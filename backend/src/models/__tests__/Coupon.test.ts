import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Coupon, ICoupon } from '../Coupon'

describe('Coupon Model', () => {
  let mongoServer: MongoMemoryServer

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()
    await mongoose.connect(mongoUri)
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  beforeEach(async () => {
    await Coupon.deleteMany({})
  })

  describe('Schema Validation', () => {
    it('should create a valid percentage coupon', async () => {
      const couponData = {
        code: 'SAVE20',
        discountType: 'percentage' as const,
        discountValue: 20,
        minOrderValue: 100,
        maxDiscountAmount: 50,
        usageLimit: 100,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      }

      const coupon = new Coupon(couponData)
      const savedCoupon = await coupon.save()

      expect(savedCoupon.code).toBe('SAVE20')
      expect(savedCoupon.discountType).toBe('percentage')
      expect(savedCoupon.discountValue).toBe(20)
      expect(savedCoupon.minOrderValue).toBe(100)
      expect(savedCoupon.maxDiscountAmount).toBe(50)
      expect(savedCoupon.usageLimit).toBe(100)
      expect(savedCoupon.usageCount).toBe(0)
      expect(savedCoupon.isActive).toBe(true)
    })

    it('should create a valid fixed amount coupon', async () => {
      const couponData = {
        code: 'FLAT50',
        discountType: 'fixed' as const,
        discountValue: 50,
        minOrderValue: 200,
        usageLimit: 50,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      }

      const coupon = new Coupon(couponData)
      const savedCoupon = await coupon.save()

      expect(savedCoupon.code).toBe('FLAT50')
      expect(savedCoupon.discountType).toBe('fixed')
      expect(savedCoupon.discountValue).toBe(50)
      expect(savedCoupon.minOrderValue).toBe(200)
      expect(savedCoupon.maxDiscountAmount).toBeUndefined()
    })

    it('should require code, discountType, discountValue, and expiresAt', async () => {
      const coupon = new Coupon({})
      
      await expect(coupon.save()).rejects.toThrow()
    })

    it('should enforce unique code constraint', async () => {
      const couponData = {
        code: 'DUPLICATE',
        discountType: 'percentage' as const,
        discountValue: 10,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }

      await new Coupon(couponData).save()
      
      const duplicateCoupon = new Coupon(couponData)
      await expect(duplicateCoupon.save()).rejects.toThrow()
    })

    it('should convert code to uppercase', async () => {
      const couponData = {
        code: 'lowercase',
        discountType: 'percentage' as const,
        discountValue: 15,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }

      const coupon = new Coupon(couponData)
      const savedCoupon = await coupon.save()

      expect(savedCoupon.code).toBe('LOWERCASE')
    })

    it('should validate discount type enum', async () => {
      const couponData = {
        code: 'INVALID',
        discountType: 'invalid' as any,
        discountValue: 10,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }

      const coupon = new Coupon(couponData)
      await expect(coupon.save()).rejects.toThrow()
    })

    it('should validate minimum values', async () => {
      const couponData = {
        code: 'NEGATIVE',
        discountType: 'percentage' as const,
        discountValue: -10,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }

      const coupon = new Coupon(couponData)
      await expect(coupon.save()).rejects.toThrow()
    })
  })

  describe('Pre-save Validation', () => {
    it('should reject percentage discount over 100%', async () => {
      const couponData = {
        code: 'OVER100',
        discountType: 'percentage' as const,
        discountValue: 150,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }

      const coupon = new Coupon(couponData)
      await expect(coupon.save()).rejects.toThrow('Percentage discount cannot exceed 100%')
    })

    it('should reject maxDiscountAmount for fixed coupons', async () => {
      const couponData = {
        code: 'FIXEDMAX',
        discountType: 'fixed' as const,
        discountValue: 50,
        maxDiscountAmount: 100,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }

      const coupon = new Coupon(couponData)
      await expect(coupon.save()).rejects.toThrow('Maximum discount amount can only be set for percentage coupons')
    })

    it('should reject usage count exceeding usage limit', async () => {
      const couponData = {
        code: 'OVERLIMIT',
        discountType: 'percentage' as const,
        discountValue: 10,
        usageLimit: 5,
        usageCount: 10,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }

      const coupon = new Coupon(couponData)
      await expect(coupon.save()).rejects.toThrow('Usage count cannot exceed usage limit')
    })
  })

  describe('Instance Methods', () => {
    let activeCoupon: ICoupon
    let expiredCoupon: ICoupon
    let inactiveCoupon: ICoupon

    beforeEach(async () => {
      activeCoupon = await new Coupon({
        code: 'ACTIVE20',
        discountType: 'percentage',
        discountValue: 20,
        minOrderValue: 100,
        maxDiscountAmount: 50,
        usageLimit: 100,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }).save()

      expiredCoupon = await new Coupon({
        code: 'EXPIRED10',
        discountType: 'percentage',
        discountValue: 10,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      }).save()

      inactiveCoupon = await new Coupon({
        code: 'INACTIVE15',
        discountType: 'percentage',
        discountValue: 15,
        isActive: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }).save()
    })

    describe('isValid()', () => {
      it('should return true for active, non-expired coupon', () => {
        expect(activeCoupon.isValid()).toBe(true)
      })

      it('should return false for expired coupon', () => {
        expect(expiredCoupon.isValid()).toBe(false)
      })

      it('should return false for inactive coupon', () => {
        expect(inactiveCoupon.isValid()).toBe(false)
      })
    })

    describe('canBeUsed()', () => {
      it('should return valid for active coupon with sufficient order value', () => {
        const result = activeCoupon.canBeUsed(150)
        expect(result.valid).toBe(true)
        expect(result.reason).toBeUndefined()
      })

      it('should return invalid for inactive coupon', () => {
        const result = inactiveCoupon.canBeUsed(150)
        expect(result.valid).toBe(false)
        expect(result.reason).toBe('Coupon is not active')
      })

      it('should return invalid for expired coupon', () => {
        const result = expiredCoupon.canBeUsed(150)
        expect(result.valid).toBe(false)
        expect(result.reason).toBe('Coupon has expired')
      })

      it('should return invalid for insufficient order value', () => {
        const result = activeCoupon.canBeUsed(50)
        expect(result.valid).toBe(false)
        expect(result.reason).toBe('Minimum order value of ৳100 required')
      })

      it('should return invalid when usage limit reached', async () => {
        activeCoupon.usageCount = 100
        await activeCoupon.save()

        const result = activeCoupon.canBeUsed(150)
        expect(result.valid).toBe(false)
        expect(result.reason).toBe('Coupon usage limit has been reached')
      })
    })

    describe('calculateDiscount()', () => {
      it('should calculate percentage discount correctly', () => {
        const discount = activeCoupon.calculateDiscount(200)
        expect(discount).toBe(40) // 20% of 200
      })

      it('should apply maximum discount limit for percentage coupons', () => {
        const discount = activeCoupon.calculateDiscount(500)
        expect(discount).toBe(50) // Capped at maxDiscountAmount
      })

      it('should calculate fixed discount correctly', async () => {
        const fixedCoupon = await new Coupon({
          code: 'FIXED30',
          discountType: 'fixed',
          discountValue: 30,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }).save()

        const discount = fixedCoupon.calculateDiscount(100)
        expect(discount).toBe(30)
      })

      it('should not exceed order value for fixed discount', async () => {
        const fixedCoupon = await new Coupon({
          code: 'FIXED100',
          discountType: 'fixed',
          discountValue: 100,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }).save()

        const discount = fixedCoupon.calculateDiscount(50)
        expect(discount).toBe(50) // Limited to order value
      })

      it('should return 0 for invalid coupon', () => {
        const discount = expiredCoupon.calculateDiscount(200)
        expect(discount).toBe(0)
      })
    })

    describe('incrementUsage()', () => {
      it('should increment usage count', async () => {
        const initialCount = activeCoupon.usageCount
        await activeCoupon.incrementUsage()
        expect(activeCoupon.usageCount).toBe(initialCount + 1)
      })
    })
  })

  describe('Static Methods', () => {
    beforeEach(async () => {
      await Coupon.create([
        {
          code: 'ACTIVE1',
          discountType: 'percentage',
          discountValue: 10,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        {
          code: 'ACTIVE2',
          discountType: 'fixed',
          discountValue: 25,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        {
          code: 'EXPIRED1',
          discountType: 'percentage',
          discountValue: 15,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        },
        {
          code: 'INACTIVE1',
          discountType: 'percentage',
          discountValue: 20,
          isActive: false,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      ])
    })

    describe('findByCode()', () => {
      it('should find coupon by code (case insensitive)', async () => {
        const coupon = await Coupon.findByCode('active1')
        expect(coupon).toBeTruthy()
        expect(coupon!.code).toBe('ACTIVE1')
      })

      it('should return null for non-existent code', async () => {
        const coupon = await Coupon.findByCode('NONEXISTENT')
        expect(coupon).toBeNull()
      })
    })

    describe('findActiveCoupons()', () => {
      it('should return only active, non-expired coupons', async () => {
        const coupons = await Coupon.findActiveCoupons()
        expect(coupons).toHaveLength(2)
        expect(coupons.every(c => c.isActive && c.expiresAt > new Date())).toBe(true)
      })
    })

    describe('findExpiredCoupons()', () => {
      it('should return expired or inactive coupons', async () => {
        const coupons = await Coupon.findExpiredCoupons()
        expect(coupons).toHaveLength(2)
        expect(coupons.some(c => !c.isActive || c.expiresAt <= new Date())).toBe(true)
      })
    })
  })

  describe('Indexes', () => {
    it('should have proper indexes', async () => {
      const indexes = await Coupon.collection.getIndexes()
      
      // Check for required indexes
      expect(indexes).toHaveProperty('code_1')
      expect(indexes).toHaveProperty('isActive_1')
      expect(indexes).toHaveProperty('expiresAt_1')
      
      // Check unique constraint on code
      expect(indexes.code_1).toEqual([['code', 1]])
    })
  })
})