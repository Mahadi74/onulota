import { Request, Response, NextFunction } from 'express'
import { asyncHandler } from '../../middleware/errorHandler'
import { AuthenticatedRequest } from '../../middleware/auth'
import { getUserCart, getGuestCart, addItemToCart, updateCartItemQuantity, removeItemFromCart, clearCart, mergeGuestCartWithUserCart } from './cart.service'
import { AppError } from '../../middleware/errorHandler'

/**
 * GET /api/cart
 * Get user's cart with calculated subtotal, tax, shipping, and total
 * 
 * For authenticated users: returns user's cart from database
 * For guests: returns cart based on sessionId from query params
 */
export const getCart = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const authReq = req as AuthenticatedRequest
  
  // Check if user is authenticated
  if (authReq.user) {
    // Authenticated user - get their cart
    const cart = await getUserCart(authReq.user.userId)
    return res.status(200).json(cart)
  }
  
  // Guest user - get cart by session ID
  const sessionId = req.query.sessionId as string
  
  if (!sessionId) {
    // Return empty cart for guest without session
    return res.status(200).json({
      _id: null,
      items: [],
      subtotal: 0,
      tax: 0,
      shippingCost: 0,
      total: 0,
      totalItems: 0
    })
  }
  
  const cart = await getGuestCart(sessionId)
  res.status(200).json(cart)
})

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
 * For authenticated users: adds to user's cart
 * For guests: adds to guest cart (requires sessionId)
 */
export const addItem = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const authReq = req as AuthenticatedRequest
  const { productId, quantity, variantId, sessionId } = req.body
  
  // Validate required fields
  if (!productId) {
    throw new AppError('Product ID is required', 400)
  }
  
  if (!quantity || quantity < 1) {
    throw new AppError('Quantity must be at least 1', 400)
  }
  
  // For guests, sessionId is required
  if (!authReq.user && !sessionId) {
    throw new AppError('Session ID is required for guest users', 400)
  }
  
  // Add item to cart
  const cart = await addItemToCart(
    authReq.user?.userId,
    productId,
    quantity,
    variantId,
    sessionId
  )
  
  res.status(201).json(cart)
})

/**
 * PUT /api/cart/items/:id
 * Update cart item quantity with stock availability verification
 * 
 * Request body:
 * {
 *   quantity: number (required, min 1),
 *   sessionId?: string (required for guests)
 * }
 * 
 * For authenticated users: updates item in user's cart
 * For guests: updates item in guest cart (requires sessionId)
 */
export const updateItem = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const authReq = req as AuthenticatedRequest
  const { id: itemId } = req.params
  const { quantity, sessionId } = req.body
  
  // Validate required fields
  if (!itemId) {
    throw new AppError('Cart item ID is required', 400)
  }
  
  if (!quantity || quantity < 1) {
    throw new AppError('Quantity must be at least 1', 400)
  }
  
  // For guests, sessionId is required
  if (!authReq.user && !sessionId) {
    throw new AppError('Session ID is required for guest users', 400)
  }
  
  // Update item quantity
  const cart = await updateCartItemQuantity(
    authReq.user?.userId,
    itemId,
    quantity,
    sessionId
  )
  
  res.status(200).json(cart)
})

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
 * For authenticated users: removes item from user's cart
 * For guests: removes item from guest cart (requires sessionId)
 */
export const removeItem = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const authReq = req as AuthenticatedRequest
  const { id: itemId } = req.params
  const { sessionId } = req.query
  
  // Validate required fields
  if (!itemId) {
    throw new AppError('Cart item ID is required', 400)
  }
  
  // For guests, sessionId is required
  if (!authReq.user && !sessionId) {
    throw new AppError('Session ID is required for guest users', 400)
  }
  
  // Remove item from cart
  const cart = await removeItemFromCart(
    authReq.user?.userId,
    itemId,
    sessionId as string | undefined
  )
  
  res.status(200).json(cart)
})

/**
 * DELETE /api/cart
 * Clear entire cart (remove all items)
 * 
 * Query parameters (for guests):
 * - sessionId: Session ID for guest cart (optional)
 * 
 * For authenticated users: clears user's cart
 * For guests: clears guest cart (requires sessionId)
 */
export const deleteCart = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const authReq = req as AuthenticatedRequest
  const { sessionId } = req.query
  
  // For guests, sessionId is required
  if (!authReq.user && !sessionId) {
    throw new AppError('Session ID is required for guest users', 400)
  }
  
  // Clear cart
  const cart = await clearCart(
    authReq.user?.userId,
    sessionId as string | undefined
  )
  
  res.status(200).json(cart)
})

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
export const mergeCart = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const authReq = req as AuthenticatedRequest
  const { sessionId } = req.body
  
  // Validate user is authenticated
  if (!authReq.user) {
    throw new AppError('Authentication required to merge cart', 401)
  }
  
  // Validate sessionId is provided
  if (!sessionId) {
    throw new AppError('Session ID is required', 400)
  }
  
  // Merge guest cart with user cart
  const cart = await mergeGuestCartWithUserCart(
    authReq.user.userId,
    sessionId
  )
  
  res.status(200).json(cart)
})
