import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Product } from '../../../models/Product'
import { Category } from '../../../models/Category'
import { getProductList, ProductListQuery } from '../product.service'

describe('Product Service - getProductList', () => {
  let mongoServer: MongoMemoryServer
  let categoryId: mongoose.Types.ObjectId
  let subcategoryId: mongoose.Types.ObjectId

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()
    await mongoose.connect(mongoUri)
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
        name: 'Premium Phone',
        description: 'High-end smartphone',
        price: 1000,
        category: categoryId,
        images: [{ url: 'https://example.com/premium.jpg' }],
        stock: 10,
        averageRating: 4.9,
        reviewCount: 200,
        isActive: true
      },
      {
        name: 'Mid-Range Phone',
        description: 'Mid-range smartphone',
        price: 500,
        category: subcategoryId,
        images: [{ url: 'https://example.com/midrange.jpg' }],
        stock: 20,
        averageRating: 4.0,
        reviewCount: 100,
        isActive: true
      },
      {
        name: 'Budget Phone',
        description: 'Budget smartphone',
        price: 200,
        category: subcategoryId,
        images: [{ url: 'https://example.com/budget.jpg' }],
        stock: 30,
        averageRating: 3.5,
        reviewCount: 50,
        isActive: true
      },
      {
        name: 'Inactive Phone',
        description: 'This product is inactive',
        price: 300,
        category: categoryId,
        images: [{ url: 'https://example.com/inactive.jpg' }],
        stock: 5,
        averageRating: 4.0,
        reviewCount: 30,
        isActive: false
      }
    ])
  })

  describe('Basic Functionality', () => {
    it('should return all active products with default pagination', async () => {
      const result = await getProductList({})

      expect(result.products).toHaveLength(3)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(20)
      expect(result.pagination.total).toBe(3)
      expect(result.pagination.pages).toBe(1)
    })

    it('should not include inactive products', async () => {
      const result = await getProductList({})

      const names = result.products.map(p => p.name)
      expect(names).not.toContain('Inactive Phone')
    })

    it('should return products with required fields', async () => {
      const result = await getProductList({})

      expect(result.products[0]).toHaveProperty('_id')
      expect(result.products[0]).toHaveProperty('name')
      expect(result.products[0]).toHaveProperty('price')
      expect(result.products[0]).toHaveProperty('images')
      expect(result.products[0]).toHaveProperty('averageRating')
      expect(result.products[0]).toHaveProperty('reviewCount')
    })
  })

  describe('Pagination', () => {
    it('should respect page and limit parameters', async () => {
      const result = await getProductList({ page: 1, limit: 2 })

      expect(result.products).toHaveLength(2)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(2)
      expect(result.pagination.total).toBe(3)
      expect(result.pagination.pages).toBe(2)
    })

    it('should return correct page 2', async () => {
      const page1 = await getProductList({ page: 1, limit: 2 })
      const page2 = await getProductList({ page: 2, limit: 2 })

      const names1 = page1.products.map(p => p.name)
      const names2 = page2.products.map(p => p.name)

      expect(names1).not.toEqual(names2)
      expect(page2.products).toHaveLength(1)
    })

    it('should cap limit at 100', async () => {
      const result = await getProductList({ limit: 200 })

      expect(result.pagination.limit).toBe(100)
    })

    it('should handle page beyond available pages', async () => {
      const result = await getProductList({ page: 100, limit: 10 })

      expect(result.products).toHaveLength(0)
      expect(result.pagination.page).toBe(100)
      expect(result.pagination.total).toBe(3)
    })
  })

  describe('Price Filter', () => {
    it('should filter by minimum price', async () => {
      const result = await getProductList({ minPrice: 400 })

      expect(result.products).toHaveLength(2) // Premium Phone (1000), Mid-Range Phone (500)
      expect(result.products.every(p => p.price >= 400)).toBe(true)
    })

    it('should filter by maximum price', async () => {
      const result = await getProductList({ maxPrice: 300 })

      expect(result.products).toHaveLength(1) // Budget Phone (200)
      expect(result.products.every(p => p.price <= 300)).toBe(true)
    })

    it('should filter by price range', async () => {
      const result = await getProductList({ minPrice: 300, maxPrice: 600 })

      expect(result.products).toHaveLength(1) // Mid-Range Phone (500)
      expect(result.products.every(p => p.price >= 300 && p.price <= 600)).toBe(true)
    })

    it('should return empty results for price range with no matches', async () => {
      const result = await getProductList({ minPrice: 2000, maxPrice: 3000 })

      expect(result.products).toHaveLength(0)
      expect(result.pagination.total).toBe(0)
    })
  })

  describe('Rating Filter', () => {
    it('should filter by minimum rating', async () => {
      const result = await getProductList({ minRating: 4.0 })

      expect(result.products).toHaveLength(2) // Premium Phone (4.9), Mid-Range Phone (4.0)
      expect(result.products.every(p => p.averageRating >= 4.0)).toBe(true)
    })

    it('should filter by high rating', async () => {
      const result = await getProductList({ minRating: 4.5 })

      expect(result.products).toHaveLength(1) // Premium Phone (4.9)
      expect(result.products[0].averageRating).toBe(4.9)
    })

    it('should return empty results for very high rating', async () => {
      const result = await getProductList({ minRating: 5.0 })

      expect(result.products).toHaveLength(0)
    })
  })

  describe('Category Filter', () => {
    it('should filter by category including subcategories', async () => {
      const result = await getProductList({ categoryId: categoryId.toString() })

      expect(result.products).toHaveLength(3) // All active products
      expect(result.products.every(p => 
        p.category.toString() === categoryId.toString() || p.category.toString() === subcategoryId.toString()
      )).toBe(true)
    })

    it('should filter by subcategory', async () => {
      const result = await getProductList({ categoryId: subcategoryId.toString() })

      expect(result.products).toHaveLength(2) // Mid-Range Phone, Budget Phone
      expect(result.products.every(p => p.category.toString() === subcategoryId.toString())).toBe(true)
    })

    it('should return empty results for invalid category ID', async () => {
      const invalidId = new mongoose.Types.ObjectId()
      const result = await getProductList({ categoryId: invalidId.toString() })

      expect(result.products).toHaveLength(0)
      expect(result.pagination.total).toBe(0)
    })

    it('should return empty results for malformed category ID', async () => {
      const result = await getProductList({ categoryId: 'invalid-id' })

      expect(result.products).toHaveLength(0)
      expect(result.pagination.total).toBe(0)
    })
  })

  describe('Sorting', () => {
    it('should sort by price ascending', async () => {
      const result = await getProductList({ sortBy: 'price_asc' })

      const prices = result.products.map(p => p.price)
      expect(prices).toEqual([200, 500, 1000])
    })

    it('should sort by price descending', async () => {
      const result = await getProductList({ sortBy: 'price_desc' })

      const prices = result.products.map(p => p.price)
      expect(prices).toEqual([1000, 500, 200])
    })

    it('should sort by rating descending', async () => {
      const result = await getProductList({ sortBy: 'rating' })

      const ratings = result.products.map(p => p.averageRating)
      expect(ratings).toEqual([4.9, 4.0, 3.5])
    })

    it('should sort by newest first', async () => {
      const result = await getProductList({ sortBy: 'newest' })

      // Products are created in order, so newest should be last created (Budget Phone)
      // But we need to check the actual order
      expect(result.products).toHaveLength(3)
      // Just verify that sorting by newest works (descending by createdAt)
      const dates = result.products.map(p => new Date(p.createdAt).getTime())
      expect(dates).toEqual([...dates].sort((a, b) => b - a))
    })

    it('should use default sort (rating) when not specified', async () => {
      const result = await getProductList({})

      const ratings = result.products.map(p => p.averageRating)
      expect(ratings).toEqual([4.9, 4.0, 3.5])
    })
  })

  describe('Combined Filters', () => {
    it('should apply multiple filters with AND logic', async () => {
      const result = await getProductList({
        minPrice: 300,
        maxPrice: 600,
        minRating: 3.8,
        categoryId: subcategoryId.toString()
      })

      expect(result.products).toHaveLength(1) // Mid-Range Phone
      expect(result.products[0].name).toBe('Mid-Range Phone')
    })

    it('should apply price and rating filters', async () => {
      const result = await getProductList({
        minPrice: 400,
        minRating: 4.5
      })

      expect(result.products).toHaveLength(1) // Premium Phone
      expect(result.products[0].name).toBe('Premium Phone')
    })

    it('should return empty results when no products match all filters', async () => {
      const result = await getProductList({
        minPrice: 1500,
        maxPrice: 2000
      })

      expect(result.products).toHaveLength(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero price', async () => {
      const result = await getProductList({ minPrice: 0, maxPrice: 0 })

      expect(result.products).toHaveLength(0)
    })

    it('should handle negative prices gracefully', async () => {
      const result = await getProductList({ minPrice: -100 })

      // Negative prices are clamped to 0
      expect(result.products).toHaveLength(3)
    })

    it('should handle page 1 explicitly', async () => {
      const result = await getProductList({ page: 1, limit: 10 })

      expect(result.pagination.page).toBe(1)
      expect(result.products).toHaveLength(3)
    })

    it('should handle limit of 1', async () => {
      const result = await getProductList({ limit: 1 })

      expect(result.products).toHaveLength(1)
      expect(result.pagination.pages).toBe(3)
    })
  })
})
