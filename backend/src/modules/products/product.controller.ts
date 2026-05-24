import { Request, Response, NextFunction } from 'express'
import { asyncHandler } from '../../middleware/errorHandler'
import { getProductList, ProductListQuery, getProductDetail, searchProducts, ProductSearchQuery, getProductsByCategory, getFeaturedProducts, getRelatedProducts } from './product.service'
import { AppError } from '../../middleware/errorHandler'

/**
 * GET /api/products/:id
 *
 * Returns full product details with reviews summary.
 *
 * Path Parameters:
 * - id: string (MongoDB ObjectId of product)
 *
 * Response:
 * {
 *   "_id": "...",
 *   "name": "...",
 *   "slug": "...",
 *   "description": "...",
 *   "price": 1000,
 *   "compareAtPrice": 1500,
 *   "category": {
 *     "_id": "...",
 *     "name": "...",
 *     "slug": "..."
 *   },
 *   "images": [
 *     {
 *       "url": "...",
 *       "thumbnail": "...",
 *       "mobile": "...",
 *       "alt": "..."
 *     }
 *   ],
 *   "specifications": [
 *     {
 *       "key": "...",
 *       "value": "..."
 *     }
 *   ],
 *   "variants": [
 *     {
 *       "_id": "...",
 *       "name": "...",
 *       "sku": "...",
 *       "price": 1000,
 *       "stock": 10
 *     }
 *   ],
 *   "stock": 50,
 *   "averageRating": 4.5,
 *   "reviewCount": 10,
 *   "reviewsSummary": {
 *     "averageRating": 4.5,
 *     "totalReviews": 10
 *   },
 *   "isActive": true,
 *   "isFeatured": false,
 *   "tags": ["tag1", "tag2"],
 *   "createdAt": "...",
 *   "updatedAt": "..."
 * }
 *
 * Public endpoint — no authentication required.
 *
 * Requirements:
 * - Requirement 5.3: Return complete product details including description, specifications, all images, category, stock quantity, and reviews
 * - Requirement 5.5: Return images in the order specified by the Admin
 * - Requirement 13.5: Include average rating and total number of reviews in product details
 */
export const getProductDetailHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params

    if (!id) {
      throw new AppError('Product ID is required', 400)
    }

    try {
      const product = await getProductDetail(id)
      res.status(200).json(product)
    } catch (error) {
      const errorMessage = (error as Error).message
      if (errorMessage === 'Product not found') {
        throw new AppError('Product not found', 404)
      }
      if (errorMessage === 'Invalid product ID') {
        throw new AppError('Invalid product ID format', 400)
      }
      throw error
    }
  }
)

/**
 * GET /api/products/:id/related
 *
 * Returns related products from the same category as the requested product.
 *
 * Path Parameters:
 * - id: string (MongoDB ObjectId of product)
 *
 * Query Parameters:
 * - limit: number (default 12, max 20)
 *
 * Public endpoint — no authentication required.
 */
export const getRelatedProductsHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params
    const limitParam = req.query.limit as string | undefined
    const limit = limitParam ? Math.min(20, Math.max(1, parseInt(limitParam, 10))) : 12

    if (!id) {
      throw new AppError('Product ID is required', 400)
    }

    try {
      const related = await getRelatedProducts(id, limit)
      res.status(200).json(related)
    } catch (error) {
      const errorMessage = (error as Error).message
      if (errorMessage === 'Product not found') {
        throw new AppError('Product not found', 404)
      }
      if (errorMessage === 'Invalid product ID') {
        throw new AppError('Invalid product ID format', 400)
      }
      throw error
    }
  }
)

