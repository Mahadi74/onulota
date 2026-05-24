/**
 * Integration tests for DELETE /api/cart
 *
 * Covers Task 17.5: DELETE /api/cart - clear entire cart
 *
 * Test scenarios:
 * - Authenticated user clearing cart
 * - Guest user clearing cart
 * - Cart not found error
 * - Clearing empty cart
 * - Clearing cart with single item
 * - Clearing cart with multiple items
 * - Clearing cart with variants
 * - Response format validation
 * - Cart state after clearing
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
  variants: Array<{ name: string; price: number; stock: number }>
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
    variants: overrides.variants ?? [],
  })
}

describe('DELETE /api/cart', () => {
  // ─── Authenticated User Tests ──────────────────────────────────────────────

  describe('Authenticated User', () => {
    it('returns 200 and clears cart for authenticated user', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item first
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      // Clear cart
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        _id: expect.any(String),
        items: [],
        subtotal: 0,
        tax: 0,
        shippingCost: 0,
        total: 0,
        totalItems: 0
      })
    })

    it('returns 200 and clears cart with multiple items', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 100, stock: 20 })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 200, stock: 20 })
      const product3 = await createProduct({ name: 'Product 3', slug: 'product-3', price: 150, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add multiple items
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product1._id.toString(),
          quantity: 2
        })

      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product2._id.toString(),
          quantity: 1
        })

      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product3._id.toString(),
          quantity: 3
        })

      // Verify cart has items
      const cartBefore = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(cartBefore.body.items).toHaveLength(3)
      expect(cartBefore.body.totalItems).toBe(6)

      // Clear cart
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        items: [],
        subtotal: 0,
        tax: 0,
        shippingCost: 0,
        total: 0,
        totalItems: 0
      })
    })

    it('returns 200 and clears cart with variants', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({
        price: 100,
        stock: 10,
        variants: [
          { name: 'Size: L, Color: Red', price: 120, stock: 8 },
          { name: 'Size: M, Color: Blue', price: 110, stock: 5 }
        ]
      })
      const token = generateAccessToken(user._id.toString())
      const variantId1 = product.variants[0]._id?.toString()
      const variantId2 = product.variants[1]._id?.toString()

      // Add items with variants
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2,
          variantId: variantId1
        })

      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 1,
          variantId: variantId2
        })

      // Clear cart
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(0)
      expect(response.body.totalItems).toBe(0)
    })

    it('returns 200 when clearing already empty cart', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const token = generateAccessToken(user._id.toString())

      // Clear empty cart
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        items: [],
        subtotal: 0,
        tax: 0,
        shippingCost: 0,
        total: 0,
        totalItems: 0
      })
    })

    it('returns 200 and clears cart with high-value items', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 5000, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add high-value item
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 3
        })

      // Clear cart
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        items: [],
        subtotal: 0,
        total: 0
      })
    })
  })

  // ─── Guest User Tests ──────────────────────────────────────────────────────

  describe('Guest User', () => {
    it('returns 200 and clears cart for guest user with sessionId', async () => {
      const product = await createProduct({ price: 100, stock: 20 })
      const sessionId = 'guest-session-123'

      // Add item first
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 2,
          sessionId
        })

      // Clear cart
      const response = await request(app)
        .delete('/api/cart')
        .query({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        items: [],
        subtotal: 0,
        tax: 0,
        shippingCost: 0,
        total: 0,
        totalItems: 0
      })
    })

    it('returns 400 when guest user does not provide sessionId', async () => {
      const response = await request(app)
        .delete('/api/cart')

      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining('Session ID')
      })
    })

    it('returns 200 and clears guest cart with multiple items', async () => {
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 100, stock: 20 })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 200, stock: 20 })
      const sessionId = 'guest-session-456'

      // Add multiple items
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product1._id.toString(),
          quantity: 1,
          sessionId
        })

      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product2._id.toString(),
          quantity: 2,
          sessionId
        })

      // Clear cart
      const response = await request(app)
        .delete('/api/cart')
        .query({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(0)
      expect(response.body.totalItems).toBe(0)
    })

    it('returns 200 when clearing already empty guest cart', async () => {
      const sessionId = 'guest-session-empty'

      // Clear empty cart
      const response = await request(app)
        .delete('/api/cart')
        .query({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        items: [],
        subtotal: 0,
        total: 0
      })
    })
  })

  // ─── Cart State Tests ──────────────────────────────────────────────────────

  describe('Cart State After Clearing', () => {
    it('verifies cart is empty after clearing by fetching', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      // Clear cart
      await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      // Fetch cart to verify it's empty
      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        items: [],
        subtotal: 0,
        tax: 0,
        shippingCost: 0,
        total: 0,
        totalItems: 0
      })
    })

    it('allows adding items to cart after clearing', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 100, stock: 20 })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 200, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product1._id.toString(),
          quantity: 1
        })

      // Clear cart
      await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      // Add new item after clearing
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product2._id.toString(),
          quantity: 1
        })

      expect(response.status).toBe(201)
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0]).toMatchObject({
        product: expect.objectContaining({
          _id: product2._id.toString()
        }),
        quantity: 1
      })
    })

    it('maintains cart ID after clearing', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Get initial cart ID
      const cartBefore = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      const cartIdBefore = cartBefore.body._id

      // Add item
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 1
        })

      // Clear cart
      const clearResponse = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(clearResponse.body._id).toBe(cartIdBefore)
    })
  })

  // ─── Response Format Tests ─────────────────────────────────────────────────

  describe('Response Format', () => {
    it('returns properly formatted empty cart response', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      // Clear cart
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id')
      expect(response.body).toHaveProperty('items')
      expect(response.body).toHaveProperty('subtotal')
      expect(response.body).toHaveProperty('tax')
      expect(response.body).toHaveProperty('shippingCost')
      expect(response.body).toHaveProperty('total')
      expect(response.body).toHaveProperty('totalItems')
      expect(Array.isArray(response.body.items)).toBe(true)
      expect(response.body.items).toHaveLength(0)
    })

    it('returns zero totals in response', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 5
        })

      // Clear cart
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.subtotal).toBe(0)
      expect(response.body.tax).toBe(0)
      expect(response.body.shippingCost).toBe(0)
      expect(response.body.total).toBe(0)
      expect(response.body.totalItems).toBe(0)
    })
  })

  // ─── Edge Cases ────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('handles clearing cart with very high quantity items', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 10, stock: 10000 })
      const token = generateAccessToken(user._id.toString())

      // Add item with high quantity
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 1000
        })

      // Clear cart
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(0)
      expect(response.body.totalItems).toBe(0)
    })

    it('handles clearing cart with decimal prices', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 99.99, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 3
        })

      // Clear cart
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.subtotal).toBe(0)
      expect(response.body.total).toBe(0)
    })

    it('handles clearing cart multiple times', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 1
        })

      // Clear cart first time
      const response1 = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response1.status).toBe(200)
      expect(response1.body.items).toHaveLength(0)

      // Clear cart second time (already empty)
      const response2 = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response2.status).toBe(200)
      expect(response2.body.items).toHaveLength(0)
    })

    it('handles clearing cart with mixed variant and non-variant items', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 100, stock: 20 })
      const product2 = await createProduct({
        name: 'Product 2',
        slug: 'product-2',
        price: 200,
        stock: 20,
        variants: [
          { name: 'Size: L', price: 220, stock: 10 }
        ]
      })
      const token = generateAccessToken(user._id.toString())
      const variantId = product2.variants[0]._id?.toString()

      // Add non-variant item
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product1._id.toString(),
          quantity: 1
        })

      // Add variant item
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product2._id.toString(),
          quantity: 1,
          variantId
        })

      // Clear cart
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(0)
      expect(response.body.totalItems).toBe(0)
    })
  })

  // ─── Calculation Tests ─────────────────────────────────────────────────────

  describe('Calculations After Clearing', () => {
    it('returns zero tax after clearing cart', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 1000, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 1
        })

      // Clear cart
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.tax).toBe(0)
    })

    it('returns zero shipping after clearing cart', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 1
        })

      // Clear cart
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.shippingCost).toBe(0)
    })
  })
})
