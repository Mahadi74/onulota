/**
 * Integration tests for PUT /api/admin/products/:id
 *
 * Covers Requirement 15.2: WHEN an Admin updates a Product, THE Platform SHALL validate all required fields are present
 *
 * Acceptance criteria:
 *   - Accept PUT requests with product ID in URL path
 *   - Allow updating any product field (all fields optional)
 *   - Validate all provided fields with same constraints as creation
 *   - Validate category exists if category is being updated
 *   - Return 404 if product not found
 *   - Return 200 with updated product on success
 *   - Require admin authentication
 *   - Invalidate product caches after update
 *   - Handle validation errors with 400 Bad Request
 */

// Set required env vars BEFORE importing app (passport.ts reads them at module load time)
process.env.JWT_SECRET = 'test-jwt-secret-for-admin-product-update-tests'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-admin-product-update-tests'
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

/** Helper: create a product directly in the DB */
async function createProduct(
  name: string,
  categoryId: mongoose.Types.ObjectId,
  overrides?: Partial<any>
): Promise<any> {
  const product = new Product({
    name,
    description: 'Test product description',
    price: 100,
    category: categoryId,
    images: [{ url: 'https://example.com/image.jpg' }],
    stock: 50,
    ...overrides,
  })
  await product.save()
  return product
}

