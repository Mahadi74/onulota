import mongoose, { Schema, Document, Types } from 'mongoose'

// Interface for Order Item
export interface IOrderItem {
  _id?: Types.ObjectId
  product: Types.ObjectId
  variant?: Types.ObjectId
  name: string // snapshot
  price: number // snapshot
  quantity: number
  subtotal: number
}

// Interface for Shipping Address
export interface IShippingAddress {
  recipientName: string
  phone: string
  street: string
  city: string
  postalCode: string
  country: string
}

// Interface for Coupon
export interface IOrderCoupon {
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
}

// Interface for Status History
export interface IStatusHistory {
  _id?: Types.ObjectId
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  timestamp: Date
  note?: string
}

// Interface for Order Document
export interface IOrder extends Document {
  _id: Types.ObjectId
  orderNumber: string
  user: Types.ObjectId
  items: IOrderItem[]
  shippingAddress: IShippingAddress
  paymentMethod: 'cod' | 'sslcommerz' | 'bkash' | 'nagad'
  paymentStatus: 'pending' | 'paid' | 'failed' | 'cancelled'
  paymentTransactionId?: string
  subtotal: number
  tax: number
  shippingCost: number
  discount: number
  total: number
  coupon?: IOrderCoupon
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  statusHistory: IStatusHistory[]
  trackingNumber?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
  
  // Instance methods
  updateStatus(newStatus: string, note?: string): Promise<IOrder>
  canBeCancelled(): boolean
  calculateTotals(): void
}

// Interface for Order Model (static methods)
export interface IOrderModel extends mongoose.Model<IOrder> {
  generateOrderNumber(): Promise<string>
  findByUser(userId: string | Types.ObjectId): mongoose.Query<IOrder[], IOrder>
  findByStatus(status: string): mongoose.Query<IOrder[], IOrder>
  findByDateRange(startDate: Date, endDate: Date): mongoose.Query<IOrder[], IOrder>
}

// Order Item Schema
const OrderItemSchema = new Schema<IOrderItem>({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variant: {
    type: Schema.Types.ObjectId,
    // References a variant within a Product document
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value >= 0
      },
      message: 'Price must be a valid positive number'
    }
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Quantity must be a whole number'
    }
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value >= 0
      },
      message: 'Subtotal must be a valid positive number'
    }
  }
})

// Shipping Address Schema
const ShippingAddressSchema = new Schema<IShippingAddress>({
  recipientName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(phone: string) {
        // Bangladesh phone number validation (E.164 format)
        // Format: +880 followed by 10 digits starting with 1
        return /^\+8801[0-9]\d{8}$/.test(phone)
      },
      message: 'Phone must be a valid Bangladesh number in E.164 format (+880xxxxxxxxx)'
    }
  },
  street: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  city: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  postalCode: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(code: string) {
        // Bangladesh postal code validation (4 digits)
        return /^\d{4}$/.test(code)
      },
      message: 'Postal code must be 4 digits'
    }
  },
  country: {
    type: String,
    default: 'Bangladesh',
    trim: true
  }
}, { _id: false })

// Coupon Schema
const OrderCouponSchema = new Schema<IOrderCoupon>({
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  discountType: {
    type: String,
    required: true,
    enum: ['percentage', 'fixed']
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false })

// Status History Schema
const StatusHistorySchema = new Schema<IStatusHistory>({
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  note: {
    type: String,
    trim: true,
    maxlength: 500
  }
})

// Order Schema
const OrderSchema = new Schema<IOrder>({
  orderNumber: {
    type: String,
    unique: true,
    uppercase: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: {
    type: [OrderItemSchema],
    required: true,
    validate: {
      validator: function(items: IOrderItem[]) {
        return items && items.length > 0
      },
      message: 'Order must have at least one item'
    }
  },
  shippingAddress: {
    type: ShippingAddressSchema,
    required: true
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['cod', 'sslcommerz', 'bkash', 'nagad']
  },
  paymentStatus: {
    type: String,
    default: 'pending',
    enum: ['pending', 'paid', 'failed', 'cancelled']
  },
  paymentTransactionId: {
    type: String,
    trim: true,
    sparse: true
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value >= 0
      },
      message: 'Subtotal must be a valid positive number'
    }
  },
  tax: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value >= 0
      },
      message: 'Tax must be a valid positive number'
    }
  },
  shippingCost: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value >= 0
      },
      message: 'Shipping cost must be a valid positive number'
    }
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value >= 0
      },
      message: 'Discount must be a valid positive number'
    }
  },
  total: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value >= 0
      },
      message: 'Total must be a valid positive number'
    }
  },
  coupon: {
    type: OrderCouponSchema
  },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
  },
  statusHistory: {
    type: [StatusHistorySchema],
    default: function() {
      return [{
        status: 'pending',
        timestamp: new Date(),
        note: 'Order created'
      }]
    }
  },
  trackingNumber: {
    type: String,
    trim: true,
    sparse: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  }
}, {
  timestamps: true
})

