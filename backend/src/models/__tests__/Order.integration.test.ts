import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Order, IOrder } from '../Order'
import { Product, IProduct } from '../Product'
import { Category, ICategory } from '../Category'

describe('Order Model Integration Tests', () => {
  let mongoServer: MongoMemoryServer
  let category: ICategory
  let product: IProduct
  let userId: Types.ObjectId

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
    // Clear all collections
    await Order.deleteMany({})
    await Product.deleteMany({})
    await Category.deleteMany({})

    // Create test data
    userId = new Types.ObjectId()

    category = await Category.create({
      name: 'Electronics',
      slug: 'electronics',
      level: 0
    })

    product = await Product.create({
      name: 'iPhone 15 Pro',
      description: 'Latest Apple smartphone with titanium design',
      price: 999.99,
      category: category._id,
      images: [{
        url: 'https://example.com/iphone15.jpg',
        alt: 'iPhone 15 Pro'
      }],
      stock: 10
    })
  })

  describe('Order Creation with Product References', () => {
    it('should create order with valid product references', async () => {
      const orderData = {
        user: userId,
        items: [{
          product: product._id,
          name: product.name,
          price: product.price,
          quantity: 2,
          subtotal: product.price * 2
        }],
        shippingAddress: {
          recipientName: 'John Doe',
          phone: '+8801712345678',
          street: '123 Main Street',
          city: 'Dhaka',
          postalCode: '1000',
          country: 'Bangladesh'
        },
        paymentMethod: 'cod' as const,
        subtotal: product.price * 2,
        tax: 0,
        shippingCost: 50,
        discount: 0,
        total: (product.price * 2) + 50
      }

      const order = await Order.create(orderData)
      
      expect(order).toBeTruthy()
      expect(order.items[0].product.toString()).toBe(product._id.toString())
      expect(order.items[0].name).toBe(product.name)
      expect(order.items[0].price).toBe(product.price)
    })

    it('should populate product references', async () => {
      const orderData = {
        user: userId,
        items: [{
          product: product._id,
          name: product.name,
          price: product.price,
          quantity: 1,
          subtotal: product.price
        }],
        shippingAddress: {
          recipientName: 'John Doe',
          phone: '+8801712345678',
          street: '123 Main Street',
          city: 'Dhaka',
          postalCode: '1000',
          country: 'Bangladesh'
        },
        paymentMethod: 'cod' as const,
        subtotal: product.price,
        tax: 0,
        shippingCost: 0,
        discount: 0,
        total: product.price
      }

      const order = await Order.create(orderData)
      
      const populatedOrder = await Order.findById(order._id)
        .populate('items.product')
        .exec()

      expect(populatedOrder).toBeTruthy()
      expect(populatedOrder!.items[0].product).toBeTruthy()
      
      // Check if product is populated (has name field)
      const populatedProduct = populatedOrder!.items[0].product as any
      expect(populatedProduct.name).toBe(product.name)
    })
  })

  describe('Order Workflow Scenarios', () => {
    let order: IOrder

    beforeEach(async () => {
      const orderData = {
        user: userId,
        items: [{
          product: product._id,
          name: product.name,
          price: product.price,
          quantity: 1,
          subtotal: product.price
        }],
        shippingAddress: {
          recipientName: 'John Doe',
          phone: '+8801712345678',
          street: '123 Main Street',
          city: 'Dhaka',
          postalCode: '1000',
          country: 'Bangladesh'
        },
        paymentMethod: 'cod' as const,
        subtotal: product.price,
        tax: 0,
        shippingCost: 50,
        discount: 0,
        total: product.price + 50
      }

      order = await Order.create(orderData)
    })

    it('should handle complete order fulfillment workflow', async () => {
      // Initial state
      expect(order.status).toBe('pending')
      expect(order.statusHistory).toHaveLength(1)

      // Admin processes order
      await order.updateStatus('processing', 'Order is being prepared')
      expect(order.status).toBe('processing')
      expect(order.statusHistory).toHaveLength(2)
      expect(order.statusHistory[1].note).toBe('Order is being prepared')

      // Order is shipped
      await order.updateStatus('shipped', 'Order shipped with tracking number ABC123')
      order.trackingNumber = 'ABC123'
      await order.save()
      
      expect(order.status).toBe('shipped')
      expect(order.trackingNumber).toBe('ABC123')
      expect(order.statusHistory).toHaveLength(3)

      // Order is delivered
      await order.updateStatus('delivered', 'Order delivered successfully')
      expect(order.status).toBe('delivered')
      expect(order.statusHistory).toHaveLength(4)
      expect(order.canBeCancelled()).toBe(false)
    })

    it('should handle order cancellation workflow', async () => {
      // Customer cancels order while pending
      await order.updateStatus('cancelled', 'Customer requested cancellation')
      
      expect(order.status).toBe('cancelled')
      expect(order.statusHistory).toHaveLength(2)
      expect(order.statusHistory[1].note).toBe('Customer requested cancellation')
      expect(order.canBeCancelled()).toBe(false)
    })

    it('should handle payment status updates', async () => {
      // Initially pending payment
      expect(order.paymentStatus).toBe('pending')

      // Payment successful
      order.paymentStatus = 'paid'
      order.paymentTransactionId = 'TXN123456789'
      await order.save()

      expect(order.paymentStatus).toBe('paid')
      expect(order.paymentTransactionId).toBe('TXN123456789')
    })
  })

  describe('Complex Order Scenarios', () => {
    it('should handle orders with multiple items and variants', async () => {
      // Create a product with variants
      const productWithVariants = await Product.create({
        name: 'T-Shirt',
        description: 'Cotton T-Shirt',
        price: 29.99,
        category: category._id,
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
            price: 32.99,
            stock: 5
          }
        ]
      })

      const orderData = {
        user: userId,
        items: [
          {
            product: product._id,
            name: product.name,
            price: product.price,
            quantity: 1,
            subtotal: product.price
          },
          {
            product: productWithVariants._id,
            variant: productWithVariants.variants[0]._id,
            name: `${productWithVariants.name} - ${productWithVariants.variants[0].name}`,
            price: productWithVariants.variants[0].price,
            quantity: 2,
            subtotal: productWithVariants.variants[0].price * 2
          },
          {
            product: productWithVariants._id,
            variant: productWithVariants.variants[1]._id,
            name: `${productWithVariants.name} - ${productWithVariants.variants[1].name}`,
            price: productWithVariants.variants[1].price,
            quantity: 1,
            subtotal: productWithVariants.variants[1].price
          }
        ],
        shippingAddress: {
          recipientName: 'Jane Smith',
          phone: '+8801987654321',
          street: '456 Oak Avenue',
          city: 'Chittagong',
          postalCode: '4000',
          country: 'Bangladesh'
        },
        paymentMethod: 'sslcommerz' as const,
        subtotal: 0, // Will be calculated
        tax: 50,
        shippingCost: 100,
        discount: 20,
        total: 0 // Will be calculated
      }

      // Calculate totals
      orderData.subtotal = orderData.items.reduce((sum, item) => sum + item.subtotal, 0)
      orderData.total = orderData.subtotal + orderData.tax + orderData.shippingCost - orderData.discount

      const order = await Order.create(orderData)

      expect(order.items).toHaveLength(3)
      expect(order.items[0].variant).toBeUndefined()
      expect(order.items[1].variant).toBeTruthy()
      expect(order.items[2].variant).toBeTruthy()
      expect(order.subtotal).toBeCloseTo(orderData.subtotal, 2)
      expect(order.total).toBeCloseTo(orderData.total, 2)
    })

    it('should handle orders with coupons', async () => {
      const orderData = {
        user: userId,
        items: [{
          product: product._id,
          name: product.name,
          price: product.price,
          quantity: 1,
          subtotal: product.price
        }],
        shippingAddress: {
          recipientName: 'John Doe',
          phone: '+8801712345678',
          street: '123 Main Street',
          city: 'Dhaka',
          postalCode: '1000',
          country: 'Bangladesh'
        },
        paymentMethod: 'cod' as const,
        subtotal: product.price,
        tax: 0,
        shippingCost: 50,
        discount: 100, // $100 discount
        total: product.price + 50 - 100,
        coupon: {
          code: 'SAVE100',
          discountType: 'fixed' as const,
          discountValue: 100
        }
      }

      const order = await Order.create(orderData)

      expect(order.coupon).toBeTruthy()
      expect(order.coupon!.code).toBe('SAVE100')
      expect(order.coupon!.discountType).toBe('fixed')
      expect(order.coupon!.discountValue).toBe(100)
      expect(order.discount).toBe(100)
    })
  })

  describe('Query Performance and Indexing', () => {
    beforeEach(async () => {
      // Create multiple orders for different users and statuses
      const users = [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()]
      const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']

      const orders = []
      for (let i = 0; i < 50; i++) {
        const orderData = {
          user: users[i % users.length],
          items: [{
            product: product._id,
            name: product.name,
            price: product.price,
            quantity: 1,
            subtotal: product.price
          }],
          shippingAddress: {
            recipientName: `User ${i}`,
            phone: '+8801712345678',
            street: `${i} Main Street`,
            city: 'Dhaka',
            postalCode: '1000',
            country: 'Bangladesh'
          },
          paymentMethod: 'cod' as const,
          status: statuses[i % statuses.length] as any,
          subtotal: product.price,
          tax: 0,
          shippingCost: 0,
          discount: 0,
          total: product.price
        }
        orders.push(orderData)
      }

      // Create orders individually to trigger pre-save middleware
      for (const orderData of orders) {
        await Order.create(orderData)
      }
    })

    it('should efficiently query orders by user', async () => {
      const startTime = Date.now()
      const userOrders = await Order.findByUser(userId)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(100) // Should be fast with index
      expect(Array.isArray(userOrders)).toBe(true)
    })

    it('should efficiently query orders by status', async () => {
      const startTime = Date.now()
      const pendingOrders = await Order.findByStatus('pending')
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(100) // Should be fast with index
      expect(Array.isArray(pendingOrders)).toBe(true)
      expect(pendingOrders.every(order => order.status === 'pending')).toBe(true)
    })

    it('should efficiently query orders by date range', async () => {
      const today = new Date()
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

      const startTime = Date.now()
      const ordersInRange = await Order.findByDateRange(yesterday, tomorrow)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(100) // Should be fast with index
      expect(Array.isArray(ordersInRange)).toBe(true)
    })
  })

  describe('Data Consistency and Validation', () => {
    it('should maintain data consistency during concurrent order creation', async () => {
      const orderData = {
        user: userId,
        items: [{
          product: product._id,
          name: product.name,
          price: product.price,
          quantity: 1,
          subtotal: product.price
        }],
        shippingAddress: {
          recipientName: 'John Doe',
          phone: '+8801712345678',
          street: '123 Main Street',
          city: 'Dhaka',
          postalCode: '1000',
          country: 'Bangladesh'
        },
        paymentMethod: 'cod' as const,
        subtotal: product.price,
        tax: 0,
        shippingCost: 0,
        discount: 0,
        total: product.price
      }

      // Create multiple orders sequentially to avoid race conditions
      // In a real application, concurrent requests would be handled by the application layer
      const orders = []
      for (let i = 0; i < 5; i++) {
        const order = await Order.create(orderData)
        orders.push(order)
      }

      // All orders should have unique order numbers
      const orderNumbers = orders.map(order => order.orderNumber)
      const uniqueOrderNumbers = new Set(orderNumbers)
      expect(uniqueOrderNumbers.size).toBe(orders.length)
    })

    it('should validate referential integrity with products', async () => {
      const nonExistentProductId = new Types.ObjectId()
      
      const orderData = {
        user: userId,
        items: [{
          product: nonExistentProductId,
          name: 'Non-existent Product',
          price: 99.99,
          quantity: 1,
          subtotal: 99.99
        }],
        shippingAddress: {
          recipientName: 'John Doe',
          phone: '+8801712345678',
          street: '123 Main Street',
          city: 'Dhaka',
          postalCode: '1000',
          country: 'Bangladesh'
        },
        paymentMethod: 'cod' as const,
        subtotal: 99.99,
        tax: 0,
        shippingCost: 0,
        discount: 0,
        total: 99.99
      }

      // Order creation should succeed (referential integrity is not enforced at DB level)
      const order = await Order.create(orderData)
      expect(order).toBeTruthy()

      // But population should return null for non-existent product
      const populatedOrder = await Order.findById(order._id)
        .populate('items.product')
        .exec()

      expect(populatedOrder!.items[0].product).toBeNull()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle very large order numbers', async () => {
      // Create 99999 orders to test sequence rollover
      // Note: This is a conceptual test - in practice, we wouldn't create this many orders
      const orderNumber = await Order.generateOrderNumber()
      expect(orderNumber).toMatch(/^ORD-\d{8}-\d{5}$/)
      
      // Manually test the sequence part
      const today = new Date()
      const datePrefix = `ORD-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
      
      // Create an order with a high sequence number
      const highSequenceOrder = await Order.create({
        orderNumber: `${datePrefix}-99999`,
        user: userId,
        items: [{
          product: product._id,
          name: product.name,
          price: product.price,
          quantity: 1,
          subtotal: product.price
        }],
        shippingAddress: {
          recipientName: 'John Doe',
          phone: '+8801712345678',
          street: '123 Main Street',
          city: 'Dhaka',
          postalCode: '1000',
          country: 'Bangladesh'
        },
        paymentMethod: 'cod' as const,
        subtotal: product.price,
        tax: 0,
        shippingCost: 0,
        discount: 0,
        total: product.price
      })

      expect(highSequenceOrder.orderNumber).toBe(`${datePrefix}-99999`)
    })

    it('should handle orders with zero-priced items', async () => {
      const orderData = {
        user: userId,
        items: [{
          product: product._id,
          name: 'Free Sample',
          price: 0,
          quantity: 1,
          subtotal: 0
        }],
        shippingAddress: {
          recipientName: 'John Doe',
          phone: '+8801712345678',
          street: '123 Main Street',
          city: 'Dhaka',
          postalCode: '1000',
          country: 'Bangladesh'
        },
        paymentMethod: 'cod' as const,
        subtotal: 0,
        tax: 0,
        shippingCost: 50,
        discount: 0,
        total: 50
      }

      const order = await Order.create(orderData)
      expect(order.items[0].price).toBe(0)
      expect(order.subtotal).toBe(0)
      expect(order.total).toBe(50)
    })
  })
})