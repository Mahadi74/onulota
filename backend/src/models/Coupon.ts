import mongoose, { Schema, Document, Types } from 'mongoose'

// Interface for Coupon Document
export interface ICoupon extends Document {
  _id: Types.ObjectId
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  minOrderValue?: number
  maxDiscountAmount?: number
  usageLimit?: number
  usageCount: number
  expiresAt: Date
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  
  // Instance methods
  isValid(): boolean
  canBeUsed(orderValue?: number): { valid: boolean; reason?: string }
  calculateDiscount(orderValue: number): number
  incrementUsage(): Promise<ICoupon>
}

// Interface for Coupon Model (static methods)
export interface ICouponModel extends mongoose.Model<ICoupon> {
  findByCode(code: string): Promise<ICoupon | null>
  findActiveCoupons(): mongoose.Query<ICoupon[], ICoupon>
  findExpiredCoupons(): mongoose.Query<ICoupon[], ICoupon>
}

// Coupon Schema
const CouponSchema = new Schema<ICoupon>({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: 3,
    maxlength: 50
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
  },
  minOrderValue: {
    type: Number,
    min: 0
  },
  maxDiscountAmount: {
    type: Number,
    min: 0
  },
  usageLimit: {
    type: Number,
    min: 1
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

// Pre-save middleware to validate business rules
CouponSchema.pre('save', function(next) {
  // Ensure percentage discounts don't exceed 100%
  if (this.discountType === 'percentage' && this.discountValue > 100) {
    return next(new Error('Percentage discount cannot exceed 100%'))
  }
  
  // Ensure maxDiscountAmount is only set for percentage coupons
  if (this.discountType === 'fixed' && this.maxDiscountAmount) {
    return next(new Error('Maximum discount amount can only be set for percentage coupons'))
  }
  
  // Ensure usage count doesn't exceed usage limit
  if (this.usageLimit && this.usageCount > this.usageLimit) {
    return next(new Error('Usage count cannot exceed usage limit'))
  }
  
  next()
})

// Indexes as specified in the design document
CouponSchema.index({ code: 1 }, { unique: true })
CouponSchema.index({ isActive: 1 })
CouponSchema.index({ expiresAt: 1 })

// Compound indexes for common query patterns
CouponSchema.index({ isActive: 1, expiresAt: 1 })
CouponSchema.index({ code: 1, isActive: 1 })

// Instance method to check if coupon is valid (not expired and active)
CouponSchema.methods.isValid = function(): boolean {
  return this.isActive && new Date() <= this.expiresAt
}

// Instance method to check if coupon can be used
CouponSchema.methods.canBeUsed = function(orderValue?: number): { valid: boolean; reason?: string } {
  // Check if coupon is active
  if (!this.isActive) {
    return { valid: false, reason: 'Coupon is not active' }
  }
  
  // Check if coupon is expired
  if (new Date() > this.expiresAt) {
    return { valid: false, reason: 'Coupon has expired' }
  }
  
  // Check usage limit
  if (this.usageLimit && this.usageCount >= this.usageLimit) {
    return { valid: false, reason: 'Coupon usage limit has been reached' }
  }
  
  // Check minimum order value if provided
  if (orderValue !== undefined && this.minOrderValue && orderValue < this.minOrderValue) {
    return { valid: false, reason: `Minimum order value of ৳${this.minOrderValue} required` }
  }
  
  return { valid: true }
}

// Instance method to calculate discount amount
CouponSchema.methods.calculateDiscount = function(orderValue: number): number {
  if (!this.canBeUsed(orderValue).valid) {
    return 0
  }
  
  let discount = 0
  
  if (this.discountType === 'percentage') {
    discount = (orderValue * this.discountValue) / 100
    
    // Apply maximum discount limit if set
    if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
      discount = this.maxDiscountAmount
    }
  } else if (this.discountType === 'fixed') {
    discount = this.discountValue
    
    // Ensure discount doesn't exceed order value
    if (discount > orderValue) {
      discount = orderValue
    }
  }
  
  // Round to 2 decimal places
  return Math.round(discount * 100) / 100
}

// Instance method to increment usage count
CouponSchema.methods.incrementUsage = async function(): Promise<ICoupon> {
  this.usageCount += 1
  return this.save()
}

// Static method to find coupon by code
CouponSchema.statics.findByCode = function(code: string): Promise<ICoupon | null> {
  return this.findOne({ code: code.toUpperCase() })
}

// Static method to find active coupons
CouponSchema.statics.findActiveCoupons = function() {
  return this.find({
    isActive: true,
    expiresAt: { $gt: new Date() }
  })
}

// Static method to find expired coupons
CouponSchema.statics.findExpiredCoupons = function() {
  return this.find({
    $or: [
      { isActive: false },
      { expiresAt: { $lte: new Date() } }
    ]
  })
}

export const Coupon = mongoose.model<ICoupon, ICouponModel>('Coupon', CouponSchema)