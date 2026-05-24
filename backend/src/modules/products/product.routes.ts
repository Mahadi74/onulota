import { Router } from 'express'
import { getProductsHandler, getProductDetailHandler, searchProductsHandler, getProductsByCategoryHandler, getFeaturedProductsHandler, getRelatedProductsHandler, getProductBrandsHandler } from './product.controller'

const router = Router()

/**
 * GET /api/products/brands
 *
 * Returns a sorted list of distinct brand names for active products.
 * Public endpoint — no authentication required.
 */
router.get('/brands', getProductBrandsHandler)

/**
 * GET /api/products/featured
 *
 * Returns up to 12 featured products sorted by rating.
 * Cached in Redis with 15-minute TTL.
 *
 * Public endpoint — no authentication required.
 *
 * Requirements:
 * - Requirement 40.4: Cache featured products in Redis with 15-minute TTL
 */
router.get('/featured', getFeaturedProductsHandler)

/**
 * GET /api/products/search
 *
 * Searches for products by text query across name, description, and category.
 * Supports the same filtering and sorting as the product listing endpoint.
 *
 * Query Parameters:
 * - q: string (required, search query)
 * - page: number (default 1)
 * - limit: number (default 20, max 100)
 * - minPrice: number (minimum price in BDT)
 * - maxPrice: number (maximum price in BDT)
 * - minRating: number (minimum average rating 0-5)
 * - categoryId: string (MongoDB ObjectId of category)
 * - sortBy: string (price_asc, price_desc, rating, newest)
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
router.get('/search', searchProductsHandler)

/**
 * GET /api/products
 *
 * Returns a paginated list of products with filtering and sorting.
 *
 * Query Parameters:
 * - page: number (default 1)
 * - limit: number (default 20, max 100)
 * - minPrice: number (minimum price in BDT)
 * - maxPrice: number (maximum price in BDT)
 * - minRating: number (minimum average rating 0-5)
 * - categoryId: string (MongoDB ObjectId of category)
 * - sortBy: string (price_asc, price_desc, rating, newest)
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
 */
router.get('/', getProductsHandler)

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
router.get('/:id/related', getRelatedProductsHandler)

/**
 * GET /api/products/:id
 *
 * Returns full product details with reviews summary.
 *
 * Path Parameters:
 * - id: string (MongoDB ObjectId of product)
 *
 * Public endpoint — no authentication required.
 *
 * Requirements:
 * - Requirement 5.3: Return complete product details including description, specifications, all images, category, stock quantity, and reviews
 * - Requirement 5.5: Return images in the order specified by the Admin
 * - Requirement 13.5: Include average rating and total number of reviews in product details
 */
router.get('/:id', getProductDetailHandler)

export default router
