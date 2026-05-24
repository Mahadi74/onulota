# Data Models

This directory contains the Mongoose data models for the onulota eCommerce Platform.

## Cart Model

The Cart model (`Cart.ts`) implements the complete cart schema as specified in the design document with TTL index support.

### Features Implemented

#### Schema Fields
- **User Association**: `user` (ObjectId reference, optional for guest carts)
- **Session Management**: `sessionId` (for guest carts, mutually exclusive with user)
- **Cart Items**: Array of items with product references, variants, quantities, and price snapshots
- **TTL Support**: `expiresAt` field with TTL index (30 days default expiration)
- **Timestamps**: `createdAt`, `updatedAt` (automatic)

#### Cart Item Fields
- **Product Reference**: `product` (ObjectId reference to Product)
- **Variant Support**: `variant` (ObjectId, optional for product variants)
- **Quantity**: `quantity` (positive integer, minimum 1)
- **Price Snapshot**: `price` (snapshot at add time for price consistency)
- **Added Timestamp**: `addedAt` (when item was added to cart)

#### Indexes (as per design document)
- **Unique Sparse Indexes**: 
  - `user` (unique, sparse) - ensures one cart per user
  - `sessionId` (unique, sparse) - ensures one cart per session
- **TTL Index**: `expiresAt` (expireAfterSeconds: 0) - automatic cart cleanup
- **Performance Indexes**: 
  - `items.product` - for efficient product lookups
  - `updatedAt` - for recent cart queries

#### Validation Rules
- **Mutual Exclusivity**: Cart must have either `user` OR `sessionId`, not both
- **Required Fields**: Either `user` or `sessionId` must be provided
- **Item Validation**: Quantity must be positive integer, price must be non-negative
- **TTL Default**: Automatic 30-day expiration from creation

#### Virtual Properties
- `subtotal`: Calculated total price of all items (quantity × price)
- `totalItems`: Total number of items across all cart items

#### Instance Methods
- `addItem(productId, quantity, price, variantId?)`: Add item or update existing quantity
- `updateItemQuantity(itemId, quantity)`: Update specific item quantity (removes if 0)
- `removeItem(itemId)`: Remove specific item from cart
- `clearCart()`: Remove all items from cart
- `hasItem(productId, variantId?)`: Check if cart contains specific item
- `getItem(productId, variantId?)`: Get specific item from cart

#### Static Methods
- `findByUser(userId)`: Find cart by user ID
- `findBySession(sessionId)`: Find cart by session ID
- `createUserCart(userId)`: Create new user cart
- `createGuestCart(sessionId)`: Create new guest cart
- `mergeGuestCartToUser(guestCart, userId)`: Merge guest cart into user cart

#### Cart Merging Logic
When merging guest cart to user cart:
- **Higher Quantity Wins**: For duplicate items, keep the higher quantity
- **Price Updates**: Update to latest price when guest quantity is higher
- **New Items Added**: Items not in user cart are added from guest cart
- **Guest Cart Cleanup**: Guest cart is deleted after successful merge

### Usage Examples

```typescript
import { Cart } from './models'

// Create user cart
const userCart = await Cart.createUserCart(userId)

// Create guest cart
const guestCart = await Cart.createGuestCart('session-123')

// Add items to cart
await userCart.addItem(productId, 2, 99.99) // Simple product
await userCart.addItem(productId, 1, 149.99, variantId) // Product with variant

// Update item quantity
const itemId = userCart.items[0]._id
await userCart.updateItemQuantity(itemId, 5)

// Check cart contents
console.log(`Subtotal: $${userCart.subtotal}`)
console.log(`Total items: ${userCart.totalItems}`)

// Find carts
const foundUserCart = await Cart.findByUser(userId)
const foundGuestCart = await Cart.findBySession('session-123')

// Merge guest cart to user cart (on login)
const mergedCart = await Cart.mergeGuestCartToUser(guestCart, userId)
```

### TTL (Time To Live) Functionality

The Cart model implements MongoDB TTL indexing for automatic cart cleanup:

- **Default Expiration**: 30 days from cart creation
- **Automatic Cleanup**: MongoDB automatically removes expired carts
- **Custom Expiration**: Can be set manually when creating carts
- **Performance**: No manual cleanup jobs needed

### Testing

The Cart model includes comprehensive tests:
- **Unit Tests**: Field validation, business logic, virtual properties, instance methods
- **Integration Tests**: Real-world scenarios, product references, cart merging
- **TTL Testing**: Expiration date validation and functionality
- **Index Testing**: Unique constraints and performance indexes

Run tests with:
```bash
npm test -- --testPathPattern=Cart.test.ts
npm test -- --testPathPattern=Cart.integration.test.ts
```

## Product Model

The Product model (`Product.ts`) implements the complete product schema as specified in the design document.

### Features Implemented

