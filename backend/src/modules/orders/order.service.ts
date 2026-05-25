import { Types } from 'mongoose'
import { Order, IOrder } from '../../models/Order'
import { Cart } from '../../models/Cart'
import { Product } from '../../models/Product'
import { Coupon } from '../../models/Coupon'
import { AppError } from '../../middleware/errorHandler'
import { logger } from '../../utils/logger'

export interface CreateOrderRequest {
  userId: string | Types.ObjectId
  shippingAddressId?: string
  shippingAddress?: {
    recipientName: string
    phone: string
    street: string
    city: string
    postalCode: string
    country?: string
  }
  paymentMethod: 'cod' | 'sslcommerz' | 'bkash' | 'nagad'
  couponCode?: string
}

export interface OrderResponse {
  _id: string
  orderNumber: string
  user: string
  items: Array<{
    product: string
    name: string
    price: number
    quantity: number
    subtotal: number
  }>
  shippingAddress: {
    recipientName: string
    phone: string
    street: string
    city: string
    postalCode: string
    country: string
  }
  paymentMethod: string
  paymentStatus: string
  subtotal: number
  tax: number
  shippingCost: number
  discount: number
  total: number
  coupon?: {
    code: string
    discountType: string
    discountValue: number
  }
  status: string
  statusHistory: Array<{
    status: string
    timestamp: Date
    note?: string
  }>
  createdAt: Date
  updatedAt: Date
}

/**
 * Create a new order from user's cart
 * 
 * Steps:
 * 1. Validate user has items in cart
 * 2. Validate all products are in stock
 * 3. Validate shipping address
 * 4. Validate and apply coupon if provided
 * 5. Calculate totals (subtotal, tax, shipping, discount)
 * 6. Create order record with status "pending"
 * 7. Reduce product stock quantities
 * 8. Clear user's cart
 * 9. Return order details
 */
export async function createOrder(
  request: CreateOrderRequest
): Promise<OrderResponse> {
  const session = await Order.startSession()
  session.startTransaction()

  try {
    const userId = new Types.ObjectId(request.userId.toString())

    // Step 1: Get user's cart
    const cart = await Cart.findOne({ user: userId }).session(session)
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new AppError('Cart is empty', 400)
    }

    // Step 2: Populate cart items with product details
    await cart.populate('items.product')

    // Step 3: Validate all products are in stock
    const orderItems = []
    let subtotal = 0

    for (const cartItem of cart.items) {
      const product = cartItem.product as any
      
      if (!product) {
        throw new AppError('Product not found in cart', 404)
      }

      if (!product.isActive) {
        throw new AppError(`Product "${product.name}" is no longer available`, 400)
      }

      // Check stock availability
      if (product.stock < cartItem.quantity) {
        throw new AppError(
          `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${cartItem.quantity}`,
          400
        )
      }

      // Create order item with snapshot of product details
      const itemSubtotal = product.price * cartItem.quantity
      orderItems.push({
        product: product._id,
        variant: cartItem.variant,
        name: product.name,
        price: product.price,
        quantity: cartItem.quantity,
        subtotal: itemSubtotal
      })

      subtotal += itemSubtotal
    }

    // Step 4: Validate shipping address
    if (!request.shippingAddress) {
      throw new AppError('Shipping address is required', 400)
    }

    const shippingAddress = {
      recipientName: request.shippingAddress.recipientName,
      phone: request.shippingAddress.phone,
      street: request.shippingAddress.street,
      city: request.shippingAddress.city,
      postalCode: request.shippingAddress.postalCode,
      country: request.shippingAddress.country || 'Bangladesh'
    }

    // Step 5: Validate and apply coupon if provided
    let discount = 0
    let couponData = undefined

    if (request.couponCode) {
      const coupon = await Coupon.findOne({ code: request.couponCode.toUpperCase() }).session(session)
      
      if (!coupon) {
        throw new AppError('Invalid coupon code', 400)
      }

      const canUse = coupon.canBeUsed(subtotal)
      if (!canUse.valid) {
        throw new AppError(canUse.reason || 'Coupon cannot be used', 400)
      }

      discount = coupon.calculateDiscount(subtotal)
      couponData = {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      }
    }

    // Step 6: Calculate totals
    const tax = Math.round(subtotal * 0.05 * 100) / 100 // 5% tax
    const shippingCost = subtotal >= 500 ? 0 : 50 // Free shipping above 500 BDT
    const total = Math.round((subtotal + tax + shippingCost - discount) * 100) / 100

    // Step 7: Create order record
    const order = new Order({
      user: userId,
      items: orderItems,
      shippingAddress,
      paymentMethod: request.paymentMethod,
      paymentStatus: request.paymentMethod === 'cod' ? 'pending' : 'pending',
      subtotal,
      tax,
      shippingCost,
      discount,
      total,
      coupon: couponData,
      status: 'pending',
      statusHistory: [{
        status: 'pending',
        timestamp: new Date(),
        note: 'Order created'
      }]
    })

    await order.save({ session })

    // Step 8: Reduce product stock quantities
    for (const cartItem of cart.items) {
      await Product.findByIdAndUpdate(
        cartItem.product,
        { $inc: { stock: -cartItem.quantity } },
        { session }
      )
    }

    // Step 9: Increment coupon usage if applied
    if (request.couponCode) {
      const coupon = await Coupon.findOne({ code: request.couponCode.toUpperCase() }).session(session)
      if (coupon) {
        coupon.usageCount += 1
        await coupon.save({ session })
      }
    }

    // Step 10: Clear user's cart
    await Cart.deleteOne({ user: userId }).session(session)

    await session.commitTransaction()

    logger.info(`Order created successfully: ${order.orderNumber} for user ${userId}`)

    return formatOrderResponse(order)
  } catch (error) {
    await session.abortTransaction()
    logger.error('Error creating order:', error)
    throw error
  } finally {
    await session.endSession()
  }
}

