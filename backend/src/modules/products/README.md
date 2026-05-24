# Products Module

## Overview

The Products module provides the `GET /api/products` endpoint for retrieving a paginated list of products with advanced filtering and sorting capabilities.

## Features

### Pagination
- **page**: Current page number (default: 1, min: 1)
- **limit**: Items per page (default: 20, max: 100)
- Returns pagination metadata including total count and number of pages

### Filtering

#### Price Range Filter
- **minPrice**: Minimum product price in BDT (default: 0)
- **maxPrice**: Maximum product price in BDT
- Validates that minPrice ≤ maxPrice

#### Rating Filter
- **minRating**: Minimum average rating (0-5)
- Returns only products with averageRating ≥ minRating

#### Category Filter
- **categoryId**: MongoDB ObjectId of a category
- Automatically includes products from all descendant categories (subcategories)
- Handles invalid or malformed IDs gracefully by returning empty results

### Sorting
- **sortBy**: Sort order for results
  - `price_asc`: Sort by price ascending
  - `price_desc`: Sort by price descending
  - `rating`: Sort by average rating descending (default)
  - `newest`: Sort by creation date descending

### Filter Combination
All filters use AND logic - products must match ALL specified criteria to be included in results.

## API Endpoint

### GET /api/products

**Query Parameters:**
```
GET /api/products?page=1&limit=20&minPrice=100&maxPrice=5000&minRating=3.5&categoryId=<id>&sortBy=rating
```

**Response:**
```json
{
  "products": [
    {
      "_id": "...",
      "name": "Product Name",
      "price": 1000,
      "images": [
        {
          "url": "https://example.com/image.jpg",
          "thumbnail": "...",
          "mobile": "...",
          "alt": "Product image"
        }
      ],
      "averageRating": 4.5,
      "reviewCount": 150,
      "category": "...",
      "slug": "product-name"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

## Implementation Details

### Service Layer (`product.service.ts`)

The `getProductList` function handles all business logic:

1. **Pagination**: Validates and normalizes page/limit parameters
2. **Filter Building**: Constructs MongoDB query filters for:
   - Active products only (isActive: true)
   - Price range
   - Rating threshold
   - Category and descendants
3. **Sorting**: Applies appropriate sort order
4. **Database Query**: Executes optimized MongoDB query with:
   - Lean queries for performance
   - Field selection to minimize data transfer
   - Pagination with skip/limit
5. **Response**: Returns products and pagination metadata

### Controller Layer (`product.controller.ts`)

The `getProductsHandler` function:

1. **Parameter Validation**: Validates and parses all query parameters
2. **Error Handling**: Returns 400 Bad Request for invalid inputs
3. **Service Invocation**: Calls the service layer
4. **Response**: Returns 200 with JSON response

### Routes (`product.routes.ts`)

Registers the GET /api/products endpoint as a public route (no authentication required).

## Database Indexes

The Product model includes the following indexes to optimize queries:

- `slug` (unique)
- `category` (for category filtering)
- `averageRating` (for rating sorting)
- `price` (for price sorting)
- `isActive` (for filtering active products)
- Compound indexes for common query patterns:
  - `(category, isActive)`
  - `(category, price)`
  - `(category, averageRating)`
  - `(isActive, isFeatured)`
  - `(isActive, createdAt)`
  - `(isActive, averageRating)`
  - `(isActive, price)`

## Testing

### Integration Tests (`product.integration.test.ts`)

Comprehensive integration tests covering:
- Basic listing and pagination
- Price filtering (min, max, range)
- Rating filtering
- Category filtering (including subcategories)
- Sorting (price asc/desc, rating, newest)
- Combined filters with AND logic
- Edge cases (invalid parameters, empty results, etc.)

**Test Coverage**: 41 test cases

### Unit Tests (`product.service.test.ts`)

Unit tests for the service layer covering:
- Basic functionality
- Pagination logic
- Price filtering
- Rating filtering
- Category filtering
- Sorting
- Combined filters
- Edge cases

**Test Coverage**: 30 test cases

## Performance Considerations

1. **Lean Queries**: Uses `.lean()` for read-only queries to reduce memory usage
2. **Field Selection**: Only selects necessary fields to minimize data transfer
3. **Pagination**: Limits result set size with skip/limit
4. **Indexes**: Optimized indexes on frequently queried fields
5. **Category Descendants**: Efficiently finds all descendant categories recursively

## Error Handling

- **400 Bad Request**: Invalid query parameters (non-numeric page/limit, invalid sortBy, etc.)
- **200 OK with empty results**: Invalid category ID or no products match filters
- **500 Internal Server Error**: Database connection failures (handled by global error handler)

## Requirements Mapping

This implementation satisfies the following requirements:

- **Requirement 5.1**: Return products with name, price, primary image, rating, category
- **Requirement 5.2**: Support pagination with configurable page size (default 20)
- **Requirement 6.2**: Filter by price range
- **Requirement 6.3**: Filter by category (including subcategories)
- **Requirement 6.4**: Filter by rating
- **Requirement 6.5**: Support multiple filters with AND logic
- **Requirement 6.6**: Support sorting by price, rating, newest
- **Requirement 29.3**: Implement pagination for all list endpoints
- **Requirement 29.5**: Respond to product listing requests within 200ms at 95th percentile

## Future Enhancements

1. **Caching**: Implement Redis caching for frequently accessed product lists
2. **Search**: Add full-text search capability
3. **Faceted Search**: Return available filter options (price ranges, categories, ratings)
4. **Recommendations**: Add "related products" or "recommended products" section
5. **Inventory Status**: Include stock availability in response