/**
 * GET /api/products
 *
 * Returns a paginated list of products with filtering and sorting.
 *
 * Query Parameters:
 * - page: number (default 1, min 1)
 * - limit: number (default 20, max 100)
 * - minPrice: number (minimum price in BDT, default 0)
 * - maxPrice: number (maximum price in BDT)
 * - minRating: number (minimum average rating 0-5)
 * - categoryId: string (MongoDB ObjectId of category)
 * - sortBy: string (price_asc, price_desc, rating, newest; default: rating)
 *
 * Response:
 * {
 *   "products": [
 *     {
 *       "_id": "...",
 *       "name": "...",
 *       "price": 1000,
 *       "images": [...],
 *       "averageRating": 4.5,
 *       "reviewCount": 10,
 *       "category": "...",
 *       "slug": "..."
 *     }
 *   ],
 *   "pagination": {
 *     "page": 1,
 *     "limit": 20,
 *     "total": 100,
 *     "pages": 5
 *   }
 * }
 *
 * Public endpoint — no authentication required.
 *
 * Requirements:
 * - Requirement 5.1: Return products with name, price, primary image, rating, category
 * - Requirement 5.2: Support pagination with configurable page size (default 20)
 * - Requirement 6.2: Filter by price range
 * - Requirement 6.3: Filter by category (including subcategories)
 * - Requirement 6.4: Filter by rating
 * - Requirement 6.5: Support multiple filters with AND logic
 * - Requirement 6.6: Support sorting by price, rating, newest
 * - Requirement 29.3: Implement pagination for all list endpoints
 */
export const getProductsHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    // Parse and validate query parameters
    const query: ProductListQuery = {}

    // Pagination
    if (req.query.page) {
      const page = parseInt(req.query.page as string, 10)
      if (isNaN(page) || page < 1) {
        throw new AppError('Invalid page parameter', 400)
      }
      query.page = page
    }

    if (req.query.limit) {
      const limit = parseInt(req.query.limit as string, 10)
      if (isNaN(limit) || limit < 1) {
        throw new AppError('Limit must be at least 1', 400)
      }
      // Cap at 100, but don't reject if larger
      query.limit = Math.min(limit, 100)
    }

    // Price filters
    if (req.query.minPrice) {
      const minPrice = parseFloat(req.query.minPrice as string)
      if (isNaN(minPrice) || minPrice < 0) {
        throw new AppError('Invalid minPrice parameter', 400)
      }
      query.minPrice = minPrice
    }

    if (req.query.maxPrice) {
      const maxPrice = parseFloat(req.query.maxPrice as string)
      if (isNaN(maxPrice) || maxPrice < 0) {
        throw new AppError('Invalid maxPrice parameter', 400)
      }
      query.maxPrice = maxPrice
    }

    // Validate price range
    if (query.minPrice !== undefined && query.maxPrice !== undefined) {
      if (query.minPrice > query.maxPrice) {
        throw new AppError('minPrice cannot be greater than maxPrice', 400)
      }
    }

    // Rating filter
    if (req.query.minRating) {
      const minRating = parseFloat(req.query.minRating as string)
      if (isNaN(minRating) || minRating < 0 || minRating > 5) {
        throw new AppError('minRating must be between 0 and 5', 400)
      }
      query.minRating = minRating
    }

    // Category filter
    if (req.query.categoryId) {
      query.categoryId = req.query.categoryId as string
    }

    // Brand filter
    if (req.query.brand) {
      query.brand = req.query.brand as string
    }

    // Tags filter
    if (req.query.tags) {
      query.tags = (req.query.tags as string).split(',').filter(Boolean)
    }

    // In-stock filter
    if (req.query.inStock) {
      query.inStock = req.query.inStock === 'true'
    }

    // Featured filter
    if (req.query.isFeatured) {
      query.isFeatured = req.query.isFeatured === 'true'
    }

    // Sort parameter
    if (req.query.sortBy) {
      const validSortOptions = ['price_asc', 'price_desc', 'rating', 'newest']
      const sortBy = req.query.sortBy as string
      if (!validSortOptions.includes(sortBy)) {
        throw new AppError(
          `Invalid sortBy parameter. Must be one of: ${validSortOptions.join(', ')}`,
          400
        )
      }
      query.sortBy = sortBy as any
    }

    // Fetch products
    const result = await getProductList(query)

    res.status(200).json(result)
  }
)

