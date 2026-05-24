import mongoose, { Schema, Document, Types } from 'mongoose'

// Interface for Cart Item
export interface ICartItem {
  _id?: Types.ObjectId
  product: Types.ObjectId
  variant?: Types.ObjectId
  quantity: number
  price: number // snapshot at add time
  addedAt: Date
}

// Interface for Cart Document
export interface ICart extends Document {
  _id: Types.ObjectId
  user?: Types.ObjectId // optional for guest carts
  sessionId?: string // for guest carts
  items: ICartItem[]
  expiresAt: Date // TTL index, 30 days
  createdAt: Date
  updatedAt: Date
  
  // Virtual properties
  subtotal: number
  totalItems: number
  
  // Instance methods
  addItem(productId: Types.ObjectId, quantity: number, price: number, variantId?: Types.ObjectId): Promise<ICart>
  updateItemQuantity(itemId: Types.ObjectId, quantity: number): Promise<ICart>
  removeItem(itemId: Types.ObjectId): Promise<ICart>
  clearCart(): Promise<ICart>
  hasItem(productId: Types.ObjectId, variantId?: Types.ObjectId): boolean
  getItem(productId: Types.ObjectId, variantId?: Types.ObjectId): ICartItem | undefined
}

// Interface for Cart Model (static methods)
export interface ICartModel extends mongoose.Model<ICart> {
  findByUser(userId: string | Types.ObjectId): Promise<ICart | null>
  findBySession(sessionId: string): Promise<ICart | null>
  createUserCart(userId: Types.ObjectId): Promise<ICart>
  createGuestCart(sessionId: string): Promise<ICart>
  mergeGuestCartToUser(guestCart: ICart, userId: Types.ObjectId): Promise<ICart>
}

// Cart Item Schema
const CartItemSchema = new Schema<ICartItem>({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variant: {
    type: Schema.Types.ObjectId,
    // Note: This references a variant within a Product document
    // Validation should be done at the application level
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
  addedAt: {
    type: Date,
    default: Date.now
  }
})

// Cart Schema
const CartSchema = new Schema<ICart>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    // Optional for guest carts
    sparse: true
  },
  sessionId: {
    type: String,
    // For guest carts
    sparse: true,
    trim: true
  },
  items: [CartItemSchema],
  expiresAt: {
    type: Date,
    default: function() {
      // Set expiration to 30 days from now
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    },
    required: true
  }
}, {
  timestamps: true
})

// Validation to ensure either user or sessionId is provided
CartSchema.pre('validate', function(next) {
  if (!this.user && !this.sessionId) {
    return next(new Error('Cart must have either a user or sessionId'))
  }
  
  if (this.user && this.sessionId) {
    return next(new Error('Cart cannot have both user and sessionId'))
  }
  
  next()
})

// Indexes as specified in the design document
CartSchema.index({ user: 1 }, { unique: true, sparse: true })
CartSchema.index({ sessionId: 1 }, { unique: true, sparse: true })
CartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // TTL index

// Additional indexes for performance
CartSchema.index({ 'items.product': 1 })
CartSchema.index({ updatedAt: -1 })

// Virtual for calculating subtotal
CartSchema.virtual('subtotal').get(function() {
  return this.items.reduce((total, item) => {
    return total + (item.price * item.quantity)
  }, 0)
})

// Virtual for calculating total number of items
CartSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => {
    return total + item.quantity
  }, 0)
})

// Ensure virtuals are included in JSON output
CartSchema.set('toJSON', { virtuals: true })
CartSchema.set('toObject', { virtuals: true })

// Static method to find cart by user
CartSchema.statics.findByUser = function(userId: string | Types.ObjectId) {
  return this.findOne({ user: userId })
}

// Static method to find cart by session
CartSchema.statics.findBySession = function(sessionId: string) {
  return this.findOne({ sessionId })
}

// Static method to create user cart
CartSchema.statics.createUserCart = function(userId: Types.ObjectId) {
  return this.create({
    user: userId,
    items: []
  })
}

// Static method to create guest cart
CartSchema.statics.createGuestCart = function(sessionId: string) {
  return this.create({
    sessionId,
    items: []
  })
}

// Static method to merge guest cart to user cart
CartSchema.statics.mergeGuestCartToUser = async function(guestCart: ICart, userId: Types.ObjectId) {
  // Find existing user cart
  let userCart = await (this as ICartModel).findByUser(userId)
  
  if (!userCart) {
    // Create new user cart if doesn't exist
    userCart = await (this as ICartModel).createUserCart(userId)
  }
  
  // Merge items from guest cart
  for (const guestItem of guestCart.items) {
    const existingItem = userCart.getItem(guestItem.product, guestItem.variant)
    
    if (existingItem) {
      // If item exists, keep the higher quantity (as per design spec)
      if (guestItem.quantity > existingItem.quantity) {
        existingItem.quantity = guestItem.quantity
        existingItem.price = guestItem.price // Update price to latest
        existingItem.addedAt = guestItem.addedAt
      }
    } else {
      // Add new item
      userCart.items.push({
        product: guestItem.product,
        variant: guestItem.variant,
        quantity: guestItem.quantity,
        price: guestItem.price,
        addedAt: guestItem.addedAt
      })
    }
  }
  
  await userCart.save()
  
  // Delete guest cart
  await guestCart.deleteOne()
  
  return userCart
}

// Instance method to add item to cart
CartSchema.methods.addItem = async function(
  productId: Types.ObjectId, 
  quantity: number, 
  price: number, 
  variantId?: Types.ObjectId
) {
  const existingItem = this.getItem(productId, variantId)
  
  if (existingItem) {
    // Update existing item quantity
    existingItem.quantity += quantity
    existingItem.price = price // Update to latest price
    existingItem.addedAt = new Date()
  } else {
    // Add new item
    this.items.push({
      product: productId,
      variant: variantId,
      quantity,
      price,
      addedAt: new Date()
    })
  }
  
  return this.save()
}

// Instance method to update item quantity
CartSchema.methods.updateItemQuantity = async function(itemId: Types.ObjectId, quantity: number) {
  const item = this.items.id(itemId)
  
  if (!item) {
    throw new Error('Cart item not found')
  }
  
  if (quantity <= 0) {
    // Remove item if quantity is 0 or negative
    this.items.pull(itemId)
  } else {
    item.quantity = quantity
  }
  
  return this.save()
}

// Instance method to remove item from cart
CartSchema.methods.removeItem = async function(itemId: Types.ObjectId) {
  this.items.pull(itemId)
  return this.save()
}

// Instance method to clear cart
CartSchema.methods.clearCart = async function() {
  this.items = []
  return this.save()
}

// Instance method to check if cart has specific item
CartSchema.methods.hasItem = function(productId: Types.ObjectId, variantId?: Types.ObjectId) {
  return this.items.some((item: ICartItem) => {
    const productMatch = item.product.toString() === productId.toString()
    
    if (variantId) {
      return productMatch && item.variant?.toString() === variantId.toString()
    }
    
    return productMatch && !item.variant
  })
}

// Instance method to get specific item
CartSchema.methods.getItem = function(productId: Types.ObjectId, variantId?: Types.ObjectId) {
  return this.items.find((item: ICartItem) => {
    const productMatch = item.product.toString() === productId.toString()
    
    if (variantId) {
      return productMatch && item.variant?.toString() === variantId.toString()
    }
    
    return productMatch && !item.variant
  })
}

export const Cart = mongoose.model<ICart, ICartModel>('Cart', CartSchema)