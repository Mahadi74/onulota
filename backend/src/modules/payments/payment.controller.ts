import { Request, Response, NextFunction } from 'express'
import { asyncHandler } from '../../middleware/errorHandler'
import { AppError } from '../../middleware/errorHandler'
import { AuthenticatedRequest } from '../../middleware/auth'
import {
  initSSLCommerzPayment,
  handleSSLCommerzSuccess,
  handleSSLCommerzFail,
  handleSSLCommerzCancel,
  confirmCODOrder,
  SSLCommerzCallbackRequest
} from './payment.service'

/**
 * POST /api/payments/sslcommerz/init
 * 
 * Initialize SSLCommerz payment session
 * 
 * Request Body:
 * {
 *   "orderId": "string (required)",
 *   "amount": "number (required)",
 *   "customerName": "string (required)",
 *   "customerEmail": "string (required)",
 *   "customerPhone": "string (required)"
 * }
 * 
 * Success Response (200):
 * {
 *   "status": "success",
 *   "sessionkey": "string",
 *   "redirectGatewayURL": "string"
 * }
 * 
 * Error Responses:
 * - 404: Order not found
 * - 400: Order not in pending state
 * - 403: Unauthorized (order belongs to different user)
 * - 401: Unauthorized (not authenticated)
 */
export const initSSLCommerzHandler = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest
    
    // Verify user is authenticated
    if (!authReq.user) {
      throw new AppError('Authentication required', 401)
    }

    const { orderId, amount, customerName, customerEmail, customerPhone } = authReq.body

    // Validate required fields
    if (!orderId) {
      throw new AppError('Order ID is required', 400)
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new AppError('Valid amount is required', 400)
    }

    if (!customerName || !customerEmail || !customerPhone) {
      throw new AppError('Customer name, email, and phone are required', 400)
    }

    // Initialize payment
    const result = await initSSLCommerzPayment({
      orderId,
      userId: authReq.user.userId,
      amount,
      customerName,
      customerEmail,
      customerPhone
    })

    res.status(200).json(result)
  }
) as any

/**
 * POST /api/payments/sslcommerz/success
 * 
 * Handle SSLCommerz payment success callback
 * 
 * This is called by SSLCommerz gateway after successful payment
 * 
 * Request Body: SSLCommerz IPN callback data
 * 
 * Success Response (200):
 * {
 *   "status": "success",
 *   "message": "Payment processed successfully",
 *   "orderId": "string"
 * }
 * 
 * Error Responses:
 * - 404: Order not found
 * - 400: Invalid payment status
 */
export const handleSSLCommerzSuccessHandler = asyncHandler(
  async (req: any, res: Response, next: NextFunction) => {
    const callback = req.body as SSLCommerzCallbackRequest

    // Validate required callback fields
    if (!callback || !callback.tran_id || !callback.val_id || !callback.status) {
      throw new AppError('Invalid callback data from payment gateway', 400)
    }

    // Handle success
    const result = await handleSSLCommerzSuccess(callback)

    res.status(200).json(result)
  }
)

/**
 * POST /api/payments/sslcommerz/fail
 * 
 * Handle SSLCommerz payment failure callback
 * 
 * This is called by SSLCommerz gateway after failed payment
 * 
 * Request Body: SSLCommerz IPN callback data
 * 
 * Success Response (200):
 * {
 *   "status": "failed",
 *   "message": "Payment failed. Cart has been restored.",
 *   "orderId": "string"
 * }
 * 
 * Error Responses:
 * - 404: Order not found
 */
export const handleSSLCommerzFailHandler = asyncHandler(
  async (req: any, res: Response, next: NextFunction) => {
    const callback = req.body as SSLCommerzCallbackRequest

    // Validate required callback fields
    if (!callback || !callback.tran_id) {
      throw new AppError('Invalid callback data from payment gateway', 400)
    }

    // Handle failure
    const result = await handleSSLCommerzFail(callback)

    res.status(200).json(result)
  }
)

/**
 * POST /api/payments/sslcommerz/cancel
 * 
 * Handle SSLCommerz payment cancellation callback
 * 
 * This is called by SSLCommerz gateway when user cancels payment
 * 
 * Request Body: SSLCommerz IPN callback data
 * 
 * Success Response (200):
 * {
 *   "status": "cancelled",
 *   "message": "Payment cancelled. Cart has been restored.",
 *   "orderId": "string"
 * }
 * 
 * Error Responses:
 * - 404: Order not found
 */
export const handleSSLCommerzCancelHandler = asyncHandler(
  async (req: any, res: Response, next: NextFunction) => {
    const callback = req.body as SSLCommerzCallbackRequest

    // Validate required callback fields
    if (!callback || !callback.tran_id) {
      throw new AppError('Invalid callback data from payment gateway', 400)
    }

    // Handle cancellation
    const result = await handleSSLCommerzCancel(callback)

    res.status(200).json(result)
  }
)

/**
 * POST /api/payments/cod/confirm
 * 
 * Confirm COD (Cash on Delivery) order
 * 
 * Request Body:
 * {
 *   "orderId": "string (required)"
 * }
 * 
 * Success Response (200):
 * {
 *   "status": "success",
 *   "message": "COD order confirmed",
 *   "orderId": "string"
 * }
 * 
 * Error Responses:
 * - 404: Order not found
 * - 400: Order not in pending state
 * - 400: Order payment method is not COD
 * - 401: Unauthorized (not authenticated)
 */
export const confirmCODOrderHandler = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest
    
    // Verify user is authenticated
    if (!authReq.user) {
      throw new AppError('Authentication required', 401)
    }

    const { orderId } = authReq.body

    if (!orderId) {
      throw new AppError('Order ID is required', 400)
    }

    // Confirm COD order
    const result = await confirmCODOrder(orderId)

    res.status(200).json(result)
  }
) as any
