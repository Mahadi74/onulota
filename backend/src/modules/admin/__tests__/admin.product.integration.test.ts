/**
 * Integration tests for POST /api/admin/products
 *
 * Covers Requirement 15.1: WHEN an Admin creates a Product, THE Platform SHALL require 
 * name, description, price, category, and at least one image
 *
 * Acceptance criteria:
 *   - Accept POST requests with product data
 *   - Validate required fields: name, description, price, category, and at least one image
 *   - Validate field types and constraints (e.g., price >= 0, name length, etc.)
 *   - Create a new product in the database
 *   - Return the created product with 201 status code
 *   - Require admin authentication
 *   - Handle validation errors with 400 Bad Request
 *   - Handle category not found with 404 Not Found
 *   - Invalidate product listing caches after creation
 */

// Set required env vars BEFORE importing app (passport.ts reads them at module load time)
process.env.JWT_SECRET = 'test-jwt-secret-for-admin-product-tests'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-admin-product-tests'
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:5000/api/auth/google/callback'

import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { createApp } from '../../../app'
import { User } from '../../../models/User'
import { Category } from '../../../models/Category'
import { Product } from '../../../models/Product'

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
  await Product.deleteMany({})
  await Category.deleteMany({})
  await User.deleteMany({})
})

/** Helper: create a user and return a JWT access token */
async function createUserAndGetToken(role: 'user' | 'admin' = 'admin'): Promise<string> {
  const hashedPassword = await bcrypt.hash('Admin@123', 10)
  await User.create({
    name: 'Test Admin',
    email: 'admin@example.com',
    password: hashedPassword,
    role,
    isActive: true,
  })

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@example.com', password: 'Admin@123' })

  return res.body.accessToken as string
}

/** Helper: create a category directly in the DB */
async function createCategory(name: string): Promise<mongoose.Document & { _id: mongoose.Types.ObjectId }> {
  const cat = new Category({ name })
  await cat.save()
  return cat as unknown as mongoose.Document & { _id: mongoose.Types.ObjectId }
}

