/**
 * Admin coupon controller for managing coupons.
 * 
 * Handles:
 * - Listing coupons with usage stats
 * - Creating coupons
 * - Updating coupons
 * - Deactivating coupons
 */

import { Request, Response, NextFunction } from 'express'
import { Coupon } from '../../models/Coupon'
import { asyncHandler } from '../../utils/asyncHandler'

/**
 * GET /api/admin/coupons
 * 
 * Get all coupons with usage statistics.
 * 
 * Query parameters:
 * - page: Page number (default 1)
 * - limit: Items per page (default 20)
 * 
 * Requirement 22.6: THE Platform SHALL display Coupon usage statistics including total uses and total discount amount applied
 */
export const getCouponsHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { page = 1, limit = 20 } = req.query

  // Get total count
  const total = await Coupon.countDocuments()

  // Get coupons with pagination
  const coupons = await Coupon.find()
    .sort({ createdAt: -1 })
    .skip((parseInt(page as string) - 1) * parseInt(limit as string))
    .limit(parseInt(limit as string))

  res.json({
    coupons,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / parseInt(limit as string))
    }
  })
})

/**
 * POST /api/admin/coupons
 * 
 * Create a new coupon.
 * 
 * Request body:
 * - code: Unique coupon code (required)
 * - discountType: 'percentage' or 'fixed' (required)
 * - discountValue: Discount amount (required)
 * - minOrderValue: Minimum order value (optional)
 * - maxDiscountAmount: Maximum discount for percentage coupons (optional)
 * - usageLimit: Total usage limit (optional)
 * - expiresAt: Expiration date (required)
 * 
 * Requirement 22.7: WHEN an Admin creates a Coupon, THE Platform SHALL require a unique code, discount type (percentage or fixed amount), discount value, and expiration date
 * Requirement 22.7: WHEN an Admin creates a Coupon, THE Platform SHALL allow optional fields: minimum order value, maximum discount amount, and usage limit
 */
export const createCouponHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const {
    code,
    discountType,
    discountValue,
    minOrderValue,
    maxDiscountAmount,
    usageLimit,
    expiresAt
  } = req.body

  // Check if code already exists
  const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() })
  if (existingCoupon) {
    return res.status(409).json({
      error: 'Conflict',
      message: 'Coupon code already exists'
    })
  }

  // Create coupon
  const coupon = new Coupon({
    code: code.toUpperCase(),
    discountType,
    discountValue,
    minOrderValue,
    maxDiscountAmount,
    usageLimit,
    expiresAt: new Date(expiresAt),
    isActive: true
  })

  await coupon.save()

  res.status(201).json({
    message: 'Coupon created successfully',
    coupon
  })
})

/**
 * PUT /api/admin/coupons/:id
 * 
 * Update a coupon.
 * 
 * Request body (all optional):
 * - code: Coupon code
 * - discountType: 'percentage' or 'fixed'
 * - discountValue: Discount amount
 * - minOrderValue: Minimum order value
 * - maxDiscountAmount: Maximum discount for percentage coupons
 * - usageLimit: Total usage limit
 * - expiresAt: Expiration date
 * - isActive: Active status
 * 
 * Requirement 22.8: WHEN an Admin updates a Coupon, THE Platform SHALL validate the code remains unique
 */
export const updateCouponHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { id: couponId } = req.params
  const {
    code,
    discountType,
    discountValue,
    minOrderValue,
    maxDiscountAmount,
    usageLimit,
    expiresAt,
    isActive
  } = req.body

  // Find coupon
  const coupon = await Coupon.findById(couponId)
  if (!coupon) {
    return res.status(404).json({ error: 'Not Found', message: 'Coupon not found' })
  }

  // Check if new code already exists (if code is being changed)
  if (code && code.toUpperCase() !== coupon.code) {
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() })
    if (existingCoupon) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Coupon code already exists'
      })
    }
    coupon.code = code.toUpperCase()
  }

  // Update fields
  if (discountType !== undefined) coupon.discountType = discountType
  if (discountValue !== undefined) coupon.discountValue = discountValue
  if (minOrderValue !== undefined) coupon.minOrderValue = minOrderValue
  if (maxDiscountAmount !== undefined) coupon.maxDiscountAmount = maxDiscountAmount
  if (usageLimit !== undefined) coupon.usageLimit = usageLimit
  if (expiresAt !== undefined) coupon.expiresAt = new Date(expiresAt)
  if (isActive !== undefined) coupon.isActive = isActive

  await coupon.save()

  res.json({
    message: 'Coupon updated successfully',
    coupon
  })
})

/**
 * DELETE /api/admin/coupons/:id
 * 
 * Deactivate a coupon.
 * 
 * Requirement 22.9: WHEN an Admin deactivates a Coupon, THE Platform SHALL prevent Users from applying it to new Orders
 */
export const deleteCouponHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { id: couponId } = req.params

  // Find coupon
  const coupon = await Coupon.findById(couponId)
  if (!coupon) {
    return res.status(404).json({ error: 'Not Found', message: 'Coupon not found' })
  }

  // Deactivate coupon (soft delete)
  coupon.isActive = false
  await coupon.save()

  res.json({
    message: 'Coupon deactivated successfully',
    coupon
  })
})
