import request from 'supertest'
import { Express } from 'express'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { createApp } from '../../../app'
import { User } from '../../../models/User'
import { Product } from '../../../models/Product'
import { Category } from '../../../models/Category'
import { generateAccessToken } from '../../../utils/jwt'

let app: Express
let mongoServer: MongoMemoryServer
let adminToken: string
let productId: string

function createTestImageBuffer(): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x5b, 0x0b, 0xfb, 0xd7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82,
  ])
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
  app = createApp() as Express

  const adminUser = await User.create({
    name: 'Admin',
    email: 'admin@test.com',
    password: 'pass',
    role: 'admin',
  })
  adminToken = generateAccessToken({ id: adminUser._id.toString(), role: 'admin' })

  const category = await Category.create({
    name: 'Test',
    slug: 'test',
    level: 0,
  })

  const product = await Product.create({
    name: 'Test Product',
    slug: 'test-product',
    description: 'Test description',
    price: 100,
    category: category._id,
    images: [],
    stock: 10,
  })
  productId = product._id.toString()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

describe('Image Upload Endpoint', () => {
  test('should upload image successfully', async () => {
    const response = await request(app)
      .post(`/api/admin/products/${productId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('images', createTestImageBuffer(), 'test.png')

    expect(response.status).toBe(200)
    expect(response.body.product.images.length).toBeGreaterThan(0)
    expect(response.body.product.images[0].url).toContain('.webp')
    expect(response.body.product.images[0].thumbnail).toContain('.webp')
    expect(response.body.product.images[0].mobile).toContain('.webp')
  })

  test('should upload multiple images', async () => {
    const response = await request(app)
      .post(`/api/admin/products/${productId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('images', createTestImageBuffer(), 'test1.png')
      .attach('images', createTestImageBuffer(), 'test2.png')

    expect(response.status).toBe(200)
    expect(response.body.message).toContain('2 image(s) uploaded successfully')
  })

  test('should reject invalid product ID', async () => {
    const response = await request(app)
      .post('/api/admin/products/invalid-id/images')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('images', createTestImageBuffer(), 'test.png')

    expect(response.status).toBe(400)
  })

  test('should reject non-existent product', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString()
    const response = await request(app)
      .post(`/api/admin/products/${fakeId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('images', createTestImageBuffer(), 'test.png')

    expect(response.status).toBe(404)
  })
})
