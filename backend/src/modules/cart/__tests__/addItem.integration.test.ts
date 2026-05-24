/**
 * Integration tests for POST /api/cart/items
 *
 * Covers Task 17.2: POST /api/cart/items - add item, verify stock availability
 *
 * Test scenarios:
 * - Authenticated user adding item to cart
 * - Guest user adding item to cart
 * - Stock availability verification
 * - Insufficient stock error
 * - Product not found error
 * - Inactive product error
 * - Variant stock verification
 * - Quantity validation
 * - Cart calculations after adding item
 * - Adding duplicate items (quantity update)
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

describe('POST /api/cart/items', () => {
  // ─── Authenticated User Tests ──────────────────────────────────────────────

  describe('Authenticated User', () => {
    it('returns 201 and adds item to cart for authenticated user', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        _id: expect.any(String),
        items: expect.arrayContaining([
          expect.objectContaining({
            product: expect.objectContaining({
              _id: product._id.toString(),
              name: 'Test Product',
              price: 100,
              stock: 10
            }),
            quantity: 2,
            price: 100,
            subtotal: 200
          })
        ]),
        subtotal: 200,
        tax: 10,
        shippingCost: 50,
        total: 260,
        totalItems: 2
      })
    })

    it('returns 201 and updates quantity when adding duplicate item', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item first time
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      // Add same item again
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 3
        })

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        items: expect.arrayContaining([
          expect.objectContaining({
            product: expect.objectContaining({
              _id: product._id.toString()
            }),
            quantity: 5, // 2 + 3
            subtotal: 500
          })
        ]),
        subtotal: 500,
        totalItems: 5
      })
    })

    it('returns 201 and adds multiple different items to cart', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 100, stock: 10 })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 150, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      // Add first item
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product1._id.toString(),
          quantity: 1
        })

      // Add second item
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product2._id.toString(),
          quantity: 2
        })

      expect(response.status).toBe(201)
      expect(response.body.items).toHaveLength(2)
      expect(response.body).toMatchObject({
        subtotal: 400, // 100 + 300
        totalItems: 3
      })
    })

    it('returns 201 and adds item with variant', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({
        price: 100,
        stock: 10,
        variants: [
          { name: 'Size: L, Color: Red', price: 120, stock: 5 }
        ]
      })
      const token = generateAccessToken(user._id.toString())
      const variantId = product.variants[0]._id?.toString()

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2,
          variantId
        })

      expect(response.status).toBe(201)
      expect(response.body.items[0]).toMatchObject({
        quantity: 2,
        price: 100, // Uses product price, not variant price
        subtotal: 200
      })
    })
  })

  // ─── Guest User Tests ──────────────────────────────────────────────────────

  describe('Guest User', () => {
    it('returns 201 and adds item to guest cart with sessionId', async () => {
      const product = await createProduct({ price: 100, stock: 10 })
      const sessionId = 'guest-session-123'

      const response = await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 2,
          sessionId
        })

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        _id: expect.any(String),
        items: expect.arrayContaining([
          expect.objectContaining({
            product: expect.objectContaining({
              _id: product._id.toString()
            }),
            quantity: 2,
            subtotal: 200
          })
        ]),
        subtotal: 200,
        totalItems: 2
      })
    })

    it('returns 400 when guest user does not provide sessionId', async () => {
      const product = await createProduct({ price: 100, stock: 10 })

      const response = await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining('Session ID')
      })
    })

    it('returns 201 and updates quantity for duplicate item in guest cart', async () => {
      const product = await createProduct({ price: 100, stock: 20 })
      const sessionId = 'guest-session-456'

      // Add item first time
      await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 2,
          sessionId
        })

      // Add same item again
      const response = await request(app)
        .post('/api/cart/items')
        .send({
          productId: product._id.toString(),
          quantity: 3,
          sessionId
        })

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        items: expect.arrayContaining([
          expect.objectContaining({
            quantity: 5 // 2 + 3
          })
        ]),
        totalItems: 5
      })
    })
  })

  // ─── Stock Availability Tests ──────────────────────────────────────────────

  describe('Stock Availability Verification', () => {
    it('returns 409 when requesting quantity exceeds available stock', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 5 })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 10
        })

      expect(response.status).toBe(409)
      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining('Insufficient stock')
      })
    })

    it('returns 409 when requesting exact stock amount that exceeds after adding to existing cart item', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      // Add 5 items first
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 5
        })

      // Try to add 6 more (total would be 11, but only 10 available)
      // The cart.addItem method adds to the quantity, so this will fail
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 6
        })

      // This should fail because 5 + 6 = 11 > 10 available
      expect(response.status).toBe(409)
      expect(response.body.message).toContain('Insufficient stock')
    })

    it('returns 201 when requesting exact available stock', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 5 })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 5
        })

      expect(response.status).toBe(201)
      expect(response.body.items[0]).toMatchObject({
        quantity: 5
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

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 5,
          variantId
        })

      expect(response.status).toBe(409)
      expect(response.body.message).toContain('Insufficient stock')
    })

    it('returns 201 when variant stock is sufficient', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({
        price: 100,
        stock: 10,
        variants: [
          { name: 'Size: L, Color: Red', price: 120, stock: 5 }
        ]
      })
      const token = generateAccessToken(user._id.toString())
      const variantId = product.variants[0]._id?.toString()

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 5,
          variantId
        })

      expect(response.status).toBe(201)
      expect(response.body.items[0]).toMatchObject({
        quantity: 5
      })
    })
  })

  // ─── Product Validation Tests ──────────────────────────────────────────────

  describe('Product Validation', () => {
    it('returns 404 when product does not exist', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const token = generateAccessToken(user._id.toString())
      const fakeProductId = new mongoose.Types.ObjectId().toString()

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: fakeProductId,
          quantity: 1
        })

      expect(response.status).toBe(404)
      expect(response.body.message).toContain('Product not found')
    })

    it('returns 400 when product is inactive', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10, isActive: false })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 1
        })

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('no longer available')
    })

    it('returns 404 when variant does not exist', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({
        price: 100,
        stock: 10,
        variants: [
          { name: 'Size: L, Color: Red', price: 120, stock: 5 }
        ]
      })
      const token = generateAccessToken(user._id.toString())
      const fakeVariantId = new mongoose.Types.ObjectId().toString()

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 1,
          variantId: fakeVariantId
        })

      expect(response.status).toBe(404)
      expect(response.body.message).toContain('variant not found')
    })
  })

  // ─── Input Validation Tests ────────────────────────────────────────────────

  describe('Input Validation', () => {
    it('returns 400 when productId is missing', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 1
        })

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('productId')
    })

    it('returns 400 when quantity is missing', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString()
        })

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('quantity')
    })

    it('returns 400 when quantity is less than 1', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 0
        })

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('Invalid input data')
    })

    it('returns 400 when quantity is negative', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: -5
        })

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('Invalid input data')
    })

    it('returns 400 when quantity is not an integer', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2.5
        })

      expect(response.status).toBe(400)
    })
  })

  // ─── Cart Calculations Tests ───────────────────────────────────────────────

  describe('Cart Calculations After Adding Item', () => {
    it('correctly calculates cart totals after adding item', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 3
        })

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        subtotal: 300,
        tax: 15, // 5% of 300
        shippingCost: 50,
        total: 365 // 300 + 15 + 50
      })
    })

    it('applies free shipping when subtotal >= 500', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 250, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        subtotal: 500,
        tax: 25, // 5% of 500
        shippingCost: 0, // Free shipping
        total: 525 // 500 + 25 + 0
      })
    })

    it('maintains free shipping when adding more items to cart already >= 500', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 250, stock: 10 })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      // Add first item (500 BDT, free shipping)
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product1._id.toString(),
          quantity: 2
        })

      // Add second item
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product2._id.toString(),
          quantity: 1
        })

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        subtotal: 600,
        shippingCost: 0 // Still free shipping
      })
    })
  })

  // ─── Edge Cases ────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('handles large quantities correctly', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 10, stock: 1000 })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 500
        })

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        subtotal: 5000,
        totalItems: 500
      })
    })

    it('handles decimal prices correctly', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 99.99, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        subtotal: 199.98,
        tax: 10, // 5% of 199.98 = 9.999, rounded to 10
        total: 259.98
      })
    })

    it('handles product with zero stock', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 0 })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 1
        })

      expect(response.status).toBe(409)
      expect(response.body.message).toContain('Insufficient stock')
    })
  })
})
