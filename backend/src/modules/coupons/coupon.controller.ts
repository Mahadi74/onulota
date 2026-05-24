import { Request, Response, NextFunction } from 'express'
import { asyncHandler } from '../../middleware/errorHandler'
import { validateCoupon } from './coupon.service'
import { AppError } from '../../middleware/errorHandler'

/**
 * POST /api/coupons/validate
 * 
 * Validate a coupon code and calculate discount amount
 * 
 * Request Body:
 * {
 *   "code": "string (required)",
 *   "cartSubtotal": "number (required, >= 0)"
 * }
 * 
 * Success Response (200):
 * {
 *   "isValid": true,
 *   "code": "string",
 *   "discountType": "percentage" | "fixed",
 *   "discountValue": number,
 *   "discountAmount": number,
 *   "message": "Coupon applied successfully"
 * }
 * 
 * Error Responses:
 * - 400: Invalid coupon code
 * - 400: Coupon has expired
 * - 400: Coupon usage limit exceeded
 * - 400: Cart subtotal below minimum order value
 * - 400: Coupon is not active
 */
export const validateCouponHandler = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { code, cartSubtotal } = req.body

    // Validate request body
    if (!code || typeof code !== 'string') {
      throw new AppError('Coupon code is required', 400)
    }

    if (cartSubtotal === undefined || typeof cartSubtotal !== 'number') {
      throw new AppError('Cart subtotal is required', 400)
    }

    if (cartSubtotal < 0) {
      throw new AppError('Cart subtotal must be a non-negative number', 400)
    }

    // Validate coupon
    const result = await validateCoupon(code.trim(), cartSubtotal)

    // If validation failed, return error response
    if (!result.isValid) {
      throw new AppError(result.message, 400)
    }

    // Return success response
    res.status(200).json(result)
  }
)
