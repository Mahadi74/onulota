/**
 * Integration tests for POST /api/cart/merge
 *
 * Covers Task 17.6: POST /api/cart/merge - merge guest localStorage cart with user DB cart (prefer higher quantities)
 *
 * Test scenarios:
 * - Merge guest cart with empty user cart
 * - Merge guest cart with existing user cart
 * - Prefer higher quantity when item exists in both carts
 * - Keep lower quantity when guest quantity is lower
 * - Merge multiple items
 * - Guest cart is cleared after merge
 * - Authentication required
 * - Session ID validation
 * - Guest cart not found error
 * - Cart calculations after merge
 * - Variant handling in merge
 * - Price updates during merge
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

describe('POST /api/cart/merge', () => {
  // ─── Authentication Tests ──────────────────────────────────────────────────

  describe('Authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      const response = await request(app)
        .post('/api/cart/merge')
        .send({
          sessionId: 'guest-session-123'
        })

      expect(response.status).toBe(401)
      expect(response.body.message).toContain('Access token')
    })

    it('returns 400 when sessionId is missing', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('sessionId')
    })

    it('returns 400 when sessionId is empty string', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          sessionId: ''
        })

      expect(response.status).toBe(400)
    })
  })

  // ─── Basic Merge Tests ────────────────────────────────────────────────────

  describe('Basic Merge Operations', () => {
    it('returns 200 and merges guest cart with empty user cart', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const sessionId = 'guest-session-123'
      const token = generateAccessToken(user._id.toString())

      // Create guest cart with item
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 2,
          sessionId
        })

      // Merge guest cart with user cart
      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        _id: expect.any(String),
        items: expect.arrayContaining([
          expect.objectContaining({
            product: expect.objectContaining({
              _id: product._id.toString(),
              name: 'Test Product',
              price: 100
            }),
            quantity: 2,
            subtotal: 200
          })
        ]),
        subtotal: 200,
        totalItems: 2
      })
    })

    it('returns 200 and merges guest cart with existing user cart', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 100, stock: 10 })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 150, stock: 10 })
      const sessionId = 'guest-session-456'
      const token = generateAccessToken(user._id.toString())

      // Add item to user cart
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product1._id.toString(),
          quantity: 1
        })

      // Create guest cart with different item
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product2._id.toString(),
          quantity: 2,
          sessionId
        })

      // Merge guest cart with user cart
      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(2)
      expect(response.body).toMatchObject({
        subtotal: 400, // 100 + 300
        totalItems: 3
      })
    })
  })

  // ─── Quantity Preference Tests ────────────────────────────────────────────

  describe('Quantity Preference (Higher Quantity)', () => {
    it('prefers higher quantity from guest cart when merging duplicate items', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const sessionId = 'guest-session-789'
      const token = generateAccessToken(user._id.toString())

      // Add item to user cart with quantity 2
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      // Add same item to guest cart with quantity 5
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 5,
          sessionId
        })

      // Merge guest cart with user cart
      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0]).toMatchObject({
        quantity: 5, // Prefers higher quantity from guest
        subtotal: 500
      })
      expect(response.body).toMatchObject({
        subtotal: 500,
        totalItems: 5
      })
    })

    it('keeps user cart quantity when it is higher than guest quantity', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const sessionId = 'guest-session-101'
      const token = generateAccessToken(user._id.toString())

      // Add item to user cart with quantity 8
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 8
        })

      // Add same item to guest cart with quantity 3
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 3,
          sessionId
        })

      // Merge guest cart with user cart
      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0]).toMatchObject({
        quantity: 8, // Keeps higher quantity from user
        subtotal: 800
      })
    })

    it('handles equal quantities correctly', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const sessionId = 'guest-session-102'
      const token = generateAccessToken(user._id.toString())

      // Add item to user cart with quantity 5
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 5
        })

      // Add same item to guest cart with quantity 5
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 5,
          sessionId
        })

      // Merge guest cart with user cart
      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0]).toMatchObject({
        quantity: 5
      })
    })
  })

  // ─── Multiple Items Tests ─────────────────────────────────────────────────

  describe('Multiple Items Merge', () => {
    it('merges multiple items with mixed scenarios', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 100, stock: 20 })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 150, stock: 20 })
      const product3 = await createProduct({ name: 'Product 3', slug: 'product-3', price: 200, stock: 20 })
      const sessionId = 'guest-session-103'
      const token = generateAccessToken(user._id.toString())

      // User cart: product1 (qty 2), product2 (qty 3)
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
          quantity: 3
        })

      // Guest cart: product1 (qty 5), product3 (qty 1)
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product1._id.toString(),
          quantity: 5,
          sessionId
        })

      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product3._id.toString(),
          quantity: 1,
          sessionId
        })

      // Merge
      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(3)
      
      // Verify each item
      const item1 = response.body.items.find((i: any) => i.product._id === product1._id.toString())
      const item2 = response.body.items.find((i: any) => i.product._id === product2._id.toString())
      const item3 = response.body.items.find((i: any) => i.product._id === product3._id.toString())

      expect(item1.quantity).toBe(5) // Higher from guest
      expect(item2.quantity).toBe(3) // Only in user cart
      expect(item3.quantity).toBe(1) // Only in guest cart

      expect(response.body).toMatchObject({
        subtotal: 500 + 450 + 200, // 5*100 + 3*150 + 1*200
        totalItems: 9
      })
    })
  })

  // ─── Guest Cart Cleanup Tests ──────────────────────────────────────────────

  describe('Guest Cart Cleanup', () => {
    it('deletes guest cart after successful merge', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const sessionId = 'guest-session-104'
      const token = generateAccessToken(user._id.toString())

      // Create guest cart
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 2,
          sessionId
        })

      // Verify guest cart exists
      let guestCart = await Cart.findBySession(sessionId)
      expect(guestCart).not.toBeNull()

      // Merge
      await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId })

      // Verify guest cart is deleted
      guestCart = await Cart.findBySession(sessionId)
      expect(guestCart).toBeNull()
    })

    it('guest cart cannot be accessed after merge', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const sessionId = 'guest-session-105'
      const token = generateAccessToken(user._id.toString())

      // Create guest cart
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 2,
          sessionId
        })

      // Merge
      await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId })

      // Try to get guest cart
      const response = await request(app)
        .get('/api/cart')
        .query({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(0)
    })
  })

  // ─── Error Cases ──────────────────────────────────────────────────────────

  describe('Error Cases', () => {
    it('returns 404 when guest cart does not exist', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const token = generateAccessToken(user._id.toString())
      const nonExistentSessionId = 'non-existent-session-999'

      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId: nonExistentSessionId })

      expect(response.status).toBe(404)
      expect(response.body.message).toContain('Guest cart not found')
    })

    it('returns 404 when guest cart is empty', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const token = generateAccessToken(user._id.toString())
      const sessionId = 'empty-guest-session'

      // Create empty guest cart
      await Cart.createGuestCart(sessionId)

      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(0)
    })
  })

  // ─── Variant Handling Tests ────────────────────────────────────────────────

  describe('Variant Handling', () => {
    it('correctly merges items with variants', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({
        price: 100,
        stock: 20,
        variants: [
          { name: 'Size: L, Color: Red', price: 120, stock: 10 }
        ]
      })
      const sessionId = 'guest-session-106'
      const token = generateAccessToken(user._id.toString())
      const variantId = product.variants[0]._id?.toString()

      // Add variant to user cart
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2,
          variantId
        })

      // Add same variant to guest cart with higher quantity
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 5,
          variantId,
          sessionId
        })

      // Merge
      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0]).toMatchObject({
        quantity: 5 // Prefers higher quantity
      })
    })

    it('treats base product and variant as different items', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({
        price: 100,
        stock: 20,
        variants: [
          { name: 'Size: L, Color: Red', price: 120, stock: 10 }
        ]
      })
      const sessionId = 'guest-session-107'
      const token = generateAccessToken(user._id.toString())
      const variantId = product.variants[0]._id?.toString()

      // Add base product to user cart
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      // Add variant to guest cart
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 3,
          variantId,
          sessionId
        })

      // Merge
      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(2) // Base product and variant are separate
      expect(response.body).toMatchObject({
        totalItems: 5 // 2 + 3
      })
    })
  })

  // ─── Cart Calculations Tests ───────────────────────────────────────────────

  describe('Cart Calculations After Merge', () => {
    it('correctly recalculates totals after merge', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const sessionId = 'guest-session-108'
      const token = generateAccessToken(user._id.toString())

      // User cart: 2 items
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      // Guest cart: 3 items (higher)
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 3,
          sessionId
        })

      // Merge
      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        subtotal: 300, // 3 * 100
        tax: 15, // 5% of 300
        shippingCost: 50,
        total: 365,
        totalItems: 3
      })
    })

    it('applies free shipping when merged cart subtotal >= 500', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 250, stock: 20 })
      const sessionId = 'guest-session-109'
      const token = generateAccessToken(user._id.toString())

      // User cart: 1 item (250)
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 1
        })

      // Guest cart: 2 items (500)
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 2,
          sessionId
        })

      // Merge
      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        subtotal: 500,
        tax: 25,
        shippingCost: 0, // Free shipping
        total: 525
      })
    })
  })

  // ─── Price Update Tests ────────────────────────────────────────────────────

  describe('Price Updates During Merge', () => {
    it('updates price to latest when preferring higher quantity', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const sessionId = 'guest-session-110'
      const token = generateAccessToken(user._id.toString())

      // Add item to user cart at price 100
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      // Update product price
      await Product.findByIdAndUpdate(product._id, { price: 120 })

      // Add same item to guest cart at new price 120
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 5,
          sessionId
        })

      // Merge
      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body.items[0]).toMatchObject({
        quantity: 5,
        price: 120, // Updated to latest price
        subtotal: 600
      })
    })
  })

  // ─── Edge Cases ────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('handles merge with large quantities', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 10, stock: 1000 })
      const sessionId = 'guest-session-111'
      const token = generateAccessToken(user._id.toString())

      // User cart: 100 items
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 100
        })

      // Guest cart: 500 items
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 500,
          sessionId
        })

      // Merge
      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body.items[0]).toMatchObject({
        quantity: 500
      })
      expect(response.body).toMatchObject({
        subtotal: 5000,
        totalItems: 500
      })
    })

    it('handles merge with decimal prices', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 99.99, stock: 20 })
      const sessionId = 'guest-session-112'
      const token = generateAccessToken(user._id.toString())

      // User cart: 1 item
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 1
        })

      // Guest cart: 2 items
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 2,
          sessionId
        })

      // Merge
      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        subtotal: 199.98,
        totalItems: 2
      })
    })

    it('handles merge when user has no existing cart', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const sessionId = 'guest-session-113'
      const token = generateAccessToken(user._id.toString())

      // Create guest cart only
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 2,
          sessionId
        })

      // Verify user has no cart yet
      let userCart = await Cart.findByUser(user._id)
      expect(userCart).toBeNull()

      // Merge
      const response = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)

      // Verify user cart was created
      userCart = await Cart.findByUser(user._id)
      expect(userCart).not.toBeNull()
    })
  })
})
