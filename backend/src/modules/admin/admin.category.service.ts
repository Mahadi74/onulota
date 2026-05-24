import { Types } from 'mongoose'
import { Category, ICategory } from '../../models/Category'
import { Product } from '../../models/Product'
import { cacheDel } from '../../config/redis'
import { AppError } from '../../middleware/errorHandler'
import { logger } from '../../utils/logger'
import { invalidateCategoryCaches } from './admin.product.service'

const CATEGORY_TREE_CACHE_KEY = 'categories:tree'

export interface CreateCategoryInput {
  name: string
  parent?: string
  icon?: string
  image?: string
  order?: number
}

export interface UpdateCategoryInput {
  name?: string
  parent?: string
  icon?: string
  image?: string
  order?: number
}

export interface CategoryResult {
  _id: string
  name: string
  slug: string
  parent: string | null
  level: number
  icon?: string
  image?: string
  order: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/** @deprecated Use CategoryResult instead */
export type CreateCategoryResult = CategoryResult

/**
 * Creates a new category with hierarchy depth validation.
 *
 * Business rules:
 * - If parent is provided, look up parent's level and set new category's level to parent.level + 1
 * - Reject creation if parent.level >= 2 (would create level 3, exceeding max depth of 3 levels: 0, 1, 2)
 * - Validate name uniqueness within the same parent level
 * - Generate a URL-friendly slug from the name (handled by Category model pre-save hook)
 * - Invalidate the Redis category tree cache on successful creation
 *
 * Requirement 16.1: WHEN an Admin creates a Category, THE Platform SHALL require a name and optional parent category
 * Requirement 16.2: WHEN an Admin creates a Category with a parent, THE Platform SHALL validate the parent exists
 *                   and the hierarchy depth does not exceed 3 levels
 */
export async function createCategory(input: CreateCategoryInput): Promise<CategoryResult> {
  const { name, parent, icon, image, order } = input

  // Validate parent exists and check hierarchy depth
  if (parent) {
    if (!Types.ObjectId.isValid(parent)) {
      throw new AppError('Invalid parent category ID', 400)
    }

    const parentCategory = await Category.findById(parent)
    if (!parentCategory) {
      throw new AppError('Parent category not found', 404)
    }

    // Reject if parent.level >= 2 — adding a child would create level 3 (exceeds max depth)
    if (parentCategory.level >= 2) {
      throw new AppError(
        'Category hierarchy cannot exceed 3 levels. The parent category is already at the maximum depth.',
        400
      )
    }
  }

  // Check name uniqueness within the same parent level
  // (The Category model pre-save hook also does this, but we check here for a cleaner error message)
  const existingCategory = await Category.findOne({
    name: name.trim(),
    parent: parent ? new Types.ObjectId(parent) : null,
  })

  if (existingCategory) {
    throw new AppError(
      `A category named "${name}" already exists at this level`,
      409
    )
  }

  // Create the category — the model's pre-save hooks will:
  // 1. Generate the slug from the name (prefixed with parent slug if applicable)
  // 2. Calculate and set the level based on parent
  const category = new Category({
    name: name.trim(),
    parent: parent ? new Types.ObjectId(parent) : undefined,
    icon,
    image,
    order: order ?? 0,
  })

  const saved = await category.save()

  // Invalidate the Redis category tree cache so the next GET /api/categories
  // returns fresh data including the newly created category
  try {
    await cacheDel(CATEGORY_TREE_CACHE_KEY)
    logger.debug('Category tree cache invalidated after category creation')
    
    // Also invalidate product caches since category changes affect product queries
    await invalidateCategoryCaches(saved._id.toString())
  } catch (err) {
    // Cache invalidation failure is non-fatal
    logger.warn('Failed to invalidate caches:', err)
  }

  return formatCategory(saved)
}

/**
 * Deletes a category by ID.
 *
 * Business rules:
 * - Validate the category exists (404 if not)
 * - Prevent deletion if any products reference this category (409)
 * - Prevent deletion if any child categories exist (409)
 * - Remove the category from the database on success
 * - Invalidate the Redis category tree cache on successful deletion
 *
 * Requirement 16.4: WHEN an Admin deletes a Category, THE Platform SHALL prevent deletion
 *                   if the Category contains Products
 */
export async function deleteCategory(id: string): Promise<void> {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid category ID', 400)
  }

  const category = await Category.findById(id)
  if (!category) {
    throw new AppError('Category not found', 404)
  }

  // Prevent deletion if any products reference this category
  const productCount = await Product.countDocuments({ category: category._id })
  if (productCount > 0) {
    throw new AppError(
      `Cannot delete category "${category.name}" because it contains ${productCount} product(s). Remove or reassign the products first.`,
      409
    )
  }

  // Prevent deletion if any child categories exist
  const childCount = await Category.countDocuments({ parent: category._id })
  if (childCount > 0) {
    throw new AppError(
      `Cannot delete category "${category.name}" because it has ${childCount} child categor${childCount === 1 ? 'y' : 'ies'}. Delete the child categories first.`,
      409
    )
  }

  await Category.findByIdAndDelete(id)

  // Invalidate the Redis category tree cache so the next GET /api/categories
  // returns fresh data without the deleted category
  try {
    await cacheDel(CATEGORY_TREE_CACHE_KEY)
    logger.debug('Category tree cache invalidated after category deletion')
    
    // Also invalidate product caches since category changes affect product queries
    await invalidateCategoryCaches(id)
  } catch (err) {
    // Cache invalidation failure is non-fatal
    logger.warn('Failed to invalidate caches:', err)
  }
}

