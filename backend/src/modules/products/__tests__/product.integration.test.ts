import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { createApp } from '../../../app'
import { Product } from '../../../models/Product'
import { Category } from '../../../models/Category'
import express from 'express'

describe('GET /api/products - Product Listing Endpoint', () => {
  let app: express.Application
  let mongoServer: MongoMemoryServer
  let categoryId: mongoose.Types.ObjectId
  let subcategoryId: mongoose.Types.ObjectId

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()
    await mongoose.connect(mongoUri)
    app = createApp()
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  beforeEach(async () => {
    await Product.deleteMany({})
    await Category.deleteMany({})

    // Create test categories
    const category = new Category({
      name: 'Electronics',
      slug: 'electronics',
      level: 0,
      order: 1,
      isActive: true
    })
    await category.save()
    categoryId = category._id

    const subcategory = new Category({
      name: 'Smartphones',
      slug: 'electronics-smartphones',
      parent: categoryId,
      level: 1,
      order: 1,
      isActive: true
    })
    await subcategory.save()
    subcategoryId = subcategory._id

    // Create test products
    await Product.create([
      {
        name: 'iPhone 14 Pro',
        description: 'Latest Apple smartphone with advanced camera system',
        price: 999.99,
        category: categoryId,
        images: [{ url: 'https://example.com/iphone.jpg', alt: 'iPhone 14 Pro' }],
        stock: 10,
        averageRating: 4.8,
        reviewCount: 150,
        isActive: true,
        isFeatured: true
      },
      {
        name: 'Samsung Galaxy S23',
        description: 'Flagship Android smartphone with excellent display',
        price: 899.99,
        category: subcategoryId,
        images: [{ url: 'https://example.com/samsung.jpg', alt: 'Samsung Galaxy S23' }],
        stock: 15,
        averageRating: 4.6,
        reviewCount: 120,
        isActive: true,
        isFeatured: false
      },
      {
        name: 'Google Pixel 7',
        description: 'Google flagship phone with pure Android experience',
        price: 799.99,
        category: subcategoryId,
        images: [{ url: 'https://example.com/pixel.jpg', alt: 'Google Pixel 7' }],
        stock: 8,
        averageRating: 4.5,
        reviewCount: 95,
        isActive: true,
        isFeatured: false
      },
      {
        name: 'OnePlus 11',
        description: 'Fast and smooth Android phone with clean UI',
        price: 699.99,
        category: subcategoryId,
        images: [{ url: 'https://example.com/oneplus.jpg', alt: 'OnePlus 11' }],
        stock: 20,
        averageRating: 4.3,
        reviewCount: 80,
        isActive: true,
        isFeatured: false
      },
      {
        name: 'Budget Phone',
        description: 'Affordable smartphone for basic needs',
        price: 199.99,
        category: categoryId,
        images: [{ url: 'https://example.com/budget.jpg', alt: 'Budget Phone' }],
        stock: 0,
        averageRating: 3.5,
        reviewCount: 30,
        isActive: true,
        isFeatured: false
      },
      {
        name: 'Inactive Product',
        description: 'This product is inactive and should not appear',
        price: 499.99,
        category: categoryId,
        images: [{ url: 'https://example.com/inactive.jpg', alt: 'Inactive' }],
        stock: 5,
        averageRating: 4.0,
        reviewCount: 50,
        isActive: false,
        isFeatured: false
      }
    ])
  })

  describe('Basic Listing', () => {
    it('should return all active products with default pagination', async () => {
      const res = await request(app)
        .get('/api/products')
        .expect(200)

      expect(res.body).toHaveProperty('products')
      expect(res.body).toHaveProperty('pagination')
      expect(res.body.products).toHaveLength(5) // 5 active products
      expect(res.body.pagination.page).toBe(1)
      expect(res.body.pagination.limit).toBe(20)
      expect(res.body.pagination.total).toBe(5)
      expect(res.body.pagination.pages).toBe(1)
    })

    it('should not include inactive products', async () => {
      const res = await request(app)
        .get('/api/products')
        .expect(200)

      const productNames = res.body.products.map((p: any) => p.name)
      expect(productNames).not.toContain('Inactive Product')
    })

    it('should return product with required fields', async () => {
      const res = await request(app)
        .get('/api/products')
        .expect(200)

      const product = res.body.products[0]
      expect(product).toHaveProperty('_id')
      expect(product).toHaveProperty('name')
      expect(product).toHaveProperty('price')
      expect(product).toHaveProperty('images')
      expect(product).toHaveProperty('averageRating')
      expect(product).toHaveProperty('reviewCount')
      expect(product).toHaveProperty('category')
      expect(product).toHaveProperty('slug')
    })
  })

  describe('Pagination', () => {
    it('should respect page parameter', async () => {
      const res = await request(app)
        .get('/api/products?page=1&limit=2')
        .expect(200)

      expect(res.body.products).toHaveLength(2)
      expect(res.body.pagination.page).toBe(1)
      expect(res.body.pagination.limit).toBe(2)
      expect(res.body.pagination.total).toBe(5)
      expect(res.body.pagination.pages).toBe(3)
    })

    it('should return second page correctly', async () => {
      const res1 = await request(app)
        .get('/api/products?page=1&limit=2')
        .expect(200)

      const res2 = await request(app)
        .get('/api/products?page=2&limit=2')
        .expect(200)

      const names1 = res1.body.products.map((p: any) => p.name)
      const names2 = res2.body.products.map((p: any) => p.name)

      // Products should be different between pages
      expect(names1).not.toEqual(names2)
      expect(res2.body.pagination.page).toBe(2)
    })

    it('should enforce maximum limit of 100', async () => {
      const res = await request(app)
        .get('/api/products?limit=200')
        .expect(200)

      expect(res.body.pagination.limit).toBe(100)
    })

    it('should reject invalid page parameter', async () => {
      const res = await request(app)
        .get('/api/products?page=invalid')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })

    it('should reject invalid limit parameter', async () => {
      const res = await request(app)
        .get('/api/products?limit=invalid')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })

    it('should cap limit at 100', async () => {
      const res = await request(app)
        .get('/api/products?limit=101')
        .expect(200)

      expect(res.body.pagination.limit).toBe(100)
    })

    it('should reject negative page', async () => {
      const res = await request(app)
        .get('/api/products?page=-1')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })
  })

  describe('Price Filter', () => {
    it('should filter products by minimum price', async () => {
      const res = await request(app)
        .get('/api/products?minPrice=700')
        .expect(200)

      expect(res.body.products).toHaveLength(3) // Samsung, Google, OnePlus
      expect(res.body.products.every((p: any) => p.price >= 700)).toBe(true)
    })

    it('should filter products by maximum price', async () => {
      const res = await request(app)
        .get('/api/products?maxPrice=500')
        .expect(200)

      expect(res.body.products).toHaveLength(1) // Budget Phone
      expect(res.body.products.every((p: any) => p.price <= 500)).toBe(true)
    })

    it('should filter products by price range', async () => {
      const res = await request(app)
        .get('/api/products?minPrice=600&maxPrice=900')
        .expect(200)

      expect(res.body.products).toHaveLength(3) // Google Pixel, OnePlus, Samsung
      expect(res.body.products.every((p: any) => p.price >= 600 && p.price <= 900)).toBe(true)
    })

    it('should reject invalid minPrice', async () => {
      const res = await request(app)
        .get('/api/products?minPrice=invalid')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })

    it('should reject invalid maxPrice', async () => {
      const res = await request(app)
        .get('/api/products?maxPrice=invalid')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })

    it('should reject minPrice greater than maxPrice', async () => {
      const res = await request(app)
        .get('/api/products?minPrice=1000&maxPrice=500')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })

    it('should reject negative prices', async () => {
      const res = await request(app)
        .get('/api/products?minPrice=-100')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })
  })

  describe('Rating Filter', () => {
    it('should filter products by minimum rating', async () => {
      const res = await request(app)
        .get('/api/products?minRating=4.5')
        .expect(200)

      expect(res.body.products).toHaveLength(3) // iPhone, Samsung, Google
      expect(res.body.products.every((p: any) => p.averageRating >= 4.5)).toBe(true)
    })

    it('should filter products by rating 0', async () => {
      const res = await request(app)
        .get('/api/products?minRating=0')
        .expect(200)

      expect(res.body.products).toHaveLength(5) // All active products
    })

    it('should filter products by rating 5', async () => {
      const res = await request(app)
        .get('/api/products?minRating=5')
        .expect(200)

      expect(res.body.products).toHaveLength(0) // No products with 5.0 rating
    })

    it('should reject invalid minRating', async () => {
      const res = await request(app)
        .get('/api/products?minRating=invalid')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })

    it('should reject minRating greater than 5', async () => {
      const res = await request(app)
        .get('/api/products?minRating=6')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })

    it('should reject negative minRating', async () => {
      const res = await request(app)
        .get('/api/products?minRating=-1')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })
  })

  describe('Category Filter', () => {
    it('should filter products by category', async () => {
      const res = await request(app)
        .get(`/api/products?categoryId=${categoryId}`)
        .expect(200)

      expect(res.body.products).toHaveLength(5) // All products (iPhone, Budget Phone, Samsung, Google, OnePlus)
      expect(res.body.products.every((p: any) => 
        p.category === categoryId.toString() || p.category === subcategoryId.toString()
      )).toBe(true)
    })

    it('should filter products by subcategory', async () => {
      const res = await request(app)
        .get(`/api/products?categoryId=${subcategoryId}`)
        .expect(200)

      expect(res.body.products).toHaveLength(3) // Samsung, Google, OnePlus
      expect(res.body.products.every((p: any) => p.category === subcategoryId.toString())).toBe(true)
    })

    it('should return empty results for invalid category ID', async () => {
      const invalidId = new mongoose.Types.ObjectId()
      const res = await request(app)
        .get(`/api/products?categoryId=${invalidId}`)
        .expect(200)

      expect(res.body.products).toHaveLength(0)
      expect(res.body.pagination.total).toBe(0)
    })

    it('should return empty results for malformed category ID', async () => {
      const res = await request(app)
        .get('/api/products?categoryId=invalid-id')
        .expect(200)

      expect(res.body.products).toHaveLength(0)
    })
  })

  describe('Sorting', () => {
    it('should sort by price ascending', async () => {
      const res = await request(app)
        .get('/api/products?sortBy=price_asc')
        .expect(200)

      const prices = res.body.products.map((p: any) => p.price)
      expect(prices).toEqual([...prices].sort((a, b) => a - b))
    })

    it('should sort by price descending', async () => {
      const res = await request(app)
        .get('/api/products?sortBy=price_desc')
        .expect(200)

      const prices = res.body.products.map((p: any) => p.price)
      expect(prices).toEqual([...prices].sort((a, b) => b - a))
    })

    it('should sort by rating descending', async () => {
      const res = await request(app)
        .get('/api/products?sortBy=rating')
        .expect(200)

      const ratings = res.body.products.map((p: any) => p.averageRating)
      expect(ratings[0]).toBeGreaterThanOrEqual(ratings[ratings.length - 1])
    })

    it('should sort by newest first', async () => {
      const res = await request(app)
        .get('/api/products?sortBy=newest')
        .expect(200)

      const dates = res.body.products.map((p: any) => new Date(p.createdAt).getTime())
      expect(dates).toEqual([...dates].sort((a, b) => b - a))
    })

    it('should use default sort (rating) when sortBy not specified', async () => {
      const res = await request(app)
        .get('/api/products')
        .expect(200)

      const ratings = res.body.products.map((p: any) => p.averageRating)
      expect(ratings[0]).toBeGreaterThanOrEqual(ratings[ratings.length - 1])
    })

    it('should reject invalid sortBy parameter', async () => {
      const res = await request(app)
        .get('/api/products?sortBy=invalid')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })
  })

  describe('Combined Filters', () => {
    it('should apply multiple filters with AND logic', async () => {
      const res = await request(app)
        .get(`/api/products?minPrice=600&maxPrice=900&minRating=4.3&categoryId=${subcategoryId}`)
        .expect(200)

      expect(res.body.products).toHaveLength(3) // Samsung, Google, OnePlus
      expect(res.body.products.every((p: any) => 
        p.price >= 600 && 
        p.price <= 900 && 
        p.averageRating >= 4.3 &&
        p.category === subcategoryId.toString()
      )).toBe(true)
    })

    it('should apply price and rating filters', async () => {
      const res = await request(app)
        .get('/api/products?minPrice=700&minRating=4.5')
        .expect(200)

      expect(res.body.products).toHaveLength(3) // iPhone, Samsung, Google
      expect(res.body.products.every((p: any) => 
        p.price >= 700 && p.averageRating >= 4.5
      )).toBe(true)
    })

    it('should apply category and sorting filters', async () => {
      const res = await request(app)
        .get(`/api/products?categoryId=${subcategoryId}&sortBy=price_asc`)
        .expect(200)

      expect(res.body.products).toHaveLength(3)
      const prices = res.body.products.map((p: any) => p.price)
      expect(prices).toEqual([...prices].sort((a, b) => a - b))
    })

    it('should return empty results when no products match all filters', async () => {
      const res = await request(app)
        .get('/api/products?minPrice=2000&maxPrice=3000')
        .expect(200)

      expect(res.body.products).toHaveLength(0)
      expect(res.body.pagination.total).toBe(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle page beyond available pages', async () => {
      const res = await request(app)
        .get('/api/products?page=100&limit=10')
        .expect(200)

      expect(res.body.products).toHaveLength(0)
      expect(res.body.pagination.page).toBe(100)
      expect(res.body.pagination.total).toBe(5)
    })

    it('should handle zero price range', async () => {
      const res = await request(app)
        .get('/api/products?minPrice=0&maxPrice=0')
        .expect(200)

      expect(res.body.products).toHaveLength(0)
    })

    it('should handle very large limit', async () => {
      const res = await request(app)
        .get('/api/products?limit=999999')
        .expect(200)

      expect(res.body.pagination.limit).toBe(100)
    })

    it('should handle limit of 1', async () => {
      const res = await request(app)
        .get('/api/products?limit=1')
        .expect(200)

      expect(res.body.products).toHaveLength(1)
      expect(res.body.pagination.pages).toBe(5)
    })
  })
})


describe('GET /api/products/:id - Product Detail Endpoint', () => {
  let app: express.Application
  let mongoServer: MongoMemoryServer
  let categoryId: mongoose.Types.ObjectId
  let productId: mongoose.Types.ObjectId

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()
    await mongoose.connect(mongoUri)
    app = createApp()
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  beforeEach(async () => {
    await Product.deleteMany({})
    await Category.deleteMany({})

    // Create test category
    const category = new Category({
      name: 'Electronics',
      slug: 'electronics',
      level: 0,
      order: 1,
      isActive: true
    })
    await category.save()
    categoryId = category._id

    // Create test product with full details
    const product = new Product({
      name: 'iPhone 14 Pro',
      description: 'Latest Apple smartphone with advanced camera system and A16 Bionic chip',
      price: 999.99,
      compareAtPrice: 1099.99,
      category: categoryId,
      images: [
        { url: 'https://example.com/iphone-1.jpg', thumbnail: 'https://example.com/iphone-1-thumb.jpg', mobile: 'https://example.com/iphone-1-mobile.jpg', alt: 'iPhone 14 Pro Front' },
        { url: 'https://example.com/iphone-2.jpg', thumbnail: 'https://example.com/iphone-2-thumb.jpg', mobile: 'https://example.com/iphone-2-mobile.jpg', alt: 'iPhone 14 Pro Back' }
      ],
      specifications: [
        { key: 'Display', value: '6.1-inch Super Retina XDR' },
        { key: 'Processor', value: 'A16 Bionic' },
        { key: 'Camera', value: '48MP Main + 12MP Ultra Wide' }
      ],
      variants: [
        { name: 'Color: Space Black, Storage: 128GB', sku: 'IPHONE14PRO-SB-128', price: 999.99, stock: 10 },
        { name: 'Color: Space Black, Storage: 256GB', sku: 'IPHONE14PRO-SB-256', price: 1099.99, stock: 5 }
      ],
      stock: 15,
      averageRating: 4.8,
      reviewCount: 150,
      isActive: true,
      isFeatured: true,
      tags: ['smartphone', 'apple', 'premium']
    })
    await product.save()
    productId = product._id
  })

  describe('Basic Product Detail Retrieval', () => {
    it('should return full product details by ID', async () => {
      const res = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200)

      expect(res.body).toHaveProperty('_id')
      expect(res.body).toHaveProperty('name', 'iPhone 14 Pro')
      expect(res.body).toHaveProperty('description')
      expect(res.body).toHaveProperty('price', 999.99)
      expect(res.body).toHaveProperty('compareAtPrice', 1099.99)
      expect(res.body).toHaveProperty('category')
      expect(res.body).toHaveProperty('images')
      expect(res.body).toHaveProperty('specifications')
      expect(res.body).toHaveProperty('variants')
      expect(res.body).toHaveProperty('stock', 15)
      expect(res.body).toHaveProperty('averageRating', 4.8)
      expect(res.body).toHaveProperty('reviewCount', 150)
      expect(res.body).toHaveProperty('reviewsSummary')
      expect(res.body).toHaveProperty('isActive', true)
      expect(res.body).toHaveProperty('isFeatured', true)
      expect(res.body).toHaveProperty('tags')
      expect(res.body).toHaveProperty('createdAt')
      expect(res.body).toHaveProperty('updatedAt')
    })

    it('should return category information', async () => {
      const res = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200)

      expect(res.body.category).toHaveProperty('_id')
      expect(res.body.category).toHaveProperty('name', 'Electronics')
      expect(res.body.category).toHaveProperty('slug', 'electronics')
    })

    it('should return all images in order', async () => {
      const res = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200)

      expect(res.body.images).toHaveLength(2)
      expect(res.body.images[0].url).toBe('https://example.com/iphone-1.jpg')
      expect(res.body.images[0].alt).toBe('iPhone 14 Pro Front')
      expect(res.body.images[1].url).toBe('https://example.com/iphone-2.jpg')
      expect(res.body.images[1].alt).toBe('iPhone 14 Pro Back')
    })

    it('should return image variants (thumbnail, mobile)', async () => {
      const res = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200)

      expect(res.body.images[0]).toHaveProperty('thumbnail')
      expect(res.body.images[0]).toHaveProperty('mobile')
      expect(res.body.images[0].thumbnail).toBe('https://example.com/iphone-1-thumb.jpg')
      expect(res.body.images[0].mobile).toBe('https://example.com/iphone-1-mobile.jpg')
    })

    it('should return all specifications', async () => {
      const res = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200)

      expect(res.body.specifications).toHaveLength(3)
      expect(res.body.specifications[0]).toEqual({ key: 'Display', value: '6.1-inch Super Retina XDR' })
      expect(res.body.specifications[1]).toEqual({ key: 'Processor', value: 'A16 Bionic' })
      expect(res.body.specifications[2]).toEqual({ key: 'Camera', value: '48MP Main + 12MP Ultra Wide' })
    })

    it('should return all variants with pricing and stock', async () => {
      const res = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200)

      expect(res.body.variants).toHaveLength(2)
      expect(res.body.variants[0]).toHaveProperty('name', 'Color: Space Black, Storage: 128GB')
      expect(res.body.variants[0]).toHaveProperty('sku', 'IPHONE14PRO-SB-128')
      expect(res.body.variants[0]).toHaveProperty('price', 999.99)
      expect(res.body.variants[0]).toHaveProperty('stock', 10)
      expect(res.body.variants[1]).toHaveProperty('price', 1099.99)
      expect(res.body.variants[1]).toHaveProperty('stock', 5)
    })

    it('should return reviews summary', async () => {
      const res = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200)

      expect(res.body.reviewsSummary).toHaveProperty('averageRating', 4.8)
      expect(res.body.reviewsSummary).toHaveProperty('totalReviews', 150)
    })

    it('should return tags array', async () => {
      const res = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200)

      expect(res.body.tags).toEqual(['smartphone', 'apple', 'premium'])
    })
  })

  describe('Error Handling', () => {
    it('should return 404 for non-existent product', async () => {
      const nonExistentId = new mongoose.Types.ObjectId()
      const res = await request(app)
        .get(`/api/products/${nonExistentId}`)
        .expect(404)

      expect(res.body).toHaveProperty('error')
      expect(res.body.message).toContain('not found')
    })

    it('should return 400 for invalid product ID format', async () => {
      const res = await request(app)
        .get('/api/products/invalid-id')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })

    it('should return 400 for malformed ObjectId', async () => {
      const res = await request(app)
        .get('/api/products/12345')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })

    it('should not return inactive products', async () => {
      // Create an inactive product
      const inactiveProduct = new Product({
        name: 'Inactive Product',
        description: 'This product is inactive',
        price: 500,
        category: categoryId,
        images: [{ url: 'https://example.com/inactive.jpg' }],
        stock: 10,
        averageRating: 4.0,
        reviewCount: 50,
        isActive: false
      })
      await inactiveProduct.save()

      const res = await request(app)
        .get(`/api/products/${inactiveProduct._id}`)
        .expect(404)

      expect(res.body).toHaveProperty('error')
    })
  })

  describe('Product Variants and Stock', () => {
    it('should return correct stock information', async () => {
      const res = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200)

      expect(res.body.stock).toBe(15)
      expect(res.body.variants[0].stock).toBe(10)
      expect(res.body.variants[1].stock).toBe(5)
    })

    it('should handle products without variants', async () => {
      const simpleProduct = new Product({
        name: 'Simple Product',
        description: 'Product without variants',
        price: 100,
        category: categoryId,
        images: [{ url: 'https://example.com/simple.jpg' }],
        stock: 20,
        averageRating: 4.0,
        reviewCount: 10,
        isActive: true,
        variants: []
      })
      await simpleProduct.save()

      const res = await request(app)
        .get(`/api/products/${simpleProduct._id}`)
        .expect(200)

      expect(res.body.variants).toHaveLength(0)
      expect(res.body.stock).toBe(20)
    })

    it('should handle products without images', async () => {
      const noImageProduct = new Product({
        name: 'No Image Product',
        description: 'Product without images',
        price: 100,
        category: categoryId,
        images: [],
        stock: 20,
        averageRating: 4.0,
        reviewCount: 10,
        isActive: true
      })
      await noImageProduct.save()

      const res = await request(app)
        .get(`/api/products/${noImageProduct._id}`)
        .expect(200)

      expect(res.body.images).toHaveLength(0)
    })
  })

  describe('Product Metadata', () => {
    it('should return correct timestamps', async () => {
      const res = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200)

      expect(res.body.createdAt).toBeDefined()
      expect(res.body.updatedAt).toBeDefined()
      expect(new Date(res.body.createdAt)).toBeInstanceOf(Date)
      expect(new Date(res.body.updatedAt)).toBeInstanceOf(Date)
    })

    it('should return featured flag', async () => {
      const res = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200)

      expect(res.body.isFeatured).toBe(true)
    })

    it('should return slug', async () => {
      const res = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200)

      expect(res.body.slug).toBeDefined()
      expect(typeof res.body.slug).toBe('string')
    })
  })

  describe('Edge Cases', () => {
    it('should handle product with zero rating', async () => {
      const newProduct = new Product({
        name: 'New Product',
        description: 'Brand new product with no reviews',
        price: 100,
        category: categoryId,
        images: [{ url: 'https://example.com/new.jpg' }],
        stock: 10,
        averageRating: 0,
        reviewCount: 0,
        isActive: true
      })
      await newProduct.save()

      const res = await request(app)
        .get(`/api/products/${newProduct._id}`)
        .expect(200)

      expect(res.body.averageRating).toBe(0)
      expect(res.body.reviewCount).toBe(0)
      expect(res.body.reviewsSummary.averageRating).toBe(0)
      expect(res.body.reviewsSummary.totalReviews).toBe(0)
    })

    it('should handle product with zero stock', async () => {
      const outOfStockProduct = new Product({
        name: 'Out of Stock',
        description: 'Product with no stock',
        price: 100,
        category: categoryId,
        images: [{ url: 'https://example.com/oos.jpg' }],
        stock: 0,
        averageRating: 4.0,
        reviewCount: 10,
        isActive: true
      })
      await outOfStockProduct.save()

      const res = await request(app)
        .get(`/api/products/${outOfStockProduct._id}`)
        .expect(200)

      expect(res.body.stock).toBe(0)
    })

    it('should handle product with no specifications', async () => {
      const noSpecProduct = new Product({
        name: 'No Spec Product',
        description: 'Product without specifications',
        price: 100,
        category: categoryId,
        images: [{ url: 'https://example.com/nospec.jpg' }],
        stock: 10,
        averageRating: 4.0,
        reviewCount: 10,
        isActive: true,
        specifications: []
      })
      await noSpecProduct.save()

      const res = await request(app)
        .get(`/api/products/${noSpecProduct._id}`)
        .expect(200)

      expect(res.body.specifications).toHaveLength(0)
    })

    it('should handle product with no tags', async () => {
      const noTagProduct = new Product({
        name: 'No Tag Product',
        description: 'Product without tags',
        price: 100,
        category: categoryId,
        images: [{ url: 'https://example.com/notag.jpg' }],
        stock: 10,
        averageRating: 4.0,
        reviewCount: 10,
        isActive: true,
        tags: []
      })
      await noTagProduct.save()

      const res = await request(app)
        .get(`/api/products/${noTagProduct._id}`)
        .expect(200)

      expect(res.body.tags).toHaveLength(0)
    })
  })
})


