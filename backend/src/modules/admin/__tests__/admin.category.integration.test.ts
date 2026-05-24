/**
 * Integration tests for POST /api/admin/categories and PUT /api/admin/categories/:id
 *
 * Covers Requirements: 16.1, 16.2, 16.3, 16.4
 * Acceptance criteria:
 *   16.1 - Admin creates a category with required name and optional parent
 *   16.2 - Hierarchy depth validation (max 3 levels: 0, 1, 2)
 *   16.3 - Name uniqueness within the same parent level (create and update)
 *   16.4 - Prevent deletion if the category contains products or child categories
 */

// Set required env vars BEFORE importing app (passport.ts reads them at module load time)
process.env.JWT_SECRET = 'test-jwt-secret-for-admin-category-tests'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-admin-category-tests'
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

/** Helper: create a root category directly in the DB */
async function createRootCategory(name: string): Promise<mongoose.Document & { _id: mongoose.Types.ObjectId; level: number }> {
  const cat = new Category({ name })
  await cat.save()
  return cat as unknown as mongoose.Document & { _id: mongoose.Types.ObjectId; level: number }
}

describe('POST /api/admin/categories', () => {
  // ─── Authentication & Authorization ────────────────────────────────────────

  it('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .post('/api/admin/categories')
      .send({ name: 'Electronics' })

    expect(res.status).toBe(401)
  })

  it('returns 403 when a non-admin user tries to create a category', async () => {
    const token = await createUserAndGetToken('user')

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Electronics' })

    expect(res.status).toBe(403)
  })

  // ─── Happy path: root category ──────────────────────────────────────────────

  it('creates a root category (level 0) with 201 status (Req 16.1)', async () => {
    const token = await createUserAndGetToken('admin')

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Electronics' })

    expect(res.status).toBe(201)
    expect(res.body.category).toMatchObject({
      name: 'Electronics',
      slug: 'electronics',
      level: 0,
      parent: null,
      isActive: true,
    })
    expect(res.body.category._id).toBeDefined()
    expect(res.body.category.createdAt).toBeDefined()
  })

  it('creates a root category with optional fields (icon, image, order)', async () => {
    const token = await createUserAndGetToken('admin')

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Fashion',
        icon: 'fashion-icon',
        image: 'https://example.com/fashion.jpg',
        order: 5,
      })

    expect(res.status).toBe(201)
    expect(res.body.category).toMatchObject({
      name: 'Fashion',
      icon: 'fashion-icon',
      level: 0,
      order: 5,
    })
    // Image URL is stored (may be sanitized by XSS middleware)
    expect(res.body.category.image).toBeDefined()
  })

  // ─── Happy path: subcategory (level 1) ─────────────────────────────────────

  it('creates a level-1 subcategory under a root category (Req 16.1, 16.2)', async () => {
    const token = await createUserAndGetToken('admin')
    const parent = await createRootCategory('Electronics')

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mobile Phones', parent: parent._id.toString() })

    expect(res.status).toBe(201)
    expect(res.body.category).toMatchObject({
      name: 'Mobile Phones',
      level: 1,
      parent: parent._id.toString(),
    })
    expect(res.body.category.slug).toBe('electronics-mobile-phones')
  })

  // ─── Happy path: sub-subcategory (level 2) ─────────────────────────────────

  it('creates a level-2 sub-subcategory (Req 16.2)', async () => {
    const token = await createUserAndGetToken('admin')
    const root = await createRootCategory('Electronics')

    const level1Res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mobile Phones', parent: root._id.toString() })

    const level1Id = level1Res.body.category._id

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Smartphones', parent: level1Id })

    expect(res.status).toBe(201)
    expect(res.body.category).toMatchObject({
      name: 'Smartphones',
      level: 2,
      parent: level1Id,
    })
  })

  // ─── Hierarchy depth validation ─────────────────────────────────────────────

  it('rejects creation when parent is at level 2 (would exceed max depth) (Req 16.2)', async () => {
    const token = await createUserAndGetToken('admin')
    const root = await createRootCategory('Electronics')

    const level1Res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mobile Phones', parent: root._id.toString() })

    const level1Id = level1Res.body.category._id

    const level2Res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Smartphones', parent: level1Id })

    const level2Id = level2Res.body.category._id

    // Attempt to create level 3 — should be rejected
    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Android Phones', parent: level2Id })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/hierarchy cannot exceed 3 levels/i)
  })

  // ─── Name uniqueness within same parent ─────────────────────────────────────

  it('rejects duplicate name within the same parent level (Req 16.3)', async () => {
    const token = await createUserAndGetToken('admin')

    // Create first root category
    await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Electronics' })

    // Attempt to create another root category with the same name
    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Electronics' })

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/already exists/i)
  })

  it('allows same name under different parents', async () => {
    const token = await createUserAndGetToken('admin')
    const parent1 = await createRootCategory('Electronics')
    const parent2 = await createRootCategory('Fashion')

    const res1 = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Accessories', parent: parent1._id.toString() })

    const res2 = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Accessories', parent: parent2._id.toString() })

    expect(res1.status).toBe(201)
    expect(res2.status).toBe(201)
    expect(res1.body.category.slug).toBe('electronics-accessories')
    expect(res2.body.category.slug).toBe('fashion-accessories')
  })

  // ─── Parent not found ────────────────────────────────────────────────────────

  it('returns 404 when parent category does not exist', async () => {
    const token = await createUserAndGetToken('admin')
    const nonExistentId = new mongoose.Types.ObjectId().toString()

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mobile Phones', parent: nonExistentId })

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/parent category not found/i)
  })

  // ─── Input validation ────────────────────────────────────────────────────────

  it('returns 400 when name is missing', async () => {
    const token = await createUserAndGetToken('admin')

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(res.status).toBe(400)
  })

  it('returns 400 when name is too short (< 2 chars)', async () => {
    const token = await createUserAndGetToken('admin')

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when name exceeds 100 characters', async () => {
    const token = await createUserAndGetToken('admin')

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A'.repeat(101) })

    expect(res.status).toBe(400)
  })

  it('returns 400 when parent is not a valid ObjectId', async () => {
    const token = await createUserAndGetToken('admin')

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Electronics', parent: 'not-a-valid-id' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when image is not a valid URL', async () => {
    const token = await createUserAndGetToken('admin')

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Electronics', image: 'not-a-url' })

    expect(res.status).toBe(400)
  })

  // ─── Persisted in DB ─────────────────────────────────────────────────────────

  it('persists the created category in the database', async () => {
    const token = await createUserAndGetToken('admin')

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Electronics' })

    expect(res.status).toBe(201)

    const saved = await Category.findById(res.body.category._id)
    expect(saved).not.toBeNull()
    expect(saved!.name).toBe('Electronics')
    expect(saved!.level).toBe(0)
  })
})

