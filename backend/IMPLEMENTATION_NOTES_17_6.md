# Implementation Notes: Task 17.6 - POST /api/cart/merge

## Overview
Implemented the cart merge endpoint that allows authenticated users to merge their guest localStorage cart with their user database cart. When items exist in both carts, the higher quantity is preferred.

## Changes Made

### 1. Service Layer (`cart.service.ts`)
Added `mergeGuestCartWithUserCart()` function that:
- Finds the guest cart by session ID
- Finds or creates the user's cart
- Merges items from guest cart into user cart:
  - For items only in guest cart: adds them to user cart
  - For items in both carts: uses the higher quantity
  - Updates price to the latest value when preferring higher quantity
- Deletes the guest cart after successful merge
- Returns the merged cart with recalculated totals

**Key Logic:**
```typescript
if (existingUserItem) {
  // Item exists in both carts - prefer higher quantity
  if (guestItem.quantity > existingUserItem.quantity) {
    existingUserItem.quantity = guestItem.quantity
    existingUserItem.price = guestItem.price // Update to latest price
    existingUserItem.addedAt = guestItem.addedAt
  }
} else {
  // Item only in guest cart - add to user cart
  userCart.items.push({...})
}
```

### 2. Controller Layer (`cart.controller.ts`)
Added `mergeCart()` controller that:
- Validates user is authenticated (401 if not)
- Validates sessionId is provided (400 if not)
- Calls the service function
- Returns the merged cart with 200 status

### 3. Routes (`cart.routes.ts`)
Added POST route `/api/cart/merge` that:
- Requires authentication (uses `authenticateToken` middleware)
- Validates request body with Joi schema
- Calls the merge controller

**Route Definition:**
```typescript
router.post(
  '/merge',
  authRequired,
  validateBody(mergeCartSchema),
  mergeCart as express.RequestHandler
)
```

### 4. Integration Tests (`mergeCart.integration.test.ts`)
Created comprehensive test suite with 21 test cases covering:

#### Authentication Tests (3 tests)
- Returns 401 when user is not authenticated
- Returns 400 when sessionId is missing
- Returns 400 when sessionId is empty string

#### Basic Merge Operations (2 tests)
- Merges guest cart with empty user cart
- Merges guest cart with existing user cart

#### Quantity Preference Tests (3 tests)
- Prefers higher quantity from guest cart
- Keeps user cart quantity when it's higher
- Handles equal quantities correctly

#### Multiple Items Tests (1 test)
- Merges multiple items with mixed scenarios (some only in user, some only in guest, some in both)

#### Guest Cart Cleanup Tests (2 tests)
- Deletes guest cart after successful merge
- Guest cart cannot be accessed after merge

#### Error Cases Tests (2 tests)
- Returns 404 when guest cart does not exist
- Returns 200 with empty items when guest cart is empty

#### Variant Handling Tests (2 tests)
- Correctly merges items with variants
- Treats base product and variant as different items

#### Cart Calculations Tests (2 tests)
- Correctly recalculates totals after merge
- Applies free shipping when merged cart subtotal >= 500

#### Price Updates Tests (1 test)
- Updates price to latest when preferring higher quantity

#### Edge Cases Tests (3 tests)
- Handles merge with large quantities (500 items)
- Handles merge with decimal prices
- Handles merge when user has no existing cart

## Test Results
All 21 tests pass successfully:
```
Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total
```

All existing cart tests (165 tests across 8 test files) continue to pass, confirming no regressions.

## API Endpoint

### POST /api/cart/merge

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "sessionId": "string (required)"
}
```

**Success Response (200):**
```json
{
  "_id": "string",
  "items": [
    {
      "_id": "string",
      "product": {
        "_id": "string",
        "name": "string",
        "price": "number",
        "stock": "number"
      },
      "quantity": "number",
      "price": "number",
      "subtotal": "number"
    }
  ],
  "subtotal": "number",
  "tax": "number",
  "shippingCost": "number",
  "total": "number",
  "totalItems": "number"
}
```

**Error Responses:**
- 401: User not authenticated
- 400: Missing or invalid sessionId
- 404: Guest cart not found

## Merge Logic Details

### Quantity Preference
When an item exists in both carts, the merge logic compares quantities:
- If guest quantity > user quantity: use guest quantity
- If user quantity >= guest quantity: keep user quantity
- Updates price to the latest value from the guest cart

### Item Identification
Items are identified by:
- Product ID
- Variant ID (if applicable)

Base product and variants are treated as separate items.

### Cart Cleanup
After successful merge:
- Guest cart is deleted from database
- Guest cart cannot be accessed via GET /api/cart?sessionId=...
- User cart contains all merged items

### Calculations
After merge, cart totals are recalculated:
- Subtotal: sum of all item prices × quantities
- Tax: 5% of subtotal
- Shipping: 50 BDT (or free if subtotal >= 500 BDT)
- Total: subtotal + tax + shipping

## Frontend Integration

The frontend should call this endpoint after user login:
1. User logs in
2. Frontend has guest cart in localStorage with sessionId
3. Frontend calls POST /api/cart/merge with sessionId
4. Backend merges carts and returns merged result
5. Frontend updates local cart state with merged result
6. Frontend clears guest cart from localStorage

## Compliance with Requirements

✅ Implement POST /api/cart/merge endpoint
✅ Merge guest cart (from localStorage/sessionId) with authenticated user's cart
✅ For items that exist in both carts, prefer the higher quantity
✅ Support both authenticated users and guests (merge endpoint requires auth)
✅ Return merged cart with recalculated totals
✅ Validate that both carts exist before merging
✅ Handle error cases appropriately (user not authenticated, etc.)
✅ Include comprehensive integration tests covering all scenarios
✅ Add `mergeGuestCartWithUserCart()` function to cart.service.ts
✅ Add `mergeCart()` controller to cart.controller.ts
✅ Add POST route with validation to cart.routes.ts
✅ Create integration tests in cart/__tests__/mergeCart.integration.test.ts
✅ All tests pass