describe('GET /api/products/search - Product Search Endpoint', () => {
  let app: express.Application
  let mongoServer: MongoMemoryServer
  let categoryId: mongoose.Types.ObjectId
  let subcategoryId: mongoose.Types.ObjectId

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()
    await mongoose.connect(mongoUri)
    app = createApp()
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  beforeEach(async () => {
    await Product.deleteMany({})
    await Category.deleteMany({})

    // Create test categories
    const category = new Category({
      name: 'Electronics',
      slug: 'electronics',
      level: 0,
      order: 1,
      isActive: true
    })
    await category.save()
    categoryId = category._id

    const subcategory = new Category({
      name: 'Smartphones',
      slug: 'electronics-smartphones',
      parent: categoryId,
      level: 1,
      order: 1,
      isActive: true
    })
    await subcategory.save()
    subcategoryId = subcategory._id

    // Create test products with searchable content
    await Product.create([
      {
        name: 'iPhone 14 Pro',
        description: 'Latest Apple smartphone with advanced camera system and A16 Bionic chip',
        price: 999.99,
        category: categoryId,
        images: [{ url: 'https://example.com/iphone.jpg', alt: 'iPhone 14 Pro' }],
        stock: 10,
        averageRating: 4.8,
        reviewCount: 150,
        isActive: true,
        isFeatured: true
      },
      {
        name: 'Samsung Galaxy S23',
        description: 'Flagship Android smartphone with excellent display and fast processor',
        price: 899.99,
        category: subcategoryId,
        images: [{ url: 'https://example.com/samsung.jpg', alt: 'Samsung Galaxy S23' }],
        stock: 15,
        averageRating: 4.6,
        reviewCount: 120,
        isActive: true,
        isFeatured: false
      },
      {
        name: 'Google Pixel 7',
        description: 'Google flagship phone with pure Android experience and excellent camera',
        price: 799.99,
        category: subcategoryId,
        images: [{ url: 'https://example.com/pixel.jpg', alt: 'Google Pixel 7' }],
        stock: 8,
        averageRating: 4.5,
        reviewCount: 95,
        isActive: true,
        isFeatured: false
      },
      {
        name: 'OnePlus 11',
        description: 'Fast and smooth Android phone with clean UI and 5G support',
        price: 699.99,
        category: subcategoryId,
        images: [{ url: 'https://example.com/oneplus.jpg', alt: 'OnePlus 11' }],
        stock: 20,
        averageRating: 4.3,
        reviewCount: 80,
        isActive: true,
        isFeatured: false
      },
      {
        name: 'Budget Phone',
        description: 'Affordable smartphone for basic needs with long battery life',
        price: 199.99,
        category: categoryId,
        images: [{ url: 'https://example.com/budget.jpg', alt: 'Budget Phone' }],
        stock: 0,
        averageRating: 3.5,
        reviewCount: 30,
        isActive: true,
        isFeatured: false
      },
      {
        name: 'Inactive Product',
        description: 'This product is inactive and should not appear in search results',
        price: 499.99,
        category: categoryId,
        images: [{ url: 'https://example.com/inactive.jpg', alt: 'Inactive' }],
        stock: 5,
        averageRating: 4.0,
        reviewCount: 50,
        isActive: false,
        isFeatured: false
      }
    ])
  })

  describe('Basic Search', () => {
    it('should require search query parameter', async () => {
      const res = await request(app)
        .get('/api/products/search')
        .expect(400)

      expect(res.body).toHaveProperty('error')
      expect(res.body.message).toContain('required')
    })

    it('should reject empty search query', async () => {
      const res = await request(app)
        .get('/api/products/search?q=')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })

    it('should search by product name', async () => {
      const res = await request(app)
        .get('/api/products/search?q=iPhone')
        .expect(200)

      expect(res.body.products.length).toBeGreaterThan(0)
      expect(res.body.products.some((p: any) => p.name.includes('iPhone'))).toBe(true)
    })

    it('should search by product description', async () => {
      const res = await request(app)
        .get('/api/products/search?q=camera')
        .expect(200)

      expect(res.body.products.length).toBeGreaterThan(0)
    })

    it('should search by category name', async () => {
      const res = await request(app)
        .get('/api/products/search?q=smartphone')
        .expect(200)

      expect(res.body.products.length).toBeGreaterThan(0)
    })

    it('should return empty results for no matches', async () => {
      const res = await request(app)
        .get('/api/products/search?q=nonexistentproduct123')
        .expect(200)

      expect(res.body.products).toHaveLength(0)
      expect(res.body.pagination.total).toBe(0)
    })

    it('should not include inactive products in search results', async () => {
      const res = await request(app)
        .get('/api/products/search?q=inactive')
        .expect(200)

      const inactiveFound = res.body.products.some((p: any) => p.name === 'Inactive Product')
      expect(inactiveFound).toBe(false)
    })

    it('should return product with required fields', async () => {
      const res = await request(app)
        .get('/api/products/search?q=iPhone')
        .expect(200)

      const product = res.body.products[0]
      expect(product).toHaveProperty('_id')
      expect(product).toHaveProperty('name')
      expect(product).toHaveProperty('price')
      expect(product).toHaveProperty('images')
      expect(product).toHaveProperty('averageRating')
      expect(product).toHaveProperty('reviewCount')
      expect(product).toHaveProperty('category')
      expect(product).toHaveProperty('slug')
    })
  })

  describe('Search with Pagination', () => {
    it('should respect page parameter', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&page=1&limit=2')
        .expect(200)

      expect(res.body.pagination.page).toBe(1)
      expect(res.body.pagination.limit).toBe(2)
    })

    it('should enforce maximum limit of 100', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&limit=200')
        .expect(200)

      expect(res.body.pagination.limit).toBe(100)
    })

    it('should reject invalid page parameter', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&page=invalid')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })

    it('should reject invalid limit parameter', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&limit=invalid')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })
  })

  describe('Search with Price Filter', () => {
    it('should filter search results by minimum price', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&minPrice=700')
        .expect(200)

      expect(res.body.products.every((p: any) => p.price >= 700)).toBe(true)
    })

    it('should filter search results by maximum price', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&maxPrice=500')
        .expect(200)

      expect(res.body.products.every((p: any) => p.price <= 500)).toBe(true)
    })

    it('should filter search results by price range', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&minPrice=600&maxPrice=900')
        .expect(200)

      expect(res.body.products.every((p: any) => 
        p.price >= 600 && p.price <= 900
      )).toBe(true)
    })

    it('should reject invalid minPrice', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&minPrice=invalid')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })

    it('should reject minPrice greater than maxPrice', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&minPrice=1000&maxPrice=500')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })
  })

  describe('Search with Rating Filter', () => {
    it('should filter search results by minimum rating', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&minRating=4.5')
        .expect(200)

      expect(res.body.products.every((p: any) => p.averageRating >= 4.5)).toBe(true)
    })

    it('should reject invalid minRating', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&minRating=invalid')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })

    it('should reject minRating greater than 5', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&minRating=6')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })
  })

  describe('Search with Category Filter', () => {
    it('should filter search results by category', async () => {
      const res = await request(app)
        .get(`/api/products/search?q=phone&categoryId=${categoryId}`)
        .expect(200)

      expect(res.body.products.length).toBeGreaterThan(0)
    })

    it('should filter search results by subcategory', async () => {
      const res = await request(app)
        .get(`/api/products/search?q=phone&categoryId=${subcategoryId}`)
        .expect(200)

      expect(res.body.products.length).toBeGreaterThan(0)
    })

    it('should return empty results for invalid category ID', async () => {
      const invalidId = new mongoose.Types.ObjectId()
      const res = await request(app)
        .get(`/api/products/search?q=phone&categoryId=${invalidId}`)
        .expect(200)

      expect(res.body.products).toHaveLength(0)
    })

    it('should return empty results for malformed category ID', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&categoryId=invalid-id')
        .expect(200)

      expect(res.body.products).toHaveLength(0)
    })
  })

  describe('Search with Sorting', () => {
    it('should sort search results by price ascending', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&sortBy=price_asc')
        .expect(200)

      if (res.body.products.length > 1) {
        const prices = res.body.products.map((p: any) => p.price)
        expect(prices).toEqual([...prices].sort((a, b) => a - b))
      }
    })

    it('should sort search results by price descending', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&sortBy=price_desc')
        .expect(200)

      if (res.body.products.length > 1) {
        const prices = res.body.products.map((p: any) => p.price)
        expect(prices).toEqual([...prices].sort((a, b) => b - a))
      }
    })

    it('should sort search results by rating', async () => {
      const res = await request(app)
        .get('/api/products/search?q=Samsung&sortBy=rating')
        .expect(200)

      if (res.body.products.length > 1) {
        const ratings = res.body.products.map((p: any) => p.averageRating)
        expect(ratings[0]).toBeGreaterThanOrEqual(ratings[ratings.length - 1])
      }
    })

    it('should sort search results by newest', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&sortBy=newest')
        .expect(200)

      if (res.body.products.length > 1) {
        const dates = res.body.products.map((p: any) => new Date(p.createdAt).getTime())
        expect(dates).toEqual([...dates].sort((a, b) => b - a))
      }
    })

    it('should reject invalid sortBy parameter', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&sortBy=invalid')
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })
  })

  describe('Search with Combined Filters', () => {
    it('should apply multiple filters with AND logic', async () => {
      const res = await request(app)
        .get(`/api/products/search?q=phone&minPrice=600&maxPrice=900&minRating=4.3&categoryId=${subcategoryId}`)
        .expect(200)

      expect(res.body.products.every((p: any) => 
        p.price >= 600 && 
        p.price <= 900 && 
        p.averageRating >= 4.3
      )).toBe(true)
    })

    it('should apply price and rating filters', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&minPrice=700&minRating=4.5')
        .expect(200)

      expect(res.body.products.every((p: any) => 
        p.price >= 700 && p.averageRating >= 4.5
      )).toBe(true)
    })

    it('should apply category and sorting filters', async () => {
      const res = await request(app)
        .get(`/api/products/search?q=phone&categoryId=${subcategoryId}&sortBy=price_asc`)
        .expect(200)

      if (res.body.products.length > 1) {
        const prices = res.body.products.map((p: any) => p.price)
        expect(prices).toEqual([...prices].sort((a, b) => a - b))
      }
    })

    it('should return empty results when no products match all filters', async () => {
      const res = await request(app)
        .get('/api/products/search?q=phone&minPrice=2000&maxPrice=3000')
        .expect(200)

      expect(res.body.products).toHaveLength(0)
      expect(res.body.pagination.total).toBe(0)
    })
  })

  describe('Search Edge Cases', () => {
    it('should handle search with whitespace', async () => {
      const res = await request(app)
        .get('/api/products/search?q=  iPhone  ')
        .expect(200)

      expect(res.body.products.length).toBeGreaterThan(0)
    })

    it('should handle case-insensitive search', async () => {
      const res1 = await request(app)
        .get('/api/products/search?q=iphone')
        .expect(200)

      const res2 = await request(app)
        .get('/api/products/search?q=IPHONE')
        .expect(200)

      expect(res1.body.products.length).toBeGreaterThan(0)
      expect(res2.body.products.length).toBeGreaterThan(0)
    })
  })
})

