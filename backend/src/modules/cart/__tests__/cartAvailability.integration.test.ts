/**
 * Integration tests for cart item availability checking
 *
 * Covers Task 17.7: Mark out-of-stock cart items as unavailable on cart retrieval
 *
 * Test scenarios:
 * - Product is inactive (isActive: false)
 * - Product stock is 0 (for non-variant items)
 * - Variant stock is 0 (for variant items)
 * - Requested quantity exceeds available stock
 * - Item is available (all checks pass)
 * - Mixed availability in cart (some available, some unavailable)
 * - Variant not found
 * - Availability changes after item added to cart
 */

// Set required env vars BEFORE importing app
process.env.JWT_SECRET = 'test-jwt-secret-for-cart-availability-tests'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-cart-availability-tests'
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
  variants?: Array<{ name: string; sku?: string; price: number; stock: number }>
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

describe('GET /api/cart - Item Availability Checking', () => {
  // ─── Product Inactive Tests ────────────────────────────────────────────────

  describe('Product Inactive (isActive: false)', () => {
    it('marks item as unavailable when product is inactive', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, isActive: true })
      const token = generateAccessToken(user._id.toString())

      // Create cart with item
      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 1, 100)

      // Deactivate product
      await Product.findByIdAndUpdate(product._id, { isActive: false })

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0]).toMatchObject({
        isAvailable: false,
        unavailableReason: 'Product is no longer available'
      })
    })

    it('marks multiple items as unavailable when products are inactive', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 100, isActive: true })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 150, isActive: true })
      const token = generateAccessToken(user._id.toString())

      // Create cart with items
      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product1._id, 1, 100)
      await cart.addItem(product2._id, 1, 150)

      // Deactivate both products
      await Product.findByIdAndUpdate(product1._id, { isActive: false })
      await Product.findByIdAndUpdate(product2._id, { isActive: false })

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(2)
      expect(response.body.items[0]).toMatchObject({
        isAvailable: false,
        unavailableReason: 'Product is no longer available'
      })
      expect(response.body.items[1]).toMatchObject({
        isAvailable: false,
        unavailableReason: 'Product is no longer available'
      })
    })
  })

  // ─── Product Stock Zero Tests ──────────────────────────────────────────────

  describe('Product Stock is 0 (Non-Variant Items)', () => {
    it('marks item as unavailable when product stock is 0', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      // Create cart with item
      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 1, 100)

      // Set product stock to 0
      await Product.findByIdAndUpdate(product._id, { stock: 0 })

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0]).toMatchObject({
        isAvailable: false,
        unavailableReason: 'Insufficient stock available'
      })
    })

    it('marks item as unavailable when quantity exceeds available stock', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      // Create cart with item
      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 5, 100)

      // Reduce product stock below cart quantity
      await Product.findByIdAndUpdate(product._id, { stock: 3 })

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0]).toMatchObject({
        quantity: 5,
        isAvailable: false,
        unavailableReason: 'Insufficient stock available'
      })
    })
  })

  // ─── Variant Stock Tests ───────────────────────────────────────────────────

  describe('Variant Stock is 0 (Variant Items)', () => {
    it('marks variant item as unavailable when variant stock is 0', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({
        price: 100,
        stock: 10,
        variants: [
          { name: 'Size: L, Color: Red', sku: 'SKU-001', price: 100, stock: 5 }
        ]
      })
      const token = generateAccessToken(user._id.toString())

      // Get variant ID
      const variant = product.variants[0]

      // Create cart with variant item
      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 1, 100, variant._id)

      // Set variant stock to 0
      await Product.findByIdAndUpdate(
        product._id,
        { 'variants.0.stock': 0 }
      )

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0]).toMatchObject({
        isAvailable: false,
        unavailableReason: 'Variant out of stock'
      })
    })

    it('marks variant item as unavailable when quantity exceeds variant stock', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({
        price: 100,
        stock: 10,
        variants: [
          { name: 'Size: L, Color: Red', sku: 'SKU-001', price: 100, stock: 10 }
        ]
      })
      const token = generateAccessToken(user._id.toString())

      // Get variant ID
      const variant = product.variants[0]

      // Create cart with variant item
      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 8, 100, variant._id)

      // Reduce variant stock
      await Product.findByIdAndUpdate(
        product._id,
        { 'variants.0.stock': 5 }
      )

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0]).toMatchObject({
        quantity: 8,
        isAvailable: false,
        unavailableReason: 'Insufficient stock available'
      })
    })
  })

  // ─── Available Items Tests ────────────────────────────────────────────────

  describe('Available Items', () => {
    it('marks item as available when all checks pass', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10, isActive: true })
      const token = generateAccessToken(user._id.toString())

      // Create cart with item
      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 2, 100)

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0]).toMatchObject({
        isAvailable: true,
        unavailableReason: null
      })
    })

    it('marks variant item as available when all checks pass', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({
        price: 100,
        stock: 10,
        isActive: true,
        variants: [
          { name: 'Size: L, Color: Red', sku: 'SKU-001', price: 100, stock: 10 }
        ]
      })
      const token = generateAccessToken(user._id.toString())

      // Get variant ID
      const variant = product.variants[0]

      // Create cart with variant item
      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 3, 100, variant._id)

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0]).toMatchObject({
        isAvailable: true,
        unavailableReason: null
      })
    })

    it('marks item as available when quantity equals available stock', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 5 })
      const token = generateAccessToken(user._id.toString())

      // Create cart with item
      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 5, 100)

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0]).toMatchObject({
        quantity: 5,
        isAvailable: true,
        unavailableReason: null
      })
    })
  })

  // ─── Mixed Availability Tests ──────────────────────────────────────────────

  describe('Mixed Availability in Cart', () => {
    it('returns correct availability for mixed items (available and unavailable)', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 100, stock: 10, isActive: true })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 150, stock: 5, isActive: true })
      const token = generateAccessToken(user._id.toString())

      // Create cart with items
      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product1._id, 2, 100)
      await cart.addItem(product2._id, 3, 150)

      // Deactivate product2
      await Product.findByIdAndUpdate(product2._id, { isActive: false })

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(2)

      // First item should be available
      expect(response.body.items[0]).toMatchObject({
        product: expect.objectContaining({ name: 'Product 1' }),
        isAvailable: true,
        unavailableReason: null
      })

      // Second item should be unavailable
      expect(response.body.items[1]).toMatchObject({
        product: expect.objectContaining({ name: 'Product 2' }),
        isAvailable: false,
        unavailableReason: 'Product is no longer available'
      })
    })

    it('returns correct availability for multiple items with different unavailable reasons', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 100, stock: 10, isActive: false })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 150, stock: 0, isActive: true })
      const product3 = await createProduct({ name: 'Product 3', slug: 'product-3', price: 200, stock: 2, isActive: true })
      const token = generateAccessToken(user._id.toString())

      // Create cart with items
      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product1._id, 1, 100)
      await cart.addItem(product2._id, 1, 150)
      await cart.addItem(product3._id, 5, 200)

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(3)

      // First item: product inactive
      expect(response.body.items[0]).toMatchObject({
        isAvailable: false,
        unavailableReason: 'Product is no longer available'
      })

      // Second item: product stock is 0
      expect(response.body.items[1]).toMatchObject({
        isAvailable: false,
        unavailableReason: 'Insufficient stock available'
      })

      // Third item: quantity exceeds stock
      expect(response.body.items[2]).toMatchObject({
        isAvailable: false,
        unavailableReason: 'Insufficient stock available'
      })
    })
  })

  // ─── Guest Cart Availability Tests ────────────────────────────────────────

  describe('Guest Cart Availability', () => {
    it('marks guest cart items as unavailable when product is inactive', async () => {
      const product = await createProduct({ price: 100, isActive: true })
      const sessionId = 'guest-session-123'

      // Create guest cart with item
      const cart = await Cart.createGuestCart(sessionId)
      await cart.addItem(product._id, 1, 100)

      // Deactivate product
      await Product.findByIdAndUpdate(product._id, { isActive: false })

      const response = await request(app)
        .get('/api/cart')
        .query({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0]).toMatchObject({
        isAvailable: false,
        unavailableReason: 'Product is no longer available'
      })
    })

    it('marks guest cart items as unavailable when stock is insufficient', async () => {
      const product = await createProduct({ price: 100, stock: 5 })
      const sessionId = 'guest-session-456'

      // Create guest cart with item
      const cart = await Cart.createGuestCart(sessionId)
      await cart.addItem(product._id, 3, 100)

      // Reduce stock
      await Product.findByIdAndUpdate(product._id, { stock: 1 })

      const response = await request(app)
        .get('/api/cart')
        .query({ sessionId })

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0]).toMatchObject({
        isAvailable: false,
        unavailableReason: 'Insufficient stock available'
      })
    })
  })

  // ─── Items Not Removed Tests ───────────────────────────────────────────────

  describe('Unavailable Items Not Removed', () => {
    it('keeps unavailable items in cart (does not remove them)', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      // Create cart with item
      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 5, 100)

      // Reduce stock to make item unavailable
      await Product.findByIdAndUpdate(product._id, { stock: 2 })

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      // Item should still be in cart
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0]).toMatchObject({
        quantity: 5,
        isAvailable: false,
        unavailableReason: 'Insufficient stock available'
      })
    })

    it('keeps multiple unavailable items in cart', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product1 = await createProduct({ name: 'Product 1', slug: 'product-1', price: 100, stock: 10 })
      const product2 = await createProduct({ name: 'Product 2', slug: 'product-2', price: 150, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      // Create cart with items
      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product1._id, 5, 100)
      await cart.addItem(product2._id, 3, 150)

      // Make both products unavailable
      await Product.findByIdAndUpdate(product1._id, { isActive: false })
      await Product.findByIdAndUpdate(product2._id, { stock: 0 })

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      // Both items should still be in cart
      expect(response.body.items).toHaveLength(2)
      expect(response.body.items[0]).toMatchObject({
        isAvailable: false,
        unavailableReason: 'Product is no longer available'
      })
      expect(response.body.items[1]).toMatchObject({
        isAvailable: false,
        unavailableReason: 'Insufficient stock available'
      })
    })
  })

  // ─── Response Format Tests ────────────────────────────────────────────────

  describe('Response Format', () => {
    it('includes isAvailable and unavailableReason fields in response', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 1, 100)

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items[0]).toHaveProperty('isAvailable')
      expect(response.body.items[0]).toHaveProperty('unavailableReason')
      expect(typeof response.body.items[0].isAvailable).toBe('boolean')
      expect(response.body.items[0].unavailableReason).toBeNull()
    })

    it('returns unavailableReason as null for available items', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 1, 100)

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items[0].unavailableReason).toBeNull()
    })

    it('returns unavailableReason as string for unavailable items', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 1, 100)

      // Make product unavailable
      await Product.findByIdAndUpdate(product._id, { isActive: false })

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(typeof response.body.items[0].unavailableReason).toBe('string')
      expect(response.body.items[0].unavailableReason).toBeTruthy()
    })
  })

  // ─── Edge Cases ────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('handles empty cart correctly', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const token = generateAccessToken(user._id.toString())

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(0)
    })

    it('handles product with multiple variants correctly', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({
        price: 100,
        stock: 10,
        variants: [
          { name: 'Size: S', sku: 'SKU-001', price: 100, stock: 5 },
          { name: 'Size: M', sku: 'SKU-002', price: 100, stock: 0 },
          { name: 'Size: L', sku: 'SKU-003', price: 100, stock: 3 }
        ]
      })
      const token = generateAccessToken(user._id.toString())

      // Add items for different variants
      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 2, 100, product.variants[0]._id) // Available
      await cart.addItem(product._id, 1, 100, product.variants[1]._id) // Out of stock
      await cart.addItem(product._id, 3, 100, product.variants[2]._id) // Available

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(3)
      expect(response.body.items[0].isAvailable).toBe(true)
      expect(response.body.items[1].isAvailable).toBe(false)
      expect(response.body.items[1].unavailableReason).toBe('Variant out of stock')
      expect(response.body.items[2].isAvailable).toBe(true)
    })

    it('handles product stock changes between requests', async () => {
      const user = await createUser({ email: 'user@example.com' })
      const product = await createProduct({ price: 100, stock: 10 })
      const token = generateAccessToken(user._id.toString())

      const cart = await Cart.createUserCart(user._id)
      await cart.addItem(product._id, 5, 100)

      // First request - item available
      let response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.body.items[0].isAvailable).toBe(true)

      // Change stock
      await Product.findByIdAndUpdate(product._id, { stock: 2 })

      // Second request - item unavailable
      response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)

      expect(response.body.items[0].isAvailable).toBe(false)
      expect(response.body.items[0].unavailableReason).toBe('Insufficient stock available')
    })
  })
})
