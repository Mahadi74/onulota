import mongoose from 'mongoose'
import { Product } from '../Product'
import { connectDatabase, disconnectDatabase } from '../../config/database'

describe('Product Model Integration', () => {
  beforeAll(async () => {
    // Use test database
    process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/onulota_test'
    await connectDatabase()
  })

  afterAll(async () => {
    await disconnectDatabase()
  })

  beforeEach(async () => {
    await Product.deleteMany({})
  })

  it('should create indexes correctly', async () => {
    // Create a product to trigger index creation
    const product = new Product({
      name: 'Test Product for Indexes',
      description: 'This product is used to test index creation',
      price: 99.99,
      category: new mongoose.Types.ObjectId()
    })
    
    await product.save()

    // Get collection indexes
    const indexes = await Product.collection.getIndexes()
    
    // Check that required indexes exist
    expect(indexes).toHaveProperty('slug_1')
    expect(indexes).toHaveProperty('category_1')
    expect(indexes).toHaveProperty('averageRating_-1')
    expect(indexes).toHaveProperty('price_1')
    expect(indexes).toHaveProperty('isActive_1')
    expect(indexes).toHaveProperty('product_text_search')
    
    // Check compound indexes
    expect(indexes).toHaveProperty('category_1_isActive_1')
    expect(indexes).toHaveProperty('category_1_price_1')
    expect(indexes).toHaveProperty('isActive_1_isFeatured_1')
  })

  it('should perform text search correctly', async () => {
    const categoryId = new mongoose.Types.ObjectId()
    
    // Create test products
    await Product.create([
      {
        name: 'iPhone 15 Pro',
        description: 'Latest Apple smartphone with titanium design',
        price: 999.99,
        category: categoryId
      },
      {
        name: 'Samsung Galaxy S24',
        description: 'Android smartphone with AI features',
        price: 899.99,
        category: categoryId
      },
      {
        name: 'MacBook Pro',
        description: 'Professional laptop for developers',
        price: 1999.99,
        category: categoryId
      }
    ])

    // Test text search
    const smartphoneResults = await Product.searchProducts('smartphone')
    expect(smartphoneResults).toHaveLength(2)
    
    const appleResults = await Product.searchProducts('Apple')
    expect(appleResults).toHaveLength(1)
    expect(appleResults[0].name).toBe('iPhone 15 Pro')
  })

  it('should handle slug uniqueness correctly', async () => {
    const categoryId = new mongoose.Types.ObjectId()
    
    const product1 = new Product({
      name: 'Test Product',
      description: 'First test product',
      price: 99.99,
      category: categoryId
    })
    
    await product1.save()
    expect(product1.slug).toBe('test-product')

    // Try to create another product with the same name
    const product2 = new Product({
      name: 'Test Product',
      description: 'Second test product',
      price: 149.99,
      category: categoryId
    })

    // This should fail due to unique slug constraint
    await expect(product2.save()).rejects.toThrow()
  })
})