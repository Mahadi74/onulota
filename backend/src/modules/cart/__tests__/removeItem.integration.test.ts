/**
 * Integration tests for DELETE /api/cart/items/:id
 *
 * Covers Task 17.4: DELETE /api/cart/items/:id - remove item from cart
 *
 * Test scenarios:
 * - Authenticated user removing item from cart
 * - Guest user removing item from cart
 * - Item not found error
 * - Cart not found error
 * - Cart calculations after removing item
 * - Removing single item from multi-item cart
 * - Removing item with variants
 * - Removing last item from cart
 * - Shipping cost recalculation after removal
 * - Tax recalculation after removal
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

describe('DELETE /api/cart/items/:id', () => {
  // ─── Authenticated User Tests ──────────────────────────────────────────────

  describe('Authenticated User', () => {
    it('returns 200 and removes item from cart for authenticated user', async () => {
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

      // Remove item
      const response = await request(app)
        .delete(`/api/cart/items/${itemId}`)
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

    it('returns 200 and removes one item from multi-item cart', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 100, stock: 20 })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 200, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add first item
      const addResponse1 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product1._id.toString(),
          quantity: 1
        })

      // Add second item
      const addResponse2 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product2._id.toString(),
          quantity: 1
        })

      const itemId1 = addResponse1.body.items[0]._id

      // Remove first item
      const response = await request(app)
        .delete(`/api/cart/items/${itemId1}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0]).toMatchObject({
        product: expect.objectContaining({
          _id: product2._id.toString(),
          name: 'Product 2',
          price: 200
        }),
        quantity: 1,
        subtotal: 200
      })
      expect(response.body).toMatchObject({
        subtotal: 200,
        tax: 10,
        shippingCost: 50,
        total: 260,
        totalItems: 1
      })
    })

    it('returns 200 and removes item with variant', async () => {
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

      // Remove item
      const response = await request(app)
        .delete(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(0)
      expect(response.body.totalItems).toBe(0)
    })
  })

  // ─── Guest User Tests ──────────────────────────────────────────────────────

  describe('Guest User', () => {
    it('returns 200 and removes item from cart for guest user with sessionId', async () => {
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

      // Remove item
      const response = await request(app)
        .delete(`/api/cart/items/${itemId}`)
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

      // Try to remove without sessionId
      const response = await request(app)
        .delete(`/api/cart/items/${itemId}`)

      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining('Session ID')
      })
    })

    it('returns 200 and removes one item from multi-item guest cart', async () => {
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 100, stock: 20 })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 200, stock: 20 })
      const sessionId = 'guest-session-789'

      // Add first item
      const addResponse1 = await request(app)
        .post('/api/cart/items')
        .send({
          productId: product1._id.toString(),
          quantity: 1,
          sessionId
        })

      // Add second item
      const addResponse2 = await request(app)
        .post('/api/cart/items')
        .send({
          productId: product2._id.toString(),
          quantity: 1,
          sessionId
        })

      const itemId1 = addResponse1.body.items[0]._id

      // Remove first item
      const response = await request(app)
        .delete(`/api/cart/items/${itemId1}`)
        .query({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0]).toMatchObject({
        product: expect.objectContaining({
          _id: product2._id.toString()
        }),
        quantity: 1
      })
    })
  })

  // ─── Item Not Found Tests ──────────────────────────────────────────────────

  describe('Item Not Found', () => {
    it('returns 404 when cart item does not exist', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const token = generateAccessToken(user._id.toString())
      const fakeItemId = new mongoose.Types.ObjectId().toString()

      const response = await request(app)
        .delete(`/api/cart/items/${fakeItemId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(404)
      expect(response.body.message).toContain('Cart not found')
    })

    it('returns 404 when item ID does not exist in cart', async () => {
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

      // Try to remove non-existent item
      const fakeItemId = new mongoose.Types.ObjectId().toString()
      const response = await request(app)
        .delete(`/api/cart/items/${fakeItemId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(404)
      expect(response.body.message).toContain('Cart item not found')
    })
  })

  // ─── Cart Calculations Tests ───────────────────────────────────────────────

  describe('Cart Calculations After Removing Item', () => {
    it('correctly recalculates cart totals after removing item', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 5
        })

      const itemId = addResponse.body.items[0]._id

      // Remove item
      const response = await request(app)
        .delete(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        subtotal: 0,
        tax: 0,
        shippingCost: 0,
        total: 0,
        totalItems: 0
      })
    })

    it('recalculates shipping when removing item causes subtotal to drop below 500', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 250, stock: 20 })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 250, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add first item (250 BDT)
      const addResponse1 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product1._id.toString(),
          quantity: 1
        })

      // Add second item (250 BDT, total 500 BDT, free shipping)
      const addResponse2 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product2._id.toString(),
          quantity: 1
        })

      const itemId1 = addResponse1.body.items[0]._id

      // Verify free shipping before removal
      const cartBefore = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(cartBefore.body).toMatchObject({
        subtotal: 500,
        shippingCost: 0 // Free shipping
      })

      // Remove first item (leaves 250 BDT, should have shipping)
      const response = await request(app)
        .delete(`/api/cart/items/${itemId1}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        subtotal: 250,
        tax: 12.5, // 5% of 250
        shippingCost: 50, // Shipping restored
        total: 312.5 // 250 + 12.5 + 50
      })
    })

    it('maintains free shipping when removing item from cart still >= 500', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 300, stock: 20 })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 300, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add first item (300 BDT)
      const addResponse1 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product1._id.toString(),
          quantity: 1
        })

      // Add second item (300 BDT, total 600 BDT, free shipping)
      const addResponse2 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product2._id.toString(),
          quantity: 1
        })

      const itemId1 = addResponse1.body.items[0]._id

      // Remove first item (leaves 300 BDT, but still free shipping? No, should have shipping)
      const response = await request(app)
        .delete(`/api/cart/items/${itemId1}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        subtotal: 300,
        shippingCost: 50 // Shipping applies
      })
    })

    it('correctly recalculates tax after removing item', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item with quantity 10 (1000 BDT)
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 10
        })

      const itemId = addResponse.body.items[0]._id

      // Remove item
      const response = await request(app)
        .delete(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        subtotal: 0,
        tax: 0,
        total: 0
      })
    })
  })

  // ─── Edge Cases ────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('handles removing last item from cart', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add single item
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 1
        })

      const itemId = addResponse.body.items[0]._id

      // Remove the only item
      const response = await request(app)
        .delete(`/api/cart/items/${itemId}`)
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

    it('handles removing item with high quantity', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 10, stock: 1000 })
      const token = generateAccessToken(user._id.toString())

      // Add item with high quantity
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 500
        })

      const itemId = addResponse.body.items[0]._id

      // Remove item
      const response = await request(app)
        .delete(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        items: [],
        totalItems: 0
      })
    })

    it('handles removing item with decimal prices', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 99.99, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 3
        })

      const itemId = addResponse.body.items[0]._id

      // Remove item
      const response = await request(app)
        .delete(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        items: [],
        subtotal: 0,
        total: 0
      })
    })

    it('handles removing item from cart with multiple items of same product', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item first time
      const addResponse1 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      const itemId = addResponse1.body.items[0]._id

      // Remove item
      const response = await request(app)
        .delete(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(0)
    })

    it('handles removing item and verifying cart state persists', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 100, stock: 20 })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 200, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add two items
      const addResponse1 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product1._id.toString(),
          quantity: 1
        })

      const addResponse2 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product2._id.toString(),
          quantity: 1
        })

      const itemId1 = addResponse1.body.items[0]._id

      // Remove first item
      const removeResponse = await request(app)
        .delete(`/api/cart/items/${itemId1}`)
        .set('Authorization', `Bearer ${token}`)

      expect(removeResponse.status).toBe(200)

      // Verify cart state by fetching
      const getResponse = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(getResponse.status).toBe(200)
      expect(getResponse.body.items).toHaveLength(1)
      expect(getResponse.body.items[0]).toMatchObject({
        product: expect.objectContaining({
          _id: product2._id.toString()
        })
      })
    })
  })

  // ─── Response Format Tests ─────────────────────────────────────────────────

  describe('Response Format', () => {
    it('returns properly formatted cart response after removal', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add item
      const addResponse = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 2
        })

      const itemId = addResponse.body.items[0]._id

      // Remove item
      const response = await request(app)
        .delete(`/api/cart/items/${itemId}`)
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
    })

    it('returns items with correct structure', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 100, stock: 20 })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 200, stock: 20 })
      const token = generateAccessToken(user._id.toString())

      // Add two items
      const addResponse1 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product1._id.toString(),
          quantity: 1
        })

      const addResponse2 = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product2._id.toString(),
          quantity: 1
        })

      const itemId1 = addResponse1.body.items[0]._id

      // Remove first item
      const response = await request(app)
        .delete(`/api/cart/items/${itemId1}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)
      
      const item = response.body.items[0]
      expect(item).toHaveProperty('_id')
      expect(item).toHaveProperty('product')
      expect(item).toHaveProperty('quantity')
      expect(item).toHaveProperty('price')
      expect(item).toHaveProperty('subtotal')
      
      expect(item.product).toHaveProperty('_id')
      expect(item.product).toHaveProperty('name')
      expect(item.product).toHaveProperty('price')
      expect(item.product).toHaveProperty('stock')
    })
  })
})
