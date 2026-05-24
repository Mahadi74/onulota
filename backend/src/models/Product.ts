import mongoose, { Schema, Document, Types } from 'mongoose'
import slugify from 'slugify'

// Interface for Product Image
export interface IProductImage {
  url: string
  thumbnail?: string
  mobile?: string
  alt?: string
}

// Interface for Product Specification
export interface IProductSpecification {
  key: string
  value: string
}

// Interface for Product Variant
export interface IProductVariant {
  _id?: Types.ObjectId
  name: string // e.g., 'Size: L, Color: Red'
  sku?: string
  price: number
  stock: number
}

// Interface for Product Document
export interface IProduct extends Document {
  _id: Types.ObjectId
  name: string
  slug: string
  description: string
  price: number
  compareAtPrice?: number
  category: Types.ObjectId
  images: IProductImage[]
  specifications: IProductSpecification[]
  variants: IProductVariant[]
  stock: number
  averageRating: number
  reviewCount: number
  isActive: boolean
  isFeatured: boolean
  tags: string[]
  colors: string[]
  sizes: string[]
  brand?: string
  createdAt: Date
  updatedAt: Date
  
  // Virtual properties
  inStock: boolean
  totalStock: number
  
  // Instance methods
  updateAverageRating(newRating: number, oldRating?: number): Promise<IProduct>
  removeRating(rating: number): Promise<IProduct>
}

// Interface for Product Model (static methods)
export interface IProductModel extends mongoose.Model<IProduct> {
  findByCategory(categoryId: string | Types.ObjectId): mongoose.Query<IProduct[], IProduct>
  searchProducts(query: string, options?: any): mongoose.Query<IProduct[], IProduct>
}

// Product Image Schema
const ProductImageSchema = new Schema<IProductImage>({
  url: {
    type: String,
    required: true
  },
  thumbnail: {
    type: String
  },
  mobile: {
    type: String
  },
  alt: {
    type: String
  }
}, { _id: false })

// Product Specification Schema
const ProductSpecificationSchema = new Schema<IProductSpecification>({
  key: {
    type: String,
    required: true
  },
  value: {
    type: String,
    required: true
  }
}, { _id: false })

// Product Variant Schema
const ProductVariantSchema = new Schema<IProductVariant>({
  name: {
    type: String,
    required: true
  },
  sku: {
    type: String
    // Note: SKU uniqueness is validated at the application level
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  }
})

// Product Schema
const ProductSchema = new Schema<IProduct>({
  name: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 200,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 5000,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  compareAtPrice: {
    type: Number,
    min: 0
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  images: [ProductImageSchema],
  specifications: [ProductSpecificationSchema],
  variants: [ProductVariantSchema],
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  colors: [{
    type: String,
    trim: true
  }],
  sizes: [{
    type: String,
    trim: true
  }],
  brand: {
    type: String,
    trim: true,
    index: true,
  },
}, {
  timestamps: true
})

// Pre-save middleware to generate slug from name
ProductSchema.pre('save', function(next) {
  if (this.isModified('name') || this.isNew) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    })
  }
  next()
})

// Pre-validate middleware to ensure slug is set
ProductSchema.pre('validate', function(next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    })
  }
  
  // Validate unique SKUs within variants
  if (this.variants && this.variants.length > 0) {
    const skus = this.variants.map(v => v.sku).filter(Boolean)
    const uniqueSkus = new Set(skus)
    if (skus.length !== uniqueSkus.size) {
      return next(new Error('Variant SKUs must be unique within the product'))
    }
  }
  
  next()
})

// Indexes as specified in the design document
// Text indexes for search (name, description)
ProductSchema.index({
  name: 'text',
  description: 'text'
}, {
  weights: {
    name: 10,
    description: 5
  },
  name: 'product_text_search'
})

// Individual indexes
ProductSchema.index({ slug: 1 }, { unique: true })
ProductSchema.index({ category: 1 })
ProductSchema.index({ averageRating: -1 })
ProductSchema.index({ price: 1 })
ProductSchema.index({ isActive: 1 })

// Compound indexes for common query patterns
ProductSchema.index({ category: 1, isActive: 1 })
ProductSchema.index({ category: 1, price: 1 })
ProductSchema.index({ category: 1, averageRating: -1 })
ProductSchema.index({ isActive: 1, isFeatured: 1 })
ProductSchema.index({ isActive: 1, createdAt: -1 })
ProductSchema.index({ isActive: 1, averageRating: -1 })
ProductSchema.index({ isActive: 1, price: 1 })

// Sparse index for variant SKUs to ensure uniqueness only when present
// Note: This is handled at the application level since MongoDB sparse indexes
// don't work well with nested arrays

// Virtual for calculating if product is in stock
ProductSchema.virtual('inStock').get(function() {
  if (this.variants && this.variants.length > 0) {
    return this.variants.some(variant => variant.stock > 0)
  }
  return this.stock > 0
})

// Virtual for getting total stock across all variants
ProductSchema.virtual('totalStock').get(function() {
  if (this.variants && this.variants.length > 0) {
    return this.variants.reduce((total, variant) => total + variant.stock, 0)
  }
  return this.stock
})

// Ensure virtuals are included in JSON output
ProductSchema.set('toJSON', { virtuals: true })
ProductSchema.set('toObject', { virtuals: true })

// Static method to find products by category (including subcategories)
ProductSchema.statics.findByCategory = function(categoryId: string | Types.ObjectId) {
  return this.find({
    category: categoryId,
    isActive: true
  })
}

// Static method to search products
ProductSchema.statics.searchProducts = function(query: string, options: any = {}) {
  const searchQuery = {
    $text: { $search: query },
    isActive: true,
    ...options
  }
  
  return this.find(searchQuery, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
}

// Instance method to update average rating
ProductSchema.methods.updateAverageRating = async function(newRating: number, oldRating?: number) {
  if (oldRating !== undefined) {
    // Update existing review
    const totalRating = this.averageRating * this.reviewCount
    const updatedTotal = totalRating - oldRating + newRating
    this.averageRating = updatedTotal / this.reviewCount
  } else {
    // New review
    const totalRating = this.averageRating * this.reviewCount + newRating
    this.reviewCount += 1
    this.averageRating = totalRating / this.reviewCount
  }
  
  // Round to 2 decimal places
  this.averageRating = Math.round(this.averageRating * 100) / 100
  
  return this.save()
}

// Instance method to remove rating
ProductSchema.methods.removeRating = async function(rating: number) {
  if (this.reviewCount > 1) {
    const totalRating = this.averageRating * this.reviewCount - rating
    this.reviewCount -= 1
    this.averageRating = totalRating / this.reviewCount
    this.averageRating = Math.round(this.averageRating * 100) / 100
  } else {
    this.averageRating = 0
    this.reviewCount = 0
  }
  
  return this.save()
}

export const Product = mongoose.model<IProduct, IProductModel>('Product', ProductSchema)