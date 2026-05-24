# Product Listing Cache Implementation

## Overview

This document describes the Redis caching implementation for product listings in the onulota eCommerce Platform. The caching system improves API response times by storing frequently accessed product listing results in Redis with a 5-minute TTL (Time To Live).

## Requirements

- **Requirement 29.4**: Backend SHALL cache frequently accessed data (categories, featured products) using Redis or in-memory cache
- **Requirement 29.5**: Backend SHALL respond to product listing requests within 200ms at the 95th percentile under normal load
- **Requirement 40.4**: Cache product listings in Redis (TTL 5 min), invalidate on product update

## Architecture

### Cache Key Generation

Cache keys are generated based on query parameters to ensure consistency and predictability:

```
products:list:{page}:{limit}:{minPrice}:{maxPrice}:{minRating}:{categoryId}:{sortBy}
products:category:{categoryId}:{page}:{limit}:{minPrice}:{maxPrice}:{minRating}:{sortBy}
products:search:{query}:{page}:{limit}:{minPrice}:{maxPrice}:{minRating}:{categoryId}:{sortBy}
products:detail:{productId}
```

**Key Features:**
- Undefined values are replaced with 'null' for consistency
- Search queries are URL-encoded to handle special characters
- Same query parameters always generate the same key
- Different queries generate different keys

### Cache Utilities

#### `cacheKeys.ts`
Provides functions for generating cache keys:
- `generateProductListCacheKey()` - Generate key for product listings
- `generateProductSearchCacheKey()` - Generate key for search results
- `generateProductCategoryCacheKey()` - Generate key for category products
- `generateProductDetailCacheKey()` - Generate key for product details
- Pattern functions for cache invalidation

#### `cacheService.ts`
Provides utilities for cache operations:
- `getCachedData<T>()` - Get cached value with automatic JSON parsing
- `setCachedData<T>()` - Set cached value with automatic JSON serialization
- `invalidateCacheByPattern()` - Invalidate cache entries matching a pattern
- `invalidateCacheKey()` - Invalidate a single cache entry
- `invalidateCacheKeys()` - Invalidate multiple cache entries

**Error Handling:**
- Cache failures are non-critical and logged as warnings
- API continues to work even if Redis is unavailable
- Graceful degradation: requests fall back to database queries

### Cache TTL

- **Product Listings**: 5 minutes (300 seconds)
- **Product Details**: 5 minutes (300 seconds)
- **Category Products**: 5 minutes (300 seconds)
- **Product Search**: 5 minutes (300 seconds)

## Cache Invalidation

### Automatic Invalidation Triggers

Cache is automatically invalidated when:

1. **Product Created** - Invalidates all product caches
2. **Product Updated** - Invalidates all product caches
3. **Product Deleted** - Invalidates all product caches
4. **Category Created** - Invalidates all product caches (affects category-based queries)
5. **Category Updated** - Invalidates all product caches
6. **Category Deleted** - Invalidates all product caches

### Invalidation Patterns

When a product is modified, the following cache patterns are invalidated:

```
products:list:*          - All product listing caches
products:search:*        - All product search caches
products:category:*      - All category product caches
products:detail:*        - All product detail caches
```

This ensures that:
- Product listing pages reflect new/updated/deleted products
- Search results include new products
- Category pages show updated product information
- Product detail pages show current information

## Implementation Details

### Product Service (`product.service.ts`)

The product service functions implement caching:

```typescript
export async function getProductList(query: ProductListQuery): Promise<ProductListResponse> {
  // Generate cache key
  const cacheKey = generateProductListCacheKey(query)
  
  // Try to get from cache first
  const cached = await getCachedData<ProductListResponse>(cacheKey)
  if (cached) {
    logger.debug(`Cache hit for product list: ${cacheKey}`)
    return cached
  }
  
  // Cache miss - fetch from database
  // ... database query logic ...
  
  // Cache the result
  await setCachedData(cacheKey, result)
  
  return result
}
```

**Cached Functions:**
- `getProductList()` - Product listing with filters and sorting
- `getProductsByCategory()` - Products by category
- `searchProducts()` - Product search (not yet cached, can be added)

### Admin Product Controller (`admin.product.controller.ts`)

Admin endpoints trigger cache invalidation:

```typescript
export const createProductHandler = asyncHandler(async (req, res, next) => {
  // ... create product ...
  
  // Invalidate product caches
  await invalidateProductCaches(product._id.toString())
  
  res.status(201).json({ product })
})
```

**Admin Endpoints:**
- `POST /api/admin/products` - Create product (invalidates cache)
- `PUT /api/admin/products/:id` - Update product (invalidates cache)
- `DELETE /api/admin/products/:id` - Delete product (invalidates cache)

