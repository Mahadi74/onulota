import { Product, IProduct } from '../../models/Product'
import { Category } from '../../models/Category'
import { Types } from 'mongoose'
import { logger } from '../../utils/logger'
import { getCachedData, setCachedData } from '../../utils/cacheService'
import { cacheGet, cacheSet } from '../../config/redis'
import {
  generateProductListCacheKey,
  generateProductSearchCacheKey,
  generateProductCategoryCacheKey,
  generateProductDetailCacheKey,
} from '../../utils/cacheKeys'

export interface ProductListQuery {
  page?: number
  limit?: number
  minPrice?: number
  maxPrice?: number
  minRating?: number
  brand?: string
  tags?: string[]
  inStock?: boolean
  isFeatured?: boolean
  categoryId?: string
  sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'newest'
}

export interface ProductSearchQuery extends ProductListQuery {
  query: string
}

export interface ProductListResponse {
  products: IProduct[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface ProductDetailResponse {
  _id: Types.ObjectId
  name: string
  slug: string
  description: string
  price: number
  compareAtPrice?: number
  category: {
    _id: Types.ObjectId
    name: string
    slug: string
  }
  images: Array<{
    url: string
    thumbnail?: string
    mobile?: string
    alt?: string
  }>
  specifications: Array<{
    key: string
    value: string
  }>
  variants: Array<{
    _id?: Types.ObjectId
    name: string
    sku?: string
    price: number
    stock: number
  }>
  stock: number
  averageRating: number
  reviewCount: number
  reviewsSummary: {
    averageRating: number
    totalReviews: number
  }
  isActive: boolean
  isFeatured: boolean
  tags: string[]
  colors: string[]
  sizes: string[]
  brand?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Fetches a paginated list of products with filtering and sorting.
 *
 * Features:
 * - Pagination: page (default 1), limit (default 20, max 100)
 * - Filters:
 *   - Price range: minPrice, maxPrice
 *   - Rating: minRating (0-5)
 *   - Category: categoryId (includes subcategories)
 * - Sorting: price_asc, price_desc, rating, newest
 * - Caching: Results are cached in Redis with 5-minute TTL
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
 * - Requirement 29.5: Respond to product listing requests within 200ms at 95th percentile
 * - Requirement 40.4: Cache product listings in Redis with 5-minute TTL
 */
export async function getProductList(query: ProductListQuery): Promise<ProductListResponse> {
  // Generate cache key based on query parameters
  const cacheKey = generateProductListCacheKey(query)
  
  // Try to get from cache first
  const cached = await getCachedData<ProductListResponse>(cacheKey)
  if (cached) {
    logger.debug(`Cache hit for product list: ${cacheKey}`)
    return cached
  }
  
  logger.debug(`Cache miss for product list: ${cacheKey}`)
  // Validate and normalize pagination parameters
  const page = Math.max(1, query.page || 1)
  const limit = Math.min(100, Math.max(1, query.limit || 20))
  const skip = (page - 1) * limit

  // Build MongoDB filter query
  const filter: any = {
    isActive: true, // Only return active products
  }

  // Price range filter
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {}
    if (query.minPrice !== undefined) {
      filter.price.$gte = Math.max(0, query.minPrice)
    }
    if (query.maxPrice !== undefined) {
      filter.price.$lte = Math.max(0, query.maxPrice)
    }
  }

  // Rating filter
  if (query.minRating !== undefined) {
    const rating = Math.max(0, Math.min(5, query.minRating))
    filter.averageRating = { $gte: rating }
  }

  if (query.brand) {
    filter.brand = { $regex: new RegExp(query.brand, 'i') }
  }
  if (query.tags && query.tags.length > 0) {
    filter.tags = { $in: query.tags }
  }
  if (query.inStock === true) {
    filter.stock = { ...filter.stock, $gt: 0 }
  }
  if (query.isFeatured === true) {
    filter.isFeatured = true
  }

  // Category filter (including subcategories)
  if (query.categoryId) {
    try {
      const categoryId = new Types.ObjectId(query.categoryId)

      // Find all descendant categories
      const descendants = await findCategoryDescendants(categoryId)
      const categoryIds = [categoryId, ...descendants]

      filter.category = { $in: categoryIds }
    } catch (err) {
      logger.warn(`Invalid category ID: ${query.categoryId}`)
      // Invalid category ID — return empty results
      return {
        products: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
        },
      }
    }
  }

  // Build sort query
  const sort: any = {}
  switch (query.sortBy) {
    case 'price_asc':
      sort.price = 1
      break
    case 'price_desc':
      sort.price = -1
      break
    case 'rating':
      sort.averageRating = -1
      sort.reviewCount = -1 // Secondary sort by review count
      break
    case 'newest':
      sort.createdAt = -1
      break
    default:
      // Default sort: by rating (descending), then by review count
      sort.averageRating = -1
      sort.reviewCount = -1
  }

  // Execute query with pagination
  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('name price compareAtPrice stock images averageRating reviewCount category slug brand')
      .lean(),
    Product.countDocuments(filter),
  ])

  const pages = Math.ceil(total / limit)

  const result = {
    products: products as IProduct[],
    pagination: {
      page,
      limit,
      total,
      pages,
    },
  }
  
  // Cache the result
  await setCachedData(cacheKey, result)
  
  return result
}