/**
 * Get user's order history (newest first, paginated)
 */
export async function getUserOrders(
  userId: string | Types.ObjectId,
  page: number = 1,
  limit: number = 10
): Promise<{
  orders: OrderResponse[]
  total: number
  page: number
  pages: number
}> {
  try {
    const skip = (page - 1) * limit
    const userId_obj = new Types.ObjectId(userId.toString())

    const [orders, total] = await Promise.all([
      Order.find({ user: userId_obj })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments({ user: userId_obj })
    ])

    return {
      orders: orders.map(formatOrderResponse),
      total,
      page,
      pages: Math.ceil(total / limit)
    }
  } catch (error) {
    logger.error('Error fetching user orders:', error)
    throw error
  }
}

/**
 * Get order details by ID
 */
export async function getOrderById(
  orderId: string | Types.ObjectId,
  userId?: string | Types.ObjectId
): Promise<OrderResponse> {
  try {
    const order = await Order.findById(orderId)

    if (!order) {
      throw new AppError('Order not found', 404)
    }

    // Verify user owns this order if userId provided
    if (userId) {
      const userId_obj = new Types.ObjectId(userId.toString())
      if (!order.user.equals(userId_obj)) {
        throw new AppError('Unauthorized to access this order', 403)
      }
    }

    return formatOrderResponse(order)
  } catch (error) {
    logger.error('Error fetching order:', error)
    throw error
  }
}

/**
 * Cancel an order (only pending/processing orders can be cancelled)
 * 
 * Steps:
 * 1. Verify order exists and belongs to user
 * 2. Verify order status is pending or processing
 * 3. Restore product stock quantities
 * 4. Update order status to cancelled
 * 5. Return updated order
 */
