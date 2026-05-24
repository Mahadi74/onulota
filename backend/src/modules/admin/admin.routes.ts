/**
 * Admin routes for dashboard and management endpoints.
 * 
 * All routes require admin authentication.
 */

import { Router } from 'express'
import Joi from 'joi'
import { authenticateToken, requireRole } from '../../middleware/auth'
import { validateBody, validateParams } from '../../middleware/validate'
import { getDashboardHandler } from './admin.dashboard.controller'
import { getOrdersHandler, getOrderDetailHandler, updateOrderStatusHandler } from './admin.order.controller'
import { getUsersHandler, updateUserStatusHandler } from './admin.user.controller'
import { getCouponsHandler, createCouponHandler, updateCouponHandler, deleteCouponHandler } from './admin.coupon.controller'

const router = Router()

const auth = authenticateToken as any
const adminOnly = requireRole('admin') as any

/**
 * Joi validation schema for order status update.
 */
const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'processing', 'shipped', 'delivered', 'cancelled')
    .required()
    .messages({
      'any.required': 'Status is required',
      'any.only': 'Invalid status value'
    }),
  trackingNumber: Joi.string()
    .optional()
    .messages({
      'string.empty': 'Tracking number cannot be empty'
    }),
  note: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Note cannot exceed 500 characters'
    })
})

/**
 * Joi validation schema for order ID URL param.
 */
const orderIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'id must be a valid order ID',
      'any.required': 'Order ID is required'
    })
})

/**
 * Joi validation schema for user status update.
 */
const updateUserStatusSchema = Joi.object({
  isActive: Joi.boolean()
    .required()
    .messages({
      'any.required': 'isActive is required'
    })
})

/**
 * Joi validation schema for user ID URL param.
 */
const userIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'id must be a valid user ID',
      'any.required': 'User ID is required'
    })
})

/**
 * Joi validation schema for creating a coupon.
 */
const createCouponSchema = Joi.object({
  code: Joi.string()
    .min(3)
    .max(50)
    .required()
    .messages({
      'any.required': 'Coupon code is required',
      'string.min': 'Coupon code must be at least 3 characters',
      'string.max': 'Coupon code must not exceed 50 characters'
    }),
  discountType: Joi.string()
    .valid('percentage', 'fixed')
    .required()
    .messages({
      'any.required': 'Discount type is required',
      'any.only': 'Discount type must be either "percentage" or "fixed"'
    }),
  discountValue: Joi.number()
    .min(0)
    .required()
    .messages({
      'any.required': 'Discount value is required',
      'number.min': 'Discount value must be at least 0'
    }),
  minOrderValue: Joi.number()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Minimum order value must be at least 0'
    }),
  maxDiscountAmount: Joi.number()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Maximum discount amount must be at least 0'
    }),
  usageLimit: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      'number.min': 'Usage limit must be at least 1'
    }),
  expiresAt: Joi.date()
    .required()
    .messages({
      'any.required': 'Expiration date is required',
      'date.base': 'Expiration date must be a valid date'
    })
})

/**
 * Joi validation schema for updating a coupon.
 */
const updateCouponSchema = Joi.object({
  code: Joi.string()
    .min(3)
    .max(50)
    .optional()
    .messages({
      'string.min': 'Coupon code must be at least 3 characters',
      'string.max': 'Coupon code must not exceed 50 characters'
    }),
  discountType: Joi.string()
    .valid('percentage', 'fixed')
    .optional()
    .messages({
      'any.only': 'Discount type must be either "percentage" or "fixed"'
    }),
  discountValue: Joi.number()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Discount value must be at least 0'
    }),
  minOrderValue: Joi.number()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Minimum order value must be at least 0'
    }),
  maxDiscountAmount: Joi.number()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Maximum discount amount must be at least 0'
    }),
  usageLimit: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      'number.min': 'Usage limit must be at least 1'
    }),
  expiresAt: Joi.date()
    .optional()
    .messages({
      'date.base': 'Expiration date must be a valid date'
    }),
  isActive: Joi.boolean()
    .optional()
})

