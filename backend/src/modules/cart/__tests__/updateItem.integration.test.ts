/**
 * Integration tests for PUT /api/cart/items/:id
 *
 * Covers Task 17.3: PUT /api/cart/items/:id - update quantity, verify stock
 *
 * Test scenarios:
 * - Authenticated user updating item quantity
 * - Guest user updating item quantity
 * - Stock availability verification on update
 * - Insufficient stock error
 * - Cart item not found error
 * - Product not found error
 * - Inactive product error
 * - Variant stock verification
 * - Quantity validation
 * - Cart calculations after updating item
 * - Updating to exact available stock
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

describe('PUT /api/cart/items/:id', () => {
  // ─── Authenticated User Tests ──────────────────────────────────────────────

  describe('Authenticated User', () => {
    it('returns 200 and updates item quantity for authenticated user', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item first
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      const itemId = addResponse.body.items[0]._id

      // Update item quantity
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 5
        })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        _id: expect.any(String),
        items: expect.arrayContaining([
          expect.objectContaining({
            product: expect.objectContaining({
              _id: product._id.toString(),
              name: 'Test Product',
              price: 100,
              stock: 20
            }),
            quantity: 5,
            price: 100,
            subtotal: 500
          })
        ]),
        subtotal: 500,
        tax: 25,
        shippingCost: 0, // Free shipping when subtotal >= 500
        total: 525, // 500 + 25 + 0
        totalItems: 5
      })
    })

    it('returns 200 and updates quantity to 1', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item first
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 5
        })

      const itemId = addResponse.body.items[0]._id

      // Update item quantity to 1
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 1
        })

      expect(response.status).toBe(200)
      expect(response.body.items[0]).toMatchObject({
        quantity: 1,
        subtotal: 100
      })
    })

    it('returns 200 and updates quantity to exact available stock', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      // Add item first
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      const itemId = addResponse.body.items[0]._id

      // Update item quantity to exact stock
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 10
        })

      expect(response.status).toBe(200)
      expect(response.body.items[0]).toMatchObject({
        quantity: 10
      })
    })

    it('returns 200 and updates quantity with variant', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({
        price: 100,
        stock: 10,
        variants: [
          { name: 'Size: L, Color: Red', price: 120, stock: 8 }
        ]
      })
      const token = generateAccessToken(user._id.toString())
      const variantId = product.variants[0]._id?.toString()

      // Add item with variant
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2,
          variantId
        })

      const itemId = addResponse.body.items[0]._id

      // Update item quantity
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 5
        })

      expect(response.status).toBe(200)
      expect(response.body.items[0]).toMatchObject({
        quantity: 5,
        subtotal: 500
      })
    })
  })

  // ─── Guest User Tests ──────────────────────────────────────────────────────

  describe('Guest User', () => {
    it('returns 200 and updates item quantity for guest user with sessionId', async () => {
      const product = await createProduct({ price: 100, stock: 20 })
      const sessionId = 'guest-session-123'

      // Add item first
      const addResponse = await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 2,
          sessionId
        })

      const itemId = addResponse.body.items[0]._id

      // Update item quantity
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .send({
          quantity: 5,
          sessionId
        })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        items: expect.arrayContaining([
          expect.objectContaining({
            quantity: 5,
            subtotal: 500
          })
        ]),
        subtotal: 500,
        totalItems: 5
      })
    })

    it('returns 400 when guest user does not provide sessionId', async () => {
      const product = await createProduct({ price: 100, stock: 20 })
      const sessionId = 'guest-session-456'

      // Add item first
      const addResponse = await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 2,
          sessionId
        })

      const itemId = addResponse.body.items[0]._id

      // Try to update without sessionId
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .send({
          quantity: 5
        })

      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining('Session ID')
      })
    })
  })

  // ─── Stock Availability Tests ──────────────────────────────────────────────

  describe('Stock Availability Verification', () => {
    it('returns 409 when updating to quantity exceeding available stock', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 5 })
      const token = generateAccessToken(user._id.toString())

      // Add item first
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      const itemId = addResponse.body.items[0]._id

      // Try to update to quantity exceeding stock
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 10
        })

      expect(response.status).toBe(409)
      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining('Insufficient stock')
      })
    })

    it('returns 409 when variant stock is insufficient', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({
        price: 100,
        stock: 10,
        variants: [
          { name: 'Size: L, Color: Red', price: 120, stock: 3 }
        ]
      })
      const token = generateAccessToken(user._id.toString())
      const variantId = product.variants[0]._id?.toString()

      // Add item with variant
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2,
          variantId
        })

      const itemId = addResponse.body.items[0]._id

      // Try to update to quantity exceeding variant stock
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 5
        })

      expect(response.status).toBe(409)
      expect(response.body.message).toContain('Insufficient stock')
    })

    it('returns 201 when updating to exact available stock', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      // Add item first
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      const itemId = addResponse.body.items[0]._id

      // Update to exact stock
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 10
        })

      expect(response.status).toBe(200)
      expect(response.body.items[0]).toMatchObject({
        quantity: 10
      })
    })
  })

  // ─── Product Validation Tests ──────────────────────────────────────────────

  describe('Product Validation', () => {
    it('returns 404 when cart item does not exist', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const token = generateAccessToken(user._id.toString())
      const fakeItemId = new mongoose.Types.ObjectId().toString()

      const response = await request(app)
        .put(`/api/cart/items/${fakeItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 5
        })

      expect(response.status).toBe(404)
      expect(response.body.message).toContain('Cart not found')
    })

    it('returns 400 when product is inactive', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10, isActive: true })
      const token = generateAccessToken(user._id.toString())

      // Add item first
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      const itemId = addResponse.body.items[0]._id

      // Deactivate product
      await Product.findByIdAndUpdate(product._id, { isActive: false })

      // Try to update item
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 5
        })

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('no longer available')
    })
  })

  // ─── Input Validation Tests ────────────────────────────────────────────────

  describe('Input Validation', () => {
    it('returns 400 when quantity is missing', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      // Add item first
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      const itemId = addResponse.body.items[0]._id

      // Try to update without quantity
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('quantity')
    })

    it('returns 400 when quantity is less than 1', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      // Add item first
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      const itemId = addResponse.body.items[0]._id

      // Try to update with quantity 0
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 0
        })

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('Invalid input data')
    })

    it('returns 400 when quantity is negative', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      // Add item first
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      const itemId = addResponse.body.items[0]._id

      // Try to update with negative quantity
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: -5
        })

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('Invalid input data')
    })

    it('returns 400 when quantity is not an integer', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      // Add item first
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      const itemId = addResponse.body.items[0]._id

      // Try to update with decimal quantity
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 2.5
        })

      expect(response.status).toBe(400)
    })
  })

  // ─── Cart Calculations Tests ───────────────────────────────────────────────

  describe('Cart Calculations After Updating Item', () => {
    it('correctly recalculates cart totals after updating item', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item first
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      const itemId = addResponse.body.items[0]._id

      // Update item quantity
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 3
        })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        subtotal: 300,
        tax: 15, // 5% of 300
        shippingCost: 50,
        total: 365 // 300 + 15 + 50
      })
    })

    it('applies free shipping when updating causes subtotal >= 500', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 250, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item first (250 * 1 = 250, with shipping)
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 1
        })

      const itemId = addResponse.body.items[0]._id

      // Update to quantity 2 (250 * 2 = 500, free shipping)
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 2
        })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        subtotal: 500,
        tax: 25, // 5% of 500
        shippingCost: 0, // Free shipping
        total: 525 // 500 + 25 + 0
      })
    })

    it('maintains free shipping when updating quantity in cart already >= 500', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 250, stock: 20 })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 100, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add first item (500 BDT, free shipping)
      const addResponse1 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product1._id.toString(),
          quantity: 2
        })

      // Add second item
      const addResponse2 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product2._id.toString(),
          quantity: 1
        })

      const itemId2 = addResponse2.body.items[1]._id

      // Update second item quantity
      const response = await request(app)
        .put(`/api/cart/items/${itemId2}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 2
        })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        subtotal: 700,
        shippingCost: 0 // Still free shipping
      })
    })
  })

  // ─── Edge Cases ────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('handles updating to large quantities correctly', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 10, stock: 1000 })
      const token = generateAccessToken(user._id.toString())

      // Add item first
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 100
        })

      const itemId = addResponse.body.items[0]._id

      // Update to large quantity
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 500
        })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        subtotal: 5000,
        totalItems: 500
      })
    })

    it('handles updating with decimal prices correctly', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 99.99, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item first
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 1
        })

      const itemId = addResponse.body.items[0]._id

      // Update quantity
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 3
        })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        subtotal: 299.97,
        tax: 15, // 5% of 299.97 = 14.9985, rounded to 15
        total: 364.97
      })
    })

    it('handles updating from high quantity to low quantity', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item with high quantity
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 10
        })

      const itemId = addResponse.body.items[0]._id

      // Update to low quantity
      const response = await request(app)
        .put(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 1
        })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        subtotal: 100,
        tax: 5,
        shippingCost: 50,
        total: 155,
        totalItems: 1
      })
    })
  })
})