#### Schema Fields
- **Basic Info**: name, slug, description, price, compareAtPrice
- **Categorization**: category (ObjectId reference), tags
- **Media**: images array with url, thumbnail, mobile, alt fields
- **Specifications**: key-value pairs for product specifications
- **Variants**: support for product variants with SKU, price, and stock
- **Inventory**: stock tracking for both simple and variant products
- **Reviews**: averageRating and reviewCount (calculated fields)
- **Status**: isActive, isFeatured flags
- **Timestamps**: createdAt, updatedAt (automatic)

#### Indexes (as per design document)
- **Text Indexes**: Combined text index on `name` and `description` for search functionality
- **Unique Index**: `slug` field for URL-friendly product identification
- **Single Field Indexes**: `category`, `averageRating`, `price`, `isActive`
- **Compound Indexes**: Multiple compound indexes for common query patterns:
  - `category + isActive`
  - `category + price`
  - `category + averageRating`
  - `isActive + isFeatured`
  - `isActive + createdAt`
  - `isActive + averageRating`
  - `isActive + price`

#### Virtual Properties
- `inStock`: Calculated property that checks if product has stock (considers variants)
- `totalStock`: Calculated total stock across all variants

#### Instance Methods
- `updateAverageRating(newRating, oldRating?)`: Updates product rating when reviews are added/modified
- `removeRating(rating)`: Updates product rating when reviews are deleted

#### Static Methods
- `findByCategory(categoryId)`: Finds active products by category
- `searchProducts(query, options?)`: Performs text search with scoring

#### Middleware
- **Pre-save**: Auto-generates URL-friendly slug from product name
- **Pre-validate**: Ensures slug is set and validates unique SKUs within variants

### Usage Examples

```typescript
import { Product } from './models'

// Create a simple product
const product = new Product({
  name: 'iPhone 15 Pro',
  description: 'Latest Apple smartphone with titanium design',
  price: 999.99,
  category: categoryId,
  images: [{
    url: 'https://example.com/iphone15.jpg',
    alt: 'iPhone 15 Pro'
  }],
  stock: 10
})

await product.save()

// Create a product with variants
const tshirt = new Product({
  name: 'Cotton T-Shirt',
  description: 'Comfortable cotton t-shirt',
  price: 29.99,
  category: categoryId,
  variants: [
    {
      name: 'Size: M, Color: Red',
      sku: 'TSHIRT-M-RED',
      price: 29.99,
      stock: 10
    },
    {
      name: 'Size: L, Color: Blue',
      sku: 'TSHIRT-L-BLUE',
      price: 29.99,
      stock: 5
    }
  ]
})

await tshirt.save()

// Search products
const results = await Product.searchProducts('smartphone')

// Find by category
const categoryProducts = await Product.findByCategory(categoryId)

// Update rating
await product.updateAverageRating(5) // New 5-star review
```

### Testing

The Product model includes comprehensive tests:
- **Unit Tests**: Field validation, slug generation, rating calculations
- **Integration Tests**: Database indexes, text search, uniqueness constraints
- **Test Coverage**: All methods, virtuals, and middleware

Run tests with:
```bash
npm test -- --testPathPattern=Product.test.ts
```

### Next Steps

The following models need to be implemented to complete the data layer:
- User model (task 9.1 - marked complete but file missing)
- Category model (task 9.3)
- ~~Cart model (task 9.4)~~ ✅ **COMPLETED**
- Order model (task 9.5)
- ~~Review model (task 9.6)~~ ✅ **COMPLETED**
- Coupon model (task 9.7)
- RefreshToken model (task 9.8)

## Review Model

The Review model (`Review.ts`) implements the complete review schema as specified in the design document with compound unique indexing.

### Features Implemented

#### Schema Fields
- **Product Association**: `product` (ObjectId reference to Product, required)
- **User Association**: `user` (ObjectId reference to User, required)
- **Order Association**: `order` (ObjectId reference to Order, required for verified purchases)
- **Rating**: `rating` (integer 1-5, required)
- **Comment**: `comment` (optional text, max 1000 characters, trimmed)
- **Verification**: `isVerifiedPurchase` (boolean, default true)
- **Timestamps**: `createdAt`, `updatedAt` (automatic)

#### Indexes (as per design document)
- **Single Field Indexes**: 
  - `product` - for efficient product review queries
  - `user` - for user review history
  - `createdAt` (descending) - for chronological sorting
- **Compound Unique Index**: `(product, user)` - ensures one review per user per product
- **Additional Compound Indexes**:
  - `product + createdAt` - for paginated product reviews
  - `user + createdAt` - for user review history
  - `product + rating` - for rating-based filtering
  - `isVerifiedPurchase + product` - for verified review filtering