/**
 * GET /api/products/search
 *
 * Searches for products by text query across name, description, and category.
 * Supports the same filtering and sorting as the product listing endpoint.
 *
 * Query Parameters:
 * - q: string (required, search query)
 * - page: number (default 1, min 1)
 * - limit: number (default 20, max 100)
 * - minPrice: number (minimum price in BDT, default 0)
 * - maxPrice: number (maximum price in BDT)
 * - minRating: number (minimum average rating 0-5)
 * - categoryId: string (MongoDB ObjectId of category)
 * - sortBy: string (price_asc, price_desc, rating, newest; default: relevance)
 *
 * Response:
 * {
 *   "products": [
 *     {
 *       "_id": "...",
 *       "name": "...",
 *       "price": 1000,
 *       "images": [...],
 *       "averageRating": 4.5,
 *       "reviewCount": 10,
 *       "category": "...",
 *       "slug": "..."
 *     }
 *   ],
 *   "pagination": {
 *     "page": 1,
 *     "limit": 20,
 *     "total": 0,
 *     "pages": 0
 *   }
 * }
 *
 * Public endpoint — no authentication required.
 *
 * Requirements:
 * - Requirement 6.1: Search across product name, description, and category
 * - Requirement 6.2: Filter by price range
 * - Requirement 6.3: Filter by category (including subcategories)
 * - Requirement 6.4: Filter by rating
 * - Requirement 6.5: Support multiple filters with AND logic
 * - Requirement 6.6: Support sorting by price, rating, newest
 * - Requirement 6.7: Return empty list if no results
 */
export const searchProductsHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    // Get search query
    const searchQuery = req.query.q as string

    if (!searchQuery || searchQuery.trim().length === 0) {
      throw new AppError('Search query (q parameter) is required', 400)
    }

    // Parse and validate query parameters
    const query: ProductSearchQuery = {
      query: searchQuery,
    }

    // Pagination
    if (req.query.page) {
      const page = parseInt(req.query.page as string, 10)
      if (isNaN(page) || page < 1) {
        throw new AppError('Invalid page parameter', 400)
      }
      query.page = page
    }

    if (req.query.limit) {
      const limit = parseInt(req.query.limit as string, 10)
      if (isNaN(limit) || limit < 1) {
        throw new AppError('Limit must be at least 1', 400)
      }
      // Cap at 100, but don't reject if larger
      query.limit = Math.min(limit, 100)
    }

    // Price filters
    if (req.query.minPrice) {
      const minPrice = parseFloat(req.query.minPrice as string)
      if (isNaN(minPrice) || minPrice < 0) {
        throw new AppError('Invalid minPrice parameter', 400)
      }
      query.minPrice = minPrice
    }

    if (req.query.maxPrice) {
      const maxPrice = parseFloat(req.query.maxPrice as string)
      if (isNaN(maxPrice) || maxPrice < 0) {
        throw new AppError('Invalid maxPrice parameter', 400)
      }
      query.maxPrice = maxPrice
    }

    // Validate price range
    if (query.minPrice !== undefined && query.maxPrice !== undefined) {
      if (query.minPrice > query.maxPrice) {
        throw new AppError('minPrice cannot be greater than maxPrice', 400)
      }
    }

    // Rating filter
    if (req.query.minRating) {
      const minRating = parseFloat(req.query.minRating as string)
      if (isNaN(minRating) || minRating < 0 || minRating > 5) {
        throw new AppError('minRating must be between 0 and 5', 400)
      }
      query.minRating = minRating
    }

    // Category filter
    if (req.query.categoryId) {
      query.categoryId = req.query.categoryId as string
    }

    // Sort parameter
    if (req.query.sortBy) {
      const validSortOptions = ['price_asc', 'price_desc', 'rating', 'newest']
      const sortBy = req.query.sortBy as string
      if (!validSortOptions.includes(sortBy)) {
        throw new AppError(
          `Invalid sortBy parameter. Must be one of: ${validSortOptions.join(', ')}`,
          400
        )
      }
      query.sortBy = sortBy as any
    }

    // Search products
    const result = await searchProducts(query)

    res.status(200).json(result)
  }
)

/**
 * GET /api/categories/:id/products
 *
 * Returns products in a specific category and all its descendant categories (subcategories).
 * Supports pagination, filtering, and sorting.
 *
 * Path Parameters:
 * - id: string (MongoDB ObjectId of category)
 *
 * Query Parameters:
 * - page: number (default 1, min 1)
 * - limit: number (default 20, max 100)
 * - minPrice: number (minimum price in BDT)
 * - maxPrice: number (maximum price in BDT)
 * - minRating: number (minimum average rating 0-5)
 * - sortBy: string (price_asc, price_desc, rating, newest)
 *
 * Response:
 * {
 *   "products": [
 *     {
 *       "_id": "...",
 *       "name": "...",
 *       "price": 1000,
 *       "images": [...],
 *       "averageRating": 4.5,
 *       "reviewCount": 10,
 *       "category": "...",
 *       "slug": "..."
 *     }
 *   ],
 *   "pagination": {
 *     "page": 1,
 *     "limit": 20,
 *     "total": 100,
 *     "pages": 5
 *   }
 * }
 *
 * Public endpoint — no authentication required.
 *
 * Requirements:
 * - Requirement 7.2: WHEN a User selects a category, THE Platform SHALL display all products in that category and its child categories
 * - Requirement 6.2: Filter by price range
 * - Requirement 6.4: Filter by rating
 * - Requirement 6.5: Support multiple filters with AND logic
 * - Requirement 6.6: Support sorting by price, rating, newest
 * - Requirement 29.3: Implement pagination for all list endpoints
 */
