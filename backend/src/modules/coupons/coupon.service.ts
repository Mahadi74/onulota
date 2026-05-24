import { Coupon, ICoupon } from '../../models/Coupon'
import { logger } from '../../utils/logger'
import { Types } from 'mongoose'

export interface ValidateCouponRequest {
  code: string
  cartSubtotal: number
}

export interface ValidateCouponResponse {
  isValid: boolean
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  discountAmount: number
  message: string
}

export interface CouponValidationError {
  isValid: false
  code?: string
  message: string
}

/**
 * Validate a coupon code and calculate discount
 * 
 * Checks:
 * - Code exists in database
 * - Coupon is active (isActive: true)
 * - Coupon has not expired (expiryDate > now)
 * - Usage limit not exceeded (usageCount < usageLimit)
 * - Minimum order value requirement met (cartSubtotal >= minOrderValue)
 * 
 * @param code - Coupon code to validate
 * @param cartSubtotal - Current cart subtotal
 * @returns Validation result with discount details or error
 */
export async function validateCoupon(
  code: string,
  cartSubtotal: number
): Promise<ValidateCouponResponse | CouponValidationError> {
  try {
    // Validate input
    if (!code || typeof code !== 'string') {
      return {
        isValid: false,
        message: 'Invalid coupon code'
      }
    }

    if (typeof cartSubtotal !== 'number' || cartSubtotal < 0) {
      return {
        isValid: false,
        message: 'Invalid cart subtotal'
      }
    }

    // Find coupon by code
    const coupon = await Coupon.findByCode(code)

    if (!coupon) {
      logger.warn(`Coupon validation failed: Code not found - ${code}`)
      return {
        isValid: false,
        code,
        message: 'Invalid coupon code'
      }
    }

    // Check if coupon is active
    if (!coupon.isActive) {
      logger.warn(`Coupon validation failed: Coupon not active - ${code}`)
      return {
        isValid: false,
        code,
        message: 'Coupon is not active'
      }
    }

    // Check if coupon has expired
    if (new Date() > coupon.expiresAt) {
      logger.warn(`Coupon validation failed: Coupon expired - ${code}`)
      return {
        isValid: false,
        code,
        message: 'Coupon has expired'
      }
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      logger.warn(`Coupon validation failed: Usage limit exceeded - ${code}`)
      return {
        isValid: false,
        code,
        message: 'Coupon usage limit exceeded'
      }
    }

    // Check minimum order value
    if (coupon.minOrderValue && cartSubtotal < coupon.minOrderValue) {
      logger.warn(`Coupon validation failed: Minimum order value not met - ${code}`)
      return {
        isValid: false,
        code,
        message: `Minimum order value of ৳${coupon.minOrderValue} required`
      }
    }

    // Calculate discount amount
    const discountAmount = coupon.calculateDiscount(cartSubtotal)

    logger.info(`Coupon validated successfully - ${code}, discount: ৳${discountAmount}`)

    return {
      isValid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      message: 'Coupon applied successfully'
    }
  } catch (error) {
    logger.error('Error validating coupon:', error)
    return {
      isValid: false,
      message: 'Error validating coupon'
    }
  }
}

/**
 * Get coupon by code (for admin purposes)
 */
export async function getCouponByCode(code: string): Promise<ICoupon | null> {
  try {
    return await Coupon.findByCode(code)
  } catch (error) {
    logger.error('Error fetching coupon:', error)
    return null
  }
}

/**
 * Get all active coupons
 */
export async function getActiveCoupons(): Promise<ICoupon[]> {
  try {
    return await Coupon.findActiveCoupons()
  } catch (error) {
    logger.error('Error fetching active coupons:', error)
    return []
  }
}

/**
 * Increment coupon usage count
 */
export async function incrementCouponUsage(couponId: Types.ObjectId): Promise<ICoupon | null> {
  try {
    const coupon = await Coupon.findById(couponId)
    if (!coupon) {
      return null
    }
    return await coupon.incrementUsage()
  } catch (error) {
    logger.error('Error incrementing coupon usage:', error)
    return null
  }
}
