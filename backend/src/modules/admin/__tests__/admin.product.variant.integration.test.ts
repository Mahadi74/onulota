/**
 * Integration tests for product variant management endpoints.
 * 
 * Tests:
 * - Adding variants to products
 * - Updating existing variants
 * - Deleting variants
 * - Retrieving variants
 * - Variant validation
 * - SKU uniqueness validation
 */

// Set required env vars BEFORE importing app (passport.ts reads them at module load time)
process.env.JWT_SECRET = 'test-jwt-secret-for-variant-tests'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-variant-tests'
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:5000/api/auth/google/callback'

import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import express from 'express'
import { createApp } from '../../../app'
import { Product } from '../../../models/Product'
import { Category } from '../../../models/Category'
import { User } from '../../../models/User'

describe('Admin Product Variant Management', () => {
  let app: express.Application
  let mongoServer: MongoMemoryServer
  let adminToken: string
  let productId: string
  let categoryId: string
  let variantId: string

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()
    await mongoose.connect(mongoUri)

    // Create app
    app = createApp()
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  beforeEach(async () => {
    // Clear collections
    await Product.deleteMany({})
    await Category.deleteMany({})
    await User.deleteMany({})

    // Create admin user
    const hashedPassword = await bcrypt.hash('Admin@123', 10)
    await User.create({
      name: 'Test Admin',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'admin',
      isActive: true,
    })

    // Generate admin token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'Admin@123',
      })

    adminToken = loginRes.body.accessToken

    // Create category
    const category = new Category({
      name: 'Test Category',
      slug: 'test-category',
      level: 0,
    })
    await category.save()
    categoryId = category._id.toString()

    // Create product
    const product = new Product({
      name: 'Test Product',
      description: 'Test product description',
      price: 100,
      category: categoryId,
      images: [{ url: 'https://example.com/image.jpg' }],
      stock: 50,
    })
    await product.save()
    productId = product._id.toString()
  })

  describe('POST /api/admin/products/:id/variants', () => {
    it('should add a variant to a product', async () => {
      const res = await request(app)
        .post(`/api/admin/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: L, Color: Red',
          sku: 'SKU-001',
          price: 120,
          stock: 30,
        })

      expect(res.status).toBe(201)
      expect(res.body.message).toBe('Variant added successfully')
      expect(res.body.product.variants).toHaveLength(1)
      expect(res.body.product.variants[0].name).toBe('Size: L, Color: Red')
      expect(res.body.product.variants[0].price).toBe(120)
      expect(res.body.product.variants[0].stock).toBe(30)
      expect(res.body.product.variants[0].sku).toBe('SKU-001')

      // Verify in database
      const updatedProduct = await Product.findById(productId)
      expect(updatedProduct?.variants).toHaveLength(1)
      expect(updatedProduct?.variants[0].name).toBe('Size: L, Color: Red')
    })

    it('should add multiple variants to a product', async () => {
      // Add first variant
      await request(app)
        .post(`/api/admin/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: L, Color: Red',
          sku: 'SKU-001',
          price: 120,
          stock: 30,
        })

      // Add second variant
      const res = await request(app)
        .post(`/api/admin/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: M, Color: Blue',
          sku: 'SKU-002',
          price: 110,
          stock: 40,
        })

      expect(res.status).toBe(201)
      expect(res.body.product.variants).toHaveLength(2)
      expect(res.body.product.variants[1].name).toBe('Size: M, Color: Blue')
    })

    it('should add variant without SKU', async () => {
      const res = await request(app)
        .post(`/api/admin/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: L, Color: Red',
          price: 120,
          stock: 30,
        })

      expect(res.status).toBe(201)
      expect(res.body.product.variants[0].sku).toBeUndefined()
    })

    it('should reject duplicate SKUs', async () => {
      // Add first variant
      await request(app)
        .post(`/api/admin/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: L, Color: Red',
          sku: 'SKU-001',
          price: 120,
          stock: 30,
        })

      // Try to add variant with same SKU
      const res = await request(app)
        .post(`/api/admin/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: M, Color: Blue',
          sku: 'SKU-001',
          price: 110,
          stock: 40,
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Bad Request')
      expect(res.body.message).toContain('unique')
    })

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post(`/api/admin/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: L, Color: Red',
          // Missing price and stock
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Bad Request')
    })

    it('should reject invalid product ID', async () => {
      const res = await request(app)
        .post(`/api/admin/products/invalid-id/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: L, Color: Red',
          price: 120,
          stock: 30,
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Bad Request')
    })

    it('should reject non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString()
      const res = await request(app)
        .post(`/api/admin/products/${fakeId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: L, Color: Red',
          price: 120,
          stock: 30,
        })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Not Found')
    })

    it('should reject negative price', async () => {
      const res = await request(app)
        .post(`/api/admin/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: L, Color: Red',
          price: -10,
          stock: 30,
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Bad Request')
    })

    it('should reject negative stock', async () => {
      const res = await request(app)
        .post(`/api/admin/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: L, Color: Red',
          price: 120,
          stock: -5,
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Bad Request')
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .post(`/api/admin/products/${productId}/variants`)
        .send({
          name: 'Size: L, Color: Red',
          price: 120,
          stock: 30,
        })

      expect(res.status).toBe(401)
    })

    it('should require admin role', async () => {
      // Create regular user
      const hashedPassword = await bcrypt.hash('User@123', 10)
      await User.create({
        name: 'Regular User',
        email: 'user@example.com',
        password: hashedPassword,
        role: 'user',
        isActive: true,
      })

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'User@123',
        })

      const userToken = loginRes.body.accessToken

      const res = await request(app)
        .post(`/api/admin/products/${productId}/variants`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Size: L, Color: Red',
          price: 120,
          stock: 30,
        })

      expect(res.status).toBe(403)
    })
  })

  describe('GET /api/admin/products/:id/variants', () => {
    beforeEach(async () => {
      // Add some variants
      const product = await Product.findById(productId)
      if (product) {
        product.variants.push(
          {
            name: 'Size: L, Color: Red',
            sku: 'SKU-001',
            price: 120,
            stock: 30,
          },
          {
            name: 'Size: M, Color: Blue',
            sku: 'SKU-002',
            price: 110,
            stock: 40,
          }
        )
        await product.save()
      }
    })

    it('should get all variants for a product', async () => {
      const res = await request(app)
        .get(`/api/admin/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.variants).toHaveLength(2)
      expect(res.body.variants[0].name).toBe('Size: L, Color: Red')
      expect(res.body.variants[1].name).toBe('Size: M, Color: Blue')
    })

    it('should return empty array for product with no variants', async () => {
      const newProduct = new Product({
        name: 'Product Without Variants',
        description: 'Test product',
        price: 100,
        category: categoryId,
        images: [{ url: 'https://example.com/image.jpg' }],
      })
      await newProduct.save()

      const res = await request(app)
        .get(`/api/admin/products/${newProduct._id.toString()}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.variants).toHaveLength(0)
    })

    it('should reject non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString()
      const res = await request(app)
        .get(`/api/admin/products/${fakeId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/admin/products/:id/variants/:variantId', () => {
    beforeEach(async () => {
      const product = await Product.findById(productId)
      if (product) {
        product.variants.push({
          name: 'Size: L, Color: Red',
          sku: 'SKU-001',
          price: 120,
          stock: 30,
        })
        await product.save()
        variantId = product.variants[0]._id?.toString() || ''
      }
    })

    it('should get a specific variant', async () => {
      const res = await request(app)
        .get(`/api/admin/products/${productId}/variants/${variantId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.variant.name).toBe('Size: L, Color: Red')
      expect(res.body.variant.price).toBe(120)
      expect(res.body.variant.stock).toBe(30)
    })

    it('should reject non-existent variant', async () => {
      const fakeVariantId = new mongoose.Types.ObjectId().toString()
      const res = await request(app)
        .get(`/api/admin/products/${productId}/variants/${fakeVariantId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('PUT /api/admin/products/:id/variants/:variantId', () => {
    beforeEach(async () => {
      const product = await Product.findById(productId)
      if (product) {
        product.variants.push({
          name: 'Size: L, Color: Red',
          sku: 'SKU-001',
          price: 120,
          stock: 30,
        })
        await product.save()
        variantId = product.variants[0]._id?.toString() || ''
      }
    })

    it('should update a variant', async () => {
      const res = await request(app)
        .put(`/api/admin/products/${productId}/variants/${variantId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: XL, Color: Red',
          price: 130,
          stock: 25,
        })

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Variant updated successfully')
      expect(res.body.product.variants[0].name).toBe('Size: XL, Color: Red')
      expect(res.body.product.variants[0].price).toBe(130)
      expect(res.body.product.variants[0].stock).toBe(25)
    })

    it('should update only provided fields', async () => {
      const res = await request(app)
        .put(`/api/admin/products/${productId}/variants/${variantId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          price: 150,
        })

      expect(res.status).toBe(200)
      expect(res.body.product.variants[0].name).toBe('Size: L, Color: Red')
      expect(res.body.product.variants[0].price).toBe(150)
      expect(res.body.product.variants[0].stock).toBe(30)
    })

    it('should update SKU', async () => {
      const res = await request(app)
        .put(`/api/admin/products/${productId}/variants/${variantId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sku: 'SKU-NEW',
        })

      expect(res.status).toBe(200)
      expect(res.body.product.variants[0].sku).toBe('SKU-NEW')
    })

    it('should reject duplicate SKU', async () => {
      // Add another variant first
      const product = await Product.findById(productId)
      if (product) {
        product.variants.push({
          name: 'Size: M, Color: Blue',
          sku: 'SKU-002',
          price: 110,
          stock: 40,
        })
        await product.save()
      }

      // Get the first variant ID
      const updatedProduct = await Product.findById(productId)
      const firstVariantId = updatedProduct?.variants[0]._id?.toString()

      // Try to update first variant with second variant's SKU
      const res = await request(app)
        .put(`/api/admin/products/${productId}/variants/${firstVariantId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sku: 'SKU-002',
        })

      // This should fail because SKU-002 is already used
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('should reject non-existent variant', async () => {
      const fakeVariantId = new mongoose.Types.ObjectId().toString()
      const res = await request(app)
        .put(`/api/admin/products/${productId}/variants/${fakeVariantId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          price: 150,
        })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/admin/products/:id/variants/:variantId', () => {
    beforeEach(async () => {
      const product = await Product.findById(productId)
      if (product) {
        product.variants.push(
          {
            name: 'Size: L, Color: Red',
            sku: 'SKU-001',
            price: 120,
            stock: 30,
          },
          {
            name: 'Size: M, Color: Blue',
            sku: 'SKU-002',
            price: 110,
            stock: 40,
          }
        )
        await product.save()
        variantId = product.variants[0]._id?.toString() || ''
      }
    })

    it('should delete a variant', async () => {
      const res = await request(app)
        .delete(`/api/admin/products/${productId}/variants/${variantId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Variant deleted successfully')
      expect(res.body.product.variants).toHaveLength(1)
      expect(res.body.product.variants[0].name).toBe('Size: M, Color: Blue')

      // Verify in database
      const updatedProduct = await Product.findById(productId)
      expect(updatedProduct?.variants).toHaveLength(1)
    })

    it('should reject non-existent variant', async () => {
      const fakeVariantId = new mongoose.Types.ObjectId().toString()
      const res = await request(app)
        .delete(`/api/admin/products/${productId}/variants/${fakeVariantId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(404)
    })
  })
})