export async function cancelOrder(
  orderId: string | Types.ObjectId,
  userId: string | Types.ObjectId
): Promise<OrderResponse> {
  const session = await Order.startSession()
  session.startTransaction()

  try {
    const orderId_obj = new Types.ObjectId(orderId.toString())
    const userId_obj = new Types.ObjectId(userId.toString())

    // Step 1: Get order
    const order = await Order.findById(orderId_obj).session(session)

    if (!order) {
      throw new AppError('Order not found', 404)
    }

    // Verify user owns this order
    if (!order.user.equals(userId_obj)) {
      throw new AppError('Unauthorized to cancel this order', 403)
    }

    // Step 2: Verify order can be cancelled
    if (!order.canBeCancelled()) {
      throw new AppError(
        `Cannot cancel order with status "${order.status}". Only pending or processing orders can be cancelled.`,
        400
      )
    }

    // Step 3: Restore product stock quantities
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } },
        { session }
      )
    }

    // Step 4: Update order status
    order.status = 'cancelled'
    order.statusHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      note: 'Order cancelled by user'
    })

    await order.save({ session })

    await session.commitTransaction()

    logger.info(`Order cancelled: ${order.orderNumber} for user ${userId_obj}`)

    return formatOrderResponse(order)
  } catch (error) {
    await session.abortTransaction()
    logger.error('Error cancelling order:', error)
    throw error
  } finally {
    await session.endSession()
  }
}

/**
 * Update order status (admin only)
 */
export async function updateOrderStatus(
  orderId: string | Types.ObjectId,
  newStatus: string,
  trackingNumber?: string,
  note?: string
): Promise<OrderResponse> {
  try {
    const order = await Order.findById(orderId)

    if (!order) {
      throw new AppError('Order not found', 404)
    }

    // Validate status transition
    const validTransitions: { [key: string]: string[] } = {
      'pending': ['processing', 'shipped', 'delivered', 'cancelled'],
      'processing': ['shipped', 'delivered', 'cancelled'],
      'shipped': ['delivered', 'cancelled'],
      'delivered': [],
      'cancelled': []
    }

    const allowedStatuses = validTransitions[order.status] || []
    if (!allowedStatuses.includes(newStatus)) {
      throw new AppError(
        `Invalid status transition from ${order.status} to ${newStatus}`,
        400
      )
    }

    // Require tracking number for shipped status
    if (newStatus === 'shipped' && !trackingNumber) {
      throw new AppError('Tracking number is required for shipped status', 400)
    }

    // Update status
    order.status = newStatus as 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
    if (trackingNumber) {
      order.trackingNumber = trackingNumber
    }

    order.statusHistory.push({
      status: newStatus as any,
      timestamp: new Date(),
      note: note || `Status updated to ${newStatus}`
    })

    await order.save()

    logger.info(`Order status updated: ${order.orderNumber} -> ${newStatus}`)

    return formatOrderResponse(order)
  } catch (error) {
    logger.error('Error updating order status:', error)
    throw error
  }
}

/**
 * Format order document for API response
 */
function formatOrderResponse(order: IOrder): OrderResponse {
  return {
    _id: order._id.toString(),
    orderNumber: order.orderNumber,
    user: order.user.toString(),
    items: order.items.map(item => ({
      product: item.product.toString(),
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.subtotal
    })),
    shippingAddress: {
      recipientName: order.shippingAddress.recipientName,
      phone: order.shippingAddress.phone,
      street: order.shippingAddress.street,
      city: order.shippingAddress.city,
      postalCode: order.shippingAddress.postalCode,
      country: order.shippingAddress.country
    },
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    tax: order.tax,
    shippingCost: order.shippingCost,
    discount: order.discount,
    total: order.total,
    coupon: order.coupon ? {
      code: order.coupon.code,
      discountType: order.coupon.discountType,
      discountValue: order.coupon.discountValue
    } : undefined,
    status: order.status,
    statusHistory: order.statusHistory.map(sh => ({
      status: sh.status,
      timestamp: sh.timestamp,
      note: sh.note
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  }
}
