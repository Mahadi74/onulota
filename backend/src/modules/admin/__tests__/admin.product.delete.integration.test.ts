/**
 * Integration tests for DELETE /api/admin/products/:id
 *
 * Covers Requirement 15.3: WHEN an Admin deletes a Product, THE Platform SHALL soft-delete the Product (mark as inactive)
 *
 * Acceptance criteria:
 *   - Accept DELETE requests with product ID in URL path
 *   - Soft-delete the product by setting isActive to false (not permanently delete)
 *   - Return 404 if product not found
 *   - Return 200 with success message on successful deletion
 *   - Require admin authentication
 *   - Invalidate product caches after deletion
 *   - Handle invalid product IDs with 400 Bad Request
 */

// Set required env vars BEFORE importing app (passport.ts reads them at module load time)
process.env.JWT_SECRET = 'test-jwt-secret-for-admin-product-delete-tests'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-admin-product-delete-tests'
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
    isActive: true,
    ...overrides,
  })
  await product.save()
  return product
}

describe('DELETE /api/admin/products/:id', () => {
  // ─── Authentication & Authorization ────────────────────────────────────────

  it('returns 401 when no token is provided', async () => {
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)

    expect(res.status).toBe(401)
  })

  it('returns 403 when a non-admin user tries to delete a product', async () => {
    const token = await createUserAndGetToken('user')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })

  // ─── Happy path: soft delete product ───────────────────────────────────────

  it('soft-deletes a product and returns 200 (Req 15.3)', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/deleted successfully/i)
  })

  it('marks product as inactive (isActive: false) after deletion', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    // Verify product is marked as inactive in database
    const deletedProduct = await Product.findById(product._id)
    expect(deletedProduct).not.toBeNull()
    expect(deletedProduct!.isActive).toBe(false)
  })

  it('preserves product data after soft deletion', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id, {
      description: 'Important product description',
      price: 500,
      stock: 100,
    })

    const res = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    // Verify product data is preserved
    const deletedProduct = await Product.findById(product._id)
    expect(deletedProduct).not.toBeNull()
    expect(deletedProduct!.name).toBe('Test Product')
    expect(deletedProduct!.description).toBe('Important product description')
    expect(deletedProduct!.price).toBe(500)
    expect(deletedProduct!.stock).toBe(100)
    expect(deletedProduct!.category.toString()).toBe(category._id.toString())
  })

  it('does not permanently delete the product from database', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)
    const productId = product._id.toString()

    const res = await request(app)
      .delete(`/api/admin/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    // Verify product still exists in database (soft delete, not hard delete)
    const deletedProduct = await Product.findById(productId)
    expect(deletedProduct).not.toBeNull()
  })

  // ─── Product ID validation ─────────────────────────────────────────────────

  it('returns 400 when product ID is not a valid ObjectId', async () => {
    const token = await createUserAndGetToken('admin')

    const res = await request(app)
      .delete('/api/admin/products/not-a-valid-id')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })

  it('returns 404 when product does not exist', async () => {
    const token = await createUserAndGetToken('admin')
    const nonExistentId = new mongoose.Types.ObjectId().toString()

    const res = await request(app)
      .delete(`/api/admin/products/${nonExistentId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/product.*not found/i)
  })

  // ─── Idempotency: deleting already deleted product ──────────────────────────

  it('allows deleting an already deleted product (idempotent)', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    // First deletion
    const res1 = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res1.status).toBe(200)

    // Second deletion (should also succeed)
    const res2 = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res2.status).toBe(200)
    expect(res2.body.message).toMatch(/deleted successfully/i)

    // Verify product is still marked as inactive
    const deletedProduct = await Product.findById(product._id)
    expect(deletedProduct!.isActive).toBe(false)
  })

  // ─── Multiple products deletion ────────────────────────────────────────────

  it('deletes multiple products independently', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product1 = await createProduct('Product 1', category._id)
    const product2 = await createProduct('Product 2', category._id)

    // Delete first product
    const res1 = await request(app)
      .delete(`/api/admin/products/${product1._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res1.status).toBe(200)

    // Delete second product
    const res2 = await request(app)
      .delete(`/api/admin/products/${product2._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res2.status).toBe(200)

    // Verify both are marked as inactive
    const deleted1 = await Product.findById(product1._id)
    const deleted2 = await Product.findById(product2._id)
    expect(deleted1!.isActive).toBe(false)
    expect(deleted2!.isActive).toBe(false)
  })

  it('does not affect other products when deleting one', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product1 = await createProduct('Product 1', category._id)
    const product2 = await createProduct('Product 2', category._id)

    // Delete first product
    const res = await request(app)
      .delete(`/api/admin/products/${product1._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    // Verify second product is still active
    const unaffected = await Product.findById(product2._id)
    expect(unaffected!.isActive).toBe(true)
  })

  // ─── Product with various attributes ───────────────────────────────────────

  it('soft-deletes product with variants', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id, {
      variants: [
        { name: 'Size M', sku: 'SKU-M', price: 100, stock: 50 },
        { name: 'Size L', sku: 'SKU-L', price: 110, stock: 40 },
      ],
    })

    const res = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    const deletedProduct = await Product.findById(product._id)
    expect(deletedProduct!.isActive).toBe(false)
    expect(deletedProduct!.variants).toHaveLength(2)
  })

  it('soft-deletes product with specifications', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id, {
      specifications: [
        { key: 'Color', value: 'Black' },
        { key: 'Size', value: 'Large' },
      ],
    })

    const res = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    const deletedProduct = await Product.findById(product._id)
    expect(deletedProduct!.isActive).toBe(false)
    expect(deletedProduct!.specifications).toHaveLength(2)
  })

  it('soft-deletes product with multiple images', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id, {
      images: [
        { url: 'https://example.com/image1.jpg', alt: 'Image 1' },
        { url: 'https://example.com/image2.jpg', alt: 'Image 2' },
        { url: 'https://example.com/image3.jpg', alt: 'Image 3' },
      ],
    })

    const res = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    const deletedProduct = await Product.findById(product._id)
    expect(deletedProduct!.isActive).toBe(false)
    expect(deletedProduct!.images).toHaveLength(3)
  })

  it('soft-deletes featured product', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id, {
      isFeatured: true,
    })

    const res = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    const deletedProduct = await Product.findById(product._id)
    expect(deletedProduct!.isActive).toBe(false)
    expect(deletedProduct!.isFeatured).toBe(true)
  })

  it('soft-deletes product with tags', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id, {
      tags: ['electronics', 'gadget', 'premium'],
    })

    const res = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    const deletedProduct = await Product.findById(product._id)
    expect(deletedProduct!.isActive).toBe(false)
    expect(deletedProduct!.tags).toEqual(['electronics', 'gadget', 'premium'])
  })

  // ─── Response format ───────────────────────────────────────────────────────

  it('returns success message in response', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('message')
    expect(typeof res.body.message).toBe('string')
  })

  it('does not return product data in delete response', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id)

    const res = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.product).toBeUndefined()
  })

  // ─── Edge cases ────────────────────────────────────────────────────────────

  it('handles product with zero stock', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id, {
      stock: 0,
    })

    const res = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    const deletedProduct = await Product.findById(product._id)
    expect(deletedProduct!.isActive).toBe(false)
    expect(deletedProduct!.stock).toBe(0)
  })

  it('handles product with high stock', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id, {
      stock: 999999,
    })

    const res = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    const deletedProduct = await Product.findById(product._id)
    expect(deletedProduct!.isActive).toBe(false)
    expect(deletedProduct!.stock).toBe(999999)
  })

  it('handles product with high price', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id, {
      price: 999999.99,
    })

    const res = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    const deletedProduct = await Product.findById(product._id)
    expect(deletedProduct!.isActive).toBe(false)
    expect(deletedProduct!.price).toBe(999999.99)
  })

  it('handles product with compareAtPrice', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id, {
      price: 100,
      compareAtPrice: 150,
    })

    const res = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    const deletedProduct = await Product.findById(product._id)
    expect(deletedProduct!.isActive).toBe(false)
    expect(deletedProduct!.compareAtPrice).toBe(150)
  })

  it('handles product with average rating', async () => {
    const token = await createUserAndGetToken('admin')
    const category = await createCategory('Electronics')
    const product = await createProduct('Test Product', category._id, {
      averageRating: 4.5,
      reviewCount: 100,
    })

    const res = await request(app)
      .delete(`/api/admin/products/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    const deletedProduct = await Product.findById(product._id)
    expect(deletedProduct!.isActive).toBe(false)
    expect(deletedProduct!.averageRating).toBe(4.5)
    expect(deletedProduct!.reviewCount).toBe(100)
  })
})
