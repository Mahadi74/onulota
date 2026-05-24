import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Cart, ICart } from '../Cart'
import { Product, IProduct } from '../Product'
import { Category, ICategory } from '../Category'

describe('Cart Model Integration Tests', () => {
  let mongoServer: MongoMemoryServer
  let category: ICategory
  let product1: IProduct
  let product2: IProduct

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()
    await mongoose.connect(mongoUri)

    // Create test category
    category = await Category.create({
      name: 'Electronics',
      slug: 'electronics',
      level: 0
    })

    // Create test products
    product1 = await Product.create({
      name: 'iPhone 15',
      description: 'Latest Apple smartphone with advanced features',
      price: 999.99,
      category: category._id,
      images: [{
        url: 'https://example.com/iphone15.jpg',
        alt: 'iPhone 15'
      }],
      stock: 10
    })

    product2 = await Product.create({
      name: 'Samsung Galaxy S24',
      description: 'Premium Android smartphone with excellent camera',
      price: 899.99,
      category: category._id,
      images: [{
        url: 'https://example.com/galaxy-s24.jpg',
        alt: 'Samsung Galaxy S24'
      }],
      variants: [
        {
          name: 'Size: 128GB, Color: Black',
          sku: 'GALAXY-128-BLACK',
          price: 899.99,
          stock: 5
        },
        {
          name: 'Size: 256GB, Color: White',
          sku: 'GALAXY-256-WHITE',
          price: 999.99,
          stock: 3
        }
      ]
    })
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  beforeEach(async () => {
    await Cart.deleteMany({})
  })

  describe('Cart Operations with Products', () => {
    it('should create cart with product references', async () => {
      const userId = new mongoose.Types.ObjectId()
      
      // Create cart with items
      const cart = await Cart.create({
        user: userId,
        items: [
          {
            product: product1._id,
            quantity: 2,
            price: product1.price,
            addedAt: new Date()
          },
          {
            product: product2._id,
            variant: product2.variants[0]._id,
            quantity: 1,
            price: product2.variants[0].price,
            addedAt: new Date()
          }
        ]
      })

      expect(cart).toBeDefined()
      expect(cart.items).toHaveLength(2)
      
      // Check if product references are stored correctly
      expect(cart.items[0].product).toEqual(product1._id)
      expect(cart.items[1].product).toEqual(product2._id)
      expect(cart.items[1].variant).toEqual(product2.variants[0]._id)
    })

    it('should find cart with product references', async () => {
      const sessionId = 'guest-session-123'
      
      // Create guest cart with items
      const cart = await Cart.create({
        sessionId,
        items: [
          {
            product: product1._id,
            quantity: 1,
            price: product1.price,
            addedAt: new Date()
          }
        ]
      })

      const foundCart = await Cart.findBySession(sessionId)
      
      expect(foundCart).toBeDefined()
      expect(foundCart!.items).toHaveLength(1)
      
      // Check if product reference is stored correctly
      expect(foundCart!.items[0].product).toEqual(product1._id)
    })
  })

  describe('Real-world Cart Operations', () => {
    let userCart: ICart

    beforeEach(async () => {
      const userId = new mongoose.Types.ObjectId()
      userCart = await Cart.createUserCart(userId)
    })

    it('should handle adding products with current prices', async () => {
      // Add iPhone to cart
      await userCart.addItem(product1._id, 1, product1.price)
      
      // Add Samsung variant to cart
      const variant = product2.variants[0]
      await userCart.addItem(product2._id, 2, variant.price, variant._id)
      
      expect(userCart.items).toHaveLength(2)
      expect(userCart.subtotal).toBe(999.99 + (899.99 * 2)) // iPhone + 2x Samsung
      expect(userCart.totalItems).toBe(3)
    })

    it('should handle price updates when adding existing items', async () => {
      const originalPrice = 999.99
      const updatedPrice = 1099.99
      
      // Add item with original price
      await userCart.addItem(product1._id, 1, originalPrice)
      expect(userCart.items[0].price).toBe(originalPrice)
      
      // Add same item with updated price
      await userCart.addItem(product1._id, 1, updatedPrice)
      
      expect(userCart.items).toHaveLength(1)
      expect(userCart.items[0].quantity).toBe(2)
      expect(userCart.items[0].price).toBe(updatedPrice) // Should use latest price
    })

    it('should handle complex cart operations', async () => {
      // Add multiple items
      await userCart.addItem(product1._id, 2, product1.price)
      await userCart.addItem(product2._id, 1, product2.variants[0].price, product2.variants[0]._id)
      await userCart.addItem(product2._id, 1, product2.variants[1].price, product2.variants[1]._id)
      
      expect(userCart.items).toHaveLength(3)
      expect(userCart.totalItems).toBe(4)
      
      // Update quantity of first item
      const firstItemId = userCart.items[0]._id!
      await userCart.updateItemQuantity(firstItemId, 5)
      
      expect(userCart.items[0].quantity).toBe(5)
      expect(userCart.totalItems).toBe(7)
      
      // Remove second item
      const secondItemId = userCart.items[1]._id!
      await userCart.removeItem(secondItemId)
      
      expect(userCart.items).toHaveLength(2)
      expect(userCart.totalItems).toBe(6)
    })
  })

  describe('Cart Merging Scenarios', () => {
    it('should merge guest cart with different products to user cart', async () => {
      const userId = new mongoose.Types.ObjectId()
      const sessionId = 'guest-session-456'
      
      // Create user cart with iPhone
      const userCart = await Cart.create({
        user: userId,
        items: [{
          product: product1._id,
          quantity: 1,
          price: product1.price,
          addedAt: new Date()
        }]
      })
      
      // Create guest cart with Samsung
      const guestCart = await Cart.create({
        sessionId,
        items: [{
          product: product2._id,
          variant: product2.variants[0]._id,
          quantity: 2,
          price: product2.variants[0].price,
          addedAt: new Date()
        }]
      })
      
      const mergedCart = await Cart.mergeGuestCartToUser(guestCart, userId)
      
      expect(mergedCart.items).toHaveLength(2)
      expect(mergedCart.totalItems).toBe(3) // 1 iPhone + 2 Samsung
      
      // Verify both products are present
      const hasIPhone = mergedCart.hasItem(product1._id)
      const hasSamsung = mergedCart.hasItem(product2._id, product2.variants[0]._id)
      
      expect(hasIPhone).toBe(true)
      expect(hasSamsung).toBe(true)
    })

    it('should handle merging with variant conflicts correctly', async () => {
      const userId = new mongoose.Types.ObjectId()
      const sessionId = 'guest-session-789'
      
      const variant1 = product2.variants[0]
      const variant2 = product2.variants[1]
      
      // Create user cart with Samsung variant 1
      const userCart = await Cart.create({
        user: userId,
        items: [{
          product: product2._id,
          variant: variant1._id,
          quantity: 2,
          price: variant1.price,
          addedAt: new Date(Date.now() - 5000)
        }]
      })
      
      // Create guest cart with both variants
      const guestCart = await Cart.create({
        sessionId,
        items: [
          {
            product: product2._id,
            variant: variant1._id,
            quantity: 1, // Lower quantity than user cart
            price: variant1.price + 50, // Different price
            addedAt: new Date()
          },
          {
            product: product2._id,
            variant: variant2._id,
            quantity: 3,
            price: variant2.price,
            addedAt: new Date()
          }
        ]
      })
      
      const mergedCart = await Cart.mergeGuestCartToUser(guestCart, userId)
      
      expect(mergedCart.items).toHaveLength(2)
      
      // Variant 1 should keep user cart quantity (higher)
      const variant1Item = mergedCart.getItem(product2._id, variant1._id)
      expect(variant1Item!.quantity).toBe(2)
      expect(variant1Item!.price).toBe(variant1.price) // Original price
      
      // Variant 2 should be added from guest cart
      const variant2Item = mergedCart.getItem(product2._id, variant2._id)
      expect(variant2Item!.quantity).toBe(3)
      expect(variant2Item!.price).toBe(variant2.price)
    })
  })

  describe('Cart Expiration', () => {
    it('should set expiration date 30 days from creation', async () => {
      const userId = new mongoose.Types.ObjectId()
      const cart = await Cart.createUserCart(userId)
      
      const now = new Date()
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      
      // Allow for small time differences (within 1 minute)
      const timeDiff = Math.abs(cart.expiresAt.getTime() - thirtyDaysFromNow.getTime())
      expect(timeDiff).toBeLessThan(60000) // Within 1 minute
    })

    it('should allow custom expiration date', async () => {
      const userId = new mongoose.Types.ObjectId()
      const customExpiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      
      const cart = await Cart.create({
        user: userId,
        items: [],
        expiresAt: customExpiration
      })
      
      expect(cart.expiresAt.getTime()).toBe(customExpiration.getTime())
    })
  })

  describe('Performance and Indexing', () => {
    it('should efficiently find carts by user with index', async () => {
      const userId = new mongoose.Types.ObjectId()
      
      // Create cart
      await Cart.createUserCart(userId)
      
      // This should use the user index
      const startTime = Date.now()
      const cart = await Cart.findByUser(userId)
      const endTime = Date.now()
      
      expect(cart).toBeDefined()
      expect(endTime - startTime).toBeLessThan(100) // Should be very fast with index
    })

    it('should efficiently find carts by sessionId with index', async () => {
      const sessionId = 'performance-test-session'
      
      // Create cart
      await Cart.createGuestCart(sessionId)
      
      // This should use the sessionId index
      const startTime = Date.now()
      const cart = await Cart.findBySession(sessionId)
      const endTime = Date.now()
      
      expect(cart).toBeDefined()
      expect(endTime - startTime).toBeLessThan(100) // Should be very fast with index
    })
  })
})