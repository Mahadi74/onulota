import { Router } from 'express'
import express from 'express'
import { optionalAuth, authenticateToken } from '../../middleware/auth'
import { getCart, addItem, updateItem, removeItem, deleteCart, mergeCart } from './cart.controller'
import { validateBody } from '../../middleware/validate'
import Joi from 'joi'

const router = Router()

// Optional authentication - works for both authenticated and guest users
const auth = optionalAuth as express.RequestHandler
const authRequired = authenticateToken as express.RequestHandler

/**
 * GET /api/cart
 * Get user's cart with calculated subtotal, tax, shipping, and total
 * 
 * Query parameters (for guests):
 * - sessionId: Session ID for guest cart (optional)
 * 
 * Response:
 * {
 *   _id: string,
 *   items: [
 *     {
 *       _id: string,
 *       product: { _id, name, price, stock },
 *       quantity: number,
 *       price: number,
 *       subtotal: number
 *     }
 *   ],
 *   subtotal: number,
 *   tax: number,
 *   shippingCost: number,
 *   total: number,
 *   totalItems: number
 * }
 */
router.get('/', auth, getCart as express.RequestHandler)

/**
 * POST /api/cart/items
 * Add item to cart with stock availability verification
 * 
 * Request body:
 * {
 *   productId: string (required),
 *   quantity: number (required, min 1),
 *   variantId?: string (optional),
 *   sessionId?: string (required for guests)
 * }
 * 
 * Response: Cart object with updated items and calculations
 */
const addItemSchema = Joi.object({
  productId: Joi.string().required().messages({
    'string.empty': 'Product ID is required',
    'any.required': 'Product ID is required'
  }),
  quantity: Joi.number().integer().min(1).required().messages({
    'number.min': 'Quantity must be at least 1',
    'any.required': 'Quantity is required'
  }),
  variantId: Joi.string().optional(),
  sessionId: Joi.string().optional()
})

router.post(
  '/items',
  auth,
  validateBody(addItemSchema),
  addItem as express.RequestHandler
)

/**
 * PUT /api/cart/items/:id
 * Update cart item quantity with stock availability verification
 * 
 * URL parameters:
 * - id: Cart item ID (required)
 * 
 * Request body:
 * {
 *   quantity: number (required, min 1),
 *   sessionId?: string (required for guests)
 * }
 * 
 * Response: Cart object with updated items and calculations
 */
const updateItemSchema = Joi.object({
  quantity: Joi.number().integer().min(1).required().messages({
    'number.min': 'Quantity must be at least 1',
    'any.required': 'Quantity is required'
  }),
  sessionId: Joi.string().optional()
})

router.put(
  '/items/:id',
  auth,
  validateBody(updateItemSchema),
  updateItem as express.RequestHandler
)

/**
 * DELETE /api/cart/items/:id
 * Remove item from cart
 * 
 * URL parameters:
 * - id: Cart item ID (required)
 * 
 * Query parameters (for guests):
 * - sessionId: Session ID for guest cart (optional)
 * 
 * Response: Cart object with updated items and calculations
 */
router.delete(
  '/items/:id',
  auth,
  removeItem as express.RequestHandler
)

/**
 * DELETE /api/cart
 * Clear entire cart (remove all items)
 * 
 * Query parameters (for guests):
 * - sessionId: Session ID for guest cart (optional)
 * 
 * Response: Empty cart object with zero totals
 */
router.delete(
  '/',
  auth,
  deleteCart as express.RequestHandler
)

/**
 * POST /api/cart/merge
 * Merge guest localStorage cart with authenticated user's cart
 * 
 * For items that exist in both carts, prefer the higher quantity
 * Clears guest cart after successful merge
 * 
 * Request body:
 * {
 *   sessionId: string (required) - Guest session ID
 * }
 * 
 * Response: Merged cart with recalculated totals
 */
const mergeCartSchema = Joi.object({
  sessionId: Joi.string().required().messages({
    'string.empty': 'Session ID is required',
    'any.required': 'Session ID is required'
  })
})

router.post(
  '/merge',
  authRequired,
  validateBody(mergeCartSchema),
  mergeCart as express.RequestHandler
)

export default router