/**
 * Fetches full product details by ID with reviews summary.
 *
 * Returns:
 * - Complete product information (name, description, price, images, specifications, variants, stock)
 * - Category information
 * - Reviews summary (average rating, review count)
 * - All product images in order
 *
 * Requirements:
 * - Requirement 5.3: Return complete product details including description, specifications, all images, category, stock quantity, and reviews
 * - Requirement 5.5: Return images in the order specified by the Admin
 * - Requirement 13.5: Include average rating and total number of reviews in product details
 */
export async function getProductDetail(productId: string): Promise<ProductDetailResponse> {
  // Validate product ID format
  if (!Types.ObjectId.isValid(productId)) {
    throw new Error('Invalid product ID')
  }

  // Fetch product with category information
  const product = await Product.findById(productId)
    .populate('category', '_id name slug')
    .lean()

  if (!product) {
    throw new Error('Product not found')
  }

  // Ensure product is active
  if (!product.isActive) {
    throw new Error('Product not found')
  }

  // Return product details with reviews summary
  return {
    _id: product._id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    category: product.category as any,
    images: product.images,
    specifications: product.specifications,
    variants: product.variants,
    stock: product.stock,
    averageRating: product.averageRating,
    reviewCount: product.reviewCount,
    reviewsSummary: {
      averageRating: product.averageRating,
      totalReviews: product.reviewCount,
    },
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    tags: product.tags,
    colors: (product as any).colors || [],
    sizes: (product as any).sizes || [],
    brand: product.brand,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  }
}

/**
 * Searches for products by text query across name, description, and category.
 * Supports the same filtering and sorting as getProductList.
 *
 * Features:
 * - Full-text search using MongoDB text indexes on name and description
 * - Pagination: page (default 1), limit (default 20, max 100)
 * - Filters:
 *   - Price range: minPrice, maxPrice
 *   - Rating: minRating (0-5)
 *   - Category: categoryId (includes subcategories)
 * - Sorting: price_asc, price_desc, rating, newest (default: relevance)
 *
 * Requirements:
 * - Requirement 6.1: Search across product name, description, and category
 * - Requirement 6.2: Filter by price range
 * - Requirement 6.3: Filter by category (including subcategories)
 * - Requirement 6.4: Filter by rating
 * - Requirement 6.5: Support multiple filters with AND logic
 * - Requirement 6.6: Support sorting by price, rating, newest
 * - Requirement 6.7: Return empty list with message if no results
 * - Requirement 29.3: Implement pagination for all list endpoints
 */
