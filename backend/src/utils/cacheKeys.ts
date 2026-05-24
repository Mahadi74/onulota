/**
 * Cache key generation utilities for product listings.
 * 
 * Cache keys are generated based on query parameters to ensure:
 * - Consistency: Same query parameters always generate the same key
 * - Predictability: Keys are deterministic and can be invalidated systematically
 * - Uniqueness: Different queries generate different keys
 */

import { ProductListQuery, ProductSearchQuery } from '../modules/products/product.service'

/**
 * Generates a cache key for product listing queries.
 * 
 * Key format: `products:list:{page}:{limit}:{minPrice}:{maxPrice}:{minRating}:{categoryId}:{sortBy}`
 * 
 * All parameters are normalized to ensure consistency:
 * - Undefined values are replaced with 'null'
 * - Numbers are converted to strings
 * - ObjectIds are converted to strings
 * 
 * @param query - Product listing query parameters
 * @returns Cache key string
 */
export function generateProductListCacheKey(query: ProductListQuery): string {
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const minPrice = query.minPrice ?? 'null'
  const maxPrice = query.maxPrice ?? 'null'
  const minRating = query.minRating ?? 'null'
  const categoryId = query.categoryId ?? 'null'
  const sortBy = query.sortBy ?? 'rating'

  return `products:list:${page}:${limit}:${minPrice}:${maxPrice}:${minRating}:${categoryId}:${sortBy}`
}

/**
 * Generates a cache key for product search queries.
 * 
 * Key format: `products:search:{query}:{page}:{limit}:{minPrice}:{maxPrice}:{minRating}:{categoryId}:{sortBy}`
 * 
 * The search query is URL-encoded to handle special characters safely.
 * 
 * @param query - Product search query parameters
 * @returns Cache key string
 */
export function generateProductSearchCacheKey(query: ProductSearchQuery): string {
  const searchQuery = encodeURIComponent(query.query)
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const minPrice = query.minPrice ?? 'null'
  const maxPrice = query.maxPrice ?? 'null'
  const minRating = query.minRating ?? 'null'
  const categoryId = query.categoryId ?? 'null'
  const sortBy = query.sortBy ?? 'rating'

  return `products:search:${searchQuery}:${page}:${limit}:${minPrice}:${maxPrice}:${minRating}:${categoryId}:${sortBy}`
}

/**
 * Generates a cache key for products by category queries.
 * 
 * Key format: `products:category:{categoryId}:{page}:{limit}:{minPrice}:{maxPrice}:{minRating}:{sortBy}`
 * 
 * @param categoryId - Category ID
 * @param query - Product listing query parameters
 * @returns Cache key string
 */
export function generateProductCategoryCacheKey(categoryId: string, query: ProductListQuery): string {
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const minPrice = query.minPrice ?? 'null'
  const maxPrice = query.maxPrice ?? 'null'
  const minRating = query.minRating ?? 'null'
  const sortBy = query.sortBy ?? 'rating'

  return `products:category:${categoryId}:${page}:${limit}:${minPrice}:${maxPrice}:${minRating}:${sortBy}`
}

/**
 * Generates a cache key for product detail queries.
 * 
 * Key format: `products:detail:{productId}`
 * 
 * @param productId - Product ID
 * @returns Cache key string
 */
export function generateProductDetailCacheKey(productId: string): string {
  return `products:detail:${productId}`
}

/**
 * Generates a pattern for invalidating all product listing cache entries.
 * 
 * Pattern: `products:list:*`
 * 
 * @returns Cache key pattern
 */
export function getProductListCachePattern(): string {
  return 'products:list:*'
}

/**
 * Generates a pattern for invalidating all product search cache entries.
 * 
 * Pattern: `products:search:*`
 * 
 * @returns Cache key pattern
 */
export function getProductSearchCachePattern(): string {
  return 'products:search:*'
}

/**
 * Generates a pattern for invalidating all product category cache entries.
 * 
 * Pattern: `products:category:*`
 * 
 * @returns Cache key pattern
 */
export function getProductCategoryCachePattern(): string {
  return 'products:category:*'
}

/**
 * Generates a pattern for invalidating all product detail cache entries.
 * 
 * Pattern: `products:detail:*`
 * 
 * @returns Cache key pattern
 */
export function getProductDetailCachePattern(): string {
  return 'products:detail:*'
}

/**
 * Generates a pattern for invalidating all product-related cache entries.
 * 
 * Pattern: `products:*`
 * 
 * @returns Cache key pattern
 */
export function getAllProductsCachePattern(): string {
  return 'products:*'
}
