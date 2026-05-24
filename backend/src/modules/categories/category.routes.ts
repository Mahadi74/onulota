import { Router } from 'express'
import { getCategoryTreeHandler, getCategoryBySlugHandler } from './category.controller'
import { getProductsByCategoryHandler } from '../products/product.controller'
import { Category } from '../../models/Category'
import { asyncHandler, AppError } from '../../middleware/errorHandler'

const router = Router()

// GET /api/categories — full tree
router.get('/', getCategoryTreeHandler)

// GET /api/categories/:slug — single category by slug
router.get('/:slug', getCategoryBySlugHandler)

// GET /api/categories/:slug/products — products in a category (resolves slug → _id)
router.get(
  '/:slug/products',
  asyncHandler(async (req, _res, next) => {
    const { slug } = req.params
    const category = await Category.findOne({ slug, isActive: true }).select('_id').lean()
    if (!category) throw new AppError('Category not found', 404)
    req.params.id = category._id.toString()
    next()
  }),
  getProductsByCategoryHandler
)

export default router
