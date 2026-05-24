/**
 * Review routes for product reviews.
 * 
 * Routes:
 * - POST /api/products/:id/reviews - Submit review
 * - GET /api/products/:id/reviews - Get product reviews
 * - PUT /api/reviews/:id - Update own review
 * - DELETE /api/reviews/:id - Delete own review
 */

import { Router } from 'express'
import Joi from 'joi'
import { authenticateToken } from '../../middleware/auth'
import { validateBody, validateParams } from '../../middleware/validate'
import {
  submitReviewHandler,
  getProductReviewsHandler,
  updateReviewHandler,
  deleteReviewHandler
} from './review.controller'

const router = Router()

/**
 * Joi validation schema for submitting a review.
 */
const submitReviewSchema = Joi.object({
  rating: Joi.number()
    .integer()
    .min(1)
    .max(5)
    .required()
    .messages({
      'any.required': 'Rating is required',
      'number.min': 'Rating must be at least 1 star',
      'number.max': 'Rating cannot exceed 5 stars'
    }),
  comment: Joi.string()
    .max(1000)
    .optional()
    .messages({
      'string.max': 'Comment cannot exceed 1000 characters'
    })
})

/**
 * Joi validation schema for updating a review.
 */
const updateReviewSchema = Joi.object({
  rating: Joi.number()
    .integer()
    .min(1)
    .max(5)
    .optional()
    .messages({
      'number.min': 'Rating must be at least 1 star',
      'number.max': 'Rating cannot exceed 5 stars'
    }),
  comment: Joi.string()
    .max(1000)
    .optional()
    .allow(null)
    .messages({
      'string.max': 'Comment cannot exceed 1000 characters'
    })
})

/**
 * Joi validation schema for product ID URL param.
 */
const productIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'id must be a valid product ID',
      'any.required': 'Product ID is required'
    })
})

/**
 * Joi validation schema for review ID URL param.
 */
const reviewIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'id must be a valid review ID',
      'any.required': 'Review ID is required'
    })
})

/**
 * POST /api/products/:id/reviews
 * 
 * Submit a review for a product.
 * 
 * Requirement 21.1: WHEN a User has received an Order containing a Product, THE Platform SHALL allow the User to submit a Review for that Product
 */
router.post(
  '/:id/reviews',
  authenticateToken as any,
  validateParams(productIdParamSchema) as any,
  validateBody(submitReviewSchema) as any,
  submitReviewHandler as any
)

/**
 * GET /api/products/:id/reviews
 * 
 * Get paginated reviews for a product.
 * 
 * Requirement 21.2: THE Platform SHALL display Reviews sorted by date (newest first) with pagination (10 reviews per page)
 */
router.get(
  '/:id/reviews',
  validateParams(productIdParamSchema) as any,
  getProductReviewsHandler as any
)

/**
 * PUT /api/reviews/:id
 * 
 * Update own review.
 * 
 * Requirement 21.3: THE Platform SHALL allow Users to edit or delete their own Reviews
 */
router.put(
  '/:id',
  authenticateToken as any,
  validateParams(reviewIdParamSchema) as any,
  validateBody(updateReviewSchema) as any,
  updateReviewHandler as any
)

/**
 * DELETE /api/reviews/:id
 * 
 * Delete own review.
 * 
 * Requirement 21.4: THE Platform SHALL allow Users to edit or delete their own Reviews
 */
router.delete(
  '/:id',
  authenticateToken as any,
  validateParams(reviewIdParamSchema) as any,
  deleteReviewHandler as any
)

export default router
