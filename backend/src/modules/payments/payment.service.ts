import { Types } from 'mongoose'
import { Order } from '../../models/Order'
import { Cart } from '../../models/Cart'
import { Product } from '../../models/Product'
import { AppError } from '../../middleware/errorHandler'
import { logger } from '../../utils/logger'

export interface SSLCommerzInitRequest {
  orderId: string | Types.ObjectId
  userId: string | Types.ObjectId
  amount: number
  currency?: string
  customerName: string
  customerEmail: string
  customerPhone: string
}

export interface SSLCommerzInitResponse {
  status: string
  sessionkey: string
  redirectGatewayURL: string
}

export interface SSLCommerzCallbackRequest {
  tran_id: string
  val_id: string
  amount: string
  currency: string
  card_type: string
  card_no: string
  card_issuer: string
  card_brand: string
  card_issuer_country: string
  card_issuer_country_code: string
  store_amount: string
  store_currency: string
  risk_level: string
  risk_title: string
  status: string
  status_code: string
  status_reason: string
  currency_type: string
  currency_amount: string
  verify_sign: string
  verify_key: string
  risk_flag: string
}

/**
 * Initialize SSLCommerz payment session
 * 
 * This endpoint creates a payment session with SSLCommerz gateway
 * and returns a redirect URL for the user to complete payment
 */
export async function initSSLCommerzPayment(
  request: SSLCommerzInitRequest
): Promise<SSLCommerzInitResponse> {
  try {
    // Validate order exists
    const order = await Order.findById(request.orderId)
    if (!order) {
      throw new AppError('Order not found', 404)
    }

    // Verify order belongs to user
    const userId = new Types.ObjectId(request.userId.toString())
    if (!order.user.equals(userId)) {
      throw new AppError('Unauthorized to pay for this order', 403)
    }

    // Verify order is pending
    if (order.status !== 'pending') {
      throw new AppError('Order is not in pending state', 400)
    }

    // Verify payment is pending
    if (order.paymentStatus !== 'pending') {
      throw new AppError('Payment is not in pending state', 400)
    }

    // In production, this would call the actual SSLCommerz API
    // For now, we'll return a mock response
    const mockSessionKey = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const mockRedirectURL = `https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=sendJsonSessionkey&sessionkey=${mockSessionKey}`

    logger.info(`SSLCommerz payment session initialized for order ${order.orderNumber}`)

    return {
      status: 'success',
      sessionkey: mockSessionKey,
      redirectGatewayURL: mockRedirectURL
    }
  } catch (error) {
    logger.error('Error initializing SSLCommerz payment:', error)
    throw error
  }
}

/**
 * Handle SSLCommerz payment success callback
 * 
 * Steps:
 * 1. Verify IPN (Instant Payment Notification) from SSLCommerz
 * 2. Find order by transaction ID
 * 3. Update payment status to "paid"
 * 4. Update order status to "confirmed"
 * 5. Return success response
 */
export async function handleSSLCommerzSuccess(
  callback: SSLCommerzCallbackRequest
): Promise<{ status: string; message: string; orderId?: string }> {
  const session = await Order.startSession()
  session.startTransaction()

  try {
    // In production, verify the callback signature with SSLCommerz
    // For now, we'll trust the callback if status is VALID

    if (callback.status !== 'VALID') {
      throw new AppError('Invalid payment status from gateway', 400)
    }

    // Find order by transaction ID
    const order = await Order.findOne({
      paymentTransactionId: callback.tran_id
    }).session(session)

    if (!order) {
      throw new AppError('Order not found for this transaction', 404)
    }

    // Verify order is pending
    if (order.status !== 'pending') {
      throw new AppError('Order is not in pending state', 400)
    }

    // Update payment status and transaction ID
    order.paymentStatus = 'paid'
    order.paymentTransactionId = callback.tran_id

    // Update order status to confirmed
    order.status = 'processing'
    order.statusHistory.push({
      status: 'processing',
      timestamp: new Date(),
      note: 'Payment confirmed by SSLCommerz'
    })

    await order.save({ session })

    await session.commitTransaction()

    logger.info(`SSLCommerz payment success for order ${order.orderNumber}`)

    return {
      status: 'success',
      message: 'Payment processed successfully',
      orderId: order._id.toString()
    }
  } catch (error) {
    await session.abortTransaction()
    logger.error('Error handling SSLCommerz success callback:', error)
    throw error
  } finally {
    await session.endSession()
  }
}

/**
 * Handle SSLCommerz payment failure callback
 * 
 * Steps:
 * 1. Find order by transaction ID
 * 2. Update payment status to "failed"
 * 3. Restore cart items
 * 4. Restore product stock
 * 5. Return failure response
 */
