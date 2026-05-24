/**
 * Integration tests for GET /api/cart
 *
 * Covers Task 17.1: GET /api/cart - return cart with calculated subtotal, tax, shipping, total
 *
 * Test scenarios:
 * - Authenticated user with empty cart
 * - Authenticated user with items in cart
 * - Guest user with session ID
 * - Guest user without session ID
 * - Cart calculations (subtotal, tax, shipping, total)
 * - Free shipping threshold (500 BDT)
 */

// Set required env vars BEFORE importing app
process.env.JWT_SECRET = 'test-jwt-secret-for-cart-tests'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-cart-tests'
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:5000/api/auth/google/callback'

import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'
import { createApp } from '../../../app'
import { User } from '../../../models/User'
import { Product } from '../../../models/Product'
import { Cart } from '../../../models/Cart'
import { Category } from '../../../models/Category'

let mongoServer: MongoMemoryServer
const app = createApp()

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

afterEach(async () => {
  await User.deleteMany({})
  await Product.deleteMany({})
  await Cart.deleteMany({})
  await Category.deleteMany({})
})

/** Helper: create a user directly in the DB */
async function createUser(overrides: Partial<{
  name: string
  email: string
  password: string
  phone: string
  role: 'user' | 'admin'
  isActive: boolean
}> = {}) {
  const hashedPassword = await bcrypt.hash(overrides.password ?? 'Secure@123', 10)
  return User.create({
    name: overrides.name ?? 'Test User',
    email: (overrides.email ?? 'test@example.com').toLowerCase(),
    password: hashedPassword,
    phone: overrides.phone,
    role: overrides.role ?? 'user',
    isActive: overrides.isActive ?? true,
  })
}

/** Helper: generate a valid access token for a user */
function generateAccessToken(userId: string, role = 'user'): string {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  )
}

/** Helper: create a product */
async function createProduct(overrides: Partial<{
  name: string
  slug: string
  description: string
  price: number
  category: string
  stock: number
  isActive: boolean
}> = {}) {
  const category = await Category.create({
    name: `Test Category ${Date.now()}`,
    slug: `test-category-${Date.now()}`,
    level: 0,
  })

  return Product.create({
    name: overrides.name ?? 'Test Product',
    slug: overrides.slug ?? `test-product-${Date.now()}`,
    description: overrides.description ?? 'Test Description',
    price: overrides.price ?? 100,
    category: overrides.category ?? category._id,
    stock: overrides.stock ?? 10,
    isActive: overrides.isActive ?? true,
  })
}

