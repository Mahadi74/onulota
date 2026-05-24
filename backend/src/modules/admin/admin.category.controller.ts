import { Request, Response, NextFunction } from 'express'
import { asyncHandler } from '../../middleware/errorHandler'
import { AuthenticatedRequest } from '../../middleware/auth'
import { createCategory, updateCategory, deleteCategory, reorderCategories } from './admin.category.service'

/**
 * POST /api/admin/categories
 *
 * Creates a new category. Requires admin authentication.
 *
 * Request body:
 *   - name (required): Category name
 *   - parent (optional): Parent category ID
 *   - icon (optional): Icon URL or icon name
 *   - image (optional): Image URL
 *   - order (optional): Sort order within the same level
 *
 * Validates:
 *   - Hierarchy depth does not exceed 3 levels (level 0, 1, 2)
 *   - Name uniqueness within the same parent level
 *
 * Returns 201 with the created category on success.
 *
 * Requirement 16.1: WHEN an Admin creates a Category, THE Platform SHALL require a name and optional parent category
 * Requirement 16.2: WHEN an Admin creates a Category with a parent, THE Platform SHALL validate the parent exists
 *                   and the hierarchy depth does not exceed 3 levels
 */
export const createCategoryHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    // req.user is attached by authenticateToken middleware
    const { name, parent, icon, image, order } = req.body as {
      name: string
      parent?: string
      icon?: string
      image?: string
      order?: number
    }

    // Cast to AuthenticatedRequest to access req.user (set by authenticateToken middleware)
    void (req as AuthenticatedRequest).user

    const category = await createCategory({ name, parent, icon, image, order })

    res.status(201).json({ category })
  }
)

/**
 * PUT /api/admin/categories/:id
 *
 * Updates an existing category. Requires admin authentication.
 *
 * URL params:
 *   - id: Category ID (MongoDB ObjectId)
 *
 * Request body (all optional):
 *   - name: New category name
 *   - icon: Icon URL or icon name
 *   - image: Image URL
 *   - order: Sort order within the same level
 *
 * Validates:
 *   - Category exists (404 if not)
 *   - Name uniqueness within the same parent level (excluding this category)
 *
 * Returns 200 with the updated category on success.
 *
 * Requirement 16.3: WHEN an Admin updates a Category, THE Platform SHALL validate the name is unique
 *                   within the same parent level
 */
export const updateCategoryHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    void (req as AuthenticatedRequest).user

    const { id } = req.params
    const { name, parent, icon, image, order } = req.body as {
      name?: string
      parent?: string
      icon?: string
      image?: string
      order?: number
    }

    const category = await updateCategory(id, { name, parent, icon, image, order })

    res.status(200).json({ category })
  }
)

/**
 * PUT /api/admin/categories/reorder
 *
 * Reorders categories within the same parent level by updating their `order` field.
 *
 * Request body:
 *   - categories (required): Array of { id: string, order: number } objects
 *
 * All provided categories must be siblings (share the same parent).
 *
 * Returns 200 with the number of updated categories on success.
 *
 * Requirement 16.5: THE Platform SHALL allow Admins to reorder categories within the same level
 */
export const reorderCategoriesHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    void (req as AuthenticatedRequest).user

    const { categories } = req.body as {
      categories: Array<{ id: string; order: number }>
    }

    const result = await reorderCategories(categories)

    res.status(200).json({ message: 'Categories reordered successfully', updated: result.updated })
  }
)

/**
 * DELETE /api/admin/categories/:id
 *
 * Deletes a category. Requires admin authentication.
 *
 * URL params:
 *   - id: Category ID (MongoDB ObjectId)
 *
 * Validates:
 *   - Category exists (404 if not)
 *   - No products reference this category (409 if products exist)
 *   - No child categories exist (409 if children exist)
 *
 * Returns 200 with a success message on successful deletion.
 *
 * Requirement 16.4: WHEN an Admin deletes a Category, THE Platform SHALL prevent deletion
 *                   if the Category contains Products
 */
export const deleteCategoryHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    void (req as AuthenticatedRequest).user

    const { id } = req.params

    await deleteCategory(id)

    res.status(200).json({ message: 'Category deleted successfully' })
  }
)