export async function searchProducts(query: ProductSearchQuery): Promise<ProductListResponse> {
  // Validate search query
  if (!query.query || query.query.trim().length === 0) {
    throw new Error('Search query is required')
  }

  // Validate and normalize pagination parameters
  const page = Math.max(1, query.page || 1)
  const limit = Math.min(100, Math.max(1, query.limit || 20))
  const skip = (page - 1) * limit

  // Build MongoDB filter query
  const filter: any = {
    isActive: true, // Only return active products
    $text: { $search: query.query }, // Full-text search
  }

  // Price range filter
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {}
    if (query.minPrice !== undefined) {
      filter.price.$gte = Math.max(0, query.minPrice)
    }
    if (query.maxPrice !== undefined) {
      filter.price.$lte = Math.max(0, query.maxPrice)
    }
  }

  // Rating filter
  if (query.minRating !== undefined) {
    const rating = Math.max(0, Math.min(5, query.minRating))
    filter.averageRating = { $gte: rating }
  }

  if (query.brand) {
    filter.brand = { $regex: new RegExp(query.brand, 'i') }
  }
  if (query.tags && query.tags.length > 0) {
    filter.tags = { $in: query.tags }
  }
  if (query.inStock === true) {
    filter.stock = { ...filter.stock, $gt: 0 }
  }
  if (query.isFeatured === true) {
    filter.isFeatured = true
  }

  // Category filter (including subcategories)
  if (query.categoryId) {
    try {
      const categoryId = new Types.ObjectId(query.categoryId)

      // Find all descendant categories
      const descendants = await findCategoryDescendants(categoryId)
      const categoryIds = [categoryId, ...descendants]

      filter.category = { $in: categoryIds }
    } catch (err) {
      logger.warn(`Invalid category ID: ${query.categoryId}`)
      // Invalid category ID — return empty results
      return {
        products: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
        },
      }
    }
  }

  // Build sort query
  const sort: any = {}

  // If not explicitly sorting, use text search relevance score
  if (!query.sortBy || query.sortBy === 'rating') {
    sort.score = { $meta: 'textScore' }
  }
  
  switch (query.sortBy) {
    case 'price_asc':
      sort.price = 1
      break
    case 'price_desc':
      sort.price = -1
      break
    case 'rating':
      sort.averageRating = -1
      sort.reviewCount = -1 // Secondary sort by review count
      break
    case 'newest':
      sort.createdAt = -1
      break
    default:
      // Default sort: by text search relevance score
      sort.score = { $meta: 'textScore' }
  }

  // Execute query with pagination
  const [products, total] = await Promise.all([
    Product.find(filter, { score: { $meta: 'textScore' } })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('name price compareAtPrice stock images averageRating reviewCount category slug')
      .lean(),
    Product.countDocuments(filter),
  ])

  const pages = Math.ceil(total / limit)

  return {
    products: products as IProduct[],
    pagination: {
      page,
      limit,
      total,
      pages,
    },
  }
}

/**
 * Helper function to find all descendant categories (children, grandchildren, etc.)
 * for a given category ID.
 */
async function findCategoryDescendants(categoryId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const descendants: Types.ObjectId[] = []

  const findChildren = async (parentId: Types.ObjectId) => {
    const children = await Category.find({ parent: parentId, isActive: true })
      .select('_id')
      .lean()

    for (const child of children) {
      descendants.push(child._id)
      await findChildren(child._id)
    }
  }

  await findChildren(categoryId)
  return descendants
}

/**
 * Fetches products in a specific category and all its descendant categories.
 *
 * Features:
 * - Returns products from the specified category and all subcategories
 * - Pagination: page (default 1), limit (default 20, max 100)
 * - Filters:
 *   - Price range: minPrice, maxPrice
 *   - Rating: minRating (0-5)
 * - Sorting: price_asc, price_desc, rating, newest
 * - Caching: Results are cached in Redis with 5-minute TTL
 *
 * Requirements:
 * - Requirement 7.2: WHEN a User selects a category, THE Platform SHALL display all products in that category and its child categories
 * - Requirement 6.2: Filter by price range
 * - Requirement 6.4: Filter by rating
 * - Requirement 6.5: Support multiple filters with AND logic
 * - Requirement 6.6: Support sorting by price, rating, newest
 * - Requirement 29.3: Implement pagination for all list endpoints
 * - Requirement 40.4: Cache product listings in Redis with 5-minute TTL
 */
