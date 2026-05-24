import mongoose, { Schema, Document, Types } from 'mongoose'
import slugify from 'slugify'

// Interface for Category Document
export interface ICategory extends Document {
  _id: Types.ObjectId
  name: string
  slug: string
  parent?: Types.ObjectId
  level: number
  icon?: string
  image?: string
  order: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  
  // Virtual properties
  children: ICategory[]
  
  // Instance methods
  getAncestors(): Promise<ICategory[]>
  getDescendants(): Promise<ICategory[]>
  calculateLevel(): Promise<number>
}

// Interface for Category Model (static methods)
export interface ICategoryModel extends mongoose.Model<ICategory> {
  findByLevel(level: number): mongoose.Query<ICategory[], ICategory>
  findRootCategories(): mongoose.Query<ICategory[], ICategory>
  buildCategoryTree(): Promise<ICategory[]>
  validateHierarchyDepth(parentId?: string | Types.ObjectId): Promise<boolean>
}

// Category Schema
const CategorySchema = new Schema<ICategory>({
  name: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 100,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  parent: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  level: {
    type: Number,
    min: 0,
    max: 2,
    default: 0
  },
  icon: {
    type: String,
    trim: true
  },
  image: {
    type: String,
    trim: true
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

// Pre-save middleware to generate slug from name
CategorySchema.pre('save', async function(next) {
  if (this.isModified('name') || this.isModified('parent') || this.isNew) {
    let slugBase = slugify(this.name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    })
    
    // If this category has a parent, include parent slug to ensure uniqueness
    if (this.parent) {
      const parent = await (this.constructor as ICategoryModel).findById(this.parent)
      if (parent) {
        slugBase = `${parent.slug}-${slugBase}`
      }
    }
    
    this.slug = slugBase
  }
  next()
})

// Pre-save middleware to calculate and validate level
CategorySchema.pre('save', async function(next) {
  try {
    if (this.isModified('parent') || this.isNew) {
      if (this.parent) {
        // Find parent category to calculate level
        const parent = await (this.constructor as ICategoryModel).findById(this.parent)
        if (!parent) {
          return next(new Error('Parent category not found'))
        }
        
        this.level = parent.level + 1
        
        // Validate hierarchy depth (max 3 levels: 0, 1, 2)
        if (this.level > 2) {
          return next(new Error('Category hierarchy cannot exceed 3 levels'))
        }
      } else {
        this.level = 0
      }
    }
    
    // Validate name uniqueness within the same parent level
    const existingCategory = await (this.constructor as ICategoryModel).findOne({
      name: this.name,
      parent: this.parent,
      _id: { $ne: this._id }
    })
    
    if (existingCategory) {
      return next(new Error('Category name must be unique within the same parent level'))
    }
    
    next()
  } catch (error) {
    next(error as Error)
  }
})

// Pre-validate middleware to ensure slug is set
CategorySchema.pre('validate', async function(next) {
  if (!this.slug && this.name) {
    let slugBase = slugify(this.name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    })
    
    // If this category has a parent, include parent slug to ensure uniqueness
    if (this.parent) {
      const parent = await (this.constructor as ICategoryModel).findById(this.parent)
      if (parent) {
        slugBase = `${parent.slug}-${slugBase}`
      }
    }
    
    this.slug = slugBase
  }
  next()
})

// Indexes as specified in the design document
CategorySchema.index({ slug: 1 }, { unique: true })
CategorySchema.index({ parent: 1 })
CategorySchema.index({ level: 1 })
CategorySchema.index({ parent: 1, order: 1 })
CategorySchema.index({ parent: 1, isActive: 1 })
CategorySchema.index({ level: 1, isActive: 1 })

// Virtual for getting child categories
CategorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent'
})

// Ensure virtuals are included in JSON output
CategorySchema.set('toJSON', { virtuals: true })
CategorySchema.set('toObject', { virtuals: true })

// Static method to find categories by level
CategorySchema.statics.findByLevel = function(level: number) {
  return this.find({
    level: level,
    isActive: true
  }).sort({ order: 1, name: 1 })
}

// Static method to find root categories (level 0)
CategorySchema.statics.findRootCategories = function() {
  return this.find({
    parent: null,
    isActive: true
  }).sort({ order: 1, name: 1 })
}

// Static method to build complete category tree
CategorySchema.statics.buildCategoryTree = async function() {
  const categories = await this.find({ isActive: true })
    .sort({ level: 1, order: 1, name: 1 })
    .lean()
  
  // Create a map for quick lookup
  const categoryMap = new Map()
  const rootCategories: any[] = []
  
  // Initialize all categories with empty children array
  categories.forEach((category: any) => {
    category.children = []
    categoryMap.set(category._id.toString(), category)
  })
  
  // Build the tree structure
  categories.forEach((category: any) => {
    if (category.parent) {
      const parent = categoryMap.get(category.parent.toString())
      if (parent) {
        parent.children.push(category)
      }
    } else {
      rootCategories.push(category)
    }
  })
  
  return rootCategories
}

// Static method to validate hierarchy depth
CategorySchema.statics.validateHierarchyDepth = async function(parentId?: string | Types.ObjectId) {
  if (!parentId) {
    return true // Root level is always valid
  }
  
  const parent = await this.findById(parentId)
  if (!parent) {
    throw new Error('Parent category not found')
  }
  
  return parent.level < 2 // Can only add children if parent is at level 0 or 1
}

// Instance method to get all ancestors (parent, grandparent, etc.)
CategorySchema.methods.getAncestors = async function() {
  const ancestors: ICategory[] = []
  let current = this
  
  while (current.parent) {
    const parent = await (this.constructor as ICategoryModel).findById(current.parent)
    if (!parent) break
    
    ancestors.unshift(parent)
    current = parent
  }
  
  return ancestors
}

// Instance method to get all descendants (children, grandchildren, etc.)
CategorySchema.methods.getDescendants = async function() {
  const descendants: ICategory[] = []
  
  const findChildren = async (categoryId: Types.ObjectId) => {
    const children = await (this.constructor as ICategoryModel).find({ parent: categoryId, isActive: true })
    
    for (const child of children) {
      descendants.push(child)
      await findChildren(child._id)
    }
  }
  
  await findChildren(this._id)
  return descendants
}

// Instance method to calculate level based on parent hierarchy
CategorySchema.methods.calculateLevel = async function() {
  if (!this.parent) {
    return 0
  }
  
  const parent = await (this.constructor as ICategoryModel).findById(this.parent)
  if (!parent) {
    throw new Error('Parent category not found')
  }
  
  return parent.level + 1
}

export const Category = mongoose.model<ICategory, ICategoryModel>('Category', CategorySchema)