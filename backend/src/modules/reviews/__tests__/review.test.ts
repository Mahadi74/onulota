/**
 * Tests for review endpoints.
 * 
 * Tests:
 * - POST /api/products/:id/reviews - submit review
 * - GET /api/products/:id/reviews - get product reviews
 * - PUT /api/reviews/:id - update own review
 * - DELETE /api/reviews/:id - delete own review
 */

import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { createApp } from '../../../app'
import { Review } from '../../../models/Review'
import { Order } from '../../../models/Order'
import { Product } from '../../../models/Product'
import { User } from '../../../models/User'
import * as jwt from 'jsonwebtoken'
import { Types } from 'mongoose'

describe('Review Endpoints', () => {
  let app: any
  let mongoServer: MongoMemoryServer
  let userId: string
  let productId: string
  let orderId: string
  let token: string

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
    // Clear all collections
    await Review.deleteMany({})
    await Order.deleteMany({})
    await Product.deleteMany({})
    await User.deleteMany({})

    // Create test user
    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedpassword',
      role: 'user'
    })
    userId = user._id.toString()

    // Create JWT token
    token = jwt.sign(
      { id: userId, role: 'user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '15m' }
    )

    // Create test product
    const product = await Product.create({
      name: 'Test Product',
      slug: 'test-product',
      description: 'Test product description',
      price: 100,
      category: new Types.ObjectId(),
      images: [{ url: 'http://example.com/image.jpg' }],
      stock: 10
    })
    productId = product._id.toString()

    // Create delivered order with product
    const order = await Order.create({
      user: userId,
      items: [
        {
          product: productId,
          name: 'Test Product',
          price: 100,
          quantity: 1,
          subtotal: 100
        }
      ],
      shippingAddress: {
        recipientName: 'Test User',
        phone: '+8801700000000',
        street: 'Test Street',
        city: 'Dhaka',
        postalCode: '1000',
        country: 'Bangladesh'
      },
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      subtotal: 100,
      tax: 0,
      shippingCost: 0,
      discount: 0,
      total: 100,
      status: 'delivered'
    })
    orderId = order._id.toString()
  })

  describe('POST /api/products/:id/reviews', () => {
    it('should submit a review for a delivered product', async () => {
      const res = await request(app)
        .post(`/api/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          rating: 5,
          comment: 'Great product!'
        })

      expect(res.status).toBe(201)
      expect(res.body.review).toBeDefined()
      expect(res.body.review.rating).toBe(5)
      expect(res.body.review.comment).toBe('Great product!')
    })

    it('should prevent duplicate reviews', async () => {
      // Submit first review
      await request(app)
        .post(`/api/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          rating: 5,
          comment: 'Great product!'
        })

      // Try to submit second review
      const res = await request(app)
        .post(`/api/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          rating: 4,
          comment: 'Good product'
        })

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('Conflict')
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .post(`/api/products/${productId}/reviews`)
        .send({
          rating: 5,
          comment: 'Great product!'
        })

      expect(res.status).toBe(401)
    })

    it('should require delivered order', async () => {
      // Create pending order
      const pendingOrder = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            name: 'Test Product',
            price: 100,
            quantity: 1,
            subtotal: 100
          }
        ],
        shippingAddress: {
          recipientName: 'Test User',
          phone: '+8801700000000',
          street: 'Test Street',
          city: 'Dhaka',
          postalCode: '1000',
          country: 'Bangladesh'
        },
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        subtotal: 100,
        tax: 0,
        shippingCost: 0,
        discount: 0,
        total: 100,
        status: 'pending'
      })

      const res = await request(app)
        .post(`/api/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          rating: 5,
          comment: 'Great product!'
        })

      expect(res.status).toBe(403)
    })
  })

  describe('GET /api/products/:id/reviews', () => {
    beforeEach(async () => {
      // Create multiple reviews
      for (let i = 0; i < 15; i++) {
        const user = await User.create({
          name: `User ${i}`,
          email: `user${i}@example.com`,
          password: 'hashedpassword',
          role: 'user'
        })

        const order = await Order.create({
          user: user._id,
          items: [
            {
              product: productId,
              name: 'Test Product',
              price: 100,
              quantity: 1,
              subtotal: 100
            }
          ],
          shippingAddress: {
            recipientName: `User ${i}`,
            phone: '+8801700000000',
            street: 'Test Street',
            city: 'Dhaka',
            postalCode: '1000',
            country: 'Bangladesh'
          },
          paymentMethod: 'cod',
          paymentStatus: 'pending',
          subtotal: 100,
          tax: 0,
          shippingCost: 0,
          discount: 0,
          total: 100,
          status: 'delivered'
        })

        await Review.create({
          product: productId,
          user: user._id,
          order: order._id,
          rating: (i % 5) + 1,
          comment: `Review ${i}`,
          isVerifiedPurchase: true
        })
      }
    })

    it('should get paginated reviews', async () => {
      const res = await request(app)
        .get(`/api/products/${productId}/reviews`)
        .query({ page: 1, limit: 10 })

      expect(res.status).toBe(200)
      expect(res.body.reviews).toBeDefined()
      expect(res.body.reviews.length).toBe(10)
      expect(res.body.pagination.page).toBe(1)
      expect(res.body.pagination.limit).toBe(10)
      expect(res.body.pagination.total).toBe(15)
    })

    it('should return reviews sorted by newest first', async () => {
      const res = await request(app)
        .get(`/api/products/${productId}/reviews`)
        .query({ page: 1, limit: 20 })

      expect(res.status).toBe(200)
      expect(res.body.reviews.length).toBe(15)

      // Check that reviews are sorted by newest first
      for (let i = 0; i < res.body.reviews.length - 1; i++) {
        const current = new Date(res.body.reviews[i].createdAt)
        const next = new Date(res.body.reviews[i + 1].createdAt)
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime())
      }
    })
  })

  describe('PUT /api/reviews/:id', () => {
    let reviewId: string

    beforeEach(async () => {
      const review = await Review.create({
        product: productId,
        user: userId,
        order: orderId,
        rating: 3,
        comment: 'Average product',
        isVerifiedPurchase: true
      })
      reviewId = review._id.toString()
    })

    it('should update own review', async () => {
      const res = await request(app)
        .put(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          rating: 5,
          comment: 'Actually great product!'
        })

      expect(res.status).toBe(200)
      expect(res.body.review.rating).toBe(5)
      expect(res.body.review.comment).toBe('Actually great product!')
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .put(`/api/reviews/${reviewId}`)
        .send({
          rating: 5,
          comment: 'Actually great product!'
        })

      expect(res.status).toBe(401)
    })

    it('should prevent updating other users reviews', async () => {
      // Create another user
      const otherUser = await User.create({
        name: 'Other User',
        email: 'other@example.com',
        password: 'hashedpassword',
        role: 'user'
      })

      const otherToken = jwt.sign(
        { id: otherUser._id.toString(), role: 'user' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '15m' }
      )

      const res = await request(app)
        .put(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          rating: 1,
          comment: 'Bad product'
        })

      expect(res.status).toBe(403)
    })
  })

  describe('DELETE /api/reviews/:id', () => {
    let reviewId: string

    beforeEach(async () => {
      const review = await Review.create({
        product: productId,
        user: userId,
        order: orderId,
        rating: 3,
        comment: 'Average product',
        isVerifiedPurchase: true
      })
      reviewId = review._id.toString()
    })

    it('should delete own review', async () => {
      const res = await request(app)
        .delete(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)

      // Verify review is deleted
      const deletedReview = await Review.findById(reviewId)
      expect(deletedReview).toBeNull()
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .delete(`/api/reviews/${reviewId}`)

      expect(res.status).toBe(401)
    })

    it('should prevent deleting other users reviews', async () => {
      // Create another user
      const otherUser = await User.create({
        name: 'Other User',
        email: 'other@example.com',
        password: 'hashedpassword',
        role: 'user'
      })

      const otherToken = jwt.sign(
        { id: otherUser._id.toString(), role: 'user' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '15m' }
      )

      const res = await request(app)
        .delete(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${otherToken}`)

      expect(res.status).toBe(403)
    })
  })
})