describe('POST /api/admin/products', () => {
  // ─── Authentication & Authorization ────────────────────────────────────────

  it('returns 401 when no token is provided', async () => {
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .send({
        name: 'Test Product',
        description: 'A test product description',
        price: 100,
        category: category._id.toString(),
        images: [{ url: 'https://example.com/image.jpg' }],
      })

    expect(res.status).toBe(401)
  })

  it('returns 403 when a non-admin user tries to create a product', async () => {
    const token = await createUserAndGetToken('user')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Product',
        description: 'A test product description',
        price: 100,
        category: category._id.toString(),
        images: [{ url: 'https://example.com/image.jpg' }],
      })

    expect(res.status).toBe(403)
  })

  // ─── Happy path: create product with required fields ──────────────────────

  it('creates a product with required fields and returns 201 (Req 15.1)', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Smartphone',
        description: 'A high-quality smartphone with advanced features',
        price: 50000,
        category: category._id.toString(),
        images: [{ url: 'https://example.com/phone.jpg', alt: 'Smartphone' }],
      })

    expect(res.status).toBe(201)
    expect(res.body.product).toMatchObject({
      name: 'Smartphone',
      description: 'A high-quality smartphone with advanced features',
      price: 50000,
      category: category._id.toString(),
      isActive: true,
      isFeatured: false,
      stock: 0,
    })
    expect(res.body.product._id).toBeDefined()
    expect(res.body.product.slug).toBeDefined()
    expect(res.body.product.images).toHaveLength(1)
    // URL is sanitized by XSS middleware, so check it contains the domain
    expect(res.body.product.images[0].url).toContain('example.com')
    expect(res.body.product.createdAt).toBeDefined()
  })

  it('creates a product with all optional fields', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Premium Smartphone',
        description: 'A premium smartphone with all the latest features and technology',
        price: 100000,
        compareAtPrice: 120000,
        category: category._id.toString(),
        images: [
          { url: 'https://example.com/phone1.jpg', alt: 'Front view' },
          { url: 'https://example.com/phone2.jpg', alt: 'Back view' },
        ],
        specifications: [
          { key: 'Display', value: '6.7 inch AMOLED' },
          { key: 'Processor', value: 'Snapdragon 888' },
        ],
        variants: [
          { name: 'Black 128GB', sku: 'SKU-001', price: 100000, stock: 50 },
          { name: 'White 256GB', sku: 'SKU-002', price: 110000, stock: 30 },
        ],
        stock: 80,
        isFeatured: true,
        tags: ['smartphone', 'premium', 'android'],
      })

    expect(res.status).toBe(201)
    expect(res.body.product).toMatchObject({
      name: 'Premium Smartphone',
      price: 100000,
      compareAtPrice: 120000,
      isFeatured: true,
      stock: 80,
    })
    expect(res.body.product.images).toHaveLength(2)
    expect(res.body.product.specifications).toHaveLength(2)
    expect(res.body.product.variants).toHaveLength(2)
    expect(res.body.product.tags).toEqual(['smartphone', 'premium', 'android'])
  })

  // ─── Required fields validation ────────────────────────────────────────────

  it('returns 400 when name is missing', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'A test product description',
        price: 100,
        category: category._id.toString(),
        images: [{ url: 'https://example.com/image.jpg' }],
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/name/i)
  })

  it('returns 400 when description is missing', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Product',
        price: 100,
        category: category._id.toString(),
        images: [{ url: 'https://example.com/image.jpg' }],
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/description/i)
  })

  it('returns 400 when price is missing', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Product',
        description: 'A test product description',
        category: category._id.toString(),
        images: [{ url: 'https://example.com/image.jpg' }],
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/price/i)
  })

  it('returns 400 when category is missing', async () => {
    const token = await createUserAndGetToken('admin')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Product',
        description: 'A test product description',
        price: 100,
        images: [{ url: 'https://example.com/image.jpg' }],
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/category/i)
  })

  it('returns 400 when images array is missing', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Product',
        description: 'A test product description',
        price: 100,
        category: category._id.toString(),
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/image/i)
  })

  it('returns 400 when images array is empty (Req 15.1)', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Product',
        description: 'A test product description',
        price: 100,
        category: category._id.toString(),
        images: [],
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/image/i)
  })

  // ─── Field type and constraint validation ──────────────────────────────────

  it('returns 400 when name is too short (< 3 chars)', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'AB',
        description: 'A test product description',
        price: 100,
        category: category._id.toString(),
        images: [{ url: 'https://example.com/image.jpg' }],
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'name')).toBe(true)
  })

  it('returns 400 when name exceeds 200 characters', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'A'.repeat(201),
        description: 'A test product description',
        price: 100,
        category: category._id.toString(),
        images: [{ url: 'https://example.com/image.jpg' }],
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'name')).toBe(true)
  })

  it('returns 400 when description is too short (< 10 chars)', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Product',
        description: 'Short',
        price: 100,
        category: category._id.toString(),
        images: [{ url: 'https://example.com/image.jpg' }],
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'description')).toBe(true)
  })

  it('returns 400 when description exceeds 5000 characters', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Product',
        description: 'A'.repeat(5001),
        price: 100,
        category: category._id.toString(),
        images: [{ url: 'https://example.com/image.jpg' }],
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'description')).toBe(true)
  })

  it('returns 400 when price is negative', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Product',
        description: 'A test product description',
        price: -100,
        category: category._id.toString(),
        images: [{ url: 'https://example.com/image.jpg' }],
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'price')).toBe(true)
  })

  it('returns 400 when price is not a number', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Product',
        description: 'A test product description',
        price: 'not-a-number',
        category: category._id.toString(),
        images: [{ url: 'https://example.com/image.jpg' }],
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'price')).toBe(true)
  })

  it('returns 400 when compareAtPrice is negative', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Product',
        description: 'A test product description',
        price: 100,
        compareAtPrice: -50,
        category: category._id.toString(),
        images: [{ url: 'https://example.com/image.jpg' }],
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'compareAtPrice')).toBe(true)
  })

  it('returns 400 when category ID is not a valid ObjectId', async () => {
    const token = await createUserAndGetToken('admin')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Product',
        description: 'A test product description',
        price: 100,
        category: 'not-a-valid-id',
        images: [{ url: 'https://example.com/image.jpg' }],
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'category')).toBe(true)
  })

  it('returns 400 when image URL is not valid', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Product',
        description: 'A test product description',
        price: 100,
        category: category._id.toString(),
        images: [{ url: 'not-a-valid-url' }],
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'images.0.url')).toBe(true)
  })

  it('returns 400 when stock is negative', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Product',
        description: 'A test product description',
        price: 100,
        category: category._id.toString(),
        images: [{ url: 'https://example.com/image.jpg' }],
        stock: -10,
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'stock')).toBe(true)
  })

  it('returns 400 when variant price is negative', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Product',
        description: 'A test product description',
        price: 100,
        category: category._id.toString(),
        images: [{ url: 'https://example.com/image.jpg' }],
        variants: [
          { name: 'Variant 1', price: -50, stock: 10 },
        ],
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'variants.0.price')).toBe(true)
  })

  // ─── Category not found ────────────────────────────────────────────────────

  it('returns 404 when category does not exist', async () => {
    const token = await createUserAndGetToken('admin')
    const nonExistentId = new mongoose.Types.ObjectId().toString()

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Product',
        description: 'A test product description',
        price: 100,
        category: nonExistentId,
        images: [{ url: 'https://example.com/image.jpg' }],
      })

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/category.*not found/i)
  })

  // ─── Persisted in DB ───────────────────────────────────────────────────────

  it('persists the created product in the database', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Smartphone',
        description: 'A high-quality smartphone with advanced features',
        price: 50000,
        category: category._id.toString(),
        images: [{ url: 'https://example.com/phone.jpg' }],
        stock: 100,
      })

    expect(res.status).toBe(201)

    const saved = await Product.findById(res.body.product._id)
    expect(saved).not.toBeNull()
    expect(saved!.name).toBe('Smartphone')
    expect(saved!.price).toBe(50000)
    expect(saved!.stock).toBe(100)
    expect(saved!.isActive).toBe(true)
    expect(saved!.category.toString()).toBe(category._id.toString())
  })

  it('generates a slug from the product name', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Premium Smartphone Pro Max',
        description: 'A high-quality smartphone with advanced features',
        price: 50000,
        category: category._id.toString(),
        images: [{ url: 'https://example.com/phone.jpg' }],
      })

    expect(res.status).toBe(201)
    expect(res.body.product.slug).toBe('premium-smartphone-pro-max')
  })

  it('sets default values for optional fields', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Product',
        description: 'A test product description',
        price: 100,
        category: category._id.toString(),
        images: [{ url: 'https://example.com/image.jpg' }],
      })

    expect(res.status).toBe(201)
    expect(res.body.product.stock).toBe(0)
    expect(res.body.product.isFeatured).toBe(false)
    expect(res.body.product.specifications).toEqual([])
    expect(res.body.product.variants).toEqual([])
    expect(res.body.product.tags).toEqual([])
    expect(res.body.product.averageRating).toBe(0)
    expect(res.body.product.reviewCount).toBe(0)
  })

  it('trims whitespace from name and description', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '  Smartphone  ',
        description: '  A high-quality smartphone with advanced features  ',
        price: 50000,
        category: category._id.toString(),
        images: [{ url: 'https://example.com/phone.jpg' }],
      })

    expect(res.status).toBe(201)
    expect(res.body.product.name).toBe('Smartphone')
    expect(res.body.product.description).toBe('A high-quality smartphone with advanced features')
  })
})
