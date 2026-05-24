# End-to-End Testing Guide - Phase 39

## Overview

This document describes the comprehensive E2E testing suite for the onulota eCommerce Platform using Playwright. The test suite covers critical user flows across desktop and mobile viewports.

## Setup

### Installation

Playwright has been installed as a dev dependency:

```bash
npm install --save-dev @playwright/test
```

### Configuration

The Playwright configuration is defined in `playwright.config.ts`:

- **Test Directory**: `./e2e`
- **Base URL**: `http://localhost:5173` (frontend dev server)
- **Browsers**: Chromium, Firefox, WebKit
- **Mobile Devices**: Pixel 5 (Android), iPhone 12 (iOS)
- **Screenshots**: Captured on test failure
- **Videos**: Retained on test failure
- **Traces**: Recorded on first retry

## Running Tests

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Tests in UI Mode (Interactive)

```bash
npm run test:e2e:ui
```

This opens an interactive browser where you can:
- Watch tests run in real-time
- Step through tests
- Inspect elements
- View test logs

### Run Tests in Debug Mode

```bash
npm run test:e2e:debug
```

This opens the Playwright Inspector for step-by-step debugging.

### Run Specific Test File

```bash
npx playwright test e2e/auth.spec.ts
```

### Run Tests on Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project="Mobile Chrome"
```

### Run Tests with Specific Tag

```bash
npx playwright test --grep @smoke
```

## Test Suite Structure

### 1. Authentication Tests (`e2e/auth.spec.ts`)

**Task 39.2**: User registration and login flow

Tests covered:
- User registration with email and password
- Email validation
- Password confirmation
- Login with registered credentials
- User logout
- Session persistence

**Key Assertions**:
- Registration form validation
- Successful redirect after login
- User menu visibility when logged in
- Logout clears session

### 2. Product Search and Filter Tests (`e2e/products.spec.ts`)

**Task 39.3**: Product search and filter

Tests covered:
- Product listing page loads
- Search functionality with debounce
- Category filtering
- Price range filtering
- Sorting (price, rating, newest)
- Product detail page navigation
- Image gallery and zoom
- Variant selection
- Stock availability display

**Key Assertions**:
- Products display in grid layout
- Filters reduce product count appropriately
- Search results match query
- Product details page shows all information
- BDT currency formatting (৳ symbol)

### 3. Cart and Checkout Tests (`e2e/checkout.spec.ts`)

**Task 39.4**: Add to cart and checkout with COD

Tests covered:
- Add product to cart
- Quantity selection
- Cart persistence (localStorage for guests)
- Cart merge on login
- Checkout stepper navigation
- Address selection/addition
- Payment method selection (COD, SSLCommerz)
- Coupon code validation
- Order review and confirmation
- Order success page

**Key Assertions**:
- Cart items persist across page reloads
- Checkout steps are sequential
- Address validation
- Payment method selection
- Order confirmation displays order number
- Cart clears after successful order

### 4. Orders and Reviews Tests (`e2e/orders-reviews.spec.ts`)

**Task 39.5**: Order history and cancellation

Tests covered:
- View order history
- Order detail page
- Order status display
- Cancel order (pending/processing only)
- Tracking number display (shipped orders)

**Task 39.6**: Submit product review

Tests covered:
- Write review for delivered orders
- Star rating selection (1-5)
- Review comment submission
- Edit own review
- Delete own review
- Review list pagination

**Key Assertions**:
- Only delivered orders show review button
- Reviews display with ratings and comments
- User can only edit/delete own reviews
- Review count updates on product page

### 5. Admin Panel Tests (`e2e/admin.spec.ts`)

**Task 39.7**: Admin product creation

Tests covered:
- Admin dashboard access
- Product creation form
- Product field validation
- Image upload
- Category selection
- Product listing
- Product edit
- Product deletion

**Admin Dashboard Tests**:
- Metric cards (revenue, orders, users)
- Sales trend chart
- Top 10 products table
- Orders by status summary

**Admin Order Management**:
- Order list with filters
- Order status update
- Tracking number input
- Order detail view

**Key Assertions**:
- Only admin users can access admin panel
- Product creation requires all fields
- Product updates reflect immediately
- Order status transitions are valid
- Tracking number required for shipped status

### 6. Responsive Design Tests (`e2e/responsive.spec.ts`)

**Task 39.8**: Mobile and desktop viewport testing

Tests covered:
- Mobile viewport (375px - iPhone SE)
- Tablet viewport (768px - iPad)
- Desktop viewport (1280px)
- Mobile navigation (hamburger menu)
- Touch-friendly form inputs (min 44px height)
- Image responsive sizing
- Layout grid adjustments per viewport
- Admin panel responsiveness

**Key Assertions**:
- Mobile layout stacks vertically
- Desktop layout uses grid (2-3 columns)
- Hamburger menu visible on mobile
- Sidebar visible on desktop
- Images scale appropriately
- Form inputs are touch-friendly

## Test Data Requirements

### Seed Data

Before running E2E tests, ensure the backend is seeded with test data:

```bash
npm run seed --workspace=backend
```

This creates:
- Admin user: `admin@example.com` / `admin123`
- Test user: `test@example.com` / `password123`
- Sample categories (Electronics, Clothing, etc.)
- Sample products (50+)
- Sample reviews and orders

### Test Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@example.com | admin123 | Admin |
| test@example.com | password123 | User |

## Environment Setup

### Prerequisites

1. **Node.js**: v18+ (check with `node --version`)
2. **npm**: v9+ (check with `npm --version`)
3. **Frontend Dev Server**: Running on `http://localhost:5173`
4. **Backend API**: Running on `http://localhost:5000`
5. **MongoDB**: Running and accessible
6. **Redis**: Running and accessible (for caching)

