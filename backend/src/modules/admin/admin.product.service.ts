/**
 * Admin product service for managing products and invalidating caches.
 * 
 * Handles:
 * - Product creation, update, and deletion
 * - Cache invalidation on product changes
 * - Category cache invalidation when products are modified
 */

import { Product } from '../../models/Product'
import { Category } from '../../models/Category'
import { Types } from 'mongoose'
import { logger } from '../../utils/logger'
import { invalidateCacheByPattern } from '../../utils/cacheService'
import {
  getProductListCachePattern,
  getProductSearchCachePattern,
  getProductCategoryCachePattern,
  getProductDetailCachePattern,
  getAllProductsCachePattern,
} from '../../utils/cacheKeys'

/**
 * Invalidates all product-related caches.
 * 
 * Called when:
 * - A product is created, updated, or deleted
 * - A category is updated (affects category-based queries)
 * 
 * Invalidates:
 * - Product listing cache (all pages, filters, sorts)
 * - Product search cache (all queries)
 * - Product category cache (all categories)
 * - Product detail cache (all products)
 */
export async function invalidateAllProductCaches(): Promise<void> {
  logger.info('Invalidating all product caches')
  
  // Invalidate all product-related caches in parallel
  await Promise.all([
    invalidateCacheByPattern(getProductListCachePattern()),
    invalidateCacheByPattern(getProductSearchCachePattern()),
    invalidateCacheByPattern(getProductCategoryCachePattern()),
    invalidateCacheByPattern(getProductDetailCachePattern()),
  ])
}

/**
 * Invalidates caches for a specific product.
 * 
 * Called when a product detail is updated.
 * 
 * Invalidates:
 * - Product detail cache for this product
 * - All product listing caches (since product data may have changed)
 * - All product search caches (since product data may have changed)
 * - All category caches (since product may have changed category)
 * 
 * @param productId - Product ID
 */
export async function invalidateProductCaches(productId: string): Promise<void> {
  logger.info(`Invalidating caches for product: ${productId}`)
  
  // Invalidate all product-related caches
  await invalidateAllProductCaches()
}

/**
 * Invalidates caches for a specific category.
 * 
 * Called when a category is updated.
 * 
 * Invalidates:
 * - All product listing caches (category filter may be affected)
 * - All product category caches (category data changed)
 * - All product search caches (category filter may be affected)
 * 
 * @param categoryId - Category ID
 */
export async function invalidateCategoryCaches(categoryId: string): Promise<void> {
  logger.info(`Invalidating caches for category: ${categoryId}`)
  
  // Invalidate all product-related caches since category changes affect product queries
  await invalidateAllProductCaches()
}