describe('PUT /api/admin/categories/:id', () => {
  // ─── Authentication & Authorization ────────────────────────────────────────

  it('returns 401 when no token is provided', async () => {
    const cat = await createRootCategory('Electronics')

    const res = await request(app)
      .put(`/api/admin/categories/${cat._id}`)
      .send({ name: 'Updated Electronics' })

    expect(res.status).toBe(401)
  })

  it('returns 403 when a non-admin user tries to update a category', async () => {
    const token = await createUserAndGetToken('user')
    const cat = await createRootCategory('Electronics')

    const res = await request(app)
      .put(`/api/admin/categories/${cat._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Electronics' })

    expect(res.status).toBe(403)
  })

  // ─── 404 Not Found ──────────────────────────────────────────────────────────

  it('returns 404 when the category does not exist', async () => {
    const token = await createUserAndGetToken('admin')
    const nonExistentId = new mongoose.Types.ObjectId().toString()

    const res = await request(app)
      .put(`/api/admin/categories/${nonExistentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' })

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/category not found/i)
  })

  // ─── Input validation ────────────────────────────────────────────────────────

  it('returns 400 when the category ID is not a valid ObjectId', async () => {
    const token = await createUserAndGetToken('admin')

    const res = await request(app)
      .put('/api/admin/categories/not-a-valid-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when name is too short (< 2 chars)', async () => {
    const token = await createUserAndGetToken('admin')
    const cat = await createRootCategory('Electronics')

    const res = await request(app)
      .put(`/api/admin/categories/${cat._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when name exceeds 100 characters', async () => {
    const token = await createUserAndGetToken('admin')
    const cat = await createRootCategory('Electronics')

    const res = await request(app)
      .put(`/api/admin/categories/${cat._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A'.repeat(101) })

    expect(res.status).toBe(400)
  })

  it('returns 400 when image is not a valid URL', async () => {
    const token = await createUserAndGetToken('admin')
    const cat = await createRootCategory('Electronics')

    const res = await request(app)
      .put(`/api/admin/categories/${cat._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ image: 'not-a-url' })

    expect(res.status).toBe(400)
  })

  // ─── Happy path: update name ─────────────────────────────────────────────────

  it('updates the category name and returns 200 with updated category (Req 16.3)', async () => {
    const token = await createUserAndGetToken('admin')
    const cat = await createRootCategory('Electronics')

    const res = await request(app)
      .put(`/api/admin/categories/${cat._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Consumer Electronics' })

    expect(res.status).toBe(200)
    expect(res.body.category).toMatchObject({
      _id: cat._id.toString(),
      name: 'Consumer Electronics',
      level: 0,
      parent: null,
    })
    expect(res.body.category.updatedAt).toBeDefined()
  })

  it('updates optional fields (icon, image, order) without changing name', async () => {
    const token = await createUserAndGetToken('admin')
    const cat = await createRootCategory('Electronics')

    const res = await request(app)
      .put(`/api/admin/categories/${cat._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        icon: 'new-icon',
        image: 'https://example.com/new-image.jpg',
        order: 10,
      })

    expect(res.status).toBe(200)
    expect(res.body.category.name).toBe('Electronics')
    expect(res.body.category.icon).toBe('new-icon')
    expect(res.body.category.order).toBe(10)
  })

  it('persists the updated category in the database', async () => {
    const token = await createUserAndGetToken('admin')
    const cat = await createRootCategory('Electronics')

    await request(app)
      .put(`/api/admin/categories/${cat._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Consumer Electronics', order: 3 })

    const saved = await Category.findById(cat._id)
    expect(saved).not.toBeNull()
    expect(saved!.name).toBe('Consumer Electronics')
    expect(saved!.order).toBe(3)
  })

  // ─── Name uniqueness within same parent (Req 16.3) ──────────────────────────

  it('returns 409 when updated name conflicts with a sibling category (Req 16.3)', async () => {
    const token = await createUserAndGetToken('admin')
    await createRootCategory('Electronics')
    const fashion = await createRootCategory('Fashion')

    // Try to rename "Fashion" to "Electronics" — conflicts with sibling
    const res = await request(app)
      .put(`/api/admin/categories/${fashion._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Electronics' })

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/already exists/i)
  })

  it('allows updating a category to its own current name (no false conflict)', async () => {
    const token = await createUserAndGetToken('admin')
    const cat = await createRootCategory('Electronics')

    // Updating with the same name should succeed (not conflict with itself)
    const res = await request(app)
      .put(`/api/admin/categories/${cat._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Electronics' })

    expect(res.status).toBe(200)
    expect(res.body.category.name).toBe('Electronics')
  })

  it('allows same name under different parents when updating (Req 16.3)', async () => {
    const token = await createUserAndGetToken('admin')
    const parent1 = await createRootCategory('Electronics')
    const parent2 = await createRootCategory('Fashion')

    // Create "Accessories" under Electronics
    const acc1Res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Accessories', parent: parent1._id.toString() })

    // Create "Bags" under Fashion
    const bagsRes = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bags', parent: parent2._id.toString() })

    // Rename "Bags" under Fashion to "Accessories" — allowed because different parent
    const res = await request(app)
      .put(`/api/admin/categories/${bagsRes.body.category._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Accessories' })

    expect(res.status).toBe(200)
    expect(res.body.category.name).toBe('Accessories')
    // The original Accessories under Electronics should still exist
    const original = await Category.findById(acc1Res.body.category._id)
    expect(original).not.toBeNull()
    expect(original!.name).toBe('Accessories')
  })

  it('returns 409 when updated name conflicts with a sibling subcategory', async () => {
    const token = await createUserAndGetToken('admin')
    const parent = await createRootCategory('Electronics')

    // Create two subcategories under the same parent
    await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mobile Phones', parent: parent._id.toString() })

    const laptopsRes = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Laptops', parent: parent._id.toString() })

    // Try to rename "Laptops" to "Mobile Phones" — conflicts with sibling
    const res = await request(app)
      .put(`/api/admin/categories/${laptopsRes.body.category._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mobile Phones' })

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/already exists/i)
  })
})

describe('DELETE /api/admin/categories/:id', () => {
  // ─── Authentication & Authorization ────────────────────────────────────────

  it('returns 401 when no token is provided', async () => {
    const cat = await createRootCategory('Electronics')

    const res = await request(app)
      .delete(`/api/admin/categories/${cat._id}`)

    expect(res.status).toBe(401)
  })

  it('returns 403 when a non-admin user tries to delete a category', async () => {
    const token = await createUserAndGetToken('user')
    const cat = await createRootCategory('Electronics')

    const res = await request(app)
      .delete(`/api/admin/categories/${cat._id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })

  // ─── 404 Not Found ──────────────────────────────────────────────────────────

  it('returns 404 when the category does not exist', async () => {
    const token = await createUserAndGetToken('admin')
    const nonExistentId = new mongoose.Types.ObjectId().toString()

    const res = await request(app)
      .delete(`/api/admin/categories/${nonExistentId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/category not found/i)
  })

  // ─── 400 Invalid ObjectId ───────────────────────────────────────────────────

  it('returns 400 when the category ID is not a valid ObjectId', async () => {
    const token = await createUserAndGetToken('admin')

    const res = await request(app)
      .delete('/api/admin/categories/not-a-valid-id')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })

  // ─── 409 Conflict: products exist ──────────────────────────────────────────

  it('returns 409 when the category has products referencing it (Req 16.4)', async () => {
    const token = await createUserAndGetToken('admin')
    const cat = await createRootCategory('Electronics')

    // Create a product referencing this category
    await Product.create({
      name: 'Test Product',
      description: 'A test product description that is long enough',
      price: 100,
      category: cat._id,
      stock: 10,
    })

    const res = await request(app)
      .delete(`/api/admin/categories/${cat._id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/cannot delete category/i)
    expect(res.body.message).toMatch(/product/i)
  })

  // ─── 409 Conflict: child categories exist ──────────────────────────────────

  it('returns 409 when the category has child categories', async () => {
    const token = await createUserAndGetToken('admin')
    const parent = await createRootCategory('Electronics')

    // Create a child category
    await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mobile Phones', parent: parent._id.toString() })

    const res = await request(app)
      .delete(`/api/admin/categories/${parent._id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/cannot delete category/i)
    expect(res.body.message).toMatch(/child categor/i)
  })

  // ─── Happy path: successful deletion ───────────────────────────────────────

  it('deletes a leaf category with no products and returns 200 with success message', async () => {
    const token = await createUserAndGetToken('admin')
    const cat = await createRootCategory('Electronics')

    const res = await request(app)
      .delete(`/api/admin/categories/${cat._id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/deleted successfully/i)
  })

  it('removes the category from the database on successful deletion', async () => {
    const token = await createUserAndGetToken('admin')
    const cat = await createRootCategory('Electronics')

    await request(app)
      .delete(`/api/admin/categories/${cat._id}`)
      .set('Authorization', `Bearer ${token}`)

    const found = await Category.findById(cat._id)
    expect(found).toBeNull()
  })

  it('deletes a leaf subcategory (level 1) when it has no products or children', async () => {
    const token = await createUserAndGetToken('admin')
    const parent = await createRootCategory('Electronics')

    const subRes = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mobile Phones', parent: parent._id.toString() })

    const subId = subRes.body.category._id

    const res = await request(app)
      .delete(`/api/admin/categories/${subId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/deleted successfully/i)

    const found = await Category.findById(subId)
    expect(found).toBeNull()

    // Parent should still exist
    const parentFound = await Category.findById(parent._id)
    expect(parentFound).not.toBeNull()
  })

  it('allows deletion of a root category after its child is deleted', async () => {
    const token = await createUserAndGetToken('admin')
    const parent = await createRootCategory('Electronics')

    const subRes = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mobile Phones', parent: parent._id.toString() })

    const subId = subRes.body.category._id

    // Delete child first
    await request(app)
      .delete(`/api/admin/categories/${subId}`)
      .set('Authorization', `Bearer ${token}`)

    // Now delete parent — should succeed
    const res = await request(app)
      .delete(`/api/admin/categories/${parent._id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/deleted successfully/i)
  })
})

describe('PUT /api/admin/categories/reorder', () => {
  // ─── Authentication & Authorization ────────────────────────────────────────

  it('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .put('/api/admin/categories/reorder')
      .send({ categories: [] })

    expect(res.status).toBe(401)
  })

  it('returns 403 when a non-admin user tries to reorder categories', async () => {
    const token = await createUserAndGetToken('user')
    const cat = await createRootCategory('Electronics')

    const res = await request(app)
      .put('/api/admin/categories/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({ categories: [{ id: cat._id.toString(), order: 0 }] })

    expect(res.status).toBe(403)
  })

  // ─── Input validation ────────────────────────────────────────────────────────

  it('returns 400 when categories array is missing', async () => {
    const token = await createUserAndGetToken('admin')

    const res = await request(app)
      .put('/api/admin/categories/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(res.status).toBe(400)
  })

  it('returns 400 when categories array is empty', async () => {
    const token = await createUserAndGetToken('admin')

    const res = await request(app)
      .put('/api/admin/categories/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({ categories: [] })

    expect(res.status).toBe(400)
  })

  it('returns 400 when a category id is not a valid ObjectId', async () => {
    const token = await createUserAndGetToken('admin')

    const res = await request(app)
      .put('/api/admin/categories/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({ categories: [{ id: 'not-a-valid-id', order: 0 }] })

    expect(res.status).toBe(400)
  })

  it('returns 400 when order is missing from an item', async () => {
    const token = await createUserAndGetToken('admin')
    const cat = await createRootCategory('Electronics')

    const res = await request(app)
      .put('/api/admin/categories/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({ categories: [{ id: cat._id.toString() }] })

    expect(res.status).toBe(400)
  })

  it('returns 400 when order is negative', async () => {
    const token = await createUserAndGetToken('admin')
    const cat = await createRootCategory('Electronics')

    const res = await request(app)
      .put('/api/admin/categories/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({ categories: [{ id: cat._id.toString(), order: -1 }] })

    expect(res.status).toBe(400)
  })

  // ─── 404 Not Found ──────────────────────────────────────────────────────────

  it('returns 404 when a category ID does not exist', async () => {
    const token = await createUserAndGetToken('admin')
    const nonExistentId = new mongoose.Types.ObjectId().toString()

    const res = await request(app)
      .put('/api/admin/categories/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({ categories: [{ id: nonExistentId, order: 0 }] })

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/category not found/i)
  })

  // ─── 400 Mixed parents ──────────────────────────────────────────────────────

  it('returns 400 when categories belong to different parent levels (Req 16.5)', async () => {
    const token = await createUserAndGetToken('admin')
    const root1 = await createRootCategory('Electronics')
    const root2 = await createRootCategory('Fashion')

    // Create a subcategory under root1
    const subRes = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mobile Phones', parent: root1._id.toString() })

    const subId = subRes.body.category._id

    // Attempt to reorder root2 (level 0, no parent) together with subId (level 1, parent = root1)
    const res = await request(app)
      .put('/api/admin/categories/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categories: [
          { id: root2._id.toString(), order: 0 },
          { id: subId, order: 1 },
        ],
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/same parent level/i)
  })

  // ─── Happy path: reorder root categories ────────────────────────────────────

  it('reorders root categories and returns 200 with updated count (Req 16.5)', async () => {
    const token = await createUserAndGetToken('admin')
    const cat1 = await createRootCategory('Electronics')
    const cat2 = await createRootCategory('Fashion')
    const cat3 = await createRootCategory('Sports')

    const res = await request(app)
      .put('/api/admin/categories/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categories: [
          { id: cat1._id.toString(), order: 2 },
          { id: cat2._id.toString(), order: 0 },
          { id: cat3._id.toString(), order: 1 },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/reordered successfully/i)
    expect(res.body.updated).toBe(3)
  })

  it('persists the new order values in the database (Req 16.5)', async () => {
    const token = await createUserAndGetToken('admin')
    const cat1 = await createRootCategory('Electronics')
    const cat2 = await createRootCategory('Fashion')

    await request(app)
      .put('/api/admin/categories/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categories: [
          { id: cat1._id.toString(), order: 5 },
          { id: cat2._id.toString(), order: 3 },
        ],
      })

    const saved1 = await Category.findById(cat1._id)
    const saved2 = await Category.findById(cat2._id)

    expect(saved1!.order).toBe(5)
    expect(saved2!.order).toBe(3)
  })

  it('reorders subcategories within the same parent (Req 16.5)', async () => {
    const token = await createUserAndGetToken('admin')
    const parent = await createRootCategory('Electronics')

    const sub1Res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mobile Phones', parent: parent._id.toString() })

    const sub2Res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Laptops', parent: parent._id.toString() })

    const sub1Id = sub1Res.body.category._id
    const sub2Id = sub2Res.body.category._id

    const res = await request(app)
      .put('/api/admin/categories/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categories: [
          { id: sub1Id, order: 10 },
          { id: sub2Id, order: 5 },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.updated).toBe(2)

    const saved1 = await Category.findById(sub1Id)
    const saved2 = await Category.findById(sub2Id)
    expect(saved1!.order).toBe(10)
    expect(saved2!.order).toBe(5)
  })

  it('allows reordering a single category (updating its order value)', async () => {
    const token = await createUserAndGetToken('admin')
    const cat = await createRootCategory('Electronics')

    const res = await request(app)
      .put('/api/admin/categories/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({ categories: [{ id: cat._id.toString(), order: 7 }] })

    expect(res.status).toBe(200)
    expect(res.body.updated).toBe(1)

    const saved = await Category.findById(cat._id)
    expect(saved!.order).toBe(7)
  })
})
