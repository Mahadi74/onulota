# Testing Quick Start Guide

## Overview

This project includes three levels of testing:
1. **Unit Tests** - Frontend (Vitest) and Backend (Jest)
2. **Integration Tests** - Backend (Jest with MongoDB Memory Server)
3. **End-to-End Tests** - Full user flows (Playwright)

## Quick Commands

### Run All Tests

```bash
# Run all unit and integration tests
npm test

# Run all tests including E2E
npm run test:all
```

### Unit & Integration Tests

```bash
# Frontend unit tests
npm run test:frontend

# Backend unit and integration tests
npm run test:backend

# Backend with coverage report
npm run test:backend -- --coverage
```

### End-to-End Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests in interactive UI mode
npm run test:e2e:ui

# Run E2E tests in debug mode
npm run test:e2e:debug

# Run specific E2E test file
npx playwright test e2e/auth.spec.ts

# Run E2E tests on specific browser
npx playwright test --project=chromium
```

## Setup for E2E Testing

### 1. Start Services

```bash
# Terminal 1: Start both frontend and backend
npm start

# OR start them separately:
# Terminal 1
npm run start:frontend

# Terminal 2
npm run start:backend
```

### 2. Seed Test Data

```bash
npm run seed --workspace=backend
```

This creates:
- Admin user: `admin@example.com` / `admin123`
- Test user: `test@example.com` / `password123`
- Sample products, categories, and orders

### 3. Run E2E Tests

```bash
npm run test:e2e
```

## Test Coverage

### Frontend Tests (Vitest)
- ✅ Currency formatting with Bengali numerals
- ✅ Validation schemas (Zod)
- ✅ Cart store operations
- ✅ Component rendering (LoadingSpinner, ErrorMessage, etc.)
- **Coverage**: 45 tests, 100% passing

### Backend Tests (Jest)
- ✅ Authentication (register, login, refresh, logout)
- ✅ Product operations (list, search, filter)
- ✅ Cart operations (add, update, remove, merge)
- ✅ Order operations (create, list, cancel)
- ✅ Admin operations (product CRUD, order status)
- ✅ Configuration parser (property-based tests)
- **Coverage**: 337 tests, 98.5% passing

### E2E Tests (Playwright)
- ✅ User registration and login
- ✅ Product search and filtering
- ✅ Add to cart and checkout
- ✅ Order history and cancellation
- ✅ Product reviews (submit, edit, delete)
- ✅ Admin product creation
- ✅ Responsive design (mobile, tablet, desktop)
- **Coverage**: 20 test cases, 40+ scenarios

## Viewing Test Results

### Unit/Integration Tests

```bash
# View coverage report (backend)
npm run test:backend -- --coverage
# Open: backend/coverage/lcov-report/index.html
```

### E2E Tests

```bash
# View HTML report
npx playwright show-report

# View test results in terminal
npm run test:e2e
```

## Debugging Tests

### E2E Tests

```bash
# Debug mode with Playwright Inspector
npm run test:e2e:debug

# Interactive UI mode
npm run test:e2e:ui

# Pause test at specific point
# Add this in test code: await page.pause();
```

### Unit Tests

```bash
# Run with verbose output
npm run test:frontend -- --reporter=verbose

# Run in watch mode
npm run test:frontend -- --watch
```

## CI/CD Pipeline

Tests run automatically on:
- Push to any branch
- Pull requests
- Scheduled daily runs

Pipeline includes:
1. Gitleaks secret scanning
2. npm audit (security check)
3. Frontend build verification
4. Backend build verification
5. Unit and integration tests
6. E2E tests (on main branch)

## Common Issues

### E2E Tests Timeout

**Problem**: Tests fail with timeout errors

**Solution**:
1. Ensure frontend is running: `npm run start:frontend`
2. Ensure backend is running: `npm run start:backend`
3. Check database connectivity
4. Increase timeout in `playwright.config.ts`

### Tests Can't Find Elements

**Problem**: Selector not found errors

**Solution**:
1. Run in UI mode: `npm run test:e2e:ui`
2. Inspect element in browser
3. Update selector in test file
4. Use `page.pause()` to debug

### Authentication Failures

**Problem**: Login tests fail

**Solution**:
1. Verify test account exists: `npm run seed --workspace=backend`
2. Check JWT configuration
3. Verify CORS settings
4. Check session storage

## Test Data

### Test Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@example.com | admin123 | Admin |
| test@example.com | password123 | User |

### Sample Data

After seeding:
- 50+ products across multiple categories
- 10+ categories (Electronics, Clothing, etc.)
- Sample orders and reviews
- Coupons for testing discounts

## Performance

### Test Execution Times

- Frontend unit tests: ~5 seconds
- Backend tests: ~30 seconds
- E2E tests: ~2-3 minutes (parallel)
- Full test suite: ~5 minutes

### Optimization Tips

1. Run tests in parallel (default)
2. Use `--project=chromium` for faster E2E feedback
3. Skip video/screenshot recording in local development
4. Use `--grep` to run specific tests

## Next Steps

1. **Run all tests**: `npm run test:all`
2. **Fix any failures**: Check test output and logs
3. **Review coverage**: `npm run test:backend -- --coverage`
4. **Commit changes**: Tests must pass before merge

## Resources

- [Frontend Testing Guide](./frontend/README.md#testing)
- [Backend Testing Guide](./backend/README.md#testing)
- [E2E Testing Guide](./E2E_TESTING_GUIDE.md)
- [Playwright Documentation](https://playwright.dev)
- [Jest Documentation](https://jestjs.io)
- [Vitest Documentation](https://vitest.dev)

## Support

For issues:
1. Check test logs and error messages
2. Run tests in debug mode
3. Review test documentation
4. Check GitHub issues
5. Contact development team