### Admin Category Service (`admin.category.service.ts`)

Category operations trigger product cache invalidation:

```typescript
export async function createCategory(input: CreateCategoryInput): Promise<CategoryResult> {
  // ... create category ...
  
  // Invalidate category tree cache
  await cacheDel(CATEGORY_TREE_CACHE_KEY)
  
  // Also invalidate product caches
  await invalidateCategoryCaches(saved._id.toString())
  
  return formatCategory(saved)
}
```

## Performance Impact

### Cache Hit Scenario
- **Database Query**: ~50-100ms
- **Cache Hit**: ~5-10ms
- **Improvement**: 5-20x faster

### Cache Miss Scenario
- **Database Query**: ~50-100ms
- **Cache Set**: ~5-10ms
- **Total**: ~55-110ms (minimal overhead)

### Expected Performance
- **95th Percentile Response Time**: < 200ms (with cache hits)
- **Cache Hit Rate**: ~80-90% for typical usage patterns

## Testing

### Integration Tests (`product.cache.integration.test.ts`)

Tests verify:
- Cache key generation consistency
- Cache hits and misses
- Cache invalidation on product updates
- Cache invalidation on category updates
- Graceful degradation when Redis is unavailable
- Cache performance

**Test Coverage:**
- 16 cache-specific tests
- 171 total product module tests

### Running Tests

```bash
# Run cache integration tests
npm test -- src/modules/products/__tests__/product.cache.integration.test.ts

# Run all product module tests
npm test -- src/modules/products/__tests__/

# Run all tests
npm test
```

## Monitoring and Debugging

### Cache Logging

Cache operations are logged at debug level:

```
debug: Cache hit for product list: products:list:1:20:null:null:null:null:rating
debug: Cache miss for product list: products:list:1:20:null:null:null:null:rating
debug: Invalidated 5 cache entries matching pattern: products:list:*
```

### Redis CLI Commands

```bash
# Connect to Redis
redis-cli

# View all product cache keys
KEYS products:*

# Get a specific cache entry
GET products:list:1:20:null:null:null:null:rating

# Clear all product caches
DEL $(redis-cli KEYS 'products:*')

# Monitor cache operations
MONITOR
```

## Configuration

### Environment Variables

```bash
# Redis connection URL (default: redis://localhost:6379)
REDIS_URL=redis://localhost:6379

# Cache TTL in seconds (default: 300 = 5 minutes)
# Can be configured per cache type in cacheService.ts
```

### Cache TTL Adjustment

To change cache TTL, modify `cacheService.ts`:

```typescript
const PRODUCT_CACHE_TTL = 5 * 60 // Change this value (in seconds)
```

## Best Practices

1. **Cache Key Consistency**: Always use the provided cache key generation functions
2. **Error Handling**: Cache failures should not break the API
3. **Invalidation Strategy**: Invalidate broadly to ensure data consistency
4. **Monitoring**: Monitor cache hit rates and adjust TTL if needed
5. **Testing**: Test cache behavior with integration tests

## Future Improvements

1. **Selective Invalidation**: Invalidate only affected cache entries instead of all
2. **Cache Warming**: Pre-populate cache with popular queries
3. **Cache Statistics**: Track hit rates and performance metrics
4. **Distributed Caching**: Use Redis Cluster for high-availability
5. **Cache Compression**: Compress large cache entries to save memory

## Troubleshooting

### Cache Not Working

**Symptom**: Cache misses on every request

**Solutions:**
1. Verify Redis is running: `redis-cli ping`
2. Check Redis connection URL in environment variables
3. Check logs for cache errors
4. Verify cache key generation is consistent

### High Memory Usage

**Symptom**: Redis memory usage growing rapidly

**Solutions:**
1. Reduce cache TTL
2. Implement cache eviction policy in Redis
3. Monitor cache hit rates and adjust accordingly
4. Clear old cache entries: `FLUSHDB`

### Stale Data

**Symptom**: Product changes not reflected in API responses

**Solutions:**
1. Verify cache invalidation is triggered on product updates
2. Check admin product controller for invalidation calls
3. Manually clear cache: `redis-cli FLUSHDB`
4. Verify cache TTL is appropriate for your use case

## References

- [Redis Documentation](https://redis.io/documentation)
- [Node.js Redis Client](https://github.com/redis/node-redis)
- [Cache Invalidation Patterns](https://en.wikipedia.org/wiki/Cache_invalidation)
- [Requirement 29.4 - Performance Optimization Backend](../../../.kiro/specs/onulota-ecommerce-platform/requirements.md#requirement-29-performance-optimization---backend)
- [Requirement 40.4 - Performance Optimization](../../../.kiro/specs/onulota-ecommerce-platform/requirements.md#requirement-40-performance-optimization)