describe('GET /api/categories/:id/products - Products by Category Endpoint', () => {
  let app: express.Application
  let mongoServer: MongoMemoryServer
  let categoryId: mongoose.Types.ObjectId
  let subcategoryId: mongoose.Types.ObjectId
  let subSubcategoryId: mongoose.Types.ObjectId

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()
    await mongoose.connect(mongoUri)
    app = createApp()
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  beforeEach(async () => {
    await Product.deleteMany({})
    await Category.deleteMany({})

    // Create test category hierarchy
    const category = new Category({
      name: 'Electronics',
      slug: 'electronics',
      level: 0,
      order: 1,
      isActive: true
    })
    await category.save()
    categoryId = category._id

    const subcategory = new Category({
      name: 'Smartphones',
      slug: 'electronics-smartphones',
      parent: categoryId,
      level: 1,
      order: 1,
      isActive: true
    })
    await subcategory.save()
    subcategoryId = subcategory._id

    const subSubcategory = new Category({
      name: 'Premium Phones',
      slug: 'electronics-smartphones-premium',
      parent: subcategoryId,
      level: 2,
      order: 1,
      isActive: true
    })
    await subSubcategory.save()
    subSubcategoryId = subSubcategory._id

    // Create test products
    await Product.create([
      {
        name: 'iPhone 14 Pro',
        description: 'Latest Apple smartphone with advanced camera system',
        price: 999.99,
        category: categoryId,
        images: [{ url: 'https://example.com/iphone.jpg', alt: 'iPhone 14 Pro' }],
        stock: 10,
        averageRating: 4.8,
        reviewCount: 150,
        isActive: true,
        isFeatured: true
      },
      {
        name: 'Samsung Galaxy S23',
        description: 'Flagship Android smartphone with excellent display',
        price: 899.99,
        category: subcategoryId,
        images: [{ url: 'https://example.com/samsung.jpg', alt: 'Samsung Galaxy S23' }],
        stock: 15,
        averageRating: 4.6,
        reviewCount: 120,
        isActive: true,
        isFeatured: false
      },
      {
        name: 'Google Pixel 7 Pro',
        description: 'Google flagship phone with pure Android experience',
        price: 1099.99,
        category: subSubcategoryId,
        images: [{ url: 'https://example.com/pixel.jpg', alt: 'Google Pixel 7 Pro' }],
        stock: 8,
        averageRating: 4.7,
        reviewCount: 95,
        isActive: true,
        isFeatured: false
      },
      {
        name: 'OnePlus 11',
        description: 'Fast and smooth Android phone with clean UI',
        price: 699.99,
        category: subcategoryId,
        images: [{ url: 'https://example.com/oneplus.jpg', alt: 'OnePlus 11' }],
        stock: 20,
        averageRating: 4.3,
        reviewCount: 80,
        isActive: true,
        isFeatured: false
      },
      {
        name: 'Budget Phone',
        description: 'Affordable smartphone for basic needs',
        price: 199.99,
        category: categoryId,
        images: [{ url: 'https://example.com/budget.jpg', alt: 'Budget Phone' }],
        stock: 0,
        averageRating: 3.5,
        reviewCount: 30,
        isActive: true,
        isFeatured: false
      },
      {
        name: 'Inactive Product',
        description: 'This product is inactive and should not appear',
        price: 499.99,
        category: subcategoryId,
        images: [{ url: 'https://example.com/inactive.jpg', alt: 'Inactive' }],
        stock: 5,
        averageRating: 4.0,
        reviewCount: 50,
        isActive: false,
        isFeatured: false
      }
    ])
  })

  describe('Basic Category Product Listing', () => {
    it('should return products from category and all subcategories', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products`)
        .expect(200)

      expect(res.body).toHaveProperty('products')
      expect(res.body).toHaveProperty('pagination')
      // Should include: iPhone 14 Pro (category), Samsung Galaxy S23 (subcategory), 
      // Google Pixel 7 Pro (sub-subcategory), OnePlus 11 (subcategory), Budget Phone (category)
      expect(res.body.products).toHaveLength(5)
      expect(res.body.pagination.total).toBe(5)
    })

    it('should return products from subcategory and its descendants', async () => {
      const res = await request(app)
        .get(`/api/categories/${subcategoryId}/products`)
        .expect(200)

      // Should include: Samsung Galaxy S23 (subcategory), Google Pixel 7 Pro (sub-subcategory), OnePlus 11 (subcategory)
      expect(res.body.products).toHaveLength(3)
      expect(res.body.pagination.total).toBe(3)
    })

    it('should return products from sub-subcategory only', async () => {
      const res = await request(app)
        .get(`/api/categories/${subSubcategoryId}/products`)
        .expect(200)

      // Should include: Google Pixel 7 Pro (sub-subcategory)
      expect(res.body.products).toHaveLength(1)
      expect(res.body.products[0].name).toBe('Google Pixel 7 Pro')
      expect(res.body.pagination.total).toBe(1)
    })

    it('should not include inactive products', async () => {
      const res = await request(app)
        .get(`/api/categories/${subcategoryId}/products`)
        .expect(200)

      const productNames = res.body.products.map((p: any) => p.name)
      expect(productNames).not.toContain('Inactive Product')
    })

    it('should return empty results for category with no products', async () => {
      // Create a new empty category
      const emptyCategory = new Category({
        name: 'Empty Category',
        slug: 'empty-category',
        level: 0,
        order: 2,
        isActive: true
      })
      await emptyCategory.save()

      const res = await request(app)
        .get(`/api/categories/${emptyCategory._id}/products`)
        .expect(200)

      expect(res.body.products).toHaveLength(0)
      expect(res.body.pagination.total).toBe(0)
    })
  })

  describe('Pagination', () => {
    it('should support custom page and limit', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products?page=1&limit=2`)
        .expect(200)

      expect(res.body.products).toHaveLength(2)
      expect(res.body.pagination.page).toBe(1)
      expect(res.body.pagination.limit).toBe(2)
      expect(res.body.pagination.total).toBe(5)
      expect(res.body.pagination.pages).toBe(3)
    })

    it('should return second page of results', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products?page=2&limit=2`)
        .expect(200)

      expect(res.body.products).toHaveLength(2)
      expect(res.body.pagination.page).toBe(2)
    })

    it('should cap limit at 100', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products?limit=200`)
        .expect(200)

      expect(res.body.pagination.limit).toBe(100)
    })

    it('should reject invalid page parameter', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products?page=0`)
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })

    it('should reject invalid limit parameter', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products?limit=abc`)
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })
  })

  describe('Filtering', () => {
    it('should filter by price range', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products?minPrice=500&maxPrice=1000`)
        .expect(200)

      // Should include: iPhone 14 Pro (999.99), Samsung Galaxy S23 (899.99), OnePlus 11 (699.99)
      expect(res.body.products.length).toBeGreaterThan(0)
      res.body.products.forEach((p: any) => {
        expect(p.price).toBeGreaterThanOrEqual(500)
        expect(p.price).toBeLessThanOrEqual(1000)
      })
    })

    it('should filter by minimum price', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products?minPrice=900`)
        .expect(200)

      res.body.products.forEach((p: any) => {
        expect(p.price).toBeGreaterThanOrEqual(900)
      })
    })

    it('should filter by maximum price', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products?maxPrice=700`)
        .expect(200)

      res.body.products.forEach((p: any) => {
        expect(p.price).toBeLessThanOrEqual(700)
      })
    })

    it('should filter by minimum rating', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products?minRating=4.5`)
        .expect(200)

      res.body.products.forEach((p: any) => {
        expect(p.averageRating).toBeGreaterThanOrEqual(4.5)
      })
    })

    it('should reject invalid price range', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products?minPrice=1000&maxPrice=500`)
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })

    it('should reject invalid rating', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products?minRating=6`)
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })

    it('should combine multiple filters with AND logic', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products?minPrice=600&maxPrice=1000&minRating=4.5`)
        .expect(200)

      res.body.products.forEach((p: any) => {
        expect(p.price).toBeGreaterThanOrEqual(600)
        expect(p.price).toBeLessThanOrEqual(1000)
        expect(p.averageRating).toBeGreaterThanOrEqual(4.5)
      })
    })
  })

  describe('Sorting', () => {
    it('should sort by price ascending', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products?sortBy=price_asc`)
        .expect(200)

      if (res.body.products.length > 1) {
        const prices = res.body.products.map((p: any) => p.price)
        expect(prices).toEqual([...prices].sort((a, b) => a - b))
      }
    })

    it('should sort by price descending', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products?sortBy=price_desc`)
        .expect(200)

      if (res.body.products.length > 1) {
        const prices = res.body.products.map((p: any) => p.price)
        expect(prices).toEqual([...prices].sort((a, b) => b - a))
      }
    })

    it('should sort by rating descending', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products?sortBy=rating`)
        .expect(200)

      if (res.body.products.length > 1) {
        const ratings = res.body.products.map((p: any) => p.averageRating)
        expect(ratings).toEqual([...ratings].sort((a, b) => b - a))
      }
    })

    it('should sort by newest first', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products?sortBy=newest`)
        .expect(200)

      expect(res.body.products.length).toBeGreaterThan(0)
    })

    it('should reject invalid sort parameter', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products?sortBy=invalid`)
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })
  })

  describe('Error Handling', () => {
    it('should return 404 for non-existent category', async () => {
      const fakeId = new mongoose.Types.ObjectId()
      const res = await request(app)
        .get(`/api/categories/${fakeId}/products`)
        .expect(404)

      expect(res.body).toHaveProperty('error')
      expect(res.body.message).toContain('Category not found')
    })

    it('should return 400 for invalid category ID format', async () => {
      const res = await request(app)
        .get('/api/categories/invalid-id/products')
        .expect(400)

      expect(res.body).toHaveProperty('error')
      expect(res.body.message).toContain('Invalid category ID format')
    })

    it('should return 400 for inactive category', async () => {
      const inactiveCategory = new Category({
        name: 'Inactive Category',
        slug: 'inactive-category',
        level: 0,
        order: 3,
        isActive: false
      })
      await inactiveCategory.save()

      const res = await request(app)
        .get(`/api/categories/${inactiveCategory._id}/products`)
        .expect(404)

      expect(res.body).toHaveProperty('error')
    })
  })

  describe('Response Structure', () => {
    it('should return correct product fields', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products`)
        .expect(200)

      expect(res.body.products.length).toBeGreaterThan(0)
      const product = res.body.products[0]
      expect(product).toHaveProperty('_id')
      expect(product).toHaveProperty('name')
      expect(product).toHaveProperty('price')
      expect(product).toHaveProperty('images')
      expect(product).toHaveProperty('averageRating')
      expect(product).toHaveProperty('reviewCount')
      expect(product).toHaveProperty('category')
      expect(product).toHaveProperty('slug')
    })

    it('should return correct pagination structure', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}/products`)
        .expect(200)

      expect(res.body.pagination).toHaveProperty('page')
      expect(res.body.pagination).toHaveProperty('limit')
      expect(res.body.pagination).toHaveProperty('total')
      expect(res.body.pagination).toHaveProperty('pages')
    })
  })
})
