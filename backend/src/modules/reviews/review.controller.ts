/**
 * Review controller for handling review-related requests.
 * 
 * Handles:
 * - Submitting reviews for products
 * - Retrieving reviews for products
 * - Updating own reviews
 * - Deleting own reviews
 */

import { Request, Response, NextFunction } from 'express'
import { Review } from '../../models/Review'
import { Order } from '../../models/Order'
import { Product } from '../../models/Product'
import { asyncHandler } from '../../utils/asyncHandler'

/**
 * POST /api/products/:id/reviews
 * 
 * Submit a review for a product.
 * 
 * Requirements:
 * - User must be authenticated
 * - User must have a delivered order containing the product
 * - User can only submit one review per product
 * - Rating must be 1-5
 * - Comment is optional (max 1000 chars)
 * 
 * Requirement 13.1: WHEN a User has received an Order containing a Product, THE Platform SHALL allow the User to submit a Review for that Product
 * Requirement 13.2: WHEN a User submits a Review, THE Platform SHALL require a star rating (1-5) and optional text comment (maximum 1000 characters)
 * Requirement 13.3: THE Platform SHALL prevent Users from submitting multiple Reviews for the same Product
 */
export const submitReviewHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { id: productId } = req.params
  const { rating, comment } = req.body
  const authReq = req as any
  const userId = authReq.user?.userId

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' })
  }

  // Check if product exists
  const product = await Product.findById(productId)
  if (!product) {
    return res.status(404).json({ error: 'Not Found', message: 'Product not found' })
  }

  // Check if user has already reviewed this product
  const existingReview = await Review.findOne({ product: productId, user: userId })
  if (existingReview) {
    return res.status(409).json({ error: 'Conflict', message: 'You have already reviewed this product' })
  }

  // Check if user has a delivered order containing this product
  const deliveredOrder = await Order.findOne({
    user: userId,
    status: 'delivered',
    'items.product': productId
  })

  if (!deliveredOrder) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only review products from delivered orders'
    })
  }

  // Create review
  const review = new Review({
    product: productId,
    user: userId,
    order: deliveredOrder._id,
    rating,
    comment: comment || undefined,
    isVerifiedPurchase: true
  })

  await review.save()

  // Populate user info for response
  await review.populate('user', 'name profileImage')

  res.status(201).json({
    message: 'Review submitted successfully',
    review
  })
})

/**
 * GET /api/products/:id/reviews
 * 
 * Get paginated reviews for a product.
 * 
 * Query parameters:
 * - page: Page number (default 1)
 * - limit: Items per page (default 10)
 * 
 * Returns reviews sorted by newest first.
 * 
 * Requirement 13.6: THE Platform SHALL display Reviews sorted by date (newest first) with pagination (10 reviews per page)
 */
export const getProductReviewsHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { id: productId } = req.params
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 10

  // Check if product exists
  const product = await Product.findById(productId)
  if (!product) {
    return res.status(404).json({ error: 'Not Found', message: 'Product not found' })
  }

  // Get total count
  const total = await Review.countDocuments({ product: productId })

  // Get reviews with pagination
  const reviews = await Review.findByProduct(productId, {
    page,
    limit,
    sortBy: 'createdAt',
    sortOrder: -1
  })

  res.json({
    reviews,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  })
})

/**
 * PUT /api/reviews/:id
 * 
 * Update own review.
 * 
 * Requirements:
 * - User must be authenticated
 * - User can only update their own review
 * - Can update rating and/or comment
 * 
 * Requirement 13.7: THE Platform SHALL allow Users to edit or delete their own Reviews
 */
export const updateReviewHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { id: reviewId } = req.params
  const { rating, comment } = req.body
  const authReq = req as any
  const userId = authReq.user?.userId

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' })
  }

  // Find review
  const review = await Review.findById(reviewId)
  if (!review) {
    return res.status(404).json({ error: 'Not Found', message: 'Review not found' })
  }

  // Check ownership
  if (review.user.toString() !== userId) {
    return res.status(403).json({ error: 'Forbidden', message: 'You can only update your own reviews' })
  }

  // Update fields
  if (rating !== undefined) {
    review.rating = rating
  }
  if (comment !== undefined) {
    review.comment = comment || undefined
  }

  await review.save()

  // Populate user info for response
  await review.populate('user', 'name profileImage')

  res.json({
    message: 'Review updated successfully',
    review
  })
})

/**
 * DELETE /api/reviews/:id
 * 
 * Delete own review.
 * 
 * Requirements:
 * - User must be authenticated
 * - User can only delete their own review
 * 
 * Requirement 13.7: THE Platform SHALL allow Users to edit or delete their own Reviews
 */
export const deleteReviewHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { id: reviewId } = req.params
  const authReq = req as any
  const userId = authReq.user?.userId

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' })
  }

  // Find review
  const review = await Review.findById(reviewId)
  if (!review) {
    return res.status(404).json({ error: 'Not Found', message: 'Review not found' })
  }

  // Check ownership
  if (review.user.toString() !== userId) {
    return res.status(403).json({ error: 'Forbidden', message: 'You can only delete your own reviews' })
  }

  // Delete review (this will trigger pre-delete middleware to update product rating)
  await review.deleteOne()

  res.json({
    message: 'Review deleted successfully'
  })
})
