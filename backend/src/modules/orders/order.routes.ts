import { Router } from 'express'
import { authenticateToken } from '../../middleware/auth'
import {
  createOrderHandler,
  getUserOrdersHandler,
  getOrderByIdHandler,
  cancelOrderHandler,
  updateOrderStatusHandler
} from './order.controller'

const router = Router()

/**
 * User order routes
 */

// POST /api/orders - Create new order
router.post('/', authenticateToken as any, createOrderHandler as any)

// GET /api/orders - Get user's order history
router.get('/', authenticateToken as any, getUserOrdersHandler as any)

// GET /api/orders/:id - Get order details
router.get('/:id', authenticateToken as any, getOrderByIdHandler as any)

// PUT /api/orders/:id/cancel - Cancel order
router.put('/:id/cancel', authenticateToken as any, cancelOrderHandler as any)

/**
 * Admin order routes
 */

// PUT /api/admin/orders/:id - Update order status (admin only)
router.put('/admin/:id', authenticateToken as any, updateOrderStatusHandler as any)

export default router
