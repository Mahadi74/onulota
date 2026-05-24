import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { createApp } from '../../../app'
import { Coupon } from '../../../models/Coupon'
import express from 'express'

describe('POST /api/coupons/validate - Coupon Validation Endpoint', () => {
  let app: express.Application
  let mongoServer: MongoMemoryServer

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()
    await mongoose.connect(mongoUri)
    app = createApp()
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  beforeEach(async () => {
    await Coupon.deleteMany({})
  })

  describe('Success Cases', () => {
    it('should validate a valid percentage coupon and calculate discount', async () => {
      // Create a valid percentage coupon
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const coupon = new Coupon({
        code: 'SAVE10',
        discountType: 'percentage',
        discountValue: 10,
        minOrderValue: 100,
        usageLimit: 100,
        usageCount: 0,
        expiresAt: futureDate,
        isActive: true
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'SAVE10',
          cartSubtotal: 500
        })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        isValid: true,
        code: 'SAVE10',
        discountType: 'percentage',
        discountValue: 10,
        discountAmount: 50,
        message: 'Coupon applied successfully'
      })
    })

    it('should validate a valid fixed amount coupon', async () => {
      // Create a valid fixed coupon
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const coupon = new Coupon({
        code: 'FLAT50',
        discountType: 'fixed',
        discountValue: 50,
        minOrderValue: 200,
        usageLimit: 50,
        usageCount: 0,
        expiresAt: futureDate,
        isActive: true
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'FLAT50',
          cartSubtotal: 500
        })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        isValid: true,
        code: 'FLAT50',
        discountType: 'fixed',
        discountValue: 50,
        discountAmount: 50,
        message: 'Coupon applied successfully'
      })
    })

    it('should validate coupon with case-insensitive code', async () => {
      // Create a coupon
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const coupon = new Coupon({
        code: 'SUMMER20',
        discountType: 'percentage',
        discountValue: 20,
        minOrderValue: 0,
        usageLimit: 100,
        usageCount: 0,
        expiresAt: futureDate,
        isActive: true
      })
      await coupon.save()

      // Test with lowercase
      const response1 = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'summer20',
          cartSubtotal: 1000
        })

      expect(response1.status).toBe(200)
      expect(response1.body.isValid).toBe(true)

      // Test with mixed case
      const response2 = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'SuMmEr20',
          cartSubtotal: 1000
        })

      expect(response2.status).toBe(200)
      expect(response2.body.isValid).toBe(true)
    })

    it('should apply percentage coupon with max discount limit', async () => {
      // Create a percentage coupon with max discount
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const coupon = new Coupon({
        code: 'MAXDISCOUNT',
        discountType: 'percentage',
        discountValue: 50,
        maxDiscountAmount: 100,
        minOrderValue: 0,
        usageLimit: 100,
        usageCount: 0,
        expiresAt: futureDate,
        isActive: true
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'MAXDISCOUNT',
          cartSubtotal: 500
        })

      expect(response.status).toBe(200)
      expect(response.body.isValid).toBe(true)
      // 50% of 500 = 250, but max is 100
      expect(response.body.discountAmount).toBe(100)
    })

    it('should validate coupon without minimum order value requirement', async () => {
      // Create a coupon without minOrderValue
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const coupon = new Coupon({
        code: 'NOMIN',
        discountType: 'fixed',
        discountValue: 25,
        usageLimit: 100,
        usageCount: 0,
        expiresAt: futureDate,
        isActive: true
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'NOMIN',
          cartSubtotal: 10
        })

      expect(response.status).toBe(200)
      expect(response.body.isValid).toBe(true)
      expect(response.body.discountAmount).toBe(10) // Fixed 25 but cart is only 10
    })

    it('should validate coupon without usage limit', async () => {
      // Create a coupon without usageLimit
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const coupon = new Coupon({
        code: 'UNLIMITED',
        discountType: 'percentage',
        discountValue: 15,
        minOrderValue: 0,
        usageCount: 1000,
        expiresAt: futureDate,
        isActive: true
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'UNLIMITED',
          cartSubtotal: 200
        })

      expect(response.status).toBe(200)
      expect(response.body.isValid).toBe(true)
    })
  })

  describe('Error Cases - Invalid Code', () => {
    it('should return error for non-existent coupon code', async () => {
      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'NONEXISTENT',
          cartSubtotal: 500
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Invalid coupon code')
    })

    it('should return error for empty coupon code', async () => {
      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: '',
          cartSubtotal: 500
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Coupon code is required')
    })

    it('should return error when coupon code is missing', async () => {
      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          cartSubtotal: 500
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Coupon code is required')
    })
  })

  describe('Error Cases - Inactive Coupon', () => {
    it('should return error for inactive coupon', async () => {
      // Create an inactive coupon
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const coupon = new Coupon({
        code: 'INACTIVE',
        discountType: 'percentage',
        discountValue: 10,
        minOrderValue: 0,
        usageLimit: 100,
        usageCount: 0,
        expiresAt: futureDate,
        isActive: false
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'INACTIVE',
          cartSubtotal: 500
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Coupon is not active')
    })
  })

  describe('Error Cases - Expired Coupon', () => {
    it('should return error for expired coupon', async () => {
      // Create an expired coupon
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)

      const coupon = new Coupon({
        code: 'EXPIRED',
        discountType: 'percentage',
        discountValue: 10,
        minOrderValue: 0,
        usageLimit: 100,
        usageCount: 0,
        expiresAt: pastDate,
        isActive: true
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'EXPIRED',
          cartSubtotal: 500
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Coupon has expired')
    })

    it('should return error for coupon expiring today (at midnight)', async () => {
      // Create a coupon that expires at the start of today
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const coupon = new Coupon({
        code: 'EXPIRETODAY',
        discountType: 'percentage',
        discountValue: 10,
        minOrderValue: 0,
        usageLimit: 100,
        usageCount: 0,
        expiresAt: today,
        isActive: true
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'EXPIRETODAY',
          cartSubtotal: 500
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Coupon has expired')
    })
  })

  describe('Error Cases - Usage Limit Exceeded', () => {
    it('should return error when usage limit is exceeded', async () => {
      // Create a coupon with usage limit reached
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const coupon = new Coupon({
        code: 'LIMITREACHED',
        discountType: 'percentage',
        discountValue: 10,
        minOrderValue: 0,
        usageLimit: 5,
        usageCount: 5,
        expiresAt: futureDate,
        isActive: true
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'LIMITREACHED',
          cartSubtotal: 500
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Coupon usage limit exceeded')
    })

    it('should return error when usage count equals usage limit', async () => {
      // Create a coupon where usageCount == usageLimit
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const coupon = new Coupon({
        code: 'LIMITEQUAL',
        discountType: 'percentage',
        discountValue: 10,
        minOrderValue: 0,
        usageLimit: 10,
        usageCount: 10,
        expiresAt: futureDate,
        isActive: true
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'LIMITEQUAL',
          cartSubtotal: 500
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Coupon usage limit exceeded')
    })

    it('should allow coupon when usage count is below limit', async () => {
      // Create a coupon where usageCount < usageLimit
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const coupon = new Coupon({
        code: 'LIMITOK',
        discountType: 'percentage',
        discountValue: 10,
        minOrderValue: 0,
        usageLimit: 10,
        usageCount: 9,
        expiresAt: futureDate,
        isActive: true
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'LIMITOK',
          cartSubtotal: 500
        })

      expect(response.status).toBe(200)
      expect(response.body.isValid).toBe(true)
    })
  })

  describe('Error Cases - Minimum Order Value', () => {
    it('should return error when cart subtotal is below minimum order value', async () => {
      // Create a coupon with minimum order value
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const coupon = new Coupon({
        code: 'MINORDER',
        discountType: 'percentage',
        discountValue: 10,
        minOrderValue: 500,
        usageLimit: 100,
        usageCount: 0,
        expiresAt: futureDate,
        isActive: true
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'MINORDER',
          cartSubtotal: 300
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Minimum order value')
    })

    it('should allow coupon when cart subtotal equals minimum order value', async () => {
      // Create a coupon with minimum order value
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const coupon = new Coupon({
        code: 'MINORDEREQUAL',
        discountType: 'percentage',
        discountValue: 10,
        minOrderValue: 500,
        usageLimit: 100,
        usageCount: 0,
        expiresAt: futureDate,
        isActive: true
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'MINORDEREQUAL',
          cartSubtotal: 500
        })

      expect(response.status).toBe(200)
      expect(response.body.isValid).toBe(true)
    })

    it('should allow coupon when cart subtotal exceeds minimum order value', async () => {
      // Create a coupon with minimum order value
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const coupon = new Coupon({
        code: 'MINORDEROK',
        discountType: 'percentage',
        discountValue: 10,
        minOrderValue: 500,
        usageLimit: 100,
        usageCount: 0,
        expiresAt: futureDate,
        isActive: true
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'MINORDEROK',
          cartSubtotal: 600
        })

      expect(response.status).toBe(200)
      expect(response.body.isValid).toBe(true)
      expect(response.body.discountAmount).toBe(60) // 10% of 600
    })
  })

  describe('Error Cases - Invalid Request Body', () => {
    it('should return error when cartSubtotal is missing', async () => {
      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'SAVE10'
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Cart subtotal is required')
    })

    it('should return error when cartSubtotal is negative', async () => {
      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'SAVE10',
          cartSubtotal: -100
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Cart subtotal must be a non-negative number')
    })

    it('should return error when cartSubtotal is not a number', async () => {
      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'SAVE10',
          cartSubtotal: 'invalid'
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Cart subtotal is required')
    })

    it('should accept cartSubtotal of 0', async () => {
      // Create a coupon without minimum order value
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const coupon = new Coupon({
        code: 'ZERO',
        discountType: 'fixed',
        discountValue: 10,
        usageLimit: 100,
        usageCount: 0,
        expiresAt: futureDate,
        isActive: true
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'ZERO',
          cartSubtotal: 0
        })

      expect(response.status).toBe(200)
      expect(response.body.isValid).toBe(true)
    })
  })

  describe('Edge Cases - Multiple Validation Conditions', () => {
    it('should fail on first validation error (inactive takes precedence)', async () => {
      // Create an inactive and expired coupon
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)

      const coupon = new Coupon({
        code: 'MULTIERROR',
        discountType: 'percentage',
        discountValue: 10,
        minOrderValue: 0,
        usageLimit: 100,
        usageCount: 100,
        expiresAt: pastDate,
        isActive: false
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'MULTIERROR',
          cartSubtotal: 500
        })

      expect(response.status).toBe(400)
      // Should fail on isActive check first
      expect(response.body.error).toBe('Coupon is not active')
    })

    it('should validate coupon with all conditions met', async () => {
      // Create a coupon with all conditions
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const coupon = new Coupon({
        code: 'PERFECT',
        discountType: 'percentage',
        discountValue: 15,
        minOrderValue: 100,
        maxDiscountAmount: 200,
        usageLimit: 50,
        usageCount: 10,
        expiresAt: futureDate,
        isActive: true
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'PERFECT',
          cartSubtotal: 1000
        })

      expect(response.status).toBe(200)
      expect(response.body.isValid).toBe(true)
      expect(response.body.discountType).toBe('percentage')
      expect(response.body.discountValue).toBe(15)
      // 15% of 1000 = 150, which is less than max of 200
      expect(response.body.discountAmount).toBe(150)
    })
  })

  describe('Discount Calculation Precision', () => {
    it('should round discount amount to 2 decimal places for percentage', async () => {
      // Create a coupon that will result in a decimal discount
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const coupon = new Coupon({
        code: 'DECIMAL',
        discountType: 'percentage',
        discountValue: 33,
        minOrderValue: 0,
        usageLimit: 100,
        usageCount: 0,
        expiresAt: futureDate,
        isActive: true
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'DECIMAL',
          cartSubtotal: 100
        })

      expect(response.status).toBe(200)
      expect(response.body.isValid).toBe(true)
      // 33% of 100 = 33
      expect(response.body.discountAmount).toBe(33)
    })

    it('should not allow fixed discount to exceed cart subtotal', async () => {
      // Create a fixed coupon with value greater than cart subtotal
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const coupon = new Coupon({
        code: 'FIXEDLARGE',
        discountType: 'fixed',
        discountValue: 500,
        minOrderValue: 0,
        usageLimit: 100,
        usageCount: 0,
        expiresAt: futureDate,
        isActive: true
      })
      await coupon.save()

      const response = await request(app)
        .post('/api/coupons/validate')
        .send({
          code: 'FIXEDLARGE',
          cartSubtotal: 100
        })

      expect(response.status).toBe(200)
      expect(response.body.isValid).toBe(true)
      // Discount should be capped at cart subtotal
      expect(response.body.discountAmount).toBe(100)
    })
  })
})