/**
 * Joi validation schema for coupon ID URL param.
 */
const couponIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'id must be a valid coupon ID',
      'any.required': 'Coupon ID is required'
    })
})

/**
 * GET /api/admin/dashboard
 * 
 * Get dashboard metrics.
 * 
 * Requirement 22.1: WHEN an Admin accesses the dashboard, THE Platform SHALL display monthly revenue, orders by status, user count, top 10 products, 30-day sales trend
 */
router.get(
  '/dashboard',
  auth,
  adminOnly,
  getDashboardHandler as any
)

/**
 * GET /api/admin/orders
 * 
 * Get all orders with filters.
 * 
 * Requirement 22.2: WHEN an Admin requests the order list, THE Platform SHALL return all Orders with filters for status, date range, and User
 */
router.get(
  '/orders',
  auth,
  adminOnly,
  getOrdersHandler as any
)

/**
 * GET /api/admin/orders/:id
 *
 * Get full detail of a single order.
 */
router.get(
  '/orders/:id',
  auth,
  adminOnly,
  validateParams(orderIdParamSchema) as any,
  getOrderDetailHandler as any
)

/**
 * PUT /api/admin/orders/:id
 *
 * Update order status.
 *
 * Requirement 22.3: WHEN an Admin updates an Order_Status, THE Platform SHALL validate the status transition is valid
 */
router.put(
  '/orders/:id',
  auth,
  adminOnly,
  validateParams(orderIdParamSchema) as any,
  validateBody(updateOrderStatusSchema) as any,
  updateOrderStatusHandler as any
)

/**
 * GET /api/admin/users
 * 
 * Get paginated user list with search.
 * 
 * Requirement 22.4: WHEN an Admin requests the user list, THE Platform SHALL return all Users with pagination and search by name or email
 */
router.get(
  '/users',
  auth,
  adminOnly,
  getUsersHandler as any
)

/**
 * PUT /api/admin/users/:id
 * 
 * Activate or deactivate user account.
 * 
 * Requirement 22.5: WHEN an Admin deactivates a User account, THE Platform SHALL prevent the User from logging in
 */
router.put(
  '/users/:id',
  auth,
  adminOnly,
  validateParams(userIdParamSchema) as any,
  validateBody(updateUserStatusSchema) as any,
  updateUserStatusHandler as any
)

/**
 * GET /api/admin/coupons
 * 
 * Get all coupons with usage statistics.
 * 
 * Requirement 22.6: THE Platform SHALL display Coupon usage statistics including total uses and total discount amount applied
 */
router.get(
  '/coupons',
  auth,
  adminOnly,
  getCouponsHandler as any
)

/**
 * POST /api/admin/coupons
 * 
 * Create a new coupon.
 * 
 * Requirement 22.7: WHEN an Admin creates a Coupon, THE Platform SHALL require a unique code, discount type, discount value, and expiration date
 */
router.post(
  '/coupons',
  auth,
  adminOnly,
  validateBody(createCouponSchema) as any,
  createCouponHandler as any
)

/**
 * PUT /api/admin/coupons/:id
 * 
 * Update a coupon.
 * 
 * Requirement 22.8: WHEN an Admin updates a Coupon, THE Platform SHALL validate the code remains unique
 */
router.put(
  '/coupons/:id',
  auth,
  adminOnly,
  validateParams(couponIdParamSchema) as any,
  validateBody(updateCouponSchema) as any,
  updateCouponHandler as any
)

/**
 * DELETE /api/admin/coupons/:id
 * 
 * Deactivate a coupon.
 * 
 * Requirement 22.9: WHEN an Admin deactivates a Coupon, THE Platform SHALL prevent Users from applying it to new Orders
 */
router.delete(
  '/coupons/:id',
  auth,
  adminOnly,
  validateParams(couponIdParamSchema) as any,
  deleteCouponHandler as any
)

export default router