export async function getProductsByCategory(query: ProductListQuery): Promise<ProductListResponse> {
  if (!query.categoryId) {
    throw new Error('Category ID is required')
  }

  // Generate cache key based on query parameters
  const cacheKey = generateProductCategoryCacheKey(query.categoryId, query)
  
  // Try to get from cache first
  const cached = await getCachedData<ProductListResponse>(cacheKey)
  if (cached) {
    logger.debug(`Cache hit for category products: ${cacheKey}`)
    return cached
  }
  
  logger.debug(`Cache miss for category products: ${cacheKey}`)

  // Validate category ID format
  if (!Types.ObjectId.isValid(query.categoryId)) {
    throw new Error('Invalid category ID')
  }

  const categoryId = new Types.ObjectId(query.categoryId)

  // Verify category exists
  const category = await Category.findById(categoryId).select('_id isActive').lean()
  if (!category) {
    throw new Error('Category not found')
  }

  if (!category.isActive) {
    throw new Error('Category not found')
  }

  // Find all descendant categories
  const descendants = await findCategoryDescendants(categoryId)
  const categoryIds = [categoryId, ...descendants]

  // Validate and normalize pagination parameters
  const page = Math.max(1, query.page || 1)
  const limit = Math.min(100, Math.max(1, query.limit || 20))
  const skip = (page - 1) * limit

  // Build MongoDB filter query
  const filter: any = {
    isActive: true,
    category: { $in: categoryIds },
  }

  // Price range filter
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {}
    if (query.minPrice !== undefined) {
      filter.price.$gte = Math.max(0, query.minPrice)
    }
    if (query.maxPrice !== undefined) {
      filter.price.$lte = Math.max(0, query.maxPrice)
    }
  }

  // Rating filter
  if (query.minRating !== undefined) {
    const rating = Math.max(0, Math.min(5, query.minRating))
    filter.averageRating = { $gte: rating }
  }

  if (query.brand) {
    filter.brand = { $regex: new RegExp(query.brand, 'i') }
  }
  if (query.tags && query.tags.length > 0) {
    filter.tags = { $in: query.tags }
  }
  if (query.inStock === true) {
    filter.stock = { ...filter.stock, $gt: 0 }
  }
  if (query.isFeatured === true) {
    filter.isFeatured = true
  }

  // Build sort query
  const sort: any = {}
  switch (query.sortBy) {
    case 'price_asc':
      sort.price = 1
      break
    case 'price_desc':
      sort.price = -1
      break
    case 'rating':
      sort.averageRating = -1
      sort.reviewCount = -1 // Secondary sort by review count
      break
    case 'newest':
      sort.createdAt = -1
      break
    default:
      // Default sort: by rating (descending), then by review count
      sort.averageRating = -1
      sort.reviewCount = -1
  }

  // Execute query with pagination
  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('name price compareAtPrice stock images averageRating reviewCount category slug brand')
      .lean(),
    Product.countDocuments(filter),
  ])

  const pages = Math.ceil(total / limit)

  const result = {
    products: products as IProduct[],
    pagination: {
      page,
      limit,
      total,
      pages,
    },
  }

  // Cache the result
  await setCachedData(cacheKey, result)

  return result
}

export async function getRelatedProducts(productId: string, limit = 12): Promise<IProduct[]> {
  if (!Types.ObjectId.isValid(productId)) {
    throw new Error('Invalid product ID')
  }

  const product = await Product.findById(productId).lean()
  if (!product || !product.isActive) {
    throw new Error('Product not found')
  }

  const categoryId = product.category as Types.ObjectId
  if (!categoryId) {
    throw new Error('Product category not found')
  }

  const descendants = await findCategoryDescendants(categoryId)
  const categoryIds = [categoryId, ...descendants]

  const relatedProducts = await Product.find({
    isActive: true,
    category: { $in: categoryIds },
    _id: { $ne: product._id },
  })
    .sort({ averageRating: -1, reviewCount: -1, createdAt: -1 })
    .limit(limit)
    .select('name price compareAtPrice stock images averageRating reviewCount category slug')
    .lean()

  return relatedProducts as IProduct[]
}


/**
 * Fetches featured products with caching.
 *
 * Features:
 * - Returns up to 12 featured products
 * - Sorted by rating (descending), then by review count
 * - Caching: Results are cached in Redis with 15-minute TTL
 *
 * Requirements:
 * - Requirement 40.4: Cache featured products in Redis with 15-minute TTL
 * - Requirement 29.5: Respond to featured products requests within 200ms at 95th percentile
 */
export async function getFeaturedProducts(): Promise<IProduct[]> {
  const cacheKey = 'products:featured'

  // Try to get from cache first
  try {
    const cached = await cacheGet(cacheKey)
    if (cached) {
      logger.debug('Featured products served from Redis cache')
      return JSON.parse(cached) as IProduct[]
    }
  } catch (err) {
    logger.warn('Redis cache read failed for featured products:', err)
  }

  // Cache miss — fetch from MongoDB
  const products = await Product.find({
    isActive: true,
    isFeatured: true,
  })
    .sort({ averageRating: -1, reviewCount: -1 })
    .limit(12)
    .select('name price compareAtPrice stock images averageRating reviewCount category slug')
    .lean()

  // Cache the result with 15-minute TTL
  try {
    await cacheSet(cacheKey, JSON.stringify(products), 900)
    logger.debug('Featured products cached in Redis')
  } catch (err) {
    logger.warn('Redis cache write failed for featured products:', err)
  }

  return products as IProduct[]
}
