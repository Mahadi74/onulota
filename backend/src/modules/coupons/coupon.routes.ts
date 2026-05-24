import { Router } from 'express'
import { validateCouponHandler } from './coupon.controller'

const router = Router()

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
 * 
 * Public endpoint — no authentication required.
 * 
 * Requirements:
 * - Requirement 18.1: Validate coupon code
 * - Requirement 18.2: Check coupon is active
 * - Requirement 18.3: Check coupon has not expired
 * - Requirement 18.4: Check usage limit not exceeded
 * - Requirement 18.5: Check minimum order value requirement met
 * - Requirement 18.6: Calculate discount amount
 * - Requirement 18.7: Return validation result with discount details
 * - Requirement 18.8: Handle error cases appropriately
 */
router.post('/validate', validateCouponHandler)

export default router