describe('PUT /api/admin/products/:id', () => {
  // ─── Authentication & Authorization ────────────────────────────────────────

  it('returns 401 when no token is provided', async () => {
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .send({
        name: 'Updated Product',
      })

    expect(res.status).toBe(401)
  })

  it('returns 403 when a non-admin user tries to update a product', async () => {
    const token = await createUserAndGetToken('user')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Product',
      })

    expect(res.status).toBe(403)
  })

  // ─── Happy path: update product with single field ──────────────────────────

  it('updates product name and returns 200 (Req 15.2)', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Original Name', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Name',
      })

    expect(res.status).toBe(200)
    expect(res.body.product).toMatchObject({
      _id: product._id.toString(),
      name: 'Updated Name',
      description: 'Test product description',
      price: 100,
    })
  })

  it('updates product description', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'Updated description with more details',
      })

    expect(res.status).toBe(200)
    expect(res.body.product.description).toBe('Updated description with more details')
  })

  it('updates product price', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        price: 250,
      })

    expect(res.status).toBe(200)
    expect(res.body.product.price).toBe(250)
  })

  it('updates product stock', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        stock: 200,
      })

    expect(res.status).toBe(200)
    expect(res.body.product.stock).toBe(200)
  })

  it('updates product isFeatured flag', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id, { isFeatured: false })

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        isFeatured: true,
      })

    expect(res.status).toBe(200)
    expect(res.body.product.isFeatured).toBe(true)
  })

  it('updates product tags', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        tags: ['new', 'tags', 'here'],
      })

    expect(res.status).toBe(200)
    expect(res.body.product.tags).toEqual(['new', 'tags', 'here'])
  })

  // ─── Happy path: update multiple fields ────────────────────────────────────

  it('updates multiple fields at once', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Original', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Product',
        description: 'Updated description',
        price: 500,
        stock: 100,
        isFeatured: true,
      })

    expect(res.status).toBe(200)
    expect(res.body.product).toMatchObject({
      name: 'Updated Product',
      description: 'Updated description',
      price: 500,
      stock: 100,
      isFeatured: true,
    })
  })

  it('updates product category', async () => {
    const token = await createUserAndGetToken('admin')
    const category1 = await createCategory('Electronics')
    const category2 = await createCategory('Clothing')
    const product = await createProduct('Test Product', category1._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: category2._id.toString(),
      })

    expect(res.status).toBe(200)
    expect(res.body.product.category).toBe(category2._id.toString())
  })

  it('updates product images', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        images: [
          { url: 'https://example.com/new-image1.jpg', alt: 'New Image 1' },
          { url: 'https://example.com/new-image2.jpg', alt: 'New Image 2' },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.product.images).toHaveLength(2)
    expect(res.body.product.images[0].url).toContain('new-image1')
  })

  it('updates product specifications', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        specifications: [
          { key: 'Color', value: 'Black' },
          { key: 'Size', value: 'Large' },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.product.specifications).toHaveLength(2)
    expect(res.body.product.specifications[0]).toMatchObject({ key: 'Color', value: 'Black' })
  })

  it('updates product variants', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        variants: [
          { name: 'Size M', sku: 'SKU-M', price: 100, stock: 50 },
          { name: 'Size L', sku: 'SKU-L', price: 110, stock: 40 },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.product.variants).toHaveLength(2)
  })

  it('updates compareAtPrice', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        compareAtPrice: 150,
      })

    expect(res.status).toBe(200)
    expect(res.body.product.compareAtPrice).toBe(150)
  })

  // ─── Field validation ──────────────────────────────────────────────────────

  it('returns 400 when name is too short (< 3 chars)', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'AB',
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'name')).toBe(true)
  })

  it('returns 400 when name exceeds 200 characters', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'A'.repeat(201),
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'name')).toBe(true)
  })

  it('returns 400 when description is too short (< 10 chars)', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'Short',
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'description')).toBe(true)
  })

  it('returns 400 when description exceeds 5000 characters', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'A'.repeat(5001),
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'description')).toBe(true)
  })

  it('returns 400 when price is negative', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        price: -100,
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'price')).toBe(true)
  })

  it('returns 400 when price is not a number', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        price: 'not-a-number',
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'price')).toBe(true)
  })

  it('returns 400 when compareAtPrice is negative', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        compareAtPrice: -50,
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'compareAtPrice')).toBe(true)
  })

  it('returns 400 when stock is negative', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        stock: -10,
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'stock')).toBe(true)
  })

  it('returns 400 when image URL is not valid', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        images: [{ url: 'not-a-valid-url' }],
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'images.0.url')).toBe(true)
  })

  it('returns 400 when variant price is negative', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        variants: [
          { name: 'Variant 1', price: -50, stock: 10 },
        ],
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'variants.0.price')).toBe(true)
  })

  // ─── Category validation ───────────────────────────────────────────────────

  it('returns 400 when category ID is not a valid ObjectId', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'not-a-valid-id',
      })

    expect(res.status).toBe(400)
    expect(res.body.details).toBeDefined()
    expect(res.body.details.some((d: any) => d.field === 'category')).toBe(true)
  })

  it('returns 404 when category does not exist', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)
    const nonExistentId = new mongoose.Types.ObjectId().toString()

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: nonExistentId,
      })

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/category.*not found/i)
  })

  // ─── Product ID validation ─────────────────────────────────────────────────

  it('returns 400 when product ID is not a valid ObjectId', async () => {
    const token = await createUserAndGetToken('admin')

    const res = await request(app)
      .put('/api/admin/products/not-a-valid-id')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Product',
      })

    expect(res.status).toBe(400)
  })

  it('returns 404 when product does not exist', async () => {
    const token = await createUserAndGetToken('admin')
    const nonExistentId = new mongoose.Types.ObjectId().toString()

    const res = await request(app)
      .put(`/api/admin/products/${nonExistentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Product',
      })

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/product.*not found/i)
  })

  // ─── Database persistence ─────────────────────────────────────────────────

  it('persists the updated product in the database', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Original', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Product',
        price: 500,
        stock: 200,
      })

    expect(res.status).toBe(200)

    const saved = await Product.findById(product._id)
    expect(saved).not.toBeNull()
    expect(saved!.name).toBe('Updated Product')
    expect(saved!.price).toBe(500)
    expect(saved!.stock).toBe(200)
  })

  it('preserves unchanged fields when updating', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Original', category._id, {
      price: 100,
      stock: 50,
      isFeatured: true,
    })

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Name',
      })

    expect(res.status).toBe(200)
    expect(res.body.product).toMatchObject({
      name: 'Updated Name',
      price: 100,
      stock: 50,
      isFeatured: true,
    })
  })

  it('trims whitespace from name and description', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Original', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '  Updated Name  ',
        description: '  Updated description with more details  ',
      })

    expect(res.status).toBe(200)
    expect(res.body.product.name).toBe('Updated Name')
    expect(res.body.product.description).toBe('Updated description with more details')
  })

  it('allows clearing compareAtPrice by setting to null', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id, {
      compareAtPrice: 150,
    })

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        compareAtPrice: null,
      })

    expect(res.status).toBe(200)
    expect(res.body.product.compareAtPrice).toBeUndefined()
  })

  it('allows clearing tags by setting to empty array', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id, {
      tags: ['tag1', 'tag2'],
    })

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        tags: [],
      })

    expect(res.status).toBe(200)
    expect(res.body.product.tags).toEqual([])
  })

  it('allows clearing specifications by setting to empty array', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id, {
      specifications: [{ key: 'Color', value: 'Black' }],
    })

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        specifications: [],
      })

    expect(res.status).toBe(200)
    expect(res.body.product.specifications).toEqual([])
  })

  it('allows clearing variants by setting to empty array', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id, {
      variants: [{ name: 'Variant 1', price: 100, stock: 50 }],
    })

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        variants: [],
      })

    expect(res.status).toBe(200)
    expect(res.body.product.variants).toEqual([])
  })

  it('does not update product if no fields are provided', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Original', category._id, {
      price: 100,
    })

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(res.status).toBe(200)
    expect(res.body.product).toMatchObject({
      name: 'Original',
      price: 100,
    })
  })

  it('returns updated product with all fields', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Original', category._id)

    const res = await request(app)
      .put(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Product',
        description: 'Updated description',
        price: 500,
      })

    expect(res.status).toBe(200)
    expect(res.body.product._id).toBeDefined()
    expect(res.body.product.slug).toBeDefined()
    expect(res.body.product.createdAt).toBeDefined()
    expect(res.body.product.updatedAt).toBeDefined()
    expect(res.body.product.isActive).toBe(true)
  })
})
