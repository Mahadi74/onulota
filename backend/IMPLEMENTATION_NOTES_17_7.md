# Implementation Notes: Task 17.7 - Mark Out-of-Stock Cart Items as Unavailable

## Overview
Implemented cart item availability checking on cart retrieval. Items are now marked with `isAvailable` and `unavailableReason` fields to indicate their stock status without removing them from the cart.

## Changes Made

### 1. Updated `ICartResponse` Interface (cart.service.ts)
- Added `isAvailable: boolean` field to each cart item
- Added `unavailableReason: string | null` field to each cart item
- Response format now includes availability status for each item

### 2. Added `checkItemAvailability()` Function (cart.service.ts)
- Async function that fetches fresh product data to ensure latest stock/status
- Checks four availability conditions:
  1. **Product Active**: Returns "Product is no longer available" if `isActive: false`
  2. **Product Stock**: Returns "Insufficient stock available" if stock is 0 or quantity exceeds stock
  3. **Variant Stock**: Returns "Variant out of stock" if variant stock is 0
  4. **Variant Quantity**: Returns "Insufficient stock available" if quantity exceeds variant stock
- Returns object with `isAvailable` boolean and `unavailableReason` string or null

### 3. Updated `formatCartResponse()` Function (cart.service.ts)
- Made function async to support availability checking
- Uses `Promise.all()` to check availability for all items in parallel
- Calls `checkItemAvailability()` for each cart item
- Includes `isAvailable` and `unavailableReason` in response items

### 4. Updated All Cart Service Functions
- Modified `getUserCart()` to await `formatCartResponse()`
- Modified `getGuestCart()` to await `formatCartResponse()`
- Modified `addItemToCart()` to await `formatCartResponse()`
- Modified `updateCartItemQuantity()` to await `formatCartResponse()`
- Modified `removeItemFromCart()` to await `formatCartResponse()`
- Modified `clearCart()` to await `formatCartResponse()`
- Modified `mergeGuestCartWithUserCart()` to await `formatCartResponse()`
- Updated all populate calls to include `isActive` and `variants` fields

### 5. Created Comprehensive Integration Tests (cartAvailability.integration.test.ts)
- **21 test cases** covering all availability scenarios:
  - Product inactive tests (2 tests)
  - Product stock zero tests (2 tests)
  - Variant stock tests (2 tests)
  - Available items tests (3 tests)
  - Mixed availability tests (2 tests)
  - Guest cart availability tests (2 tests)
  - Unavailable items not removed tests (2 tests)
  - Response format tests (3 tests)
  - Edge cases tests (3 tests)

## Key Features

### Availability Check Logic
```
For each cart item:
1. Fetch fresh product data from database
2. Check if product is active
   - If not: unavailable ("Product is no longer available")
3. Check stock availability
   - For variant items: check variant stock
     - If stock = 0: unavailable ("Variant out of stock")
     - If quantity > stock: unavailable ("Insufficient stock available")
   - For non-variant items: check product stock
     - If stock = 0: unavailable ("Insufficient stock available")
     - If quantity > stock: unavailable ("Insufficient stock available")
4. If all checks pass: available (isAvailable: true, unavailableReason: null)
```

### Important Behaviors
- **Items NOT Removed**: Unavailable items remain in cart for user awareness
- **Fresh Data**: Availability is checked on every cart retrieval using fresh product data
- **Real-time Updates**: Stock changes are reflected immediately on next cart retrieval
- **Parallel Checking**: All items checked in parallel using `Promise.all()`
- **Backward Compatible**: Existing cart operations (add, update, remove) unchanged

## Response Format Example

### Available Item
```json
{
  "_id": "item-id",
  "product": {
    "_id": "product-id",
    "name": "Product Name",
    "price": 100,
    "stock": 10
  },
  "quantity": 2,
  "price": 100,
  "subtotal": 200,
  "isAvailable": true,
  "unavailableReason": null
}
```

### Unavailable Item (Product Inactive)
```json
{
  "_id": "item-id",
  "product": {
    "_id": "product-id",
    "name": "Product Name",
    "price": 100,
    "stock": 0
  },
  "quantity": 2,
  "price": 100,
  "subtotal": 200,
  "isAvailable": false,
  "unavailableReason": "Product is no longer available"
}
```

### Unavailable Item (Insufficient Stock)
```json
{
  "_id": "item-id",
  "product": {
    "_id": "product-id",
    "name": "Product Name",
    "price": 100,
    "stock": 1
  },
  "quantity": 5,
  "price": 100,
  "subtotal": 500,
  "isAvailable": false,
  "unavailableReason": "Insufficient stock available"
}
```

## Test Results
- **Total Tests**: 21 new tests + 165 existing tests = 186 total
- **All Tests Passing**: ✓ 186/186 tests pass
- **Test Coverage**:
  - Product inactive scenarios
  - Stock zero scenarios
  - Variant stock scenarios
  - Quantity exceeds stock scenarios
  - Mixed availability scenarios
  - Guest cart scenarios
  - Response format validation
  - Edge cases (empty cart, multiple variants, stock changes)

## Files Modified
1. `/Users/expert/projects/game/ruposhi/backend/src/modules/cart/cart.service.ts`
   - Updated `ICartResponse` interface
   - Added `checkItemAvailability()` function
   - Updated `formatCartResponse()` to be async
   - Updated all service functions to await `formatCartResponse()`

## Files Created
1. `/Users/expert/projects/game/ruposhi/backend/src/modules/cart/__tests__/cartAvailability.integration.test.ts`
   - 21 comprehensive integration tests

## Performance Considerations
- **Database Queries**: One fresh product fetch per item on cart retrieval
- **Parallel Processing**: All availability checks run in parallel using `Promise.all()`
- **Caching**: Product data is populated once, then fresh data fetched for availability checks
- **Scalability**: Efficient for typical cart sizes (5-20 items)

## Backward Compatibility
- ✓ Existing cart endpoints work unchanged
- ✓ New fields are additive (no breaking changes)
- ✓ All existing tests pass (165/165)
- ✓ Cart operations (add, update, remove) unchanged

## Future Enhancements
- Could add caching layer for product availability checks
- Could add batch availability check endpoint
- Could add webhook notifications for stock changes
- Could add inventory reservation system
