import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Product, IProduct } from '../Product'

describe('Product Model', () => {
  let mongoServer: MongoMemoryServer

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
  })

  describe('Product Creation', () => {
    it('should create a product with required fields', async () => {
      const productData = {
        name: 'Test Product',
        description: 'This is a test product description with more than 10 characters',
        price: 99.99,
        category: new mongoose.Types.ObjectId(),
        images: [{
          url: 'https://example.com/image.jpg',
          alt: 'Test product image'
        }]
      }

      const product = new Product(productData)
      const savedProduct = await product.save()

      expect(savedProduct.name).toBe(productData.name)
      expect(savedProduct.description).toBe(productData.description)
      expect(savedProduct.price).toBe(productData.price)
      expect(savedProduct.slug).toBe('test-product')
      expect(savedProduct.isActive).toBe(true)
      expect(savedProduct.isFeatured).toBe(false)
      expect(savedProduct.stock).toBe(0)
      expect(savedProduct.averageRating).toBe(0)
      expect(savedProduct.reviewCount).toBe(0)
    })

    it('should auto-generate slug from name', async () => {
      const product = new Product({
        name: 'Test Product With Special Characters!@#',
        description: 'This is a test product description',
        price: 99.99,
        category: new mongoose.Types.ObjectId()
      })

      const savedProduct = await product.save()
      expect(savedProduct.slug).toBe('test-product-with-special-characters')
    })

    it('should fail validation for missing required fields', async () => {
      const product = new Product({
        name: 'Test Product'
        // Missing description, price, category
      })

      await expect(product.save()).rejects.toThrow()
    })

    it('should fail validation for invalid field lengths', async () => {
      const product = new Product({
        name: 'AB', // Too short (min 3)
        description: 'Short', // Too short (min 10)
        price: 99.99,
        category: new mongoose.Types.ObjectId()
      })

      await expect(product.save()).rejects.toThrow()
    })

    it('should fail validation for negative price', async () => {
      const product = new Product({
        name: 'Test Product',
        description: 'This is a test product description',
        price: -10, // Negative price
        category: new mongoose.Types.ObjectId()
      })

      await expect(product.save()).rejects.toThrow()
    })
  })

  describe('Product Indexes', () => {
    it('should enforce unique slug constraint', async () => {
      const productData = {
        name: 'Test Product',
        description: 'This is a test product description',
        price: 99.99,
        category: new mongoose.Types.ObjectId()
      }

      const product1 = new Product(productData)
      await product1.save()

      const product2 = new Product(productData)
      await expect(product2.save()).rejects.toThrow()
    })

    it('should allow text search on name and description', async () => {
      const categoryId = new mongoose.Types.ObjectId()
      
      await Product.create([
        {
          name: 'Smartphone iPhone',
          description: 'Latest Apple smartphone with advanced features',
          price: 999.99,
          category: categoryId
        },
        {
          name: 'Android Phone',
          description: 'Budget-friendly smartphone with good performance',
          price: 299.99,
          category: categoryId
        },
        {
          name: 'Laptop Computer',
          description: 'High-performance laptop for professionals',
          price: 1299.99,
          category: categoryId
        }
      ])

      const results = await Product.searchProducts('smartphone')
      expect(results).toHaveLength(2)
      expect(results.map(p => p.name)).toEqual(
        expect.arrayContaining(['Smartphone iPhone', 'Android Phone'])
      )
    })
  })

  describe('Product Variants', () => {
    it('should handle product variants correctly', async () => {
      const product = new Product({
        name: 'T-Shirt',
        description: 'Comfortable cotton t-shirt',
        price: 29.99,
        category: new mongoose.Types.ObjectId(),
        variants: [
          {
            name: 'Size: M, Color: Red',
            sku: 'TSHIRT-M-RED',
            price: 29.99,
            stock: 10
          },
          {
            name: 'Size: L, Color: Blue',
            sku: 'TSHIRT-L-BLUE',
            price: 29.99,
            stock: 5
          }
        ]
      })

      const savedProduct = await product.save()
      expect(savedProduct.variants).toHaveLength(2)
      expect(savedProduct.totalStock).toBe(15)
      expect(savedProduct.inStock).toBe(true)
    })

    it('should calculate inStock correctly for non-variant products', async () => {
      const product = new Product({
        name: 'Simple Product',
        description: 'A simple product without variants',
        price: 49.99,
        category: new mongoose.Types.ObjectId(),
        stock: 10
      })

      const savedProduct = await product.save()
      expect(savedProduct.inStock).toBe(true)
      expect(savedProduct.totalStock).toBe(10)
    })
  })

  describe('Rating Methods', () => {
    let product: IProduct

    beforeEach(async () => {
      product = new Product({
        name: 'Test Product',
        description: 'This is a test product description',
        price: 99.99,
        category: new mongoose.Types.ObjectId()
      })
      await product.save()
    })

    it('should update average rating correctly for new reviews', async () => {
      await product.updateAverageRating(5)
      expect(product.averageRating).toBe(5)
      expect(product.reviewCount).toBe(1)

      await product.updateAverageRating(3)
      expect(product.averageRating).toBe(4)
      expect(product.reviewCount).toBe(2)
    })

    it('should update average rating correctly when updating existing review', async () => {
      await product.updateAverageRating(5)
      await product.updateAverageRating(3)
      
      // Update first review from 5 to 1
      await product.updateAverageRating(1, 5)
      expect(product.averageRating).toBe(2)
      expect(product.reviewCount).toBe(2)
    })

    it('should remove rating correctly', async () => {
      await product.updateAverageRating(5)
      await product.updateAverageRating(3)
      
      await product.removeRating(5)
      expect(product.averageRating).toBe(3)
      expect(product.reviewCount).toBe(1)
    })

    it('should reset rating when removing last review', async () => {
      await product.updateAverageRating(5)
      
      await product.removeRating(5)
      expect(product.averageRating).toBe(0)
      expect(product.reviewCount).toBe(0)
    })
  })

  describe('Static Methods', () => {
    it('should find products by category', async () => {
      const categoryId = new mongoose.Types.ObjectId()
      const otherCategoryId = new mongoose.Types.ObjectId()
      
      await Product.create([
        {
          name: 'Product 1',
          description: 'Description 1',
          price: 99.99,
          category: categoryId,
          isActive: true
        },
        {
          name: 'Product 2',
          description: 'Description 2',
          price: 149.99,
          category: categoryId,
          isActive: true
        },
        {
          name: 'Product 3',
          description: 'Description 3',
          price: 199.99,
          category: otherCategoryId,
          isActive: true
        },
        {
          name: 'Product 4',
          description: 'Description 4',
          price: 249.99,
          category: categoryId,
          isActive: false // Inactive product
        }
      ])

      const products = await Product.findByCategory(categoryId)
      expect(products).toHaveLength(2)
      expect(products.every(p => p.category.toString() === categoryId.toString())).toBe(true)
      expect(products.every(p => p.isActive)).toBe(true)
    })
  })
})