// Pre-save middleware to generate order number if not set
OrderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    try {
      this.orderNumber = await (this.constructor as IOrderModel).generateOrderNumber()
    } catch (error) {
      return next(error as Error)
    }
  }
  
  // Calculate subtotal from items if not set
  if (this.isModified('items') || this.isNew) {
    this.calculateTotals()
  }
  
  next()
})

// Pre-validate middleware
OrderSchema.pre('validate', function(next) {
  // Ensure order has items
  if (!this.items || this.items.length === 0) {
    return next(new Error('Order must have at least one item'))
  }
  
  // Validate item subtotals
  for (const item of this.items) {
    const expectedSubtotal = item.price * item.quantity
    if (Math.abs(item.subtotal - expectedSubtotal) > 0.01) {
      return next(new Error(`Item subtotal mismatch for ${item.name}`))
    }
  }
  
  // Validate total calculation
  const expectedTotal = this.subtotal + this.tax + this.shippingCost - this.discount
  if (Math.abs(this.total - expectedTotal) > 0.01) {
    return next(new Error('Order total calculation mismatch'))
  }
  
  next()
})

// Indexes as specified in the design document
OrderSchema.index({ orderNumber: 1 }, { unique: true })
OrderSchema.index({ user: 1 })
OrderSchema.index({ status: 1 })
OrderSchema.index({ createdAt: -1 })
OrderSchema.index({ paymentStatus: 1 })
OrderSchema.index({ paymentTransactionId: 1 }, { sparse: true })

// Compound indexes for common queries
OrderSchema.index({ user: 1, status: 1 })
OrderSchema.index({ user: 1, createdAt: -1 })
OrderSchema.index({ status: 1, createdAt: -1 })
OrderSchema.index({ paymentMethod: 1, paymentStatus: 1 })

// Static method to generate unique order number
OrderSchema.statics.generateOrderNumber = async function(): Promise<string> {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const datePrefix = `ORD-${year}${month}${day}`
  
  // Find the highest order number for today
  const lastOrder = await this.findOne({
    orderNumber: { $regex: `^${datePrefix}-` }
  }).sort({ orderNumber: -1 })
  
  let sequence = 1
  if (lastOrder) {
    const lastSequence = parseInt(lastOrder.orderNumber.split('-')[2])
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1
    }
  }
  
  // Format sequence as 5-digit number (e.g., 00001)
  const sequenceStr = String(sequence).padStart(5, '0')
  
  return `${datePrefix}-${sequenceStr}`
}

// Static method to find orders by user
OrderSchema.statics.findByUser = function(userId: string | Types.ObjectId) {
  return this.find({ user: userId }).sort({ createdAt: -1 })
}

// Static method to find orders by status
OrderSchema.statics.findByStatus = function(status: string) {
  return this.find({ status }).sort({ createdAt: -1 })
}

// Static method to find orders by date range
OrderSchema.statics.findByDateRange = function(startDate: Date, endDate: Date) {
  return this.find({
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ createdAt: -1 })
}

// Instance method to update order status
OrderSchema.methods.updateStatus = async function(newStatus: string, note?: string) {
  // Validate status transition
  const validTransitions: { [key: string]: string[] } = {
    'pending': ['processing', 'cancelled'],
    'processing': ['shipped', 'cancelled'],
    'shipped': ['delivered'],
    'delivered': [], // Final state
    'cancelled': [] // Final state
  }
  
  const allowedStatuses = validTransitions[this.status] || []
  if (!allowedStatuses.includes(newStatus)) {
    throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`)
  }
  
  // Update status
  this.status = newStatus
  
  // Add to status history
  this.statusHistory.push({
    status: newStatus as any,
    timestamp: new Date(),
    note: note || `Status updated to ${newStatus}`
  })
  
  return this.save()
}

// Instance method to check if order can be cancelled
OrderSchema.methods.canBeCancelled = function() {
  return ['pending', 'processing'].includes(this.status)
}

// Instance method to calculate totals
OrderSchema.methods.calculateTotals = function() {
  // Calculate subtotal from items
  this.subtotal = this.items.reduce((total: number, item: IOrderItem) => {
    return total + (item.price * item.quantity)
  }, 0)
  
  // Round to 2 decimal places
  this.subtotal = Math.round(this.subtotal * 100) / 100
  
  // Calculate total
  this.total = this.subtotal + this.tax + this.shippingCost - this.discount
  this.total = Math.round(this.total * 100) / 100
  
  // Update item subtotals
  this.items.forEach((item: IOrderItem) => {
    item.subtotal = Math.round((item.price * item.quantity) * 100) / 100
  })
}

export const Order = mongoose.model<IOrder, IOrderModel>('Order', OrderSchema)