#### Validation Rules
- **Rating Validation**: Must be integer between 1-5 (inclusive)
- **Comment Validation**: Optional, max 1000 characters, automatically trimmed
- **Required Fields**: product, user, order, rating must be provided
- **Unique Constraint**: One review per user per product (compound unique index)
- **ObjectId Validation**: All reference fields validated as proper ObjectIds

#### Instance Methods
- `updateProductRating(oldRating?)`: Updates associated product's average rating and review count
- `removeFromProductRating()`: Removes this review's rating from product calculations

#### Static Methods
- `findByProduct(productId, options?)`: Find reviews for a product with pagination and filtering
  - Supports pagination (`page`, `limit`)
  - Supports sorting (`sortBy`, `sortOrder`)
  - Supports verified-only filtering (`verifiedOnly`)
  - Auto-populates user data (except in test environment)
- `findByUser(userId)`: Find all reviews by a user (sorted by newest first)
- `getProductReviewStats(productId)`: Calculate average rating and review count for a product
- `hasUserReviewedProduct(userId, productId)`: Check if user has already reviewed a product

#### Middleware
- **Pre-validate**: Trims comments and sets empty strings to undefined
- **Pre-save**: Automatically updates product rating when review is created or modified
- **Pre-remove**: Automatically updates product rating when review is deleted

#### Product Rating Integration
The Review model automatically maintains product rating consistency:
- **New Review**: Adds rating to product's average and increments review count
- **Updated Review**: Replaces old rating with new rating in product's average
- **Deleted Review**: Removes rating from product's average and decrements count
- **Precision**: All averages rounded to 2 decimal places
- **Edge Cases**: Handles last review deletion (resets to 0 rating, 0 count)

### Usage Examples

```typescript
import { Review } from './models'

// Create a new review
const review = new Review({
  product: productId,
  user: userId,
  order: orderId,
  rating: 5,
  comment: 'Excellent product! Highly recommended.',
  isVerifiedPurchase: true
})

await review.save() // Automatically updates product rating

// Find reviews for a product (paginated)
const reviews = await Review.findByProduct(productId, {
  page: 1,
  limit: 10,
  verifiedOnly: true
})

// Find all reviews by a user
const userReviews = await Review.findByUser(userId)

// Get product review statistics
const stats = await Review.getProductReviewStats(productId)
console.log(`Average: ${stats.averageRating}, Count: ${stats.reviewCount}`)

// Check if user already reviewed product
const hasReviewed = await Review.hasUserReviewedProduct(userId, productId)

// Update a review
review.rating = 4
review.comment = 'Updated my review after more use'
await review.save() // Automatically updates product rating

// Delete a review
await review.deleteOne() // Automatically updates product rating
```

### Unique Constraint Enforcement

The compound unique index `(product, user)` ensures business rule compliance:
- **One Review Per User Per Product**: Prevents duplicate reviews
- **Database-Level Enforcement**: Constraint enforced at MongoDB level
- **Error Handling**: Duplicate attempts throw `duplicate key error`
- **Cross-Order Reviews**: Same user can review same product from different orders (uses most recent order)

### Product Rating Synchronization

The Review model maintains real-time synchronization with Product ratings:

```typescript
// Product rating is automatically updated when:

// 1. New review is created
const review = await Review.create({
  product: productId,
  user: userId,
  order: orderId,
  rating: 4
})
// Product.averageRating and Product.reviewCount are updated

// 2. Review rating is modified
review.rating = 5
await review.save()
// Product.averageRating is recalculated with new rating

// 3. Review is deleted
await review.deleteOne()
// Product.averageRating and Product.reviewCount are updated
```

### Testing

The Review model includes comprehensive test coverage:

#### Unit Tests (`Review.test.ts`)
- **Schema Validation**: All field validation rules
- **Rating Validation**: 1-5 integer constraint testing
- **Comment Validation**: Length limits, trimming, empty string handling
- **Unique Constraint**: One review per user per product enforcement
- **Static Methods**: All query methods with various scenarios
- **Index Verification**: Confirms all required indexes exist

#### Integration Tests (`Review.integration.test.ts`)
- **Product Rating Updates**: Real-time product rating synchronization
- **Sequential Operations**: Multi-review scenarios with correct calculations
- **Review Modification**: Rating updates and their effect on products
- **Review Deletion**: Proper cleanup and product rating adjustments
- **Statistics Accuracy**: Verification that stats match product fields
- **Error Handling**: Graceful handling of missing products in test environment

Run tests with:
```bash
npm test -- --testPathPattern=Review.test.ts        # Unit tests
npm test -- --testPathPattern=Review.integration    # Integration tests
npm test -- --testPathPattern=Review                # All Review tests
```

### Performance Considerations

- **Efficient Queries**: All common query patterns have supporting indexes
- **Pagination Support**: Built-in pagination prevents large result sets
- **Selective Population**: User data population disabled in test environment
- **Atomic Updates**: Product rating updates are atomic operations
- **Index Optimization**: Compound indexes support multiple query patterns