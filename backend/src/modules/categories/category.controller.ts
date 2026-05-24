import { Request, Response, NextFunction } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler'
import { getCategoryTree } from './category.service'
import { Category } from '../../models/Category'

/**
 * GET /api/categories
 *
 * Returns the full category tree with product counts.
 * Results are cached in Redis with a 1-hour TTL.
 *
 * Public endpoint — no authentication required.
 *
 * Requirement 7.3: WHEN a User requests the category tree, THE Platform SHALL
 * return the complete hierarchy with category names and product counts.
 */
export const getCategoryTreeHandler = asyncHandler(
  async (_req: Request, res: Response, _next: NextFunction) => {
    const tree = await getCategoryTree()
    res.status(200).json({ categories: tree })
  }
)

/**
 * GET /api/categories/:slug
 *
 * Returns a single category by slug.
 * Public endpoint — no authentication required.
 */
export const getCategoryBySlugHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { slug } = req.params
    const category = await Category.findOne({ slug, isActive: true })
      .select('_id name slug description icon image level parent order')
      .lean()
    if (!category) {
      throw new AppError('Category not found', 404)
    }
    res.status(200).json(category)
  }
)
