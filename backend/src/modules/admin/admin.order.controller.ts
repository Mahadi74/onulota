/**
 * Admin order controller for managing orders.
 * 
 * Handles:
 * - Listing all orders with filters
 * - Updating order status
 * - Sending email notifications on status change
 */

import { Request, Response, NextFunction } from 'express'
import { Order } from '../../models/Order'
import { User } from '../../models/User'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendOrderStatusChangeEmail } from '../../utils/emailService'

/**
 * GET /api/admin/orders/:id
 *
 * Get full detail for a single order (admin view).
 */
export const getOrderDetailHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params
  const order = await Order.findById(id).populate('user', 'name email phone')
  if (!order) {
    return res.status(404).json({ error: 'Not Found', message: 'Order not found' })
  }
  res.json(order)
})

/**
 * GET /api/admin/orders
 * 
 * Get all orders with optional filters.
 * 
 * Query parameters:
 * - status: Filter by order status (pending, processing, shipped, delivered, cancelled)
 * - startDate: Filter by start date (ISO format)
 * - endDate: Filter by end date (ISO format)
 * - userId: Filter by user ID
 * - page: Page number (default 1)
 * - limit: Items per page (default 20)
 * 
 * Requirement 22.2: WHEN an Admin requests the order list, THE Platform SHALL return all Orders with filters for status, date range, and User
 */
export const getOrdersHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const {
    status,
    startDate,
    endDate,
    userId,
    page = 1,
    limit = 20
  } = req.query

  // Build filter
  const filter: any = {}

  if (status) {
    filter.status = status
  }

  if (startDate || endDate) {
    filter.createdAt = {}
    if (startDate) {
      filter.createdAt.$gte = new Date(startDate as string)
    }
    if (endDate) {
      filter.createdAt.$lte = new Date(endDate as string)
    }
  }

  if (userId) {
    filter.user = userId
  }

  // Get total count
  const total = await Order.countDocuments(filter)

  // Get orders with pagination
  const orders = await Order.find(filter)
    .populate('user', 'name email phone')
    .sort({ createdAt: -1 })
    .skip((parseInt(page as string) - 1) * parseInt(limit as string))
    .limit(parseInt(limit as string))

  res.json({
    orders,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / parseInt(limit as string))
    }
  })
})

/**
 * PUT /api/admin/orders/:id
 * 
 * Update order status.
 * 
 * Requirements:
 * - Valid status transition (pending → processing → shipped → delivered)
 * - Tracking number required for shipped status
 * - Send email notification on status change
 * 
 * Requirement 22.3: WHEN an Admin updates an Order_Status, THE Platform SHALL validate the status transition is valid (pending → processing → shipped → delivered)
 * Requirement 22.3: WHEN an Admin marks an Order as shipped, THE Platform SHALL require a tracking number
 * Requirement 22.10: Email notification on order status change (using nodemailer or SendGrid)
 */
export const updateOrderStatusHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { id: orderId } = req.params
  const { status, trackingNumber, note } = req.body

  // Find order
  const order = await Order.findById(orderId).populate('user', 'name email')
  if (!order) {
    return res.status(404).json({ error: 'Not Found', message: 'Order not found' })
  }

  // Validate status transition
  const validTransitions: { [key: string]: string[] } = {
    'pending': ['processing', 'cancelled'],
    'processing': ['shipped', 'cancelled'],
    'shipped': ['delivered'],
    'delivered': [],
    'cancelled': []
  }

  const allowedStatuses = validTransitions[order.status] || []
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Invalid status transition from ${order.status} to ${status}`
    })
  }

  // Require tracking number for shipped status
  if (status === 'shipped' && !trackingNumber) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Tracking number is required for shipped status'
    })
  }

  // Update order status
  const oldStatus = order.status
  order.status = status
  if (trackingNumber) {
    order.trackingNumber = trackingNumber
  }

  // Add to status history
  order.statusHistory.push({
    status: status as any,
    timestamp: new Date(),
    note: note || `Status updated to ${status}`
  })

  await order.save()

  // Send email notification
  try {
    if (order.user && 'email' in order.user) {
      await sendOrderStatusChangeEmail(
        (order.user as any).email,
        (order.user as any).name,
        order.orderNumber,
        oldStatus,
        status,
        trackingNumber
      )
    }
  } catch (error) {
    // Log error but don't fail the request
    console.error('Failed to send order status change email:', error)
  }

  res.json({
    message: 'Order status updated successfully',
    order
  })
})
