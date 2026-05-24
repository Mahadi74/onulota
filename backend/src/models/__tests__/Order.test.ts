import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Order, IOrder, IOrderItem, IShippingAddress } from '../Order'

describe('Order Model', () => {
  let mongoServer: MongoMemoryServer

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()
    await mongoose.connect(mongoUri)
  }, 30000)

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  }, 30000)

  beforeEach(async () => {
    // Clear the orders collection before each test
    await Order.deleteMany({})
  })

  describe('Schema Validation', () => {
    const validOrderData = {
      user: new Types.ObjectId(),
      items: [{
        product: new Types.ObjectId(),
        name: 'Test Product',
        price: 99.99,
        quantity: 2,
        subtotal: 199.98
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
      subtotal: 199.98,
      tax: 0,
      shippingCost: 50,
      discount: 0,
      total: 249.98
    }

    it('should create a valid order', async () => {
      const order = new Order(validOrderData)
      await expect(order.save()).resolves.toBeTruthy()
      expect(order.orderNumber).toMatch(/^ORD-\d{8}-\d{5}$/)
      expect(order.status).toBe('pending')
      expect(order.paymentStatus).toBe('pending')
      expect(order.statusHistory).toHaveLength(1)
      expect(order.statusHistory[0].status).toBe('pending')
    })

    it('should require user field', async () => {
      const orderData = { ...validOrderData }
      delete (orderData as any).user
      
      const order = new Order(orderData)
      await expect(order.save()).rejects.toThrow(/user.*required/)
    })

    it('should require items array', async () => {
      const orderData = { ...validOrderData }
      delete (orderData as any).items
      
      const order = new Order(orderData)
      await expect(order.save()).rejects.toThrow(/Order must have at least one item/)
    })

    it('should require at least one item', async () => {
      const orderData = { ...validOrderData, items: [] }
      
      const order = new Order(orderData)
      await expect(order.save()).rejects.toThrow(/at least one item/)
    })

    it('should require shipping address', async () => {
      const orderData = { ...validOrderData }
      delete (orderData as any).shippingAddress
      
      const order = new Order(orderData)
      await expect(order.save()).rejects.toThrow(/shippingAddress.*required/)
    })

    it('should validate payment method enum', async () => {
      const orderData = { ...validOrderData, paymentMethod: 'invalid' as any }
      
      const order = new Order(orderData)
      await expect(order.save()).rejects.toThrow(/not a valid enum value/)
    })

    it('should validate status enum', async () => {
      const orderData = { ...validOrderData, status: 'invalid' as any }
      
      const order = new Order(orderData)
      await expect(order.save()).rejects.toThrow(/not a valid enum value/)
    })

    it('should validate paymentStatus enum', async () => {
      const orderData = { ...validOrderData, paymentStatus: 'invalid' as any }
      
      const order = new Order(orderData)
      await expect(order.save()).rejects.toThrow(/not a valid enum value/)
    })
  })

  describe('Order Item Validation', () => {
    const baseOrderData = {
      user: new Types.ObjectId(),
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

    it('should require product reference in items', async () => {
      const orderData = {
        ...baseOrderData,
        items: [{
          name: 'Test Product',
          price: 99.99,
          quantity: 1,
          subtotal: 99.99
        }]
      }
      
      const order = new Order(orderData)
      await expect(order.save()).rejects.toThrow(/product.*required/)
    })

    it('should require item name', async () => {
      const orderData = {
        ...baseOrderData,
        items: [{
          product: new Types.ObjectId(),
          price: 99.99,
          quantity: 1,
          subtotal: 99.99
        }]
      }
      
      const order = new Order(orderData)
      await expect(order.save()).rejects.toThrow(/name.*required/)
    })

    it('should require positive price', async () => {
      const orderData = {
        ...baseOrderData,
        items: [{
          product: new Types.ObjectId(),
          name: 'Test Product',
          price: -10,
          quantity: 1,
          subtotal: -10
        }]
      }
      
      const order = new Order(orderData)
      await expect(order.save()).rejects.toThrow(/Order validation failed/)
    })

    it('should require positive integer quantity', async () => {
      const orderData = {
        ...baseOrderData,
        items: [{
          product: new Types.ObjectId(),
          name: 'Test Product',
          price: 99.99,
          quantity: 0,
          subtotal: 0
        }]
      }
      
      const order = new Order(orderData)
      await expect(order.save()).rejects.toThrow(/Order validation failed/)
    })

    it('should validate quantity is integer', async () => {
      const orderData = {
        ...baseOrderData,
        items: [{
          product: new Types.ObjectId(),
          name: 'Test Product',
          price: 99.99,
          quantity: 1.5,
          subtotal: 149.985
        }]
      }
      
      const order = new Order(orderData)
      await expect(order.save()).rejects.toThrow(/Quantity must be a whole number/)
    })
  })

  describe('Shipping Address Validation', () => {
    const baseOrderData = {
      user: new Types.ObjectId(),
      items: [{
        product: new Types.ObjectId(),
        name: 'Test Product',
        price: 99.99,
        quantity: 1,
        subtotal: 99.99
      }],
      paymentMethod: 'cod' as const,
      subtotal: 99.99,
      tax: 0,
      shippingCost: 0,
      discount: 0,
      total: 99.99
    }

    it('should validate Bangladesh phone number format', async () => {
      const orderData = {
        ...baseOrderData,
        shippingAddress: {
          recipientName: 'John Doe',
          phone: '01712345678', // Missing +880 prefix
          street: '123 Main Street',
          city: 'Dhaka',
          postalCode: '1000',
          country: 'Bangladesh'
        }
      }
      
      const order = new Order(orderData)
      await expect(order.save()).rejects.toThrow(/Phone must be a valid Bangladesh number/)
    })

    it('should validate postal code format', async () => {
      const orderData = {
        ...baseOrderData,
        shippingAddress: {
          recipientName: 'John Doe',
          phone: '+8801712345678',
          street: '123 Main Street',
          city: 'Dhaka',
          postalCode: '12345', // Should be 4 digits
          country: 'Bangladesh'
        }
      }
      
      const order = new Order(orderData)
      await expect(order.save()).rejects.toThrow(/Postal code must be 4 digits/)
    })

    it('should accept valid shipping address', async () => {
      const orderData = {
        ...baseOrderData,
        shippingAddress: {
          recipientName: 'John Doe',
          phone: '+8801712345678',
          street: '123 Main Street',
          city: 'Dhaka',
          postalCode: '1000',
          country: 'Bangladesh'
        }
      }
      
      const order = new Order(orderData)
      await expect(order.save()).resolves.toBeTruthy()
    })
  })

  describe('Order Number Generation', () => {
    it('should generate unique order numbers', async () => {
      const orderData1 = {
        user: new Types.ObjectId(),
        items: [{
          product: new Types.ObjectId(),
          name: 'Test Product 1',
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

      const orderData2 = { ...orderData1 }
      orderData2.items[0].name = 'Test Product 2'

      const order1 = await Order.create(orderData1)
      const order2 = await Order.create(orderData2)

      expect(order1.orderNumber).toMatch(/^ORD-\d{8}-\d{5}$/)
      expect(order2.orderNumber).toMatch(/^ORD-\d{8}-\d{5}$/)
      expect(order1.orderNumber).not.toBe(order2.orderNumber)
    })

    it('should generate sequential order numbers for same day', async () => {
      const orderData = {
        user: new Types.ObjectId(),
        items: [{
          product: new Types.ObjectId(),
          name: 'Test Product',
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

      const order1 = await Order.create(orderData)
      const order2 = await Order.create(orderData)

      const today = new Date()
      const datePrefix = `ORD-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`

      expect(order1.orderNumber).toBe(`${datePrefix}-00001`)
      expect(order2.orderNumber).toBe(`${datePrefix}-00002`)
    })
  })

  describe('Status Management', () => {
    let order: IOrder

    beforeEach(async () => {
      const orderData = {
        user: new Types.ObjectId(),
        items: [{
          product: new Types.ObjectId(),
          name: 'Test Product',
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

      order = await Order.create(orderData)
    })

    it('should allow valid status transitions', async () => {
      // pending -> processing
      await order.updateStatus('processing')
      expect(order.status).toBe('processing')
      expect(order.statusHistory).toHaveLength(2)

      // processing -> shipped
      await order.updateStatus('shipped')
      expect(order.status).toBe('shipped')
      expect(order.statusHistory).toHaveLength(3)

      // shipped -> delivered
      await order.updateStatus('delivered')
      expect(order.status).toBe('delivered')
      expect(order.statusHistory).toHaveLength(4)
    })

    it('should allow cancellation from pending', async () => {
      await order.updateStatus('cancelled')
      expect(order.status).toBe('cancelled')
      expect(order.statusHistory).toHaveLength(2)
    })

    it('should allow cancellation from processing', async () => {
      await order.updateStatus('processing')
      await order.updateStatus('cancelled')
      expect(order.status).toBe('cancelled')
      expect(order.statusHistory).toHaveLength(3)
    })

    it('should reject invalid status transitions', async () => {
      // pending -> shipped (skipping processing)
      await expect(order.updateStatus('shipped')).rejects.toThrow(/Invalid status transition/)

      // pending -> delivered (skipping processing and shipped)
      await expect(order.updateStatus('delivered')).rejects.toThrow(/Invalid status transition/)
    })

    it('should reject transitions from final states', async () => {
      await order.updateStatus('processing')
      await order.updateStatus('shipped')
      await order.updateStatus('delivered')

      // delivered -> any other status
      await expect(order.updateStatus('cancelled')).rejects.toThrow(/Invalid status transition/)
    })

    it('should check if order can be cancelled', () => {
      expect(order.canBeCancelled()).toBe(true)

      order.status = 'processing'
      expect(order.canBeCancelled()).toBe(true)

      order.status = 'shipped'
      expect(order.canBeCancelled()).toBe(false)

      order.status = 'delivered'
      expect(order.canBeCancelled()).toBe(false)

      order.status = 'cancelled'
      expect(order.canBeCancelled()).toBe(false)
    })
  })

  describe('Total Calculations', () => {
    it('should calculate totals correctly', async () => {
      const orderData = {
        user: new Types.ObjectId(),
        items: [
          {
            product: new Types.ObjectId(),
            name: 'Product 1',
            price: 99.99,
            quantity: 2,
            subtotal: 199.98
          },
          {
            product: new Types.ObjectId(),
            name: 'Product 2',
            price: 49.99,
            quantity: 1,
            subtotal: 49.99
          }
        ],
        shippingAddress: {
          recipientName: 'John Doe',
          phone: '+8801712345678',
          street: '123 Main Street',
          city: 'Dhaka',
          postalCode: '1000',
          country: 'Bangladesh'
        },
        paymentMethod: 'cod' as const,
        subtotal: 249.97,
        tax: 25.00,
        shippingCost: 50.00,
        discount: 24.97,
        total: 300.00
      }

      const order = new Order(orderData)
      order.calculateTotals()

      expect(order.subtotal).toBe(249.97)
      expect(order.total).toBe(300.00)
      expect(order.items[0].subtotal).toBe(199.98)
      expect(order.items[1].subtotal).toBe(49.99)
    })

    it('should validate total calculation on save', async () => {
      const orderData = {
        user: new Types.ObjectId(),
        items: [{
          product: new Types.ObjectId(),
          name: 'Test Product',
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
        tax: 10.00,
        shippingCost: 5.00,
        discount: 0,
        total: 100.00 // Incorrect total (should be 114.99)
      }

      const order = new Order(orderData)
      await expect(order.save()).rejects.toThrow(/total calculation mismatch/)
    })

    it('should validate item subtotal calculation', async () => {
      const orderData = {
        user: new Types.ObjectId(),
        items: [{
          product: new Types.ObjectId(),
          name: 'Test Product',
          price: 99.99,
          quantity: 2,
          subtotal: 150.00 // Incorrect subtotal (should be 199.98)
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
        subtotal: 150.00,
        tax: 0,
        shippingCost: 0,
        discount: 0,
        total: 150.00
      }

      const order = new Order(orderData)
      await expect(order.save()).rejects.toThrow(/Item subtotal mismatch/)
    })
  })

  describe('Static Methods', () => {
    let userId: Types.ObjectId
    let orders: IOrder[]

    beforeEach(async () => {
      userId = new Types.ObjectId()
      
      const orderData = {
        user: userId,
        items: [{
          product: new Types.ObjectId(),
          name: 'Test Product',
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

      // Create multiple orders with different statuses
      orders = []
      orders.push(await Order.create({ ...orderData, status: 'pending' }))
      orders.push(await Order.create({ ...orderData, status: 'processing' }))
      orders.push(await Order.create({ ...orderData, status: 'shipped' }))
    })

    it('should find orders by user', async () => {
      const userOrders = await Order.findByUser(userId)
      expect(userOrders).toHaveLength(3)
      expect(userOrders.every(order => order.user.toString() === userId.toString())).toBe(true)
    })

    it('should find orders by status', async () => {
      const pendingOrders = await Order.findByStatus('pending')
      expect(pendingOrders).toHaveLength(1)
      expect(pendingOrders[0].status).toBe('pending')

      const processingOrders = await Order.findByStatus('processing')
      expect(processingOrders).toHaveLength(1)
      expect(processingOrders[0].status).toBe('processing')
    })

    it('should find orders by date range', async () => {
      const today = new Date()
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

      const ordersInRange = await Order.findByDateRange(yesterday, tomorrow)
      expect(ordersInRange).toHaveLength(3)
    })

    it('should generate order number', async () => {
      const orderNumber = await Order.generateOrderNumber()
      expect(orderNumber).toMatch(/^ORD-\d{8}-\d{5}$/)
    })
  })

  describe('Indexes', () => {
    it('should enforce unique order number', async () => {
      const orderData = {
        orderNumber: 'ORD-20240101-00001',
        user: new Types.ObjectId(),
        items: [{
          product: new Types.ObjectId(),
          name: 'Test Product',
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

      await Order.create(orderData)
      
      // Try to create another order with the same order number
      await expect(Order.create(orderData)).rejects.toThrow(/duplicate key/)
    })
  })
})