export interface ReorderCategoryItem {
  id: string
  order: number
}

export interface ReorderCategoriesResult {
  updated: number
}

/**
 * Reorders categories within the same parent level by updating their `order` field.
 *
 * Business rules:
 * - All provided category IDs must be valid MongoDB ObjectIds
 * - All provided categories must exist
 * - All provided categories must share the same parent (i.e., be siblings at the same level)
 * - Each category's `order` field is updated to the provided value
 * - Invalidates the Redis category tree cache on success
 *
 * Requirement 16.5: THE Platform SHALL allow Admins to reorder categories within the same level
 */
export async function reorderCategories(items: ReorderCategoryItem[]): Promise<ReorderCategoriesResult> {
  if (items.length === 0) {
    throw new AppError('At least one category must be provided for reordering', 400)
  }

  // Validate all IDs are valid ObjectIds
  for (const item of items) {
    if (!Types.ObjectId.isValid(item.id)) {
      throw new AppError(`Invalid category ID: ${item.id}`, 400)
    }
  }

  const ids = items.map((item) => new Types.ObjectId(item.id))

  // Fetch all categories in one query
  const categories = await Category.find({ _id: { $in: ids } })

  // Verify all categories were found
  if (categories.length !== items.length) {
    const foundIds = new Set(categories.map((c) => c._id.toString()))
    const missingId = items.find((item) => !foundIds.has(item.id))?.id
    throw new AppError(`Category not found: ${missingId}`, 404)
  }

  // Verify all categories share the same parent (are siblings at the same level)
  const parentValues = categories.map((c) => (c.parent ? c.parent.toString() : null))
  const uniqueParents = new Set(parentValues)
  if (uniqueParents.size > 1) {
    throw new AppError(
      'All categories must belong to the same parent level to be reordered together',
      400
    )
  }

  // Bulk update order fields
  const bulkOps = items.map((item) => ({
    updateOne: {
      filter: { _id: new Types.ObjectId(item.id) },
      update: { $set: { order: item.order } },
    },
  }))

  const result = await Category.bulkWrite(bulkOps)

  // Invalidate the Redis category tree cache
  try {
    await cacheDel(CATEGORY_TREE_CACHE_KEY)
    logger.debug('Category tree cache invalidated after category reordering')
    
    // Also invalidate product caches since category changes affect product queries
    await invalidateCategoryCaches(categories[0]._id.toString())
  } catch (err) {
    logger.warn('Failed to invalidate caches:', err)
  }

  return { updated: result.modifiedCount }
}

function formatCategory(category: ICategory): CategoryResult {
  return {
    _id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    parent: category.parent ? category.parent.toString() : null,
    level: category.level,
    icon: category.icon,
    image: category.image,
    order: category.order,
    isActive: category.isActive,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  }
}

/**
 * Updates an existing category.
 *
 * Business rules:
 * - Validate the category exists (404 if not)
 * - If name is being changed, validate uniqueness within the same parent level
 *   (excluding the category being updated itself)
 * - Regenerate slug if name changes (handled by Category model pre-save hook)
 * - Invalidate the Redis category tree cache on successful update
 *
 * Requirement 16.3: WHEN an Admin updates a Category, THE Platform SHALL validate the name is unique
 *                   within the same parent level
 */
export async function updateCategory(id: string, input: UpdateCategoryInput): Promise<CategoryResult> {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid category ID', 400)
  }

  const category = await Category.findById(id)
  if (!category) {
    throw new AppError('Category not found', 404)
  }

  const { name, parent, icon, image, order } = input

  // Update parent if provided
  if (parent !== undefined) {
    if (parent === '' || parent === null) {
      // Move to root
      category.parent = undefined
      category.level = 0
    } else {
      if (!Types.ObjectId.isValid(parent)) {
        throw new AppError('Invalid parent category ID', 400)
      }
      const parentCategory = await Category.findById(parent)
      if (!parentCategory) {
        throw new AppError('Parent category not found', 404)
      }
      if (parentCategory.level >= 2) {
        throw new AppError('Category hierarchy cannot exceed 3 levels', 400)
      }
      category.parent = new Types.ObjectId(parent)
      category.level = parentCategory.level + 1
    }
  }

  // Validate name uniqueness within the same parent level (excluding this category)
  if (name !== undefined) {
    const trimmedName = name.trim()
    const conflict = await Category.findOne({
      name: trimmedName,
      parent: category.parent ?? null,
      _id: { $ne: category._id },
    })

    if (conflict) {
      throw new AppError(
        `A category named "${trimmedName}" already exists at this level`,
        409
      )
    }

    category.name = trimmedName
  }

  if (icon !== undefined) {
    category.icon = icon
  }

  if (image !== undefined) {
    category.image = image
  }

  if (order !== undefined) {
    category.order = order
  }

  const saved = await category.save()

  // Invalidate the Redis category tree cache so the next GET /api/categories
  // returns fresh data reflecting the updated category
  try {
    await cacheDel(CATEGORY_TREE_CACHE_KEY)
    logger.debug('Category tree cache invalidated after category update')
    
    // Also invalidate product caches since category changes affect product queries
    await invalidateCategoryCaches(saved._id.toString())
  } catch (err) {
    // Cache invalidation failure is non-fatal
    logger.warn('Failed to invalidate caches:', err)
  }

  return formatCategory(saved)
}
