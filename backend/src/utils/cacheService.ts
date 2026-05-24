/**
 * Cache service for managing product listing cache operations.
 * 
 * Provides utilities for:
 * - Getting cached data with automatic JSON parsing
 * - Setting cached data with automatic JSON serialization
 * - Invalidating cache entries by pattern
 * - Handling cache errors gracefully
 */

import { cacheGet, cacheSet, cacheDel, getRedisClient } from '../config/redis'
import { logger } from './logger'

const PRODUCT_CACHE_TTL = 5 * 60 // 5 minutes in seconds

/**
 * Gets a cached value and automatically parses it as JSON.
 * 
 * If the cache key doesn't exist or Redis is unavailable, returns null.
 * Errors are logged but don't throw — cache failures are non-critical.
 * 
 * @param key - Cache key
 * @returns Parsed JSON object or null if not found
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const cached = await cacheGet(key)
    if (!cached) {
      return null
    }
    return JSON.parse(cached) as T
  } catch (err) {
    logger.warn(`Cache get failed for key ${key}:`, err)
    return null
  }
}

/**
 * Sets a cached value with automatic JSON serialization.
 * 
 * Uses the default product cache TTL (5 minutes).
 * Errors are logged but don't throw — cache failures are non-critical.
 * 
 * @param key - Cache key
 * @param value - Value to cache (will be JSON serialized)
 */
export async function setCachedData<T>(key: string, value: T): Promise<void> {
  try {
    const serialized = JSON.stringify(value)
    await cacheSet(key, serialized, PRODUCT_CACHE_TTL)
  } catch (err) {
    logger.warn(`Cache set failed for key ${key}:`, err)
  }
}

/**
 * Invalidates cache entries matching a pattern.
 * 
 * Uses Redis SCAN command to find keys matching the pattern,
 * then deletes them in batches to avoid blocking Redis.
 * 
 * Errors are logged but don't throw — cache failures are non-critical.
 * 
 * @param pattern - Cache key pattern (e.g., 'products:list:*')
 */
export async function invalidateCacheByPattern(pattern: string): Promise<void> {
  try {
    const client = getRedisClient()
    
    // Use SCAN to find keys matching the pattern
    let cursor = 0
    let keysToDelete: string[] = []
    
    do {
      const result = await client.scan(cursor, {
        MATCH: pattern,
        COUNT: 100, // Scan 100 keys at a time
      })
      
      cursor = result.cursor
      keysToDelete = keysToDelete.concat(result.keys)
    } while (cursor !== 0)
    
    // Delete keys in batches
    if (keysToDelete.length > 0) {
      const batchSize = 100
      for (let i = 0; i < keysToDelete.length; i += batchSize) {
        const batch = keysToDelete.slice(i, i + batchSize)
        await client.del(batch)
      }
      logger.info(`Invalidated ${keysToDelete.length} cache entries matching pattern: ${pattern}`)
    }
  } catch (err) {
    logger.warn(`Cache invalidation failed for pattern ${pattern}:`, err)
  }
}

/**
 * Invalidates a single cache entry.
 * 
 * Errors are logged but don't throw — cache failures are non-critical.
 * 
 * @param key - Cache key to invalidate
 */
export async function invalidateCacheKey(key: string): Promise<void> {
  try {
    await cacheDel(key)
    logger.debug(`Invalidated cache key: ${key}`)
  } catch (err) {
    logger.warn(`Cache invalidation failed for key ${key}:`, err)
  }
}

/**
 * Invalidates multiple cache keys.
 * 
 * Deletes keys in batches to avoid overwhelming Redis.
 * Errors are logged but don't throw — cache failures are non-critical.
 * 
 * @param keys - Array of cache keys to invalidate
 */
export async function invalidateCacheKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return
  }
  
  try {
    const client = getRedisClient()
    const batchSize = 100
    
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize)
      await client.del(batch)
    }
    
    logger.debug(`Invalidated ${keys.length} cache keys`)
  } catch (err) {
    logger.warn(`Cache invalidation failed for multiple keys:`, err)
  }
}