describe('GET /api/cart', () => {
  // ─── Authenticated User Tests ──────────────────────────────────────────────

  describe('Authenticated User', () => {
    it('returns 200 with empty cart for new user', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        _id: expect.any(String),
        items: [],
        subtotal: 0,
        tax: 0,
        shippingCost: 0,
        total: 0,
        totalItems: 0,
      })
    })

    it('returns 200 with cart items and correct calculations', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100 })
      const token = generateAccessToken(user._id.toString())

      // Create cart with item
      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 2, 100)

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        _id: expect.any(String),
        items: expect.arrayContaining([
          expect.objectContaining({
            _id: expect.any(String),
            product: expect.objectContaining({
              _id: product._id.toString(),
              name: 'Test Product',
              price: 100,
              stock: 10,
            }),
            quantity: 2,
            price: 100,
            subtotal: 200,
          }),
        ]),
        subtotal: 200,
        tax: 10, // 5% of 200
        shippingCost: 50, // Standard shipping (below 500 threshold)
        total: 260, // 200 + 10 + 50
        totalItems: 2,
      })
    })

    it('returns 200 with free shipping for orders >= 500 BDT', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 250 })
      const token = generateAccessToken(user._id.toString())

      // Create cart with items totaling 500 BDT
      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 2, 250)

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        subtotal: 500,
        tax: 25, // 5% of 500
        shippingCost: 0, // Free shipping for >= 500
        total: 525, // 500 + 25 + 0
      })
    })

    it('returns 200 with multiple items in cart', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 100 })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 150 })
      const token = generateAccessToken(user._id.toString())

      // Create cart with multiple items
      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product1._id, 1, 100)
      await cart.addItem(product2._id, 2, 150)

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        items: expect.arrayContaining([
          expect.objectContaining({
            product: expect.objectContaining({ name: 'Product 1' }),
            quantity: 1,
            subtotal: 100,
          }),
          expect.objectContaining({
            product: expect.objectContaining({ name: 'Product 2' }),
            quantity: 2,
            subtotal: 300,
          }),
        ]),
        subtotal: 400,
        tax: 20, // 5% of 400
        shippingCost: 50,
        total: 470, // 400 + 20 + 50
        totalItems: 3,
      })
    })

    it('returns 200 with correct tax calculation (5%)', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 200 })
      const token = generateAccessToken(user._id.toString())

      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 1, 200)

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        subtotal: 200,
        tax: 10, // 5% of 200
        total: 260, // 200 + 10 + 50
      })
    })
  })

  // ─── Guest User Tests ──────────────────────────────────────────────────────

  describe('Guest User', () => {
    it('returns 200 with empty cart when no sessionId provided', async () => {
      const response = await request(app).get('/api/cart')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        _id: null,
        items: [],
        subtotal: 0,
        tax: 0,
        shippingCost: 0,
        total: 0,
        totalItems: 0,
      })
    })

    it('returns 200 with empty cart for new guest session', async () => {
      const response = await request(app)
        .get('/api/cart')
        .query({ sessionId: 'guest-session-123' })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        _id: expect.any(String),
        items: [],
        subtotal: 0,
        tax: 0,
        shippingCost: 0,
        total: 0,
        totalItems: 0,
      })
    })

    it('returns 200 with guest cart items and correct calculations', async () => {
      const product = await createProduct({ price: 100 })
      const sessionId = 'guest-session-456'

      // Create guest cart with item
      const cart = await Cart.createGuestCart(sessionId)
      await cart.addItem(product._id, 3, 100)

      const response = await request(app)
        .get('/api/cart')
        .query({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        _id: expect.any(String),
        items: expect.arrayContaining([
          expect.objectContaining({
            product: expect.objectContaining({
              _id: product._id.toString(),
              name: 'Test Product',
              price: 100,
            }),
            quantity: 3,
            subtotal: 300,
          }),
        ]),
        subtotal: 300,
        tax: 15, // 5% of 300
        shippingCost: 50,
        total: 365, // 300 + 15 + 50
        totalItems: 3,
      })
    })

    it('returns 200 with free shipping for guest cart >= 500 BDT', async () => {
      const product = await createProduct({ price: 300 })
      const sessionId = 'guest-session-789'

      const cart = await Cart.createGuestCart(sessionId)
      await cart.addItem(product._id, 2, 300)

      const response = await request(app)
        .get('/api/cart')
        .query({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        subtotal: 600,
        tax: 30, // 5% of 600
        shippingCost: 0, // Free shipping for >= 500
        total: 630, // 600 + 30 + 0
      })
    })
  })

  // ─── Edge Cases ────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('handles decimal prices correctly', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 99.99 })
      const token = generateAccessToken(user._id.toString())

      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 1, 99.99)

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        subtotal: 99.99,
        tax: 5, // 5% of 99.99 = 4.9995, rounded to 5
        shippingCost: 50,
        total: 154.99, // 99.99 + 5 + 50
      })
    })

    it('handles large quantities correctly', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 10, stock: 1000 })
      const token = generateAccessToken(user._id.toString())

      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 100, 10)

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        subtotal: 1000,
        tax: 50, // 5% of 1000
        shippingCost: 0, // Free shipping for >= 500
        total: 1050,
        totalItems: 100,
      })
    })

    it('returns product details in cart items', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({
        name: 'Premium Product',
        price: 500,
        stock: 5,
      })
      const token = generateAccessToken(user._id.toString())

      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 1, 500)

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items[0]).toMatchObject({
        product: {
          _id: product._id.toString(),
          name: 'Premium Product',
          price: 500,
          stock: 5,
        },
      })
    })
  })

  // ─── Authentication Tests ──────────────────────────────────────────────────

  describe('Authentication', () => {
    it('works without authentication (guest mode)', async () => {
      const response = await request(app).get('/api/cart')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('items')
      expect(response.body).toHaveProperty('subtotal')
      expect(response.body).toHaveProperty('total')
    })

    it('works with valid authentication token', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('items')
    })

    it('ignores invalid token and treats as guest', async () => {
      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', 'Bearer invalid-token')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('items')
    })
  })
})