### Start Services

```bash
# Terminal 1: Start frontend dev server
npm run start:frontend

# Terminal 2: Start backend dev server
npm run start:backend

# Terminal 3: Run E2E tests
npm run test:e2e
```

Or use concurrently:

```bash
npm start  # Starts both frontend and backend
```

## CI/CD Integration

### GitHub Actions

E2E tests can be integrated into CI/CD pipeline:

```yaml
- name: Run E2E Tests
  run: npm run test:e2e
  env:
    CI: true
```

### Test Retries

- Local: 0 retries (fail fast for debugging)
- CI: 2 retries (handle flaky tests)

### Parallel Execution

- Local: Multiple workers (faster)
- CI: Single worker (stable)

## Debugging Failed Tests

### View Test Report

After tests complete, open the HTML report:

```bash
npx playwright show-report
```

### Inspect Failed Test

1. Check screenshot in `test-results/` folder
2. Check video recording (if enabled)
3. Check trace file (if enabled)

### Debug Specific Test

```bash
npx playwright test e2e/auth.spec.ts --debug
```

This opens the Playwright Inspector where you can:
- Step through test code
- Inspect DOM elements
- View network requests
- Check console logs

### Enable Verbose Logging

```bash
npx playwright test --debug --verbose
```

## Best Practices

### Test Isolation

- Each test is independent
- Tests use unique data (timestamps for emails)
- Tests clean up after themselves
- No test dependencies

### Selectors

Tests use multiple selector strategies for robustness:

1. **Data Attributes** (preferred): `[data-testid="product-card"]`
2. **Semantic HTML**: `button:has-text("Add to Cart")`
3. **CSS Classes**: `[class*="ProductCard"]`
4. **Fallback**: Generic selectors

### Waits

- Use `waitForURL()` for navigation
- Use `waitForSelector()` for element visibility
- Use `waitForTimeout()` sparingly (last resort)
- Avoid hard-coded delays

### Assertions

- Use `expect()` for all assertions
- Include timeout for async operations
- Check visibility before interaction
- Verify state changes after actions

## Performance Considerations

### Test Execution Time

- Single test: ~5-10 seconds
- Full suite: ~2-3 minutes (parallel)
- Full suite: ~5-10 minutes (sequential)

### Optimization Tips

1. Run tests in parallel (default)
2. Use `--project=chromium` for faster feedback
3. Skip video/screenshot recording in local development
4. Use `--grep` to run specific tests

## Troubleshooting

### Tests Timeout

**Problem**: Tests fail with timeout errors

**Solutions**:
1. Increase timeout in `playwright.config.ts`
2. Check if frontend/backend are running
3. Check network connectivity
4. Check database connectivity

### Selector Not Found

**Problem**: Tests fail with "Selector not found"

**Solutions**:
1. Verify element exists in DOM
2. Check if element is visible
3. Use `page.pause()` to inspect DOM
4. Update selector strategy

### Flaky Tests

**Problem**: Tests pass sometimes, fail other times

**Solutions**:
1. Add explicit waits for async operations
2. Avoid hard-coded delays
3. Use `waitForLoadState()` for page loads
4. Check for race conditions

### Authentication Issues

**Problem**: Tests fail to login

**Solutions**:
1. Verify test account exists in database
2. Check JWT token generation
3. Verify CORS configuration
4. Check session storage

## Maintenance

### Update Selectors

When UI changes, update selectors in test files:

```bash
# Find all data-testid references
grep -r "data-testid" e2e/
```

### Add New Tests

1. Create new `.spec.ts` file in `e2e/` directory
2. Follow existing test structure
3. Use descriptive test names
4. Add comments for complex flows
5. Run tests locally before committing

### Review Test Coverage

Current coverage:
- ✅ Authentication (login, register, logout)
- ✅ Product browsing (search, filter, sort)
- ✅ Cart operations (add, update, remove)
- ✅ Checkout flow (address, payment, review)
- ✅ Order management (history, cancel, tracking)
- ✅ Reviews (submit, edit, delete)
- ✅ Admin operations (CRUD, dashboard)
- ✅ Responsive design (mobile, tablet, desktop)

## Next Steps

### Phase 40: Performance Optimization

After E2E tests pass:
1. Run Lighthouse audit
2. Optimize bundle size
3. Implement virtual scrolling
4. Optimize images

### Phase 41: Security Hardening

Verify security measures:
1. HTTPS enforcement
2. CSP headers
3. Rate limiting
4. Input validation

### Phase 18: Bangladesh Localization

Final polish:
1. BDT currency formatting
2. Phone number validation (+880)
3. Postal code validation
4. Bangla language support

## References

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Debugging](https://playwright.dev/docs/debug)
- [Playwright CI/CD](https://playwright.dev/docs/ci)

## Support

For issues or questions:
1. Check Playwright documentation
2. Review test logs and screenshots
3. Run tests in debug mode
4. Check GitHub issues
5. Contact development team