export const getProductsByCategoryHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params

    if (!id) {
      throw new AppError('Category ID is required', 400)
    }

    // Parse and validate query parameters
    const query: ProductListQuery = {
      categoryId: id,
    }

    // Pagination
    if (req.query.page) {
      const page = parseInt(req.query.page as string, 10)
      if (isNaN(page) || page < 1) {
        throw new AppError('Invalid page parameter', 400)
      }
      query.page = page
    }

    if (req.query.limit) {
      const limit = parseInt(req.query.limit as string, 10)
      if (isNaN(limit) || limit < 1) {
        throw new AppError('Limit must be at least 1', 400)
      }
      query.limit = Math.min(limit, 100)
    }

    // Price filters
    if (req.query.minPrice) {
      const minPrice = parseFloat(req.query.minPrice as string)
      if (isNaN(minPrice) || minPrice < 0) {
        throw new AppError('Invalid minPrice parameter', 400)
      }
      query.minPrice = minPrice
    }

    if (req.query.maxPrice) {
      const maxPrice = parseFloat(req.query.maxPrice as string)
      if (isNaN(maxPrice) || maxPrice < 0) {
        throw new AppError('Invalid maxPrice parameter', 400)
      }
      query.maxPrice = maxPrice
    }

    // Validate price range
    if (query.minPrice !== undefined && query.maxPrice !== undefined) {
      if (query.minPrice > query.maxPrice) {
        throw new AppError('minPrice cannot be greater than maxPrice', 400)
      }
    }

    // Rating filter
    if (req.query.minRating) {
      const minRating = parseFloat(req.query.minRating as string)
      if (isNaN(minRating) || minRating < 0 || minRating > 5) {
        throw new AppError('minRating must be between 0 and 5', 400)
      }
      query.minRating = minRating
    }

    // Sort parameter
    if (req.query.sortBy) {
      const validSortOptions = ['price_asc', 'price_desc', 'rating', 'newest']
      const sortBy = req.query.sortBy as string
      if (!validSortOptions.includes(sortBy)) {
        throw new AppError(
          `Invalid sortBy parameter. Must be one of: ${validSortOptions.join(', ')}`,
          400
        )
      }
      query.sortBy = sortBy as any
    }

    try {
      const result = await getProductsByCategory(query)
      res.status(200).json(result)
    } catch (error) {
      const errorMessage = (error as Error).message
      if (errorMessage === 'Invalid category ID') {
        throw new AppError('Invalid category ID format', 400)
      }
      if (errorMessage === 'Category not found') {
        throw new AppError('Category not found', 404)
      }
      throw error
    }
  }
)


/**
 * GET /api/products/featured
 *
 * Returns up to 12 featured products sorted by rating.
 *
 * Response:
 * [
 *   {
 *     "_id": "...",
 *     "name": "...",
 *     "price": 1000,
 *     "images": [...],
 *     "averageRating": 4.5,
 *     "reviewCount": 10,
 *     "category": "...",
 *     "slug": "..."
 *   }
 * ]
 *
 * Public endpoint — no authentication required.
 * Cached in Redis with 15-minute TTL.
 *
 * Requirements:
 * - Requirement 40.4: Cache featured products in Redis with 15-minute TTL
 */
export const getFeaturedProductsHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const products = await getFeaturedProducts()
    res.status(200).json(products)
  }
)

export const getProductBrandsHandler = asyncHandler(
  async (_req: Request, res: Response, _next: NextFunction) => {
    const { Product } = await import('../../models/Product')
    const brands = await Product.distinct('brand', { isActive: true, brand: { $exists: true, $ne: '' } })
    res.status(200).json({ brands: brands.filter(Boolean).sort() })
  }
)
