import { Request, Response, NextFunction } from 'express'
import { asyncHandler } from '../../middleware/errorHandler'
import { AppError } from '../../middleware/errorHandler'
import { AuthenticatedRequest } from '../../middleware/auth'
import {
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  updateOrderStatus
} from './order.service'

/**
 * POST /api/orders
 * 
 * Create a new order from user's cart
 * 
 * Request Body:
 * {
 *   "shippingAddress": {
 *     "recipientName": "string (required)",
 *     "phone": "string (required, E.164 format)",
 *     "street": "string (required)",
 *     "city": "string (required)",
 *     "postalCode": "string (required, 4 digits)",
 *     "country": "string (optional, default: Bangladesh)"
 *   },
 *   "paymentMethod": "cod" | "sslcommerz" | "bkash" | "nagad" (required),
 *   "couponCode": "string (optional)"
 * }
 * 
 * Success Response (201):
 * {
 *   "_id": "string",
 *   "orderNumber": "ORD-YYYYMMDD-XXXXX",
 *   "user": "string",
 *   "items": [...],
 *   "shippingAddress": {...},
 *   "paymentMethod": "string",
 *   "paymentStatus": "pending",
 *   "subtotal": number,
 *   "tax": number,
 *   "shippingCost": number,
 *   "discount": number,
 *   "total": number,
 *   "coupon": {...},
 *   "status": "pending",
 *   "statusHistory": [...],
 *   "createdAt": "ISO date",
 *   "updatedAt": "ISO date"
 * }
 * 
 * Error Responses:
 * - 400: Cart is empty
 * - 400: Product not found or out of stock
 * - 400: Invalid coupon code
 * - 401: Unauthorized (not authenticated)
 */
export const createOrderHandler = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest
    
    // Verify user is authenticated
    if (!authReq.user) {
      throw new AppError('Authentication required', 401)
    }

    const { shippingAddress, paymentMethod, couponCode } = authReq.body

    // Validate required fields
    if (!shippingAddress) {
      throw new AppError('Shipping address is required', 400)
    }

    if (!paymentMethod) {
      throw new AppError('Payment method is required', 400)
    }

    const validPaymentMethods = ['cod', 'sslcommerz', 'bkash', 'nagad']
    if (!validPaymentMethods.includes(paymentMethod)) {
      throw new AppError('Invalid payment method', 400)
    }

    // Validate shipping address fields
    const { recipientName, phone, street, city, postalCode } = shippingAddress
    if (!recipientName || !phone || !street || !city || !postalCode) {
      throw new AppError('All shipping address fields are required', 400)
    }

    // Create order
    const order = await createOrder({
      userId: authReq.user.userId,
      shippingAddress,
      paymentMethod,
      couponCode
    })

    res.status(201).json(order)
  }
) as any

/**
 * GET /api/orders
 * 
 * Get user's order history (newest first, paginated)
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 10, max: 50)
 * 
 * Success Response (200):
 * {
 *   "orders": [...],
 *   "total": number,
 *   "page": number,
 *   "pages": number
 * }
 * 
 * Error Responses:
 * - 401: Unauthorized (not authenticated)
 */
export const getUserOrdersHandler = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest
    
    // Verify user is authenticated
    if (!authReq.user) {
      throw new AppError('Authentication required', 401)
    }

    const page = Math.max(1, parseInt(authReq.query.page as string) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(authReq.query.limit as string) || 10))

    const result = await getUserOrders(authReq.user.userId, page, limit)

    res.status(200).json(result)
  }
) as any

/**
 * GET /api/orders/:id
 * 
 * Get order details by ID
 * 
 * Success Response (200):
 * {
 *   "_id": "string",
 *   "orderNumber": "ORD-YYYYMMDD-XXXXX",
 *   ...
 * }
 * 
 * Error Responses:
 * - 404: Order not found
 * - 403: Unauthorized (order belongs to different user)
 * - 401: Unauthorized (not authenticated)
 */
export const getOrderByIdHandler = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest
    
    // Verify user is authenticated
    if (!authReq.user) {
      throw new AppError('Authentication required', 401)
    }

    const { id } = authReq.params

    const order = await getOrderById(id, authReq.user.userId)

    res.status(200).json(order)
  }
) as any

/**
 * PUT /api/orders/:id/cancel
 * 
 * Cancel an order (only pending/processing orders can be cancelled)
 * 
 * Success Response (200):
 * {
 *   "_id": "string",
 *   "orderNumber": "ORD-YYYYMMDD-XXXXX",
 *   "status": "cancelled",
 *   ...
 * }
 * 
 * Error Responses:
 * - 404: Order not found
 * - 400: Order cannot be cancelled (not pending/processing)
 * - 403: Unauthorized (order belongs to different user)
 * - 401: Unauthorized (not authenticated)
 */
export const cancelOrderHandler = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest
    
    // Verify user is authenticated
    if (!authReq.user) {
      throw new AppError('Authentication required', 401)
    }

    const { id } = authReq.params

    const order = await cancelOrder(id, authReq.user.userId)

    res.status(200).json(order)
  }
) as any

/**
 * PUT /api/admin/orders/:id
 * 
 * Update order status (admin only)
 * 
 * Request Body:
 * {
 *   "status": "processing" | "shipped" | "delivered" | "cancelled" (required),
 *   "trackingNumber": "string (required if status is 'shipped')",
 *   "note": "string (optional)"
 * }
 * 
 * Success Response (200):
 * {
 *   "_id": "string",
 *   "orderNumber": "ORD-YYYYMMDD-XXXXX",
 *   "status": "string",
 *   ...
 * }
 * 
 * Error Responses:
 * - 404: Order not found
 * - 400: Invalid status transition
 * - 400: Tracking number required for shipped status
 * - 403: Unauthorized (admin only)
 * - 401: Unauthorized (not authenticated)
 */
export const updateOrderStatusHandler = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest
    
    // Verify user is authenticated and is admin
    if (!authReq.user) {
      throw new AppError('Authentication required', 401)
    }

    if (authReq.user.role !== 'admin') {
      throw new AppError('Admin access required', 403)
    }

    const { id } = authReq.params
    const { status, trackingNumber, note } = authReq.body

    if (!status) {
      throw new AppError('Status is required', 400)
    }

    const order = await updateOrderStatus(id, status, trackingNumber, note)

    res.status(200).json(order)
  }
) as any
