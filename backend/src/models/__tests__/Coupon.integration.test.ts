import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Coupon, ICoupon } from '../Coupon'

describe('Coupon Model Integration Tests', () => {
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

  describe('Database Operations', () => {
    it('should create and retrieve coupon with all fields', async () => {
      const couponData = {
        code: 'INTEGRATION20',
        discountType: 'percentage' as const,
        discountValue: 20,
        minOrderValue: 100,
        maxDiscountAmount: 50,
        usageLimit: 100,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }

      // Create coupon
      const createdCoupon = await Coupon.create(couponData)
      expect(createdCoupon._id).toBeDefined()
      expect(createdCoupon.createdAt).toBeDefined()
      expect(createdCoupon.updatedAt).toBeDefined()

      // Retrieve coupon
      const retrievedCoupon = await Coupon.findById(createdCoupon._id)
      expect(retrievedCoupon).toBeTruthy()
      expect(retrievedCoupon!.code).toBe('INTEGRATION20')
      expect(retrievedCoupon!.discountType).toBe('percentage')
      expect(retrievedCoupon!.discountValue).toBe(20)
    })

    it('should handle concurrent coupon creation with unique codes', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        Coupon.create({
          code: `CONCURRENT${i}`,
          discountType: 'percentage',
          discountValue: 10,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
      )

      const coupons = await Promise.all(promises)
      expect(coupons).toHaveLength(5)
      
      const codes = coupons.map(c => c.code)
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBe(5) // All codes should be unique
    })

    it('should enforce unique code constraint across database', async () => {
      const couponData = {
        code: 'UNIQUE_TEST',
        discountType: 'percentage' as const,
        discountValue: 10,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }

      // Create first coupon
      await Coupon.create(couponData)

      // Try to create duplicate
      await expect(Coupon.create(couponData)).rejects.toThrow()
    })

    it('should update coupon and maintain constraints', async () => {
      const coupon = await Coupon.create({
        code: 'UPDATE_TEST',
        discountType: 'percentage',
        discountValue: 10,
        usageCount: 5,
        usageLimit: 100,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      })

      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))

      // Update usage count
      coupon.usageCount = 10
      const updatedCoupon = await coupon.save()
      
      expect(updatedCoupon.usageCount).toBe(10)
      expect(updatedCoupon.updatedAt.getTime()).toBeGreaterThanOrEqual(updatedCoupon.createdAt.getTime())
    })

    it('should soft delete by setting isActive to false', async () => {
      const coupon = await Coupon.create({
        code: 'SOFT_DELETE',
        discountType: 'fixed',
        discountValue: 25,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      })

      // Soft delete
      coupon.isActive = false
      await coupon.save()

      // Verify it still exists but is inactive
      const retrievedCoupon = await Coupon.findById(coupon._id)
      expect(retrievedCoupon).toBeTruthy()
      expect(retrievedCoupon!.isActive).toBe(false)

      // Verify it doesn't appear in active coupons
      const activeCoupons = await Coupon.findActiveCoupons()
      expect(activeCoupons.find(c => c._id.equals(coupon._id))).toBeUndefined()
    })
  })

  describe('Query Performance', () => {
    beforeEach(async () => {
      // Create test data
      const coupons = Array.from({ length: 100 }, (_, i) => ({
        code: `PERF${i.toString().padStart(3, '0')}`,
        discountType: i % 2 === 0 ? 'percentage' : 'fixed',
        discountValue: 10 + (i % 20),
        isActive: i % 10 !== 0, // 10% inactive
        expiresAt: i % 5 === 0 
          ? new Date(Date.now() - 24 * 60 * 60 * 1000) // 20% expired
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }))

      await Coupon.insertMany(coupons)
    })

    it('should efficiently find coupon by code', async () => {
      const startTime = Date.now()
      const coupon = await Coupon.findByCode('PERF050')
      const endTime = Date.now()

      expect(coupon).toBeTruthy()
      expect(coupon!.code).toBe('PERF050')
      expect(endTime - startTime).toBeLessThan(100) // Should be fast with index
    })

    it('should efficiently find active coupons', async () => {
      const startTime = Date.now()
      const activeCoupons = await Coupon.findActiveCoupons()
      const endTime = Date.now()

      expect(activeCoupons.length).toBeGreaterThan(0)
      expect(activeCoupons.every(c => c.isActive && c.expiresAt > new Date())).toBe(true)
      expect(endTime - startTime).toBeLessThan(100) // Should be fast with compound index
    })

    it('should efficiently find expired coupons', async () => {
      const startTime = Date.now()
      const expiredCoupons = await Coupon.findExpiredCoupons()
      const endTime = Date.now()

      expect(expiredCoupons.length).toBeGreaterThan(0)
      expect(endTime - startTime).toBeLessThan(100) // Should be fast with indexes
    })
  })

  describe('Business Logic Integration', () => {
    it('should handle realistic coupon usage scenario', async () => {
      // Create a promotional coupon
      const coupon = await Coupon.create({
        code: 'BLACKFRIDAY50',
        discountType: 'percentage',
        discountValue: 50,
        minOrderValue: 200,
        maxDiscountAmount: 100,
        usageLimit: 1000,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      })

      // Simulate multiple uses
      for (let i = 0; i < 10; i++) {
        const orderValue = 300 + (i * 50) // Varying order values
        
        // Check if coupon can be used
        const canUse = coupon.canBeUsed(orderValue)
        expect(canUse.valid).toBe(true)
        
        // Calculate discount
        const discount = coupon.calculateDiscount(orderValue)
        expect(discount).toBeLessThanOrEqual(100) // Should not exceed max discount
        expect(discount).toBeGreaterThan(0)
        
        // Increment usage
        await coupon.incrementUsage()
      }

      // Verify final state
      const finalCoupon = await Coupon.findById(coupon._id)
      expect(finalCoupon!.usageCount).toBe(10)
      expect(finalCoupon!.canBeUsed(300).valid).toBe(true) // Still usable
    })

    it('should handle coupon expiration correctly', async () => {
      // Create coupon that expires in 1 second
      const coupon = await Coupon.create({
        code: 'EXPIRES_SOON',
        discountType: 'fixed',
        discountValue: 25,
        expiresAt: new Date(Date.now() + 1000) // 1 second from now
      })

      // Should be valid initially
      expect(coupon.isValid()).toBe(true)
      expect(coupon.canBeUsed(100).valid).toBe(true)

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100))

      // Should be invalid after expiration
      const expiredCoupon = await Coupon.findById(coupon._id)
      expect(expiredCoupon!.isValid()).toBe(false)
      expect(expiredCoupon!.canBeUsed(100).valid).toBe(false)
    })

    it('should handle usage limit correctly', async () => {
      const coupon = await Coupon.create({
        code: 'LIMITED_USE',
        discountType: 'percentage',
        discountValue: 20,
        usageLimit: 3,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      })

      // Use coupon up to limit
      for (let i = 0; i < 3; i++) {
        expect(coupon.canBeUsed(100).valid).toBe(true)
        await coupon.incrementUsage()
      }

      // Should be invalid after reaching limit
      expect(coupon.canBeUsed(100).valid).toBe(false)
      expect(coupon.canBeUsed(100).reason).toBe('Coupon usage limit has been reached')
    })
  })
})