export async function handleSSLCommerzFail(
  callback: SSLCommerzCallbackRequest
): Promise<{ status: string; message: string; orderId?: string }> {
  const session = await Order.startSession()
  session.startTransaction()

  try {
    // Find order by transaction ID
    const order = await Order.findOne({
      paymentTransactionId: callback.tran_id
    }).session(session)

    if (!order) {
      throw new AppError('Order not found for this transaction', 404)
    }

    // Update payment status to failed
    order.paymentStatus = 'failed'
    order.paymentTransactionId = callback.tran_id

    await order.save({ session })

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } },
        { session }
      )
    }

    // Restore cart items
    const cart = await Cart.findOne({ user: order.user }).session(session)
    if (!cart) {
      const newCart = new Cart({
        user: order.user,
        items: order.items.map(item => ({
          product: item.product,
          variant: item.variant,
          quantity: item.quantity,
          price: item.price,
          addedAt: new Date()
        })),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      })
      await newCart.save({ session })
    } else {
      // Add items back to existing cart
      for (const orderItem of order.items) {
        const existingItem = cart.items.find(
          (ci: any) => ci.product.equals(orderItem.product) &&
                (!ci.variant || !orderItem.variant || ci.variant.equals(orderItem.variant))
        )

        if (existingItem) {
          existingItem.quantity += orderItem.quantity
        } else {
          cart.items.push({
            product: orderItem.product,
            variant: orderItem.variant,
            quantity: orderItem.quantity,
            price: orderItem.price,
            addedAt: new Date()
          })
        }
      }
      await cart.save({ session })
    }

    await session.commitTransaction()

    logger.info(`SSLCommerz payment failed for order ${order.orderNumber}`)

    return {
      status: 'failed',
      message: 'Payment failed. Cart has been restored.',
      orderId: order._id.toString()
    }
  } catch (error) {
    await session.abortTransaction()
    logger.error('Error handling SSLCommerz fail callback:', error)
    throw error
  } finally {
    await session.endSession()
  }
}

/**
 * Handle SSLCommerz payment cancellation callback
 * 
 * Steps:
 * 1. Find order by transaction ID
 * 2. Update payment status to "cancelled"
 * 3. Restore cart items
 * 4. Restore product stock
 * 5. Return cancellation response
 */
export async function handleSSLCommerzCancel(
  callback: SSLCommerzCallbackRequest
): Promise<{ status: string; message: string; orderId?: string }> {
  const session = await Order.startSession()
  session.startTransaction()

  try {
    // Find order by transaction ID
    const order = await Order.findOne({
      paymentTransactionId: callback.tran_id
    }).session(session)

    if (!order) {
      throw new AppError('Order not found for this transaction', 404)
    }

    // Update payment status to cancelled
    order.paymentStatus = 'cancelled'
    order.paymentTransactionId = callback.tran_id

    await order.save({ session })

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } },
        { session }
      )
    }

    // Restore cart items
    const cart = await Cart.findOne({ user: order.user }).session(session)
    if (!cart) {
      const newCart = new Cart({
        user: order.user,
        items: order.items.map(item => ({
          product: item.product,
          variant: item.variant,
          quantity: item.quantity,
          price: item.price,
          addedAt: new Date()
        })),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      })
      await newCart.save({ session })
    } else {
      // Add items back to existing cart
      for (const orderItem of order.items) {
        const existingItem = cart.items.find(
          (ci: any) => ci.product.equals(orderItem.product) &&
                (!ci.variant || !orderItem.variant || ci.variant.equals(orderItem.variant))
        )

        if (existingItem) {
          existingItem.quantity += orderItem.quantity
        } else {
          cart.items.push({
            product: orderItem.product,
            variant: orderItem.variant,
            quantity: orderItem.quantity,
            price: orderItem.price,
            addedAt: new Date()
          })
        }
      }
      await cart.save({ session })
    }

    await session.commitTransaction()

    logger.info(`SSLCommerz payment cancelled for order ${order.orderNumber}`)

    return {
      status: 'cancelled',
      message: 'Payment cancelled. Cart has been restored.',
      orderId: order._id.toString()
    }
  } catch (error) {
    await session.abortTransaction()
    logger.error('Error handling SSLCommerz cancel callback:', error)
    throw error
  } finally {
    await session.endSession()
  }
}

/**
 * Handle COD (Cash on Delivery) order confirmation
 * 
 * Steps:
 * 1. Find order
 * 2. Set payment status to "pending"
 * 3. Set order status to "confirmed"
 * 4. Return confirmation response
 */
export async function confirmCODOrder(
  orderId: string | Types.ObjectId
): Promise<{ status: string; message: string; orderId: string }> {
  try {
    const order = await Order.findById(orderId)

    if (!order) {
      throw new AppError('Order not found', 404)
    }

    // Verify order is pending
    if (order.status !== 'pending') {
      throw new AppError('Order is not in pending state', 400)
    }

    // Verify payment method is COD
    if (order.paymentMethod !== 'cod') {
      throw new AppError('Order payment method is not COD', 400)
    }

    // Set payment status to pending (will be paid on delivery)
    order.paymentStatus = 'pending'

    // Set order status to confirmed
    order.status = 'processing'
    order.statusHistory.push({
      status: 'processing',
      timestamp: new Date(),
      note: 'COD order confirmed'
    })

    await order.save()

    logger.info(`COD order confirmed: ${order.orderNumber}`)

    return {
      status: 'success',
      message: 'COD order confirmed',
      orderId: order._id.toString()
    }
  } catch (error) {
    logger.error('Error confirming COD order:', error)
    throw error
  }
}
