# Implementation Plan: onulota eCommerce Platform

## Overview

This document breaks down the implementation of the onulota eCommerce Platform into actionable development tasks. Tasks are organized by phase and component, following the architecture defined in the design document.

## Tasks

---

## Phase 1: Project Setup & Infrastructure

- [x] 1. Initialize monorepo project structure
  - [x] 1.1 Create root directory with `frontend/` and `backend/` folders
  - [x] 1.2 Initialize `frontend/` with Vite + React + TypeScript (`npm create vite@latest`)
  - [x] 1.3 Initialize `backend/` with Node.js + Express + TypeScript
  - [x] 1.4 Create root `package.json` with workspace scripts
  - [x] 1.5 Set up `.gitignore` for both frontend and backend
  - [x] 1.6 Create `.env.example` files for frontend and backend

- [x] 2. Configure frontend tooling
  - [x] 2.1 Install and configure Tailwind CSS with PostCSS
  - [x] 2.2 Install and configure ShadCN UI components
  - [x] 2.3 Install React Router v6 for client-side routing
  - [x] 2.4 Install Zustand for state management
  - [x] 2.5 Install React Query (TanStack Query) for server state
  - [x] 2.6 Install React Hook Form + Zod for form validation
  - [x] 2.7 Install Axios for HTTP requests
  - [x] 2.8 Configure path aliases in `tsconfig.json` and `vite.config.ts`
  - [x] 2.9 Set up ESLint + Prettier for code formatting

- [x] 3. Configure backend tooling
  - [x] 3.1 Install Express, Mongoose, and core dependencies
  - [x] 3.2 Install security packages: helmet, cors, express-rate-limit, bcryptjs
  - [x] 3.3 Install JWT packages: jsonwebtoken
  - [x] 3.4 Install validation: joi, express-mongo-sanitize
  - [x] 3.5 Install logging: winston, morgan
  - [x] 3.6 Install file upload: multer, sharp (image processing)
  - [x] 3.7 Install dev dependencies: nodemon, ts-node, typescript
  - [x] 3.8 Configure `tsconfig.json` for backend
  - [x] 3.9 Set up ESLint for backend TypeScript
  - [x] 3.10 Create modular folder structure: `src/modules/`, `src/middleware/`, `src/config/`, `src/utils/`

- [x] 4. Docker setup
  - [x] 4.1 Create multi-stage `Dockerfile` for frontend (build + nginx serve)
  - [x] 4.2 Create multi-stage `Dockerfile` for backend (build + production run)
  - [x] 4.3 Create `docker-compose.yml` with frontend, backend, MongoDB, Redis, Nginx services
  - [x] 4.4 Create `nginx.conf` for reverse proxy configuration
  - [x] 4.5 Add `.dockerignore` files for both frontend and backend
  - [x] 4.6 Verify `docker-compose up --build` runs without errors

- [x] 5. CI/CD pipeline setup
  - [x] 5.1 Create `.github/workflows/ci.yml` with GitHub Actions
  - [x] 5.2 Add Gitleaks secret scanning step (fail on detection)
  - [x] 5.3 Add `npm audit --audit-level=moderate` step for both frontend and backend
  - [x] 5.4 Add dependency caching step to avoid repeated installs
  - [x] 5.5 Add build verification step for both frontend and backend
  - [x] 5.6 Add test execution step
  - [x] 5.7 Add Docker build verification step

---

## Phase 2: Backend - Core Infrastructure

- [x] 6. Database and server configuration
  - [x] 6.1 Create MongoDB connection utility with connection pooling
  - [x] 6.2 Create Redis connection utility for caching
  - [x] 6.3 Create Express app factory with middleware chain
  - [x] 6.4 Configure Helmet.js security headers
  - [x] 6.5 Configure CORS with allowed origins whitelist
  - [x] 6.6 Configure Morgan HTTP request logger
  - [x] 6.7 Configure Winston logger with daily rotation (console + file)
  - [x] 6.8 Create global error handling middleware
  - [x] 6.9 Create async error wrapper utility
  - [x] 6.10 Create health check endpoint `GET /api/health`

- [x] 7. Authentication middleware and utilities
  - [x] 7.1 Create JWT utility: `generateAccessToken`, `generateRefreshToken`, `verifyToken`
  - [x] 7.2 Create `authenticateToken` middleware (verify JWT, attach user to req)
  - [x] 7.3 Create `requireRole` middleware for role-based access control
  - [x] 7.4 Create rate limiter middleware (100 req/15min unauthenticated, 1000 req/15min authenticated)
  - [x] 7.5 Create input validation middleware factory using Joi schemas
  - [x] 7.6 Create MongoDB sanitization middleware (prevent NoSQL injection)

- [x] 8. Configuration parser (Requirement 31)
  - [x] 8.1 Implement JSON config file parser with line/column error reporting
  - [x] 8.2 Implement YAML config file parser with line/column error reporting
  - [x] 8.3 Implement config pretty-printer for JSON format
  - [x] 8.4 Implement config pretty-printer for YAML format
  - [x] 8.5 Implement required field validator (databaseUrl, jwtSecret, port)
  - [x] 8.6 Write property-based tests for round-trip property (parse → print → parse)
  - [x] 8.7 Write property-based tests for error reporting property
  - [x] 8.8 Write property-based tests for required field validation property

---

## Phase 3: Backend - Data Models

- [x] 9. Create Mongoose data models
  - [x] 9.1 Create `User` model with indexes (email unique, googleId sparse unique)
  - [x] 9.2 Create `Product` model with text indexes (name, description) and compound indexes
  - [x] 9.3 Create `Category` model with parent reference and level field
  - [x] 9.4 Create `Cart` model with TTL index on `expiresAt`
  - [x] 9.5 Create `Order` model with orderNumber auto-generation and status history
  - [x] 9.6 Create `Review` model with compound unique index (product + user)
  - [x] 9.7 Create `Coupon` model with code unique index
  - [x] 9.8 Create `RefreshToken` model with TTL index on `expiresAt`
  - [x] 9.9 Create database seed script with sample categories, products, and admin user

---

## Phase 4: Backend - Authentication Module

- [x] 10. User registration and login
  - [x] 10.1 `POST /api/auth/register` - validate input, hash password, create user, return tokens
  - [x] 10.2 `POST /api/auth/login` - validate credentials, compare hash, return tokens
  - [x] 10.3 `POST /api/auth/refresh` - validate refresh token, return new access token
  - [x] 10.4 `POST /api/auth/logout` - invalidate refresh token in database
  - [x] 10.5 Joi validation schemas for register and login requests
  - [x] 10.6 Store refresh token (hashed) in RefreshToken collection

- [x] 11. Google OAuth integration
  - [x] 11.1 Install and configure `passport` + `passport-google-oauth20`
  - [x] 11.2 `GET /api/auth/google` - initiate OAuth flow
  - [x] 11.3 `GET /api/auth/google/callback` - handle callback, create/retrieve user, return tokens
  - [x] 11.4 Handle new vs existing Google users (create account or link)

---

## Phase 5: Backend - User & Address Module

- [x] 12. User profile management
  - [x] 12.1 `GET /api/users/profile` - return authenticated user profile
  - [x] 12.2 `PUT /api/users/profile` - validate and update name, phone
  - [x] 12.3 `PUT /api/users/password` - verify current password, update to new hash
  - [x] 12.4 `POST /api/users/profile/image` - upload, validate (JPEG/PNG/WebP, max 5MB), process with Sharp, store URL

- [x] 13. Address book management
  - [x] 13.1 `GET /api/users/addresses` - return all user addresses
  - [x] 13.2 `POST /api/users/addresses` - add address (max 10 per user), validate fields
  - [x] 13.3 `PUT /api/users/addresses/:id` - update address, validate fields
  - [x] 13.4 `DELETE /api/users/addresses/:id` - remove address
  - [x] 13.5 Handle default address logic (unmark previous default on new default set)

---

## Phase 6: Backend - Product & Category Module

- [ ] 14. Category management
  - [x] 14.1 `GET /api/categories` - return full category tree with product counts (cached in Redis, TTL 1hr)
  - [x] 14.2 `POST /api/admin/categories` - create category, validate hierarchy depth ≤ 3
  - [x] 14.3 `PUT /api/admin/categories/:id` - update category, validate name uniqueness within parent
  - [x] 14.4 `DELETE /api/admin/categories/:id` - prevent deletion if products exist
  - [x] 14.5 Category reordering endpoint

- [x] 15. Product catalog
  - [x] 15.1 `GET /api/products` - paginated list with filters (price, rating, category) and sorting
  - [x] 15.2 `GET /api/products/:id` - full product details with reviews summary
  - [x] 15.3 `GET /api/products/search` - text search across name, description, category
  - [x] 15.4 `GET /api/categories/:id/products` - products by category (includes subcategories)
  - [x] 15.5 Implement recursive category query for subcategory product fetching
  - [x] 15.6 Cache product listings in Redis (TTL 5 min), invalidate on product update

- [x] 16. Admin product management
  - [x] 16.1 `POST /api/admin/products` - create product with required fields validation
  - [x] 16.2 `PUT /api/admin/products/:id` - update product
  - [x] 16.3 `DELETE /api/admin/products/:id` - soft delete (set isActive: false)
  - [x] 16.4 `POST /api/admin/products/:id/images` - upload images, generate thumbnail/mobile/desktop versions with Sharp, convert to WebP
  - [x] 16.5 Product variant management (size, color with separate stock/price)

---

## Phase 7: Backend - Cart Module

- [x] 17. Cart management
  - [x] 17.1 `GET /api/cart` - return cart with calculated subtotal, tax, shipping, total
  - [x] 17.2 `POST /api/cart/items` - add item, verify stock availability
  - [x] 17.3 `PUT /api/cart/items/:id` - update quantity, verify stock
  - [x] 17.4 `DELETE /api/cart/items/:id` - remove item
  - [x] 17.5 `DELETE /api/cart` - clear entire cart
  - [x] 17.6 `POST /api/cart/merge` - merge guest localStorage cart with user DB cart (prefer higher quantities)
  - [x] 17.7 Mark out-of-stock cart items as unavailable on cart retrieval

---

## Phase 8: Backend - Order & Payment Module

- [x] 18. Coupon validation
  - [x] 18.1 `POST /api/coupons/validate` - validate code, check active/expiry/usage limit/min order value
  - [x] 18.2 Calculate discount (percentage or fixed amount)

- [x] 19. Order management
  - [x] 19.1 `POST /api/orders` - create order: validate cart, snapshot prices, reduce stock, clear cart, set status pending
  - [x] 19.2 `GET /api/orders` - user order history (newest first, paginated)
  - [x] 19.3 `GET /api/orders/:id` - order details with status history
  - [x] 19.4 `PUT /api/orders/:id/cancel` - cancel order (pending/processing only), restore stock
  - [x] 19.5 Auto-generate unique order number (e.g., `ORD-YYYYMMDD-XXXXX`)
  - [x] 19.6 Record status change timestamps in statusHistory array

- [x] 20. Payment integration
  - [x] 20.1 `POST /api/payments/sslcommerz/init` - initialize SSLCommerz session, redirect URL
  - [x] 20.2 `POST /api/payments/sslcommerz/success` - verify IPN, update payment status to paid, order to confirmed
  - [x] 20.3 `POST /api/payments/sslcommerz/fail` - update payment status to failed, restore cart
  - [x] 20.4 `POST /api/payments/sslcommerz/cancel` - update payment status to cancelled, restore cart
  - [x] 20.5 COD order flow: set payment status pending, order status confirmed
  - [x] 20.6 Store payment transaction ID from gateway response

---

## Phase 9: Backend - Reviews & Admin Module

- [x] 21. Reviews and ratings
  - [x] 21.1 `POST /api/products/:id/reviews` - submit review (require delivered order, prevent duplicates)
  - [x] 21.2 `GET /api/products/:id/reviews` - paginated reviews (10 per page, newest first)
  - [x] 21.3 `PUT /api/reviews/:id` - update own review
  - [x] 21.4 `DELETE /api/reviews/:id` - delete own review
  - [x] 21.5 Recalculate product averageRating and reviewCount after submit/update/delete

- [x] 22. Admin dashboard and management
  - [x] 22.1 `GET /api/admin/dashboard` - monthly revenue, orders by status, user count, top 10 products, 30-day sales trend
  - [x] 22.2 `GET /api/admin/orders` - all orders with filters (status, date range, user)
  - [x] 22.3 `PUT /api/admin/orders/:id` - update order status (validate transitions: pending→processing→shipped→delivered), require tracking number for shipped
  - [x] 22.4 `GET /api/admin/users` - paginated user list with search
  - [x] 22.5 `PUT /api/admin/users/:id` - activate/deactivate user account
  - [x] 22.6 `GET /api/admin/coupons` - list all coupons with usage stats
  - [x] 22.7 `POST /api/admin/coupons` - create coupon with all fields
  - [x] 22.8 `PUT /api/admin/coupons/:id` - update coupon
  - [x] 22.9 `DELETE /api/admin/coupons/:id` - deactivate coupon
  - [x] 22.10 Email notification on order status change (using nodemailer or SendGrid)

---

## Phase 10: Frontend - Core Setup

- [x] 23. Frontend architecture setup
  - [x] 23.1 Create folder structure: `components/`, `pages/`, `hooks/`, `services/api/`, `store/`, `utils/`
  - [x] 23.2 Configure React Router with lazy-loaded routes
  - [x] 23.3 Create Axios instance with base URL, interceptors for JWT attach and 401 refresh
  - [x] 23.4 Create Zustand auth store (user, tokens, login, logout actions)
  - [x] 23.5 Create Zustand cart store (items, add, remove, update, clear, merge)
  - [x] 23.6 Create React Query client with default stale time 5 minutes
  - [x] 23.7 Create `ProtectedRoute` component for auth-required pages
  - [x] 23.8 Create `AdminRoute` component for admin-only pages
  - [x] 23.9 Create global error boundary component
  - [x] 23.10 Create BDT currency formatter utility (`৳` symbol, Bengali locale)

- [x] 24. Layout components
  - [x] 24.1 Create `Header` with logo, search bar, cart icon (with badge), user menu
  - [x] 24.2 Create mobile hamburger navigation menu (visible < 768px)
  - [x] 24.3 Create `Footer` with links and Bangladesh contact info
  - [x] 24.4 Create `CategorySidebar` for desktop product listing
  - [x] 24.5 Create `Breadcrumb` component for navigation hierarchy
  - [x] 24.6 Create `LoadingSpinner` and `Skeleton` loading components
  - [x] 24.7 Create `ErrorMessage` component for API errors
  - [x] 24.8 Create `EmptyState` component for empty lists

---

## Phase 11: Frontend - Auth Pages

- [x] 25. Authentication pages
  - [x] 25.1 Create `/register` page with form (name, email, password, confirm password)
  - [x] 25.2 Create `/login` page with email/password form and Google OAuth button
  - [x] 25.3 Implement Zod validation schemas for register and login forms
  - [x] 25.4 Implement JWT token storage in memory (access) and localStorage (refresh)
  - [x] 25.5 Implement auto token refresh on 401 response via Axios interceptor
  - [x] 25.6 Implement Google OAuth redirect flow
  - [x] 25.7 Create `/profile` page with editable fields and profile image upload
  - [x] 25.8 Create address book management UI (list, add, edit, delete, set default)

---

## Phase 12: Frontend - Product Pages

- [x] 26. Product listing and search
  - [x] 26.1 Create `/products` page with `ProductGrid` (responsive, lazy-loaded images)
  - [x] 26.2 Create `ProductCard` component (image, name, price in BDT, rating stars)
  - [x] 26.3 Create `ProductFilter` sidebar (category tree, price range slider, rating filter)
  - [x] 26.4 Create sort dropdown (price asc/desc, rating, newest)
  - [x] 26.5 Create pagination component
  - [x] 26.6 Create search results page with query display
  - [x] 26.7 Implement virtual scrolling for lists > 100 items
  - [x] 26.8 Implement debounced search input with autocomplete suggestions

- [x] 27. Product detail page
  - [x] 27.1 Create `/products/:id` page with full product details
  - [x] 27.2 Create image gallery with thumbnail strip and main image zoom
  - [x] 27.3 Create variant selector (size, color) with stock indicator
  - [x] 27.4 Create quantity selector with stock validation
  - [x] 27.5 Create "Add to Cart" button with loading state
  - [x] 27.6 Create product specifications accordion
  - [x] 27.7 Create reviews section with `StarRating`, `ReviewList`, `ReviewForm`
  - [x] 27.8 Create related products section

- [x] 28. Category pages
  - [x] 28.1 Create `/categories` page with category grid
  - [x] 28.2 Create `/categories/:slug` page showing category products
  - [x] 28.3 Render category hierarchy breadcrumb
  - [x] 28.4 Display subcategory chips for navigation

---

## Phase 13: Frontend - Cart & Checkout

- [x] 29. Cart functionality
  - [x] 29.1 Create `CartDrawer` slide-out panel with item list
  - [x] 29.2 Create `CartItem` with quantity controls (+/-) and remove button
  - [x] 29.3 Create `CartSummary` with subtotal, shipping, tax, total in BDT
  - [x] 29.4 Create `/cart` full cart page
  - [x] 29.5 Implement localStorage cart persistence for guests
  - [x] 29.6 Implement cart merge on login (call `POST /api/cart/merge`)
  - [x] 29.7 Show out-of-stock warning on unavailable cart items

- [x] 30. Checkout flow
  - [x] 30.1 Create `/checkout` page with multi-step stepper (Address → Payment → Review)
  - [x] 30.2 Create address selection step (list saved addresses + add new)
  - [x] 30.3 Create payment method selection step (COD, SSLCommerz)
  - [x] 30.4 Create `CouponInput` with validate button and discount display
  - [x] 30.5 Create order review step with final totals
  - [x] 30.6 Create order confirmation page `/orders/success/:id`
  - [x] 30.7 Handle SSLCommerz redirect and return URL handling
  - [x] 30.8 Handle payment failure/cancel pages with cart restoration

---

## Phase 14: Frontend - Orders & Reviews

- [x] 31. Order management pages
  - [x] 31.1 Create `/orders` page with order history list
  - [x] 31.2 Create `OrderCard` with order number, date, status badge, total
  - [x] 31.3 Create `/orders/:id` order detail page with item list and status timeline
  - [x] 31.4 Create `OrderStatusBadge` with color-coded status
  - [x] 31.5 Create cancel order button with confirmation dialog (pending/processing only)
  - [x] 31.6 Display tracking number when order is shipped

- [x] 32. Review system
  - [x] 32.1 Create `StarRating` interactive component (1-5 stars)
  - [x] 32.2 Create `ReviewForm` with rating + comment textarea (max 1000 chars)
  - [x] 32.3 Create `ReviewList` with pagination (10 per page)
  - [x] 32.4 Show "Write a Review" button only for delivered orders
  - [x] 32.5 Allow edit/delete of own reviews

---

## Phase 15: Frontend - Admin Panel

- [x] 33. Admin layout and dashboard
  - [x] 33.1 Create admin layout with sidebar navigation
  - [x] 33.2 Create `/admin/dashboard` with metric cards (revenue, orders, users)
  - [x] 33.3 Create sales trend chart (last 30 days) using recharts or chart.js
  - [x] 33.4 Create top 10 best-selling products table
  - [x] 33.5 Create orders by status summary cards

- [x] 34. Admin product management
  - [x] 34.1 Create `/admin/products` list with search, filter, pagination
  - [x] 34.2 Create product create/edit form with all fields
  - [x] 34.3 Create image upload component with drag-and-drop and preview
  - [x] 34.4 Create variant management UI (add/remove size/color variants)
  - [x] 34.5 Implement soft delete with confirmation dialog

- [x] 35. Admin category, order, user, coupon management
  - [x] 35.1 Create `/admin/categories` with tree view and CRUD operations
  - [x] 35.2 Create `/admin/orders` with filters and status update dropdown
  - [x] 35.3 Create order status update modal with tracking number input
  - [x] 35.4 Create `/admin/users` with search, pagination, activate/deactivate
  - [x] 35.5 Create `/admin/coupons` with CRUD and usage statistics display

---

## Phase 16: Testing

- [x] 36. Backend unit and integration tests
  - [x] 36.1 Set up Jest with MongoDB Memory Server for integration tests
  - [x] 36.2 Write unit tests for auth utilities (JWT, bcrypt, token refresh)
  - [x] 36.3 Write unit tests for cart calculation logic (subtotal, tax, discount)
  - [x] 36.4 Write unit tests for coupon validation logic
  - [x] 36.5 Write unit tests for order number generation
  - [x] 36.6 Write integration tests for auth endpoints (register, login, refresh, logout)
  - [x] 36.7 Write integration tests for product endpoints (list, search, filter)
  - [x] 36.8 Write integration tests for cart endpoints (add, update, remove, merge)
  - [x] 36.9 Write integration tests for order endpoints (create, list, cancel)
  - [x] 36.10 Write integration tests for admin endpoints (product CRUD, order status update)
  - [x] 36.11 Verify minimum 70% code coverage

- [x] 37. Property-based tests (configuration parser)
  - [x] 37.1 Install `fast-check` library
  - [x] 37.2 Create arbitrary generators for valid Configuration_Objects
  - [x] 37.3 Create arbitrary generators for invalid JSON/YAML strings
  - [x] 37.4 Create arbitrary generators for partial configurations (missing required fields)
  - [x] 37.5 Implement Property 1: round-trip test (parse → print → parse ≡ original)
  - [x] 37.6 Implement Property 2: error reporting test (invalid input → error with line/column)
  - [x] 37.7 Implement Property 3: required field validation test (missing fields → all reported)
  - [x] 37.8 Configure minimum 100 iterations per property

- [x] 38. Frontend tests
  - [x] 38.1 Set up Vitest with React Testing Library
  - [x] 38.2 Write unit tests for BDT currency formatter
  - [x] 38.3 Write unit tests for cart store (add, remove, update, merge logic)
  - [x] 38.4 Write unit tests for Zod validation schemas
  - [x] 38.5 Write component tests for `ProductCard`, `CartItem`, `StarRating`
  - [x] 38.6 Write component tests for `CheckoutStepper` flow

- [x] 39. End-to-end tests (Playwright)
  - [x] 39.1 Set up Playwright with test database and seed data
  - [x] 39.2 Write E2E test: user registration and login flow
  - [x] 39.3 Write E2E test: product search and filter
  - [x] 39.4 Write E2E test: add to cart and checkout with COD
  - [x] 39.5 Write E2E test: order history and cancellation
  - [x] 39.6 Write E2E test: submit product review
  - [x] 39.7 Write E2E test: admin product creation
  - [x] 39.8 Test on mobile viewport (375px) and desktop (1280px)

---

## Phase 17: Performance & Security Hardening

- [x] 40. Performance optimization
  - [x] 40.1 Verify all route components use `React.lazy` + `Suspense`
  - [x] 40.2 Verify all product images use `loading="lazy"` attribute
  - [x] 40.3 Configure Vite to split vendor bundle from app bundle
  - [x] 40.4 Implement Redis caching for category tree (1hr TTL) and featured products (15min TTL)
  - [x] 40.5 Add database indexes for all frequently queried fields
  - [ ] 40.6 Implement virtual scrolling for product lists > 100 items
  - [ ] 40.7 Run Lighthouse audit and fix issues to achieve ≥ 80 mobile score

- [x] 41. Security hardening
  - [x] 41.1 Verify Helmet.js headers: CSP, X-Frame-Options, X-Content-Type-Options
  - [x] 41.2 Verify rate limiting: 100 req/15min unauthenticated, 1000 req/15min authenticated
  - [x] 41.3 Verify all inputs sanitized with express-mongo-sanitize
  - [x] 41.4 Verify file upload validation (type, size, content-type check)
  - [x] 41.5 Verify no secrets in source code (Gitleaks scan passes)
  - [x] 41.6 Verify npm audit passes with no high/moderate vulnerabilities
  - [x] 41.7 Verify CORS whitelist is correctly configured
  - [x] 41.8 Verify JWT secret is minimum 256 bits and stored in environment variable

---

## Phase 18: Bangladesh Localization & Final Polish

- [x] 42. Bangladesh-specific features
  - [x] 42.1 Implement BDT price display with `৳` symbol throughout frontend
  - [x] 42.2 Set default country code `+880` on all phone number inputs
  - [x] 42.3 Validate Bangladesh postal codes (4-digit format)
  - [x] 42.4 Add Bangla language support for product names/descriptions (Unicode)
  - [x] 42.5 Verify SSLCommerz sandbox integration works end-to-end
  - [x] 42.6 Test mobile-first layout on 320px, 375px, 768px, 1024px, 1280px viewports

- [x] 43. Final integration and deployment verification
  - [x] 43.1 Run full CI pipeline end-to-end (Gitleaks → audit → tests → build)
  - [x] 43.2 Verify `docker-compose up --build` starts all services cleanly
  - [x] 43.3 Verify frontend connects to backend API through Nginx proxy
  - [x] 43.4 Verify MongoDB and Redis connections are healthy
  - [x] 43.5 Run database seed script and verify sample data loads
  - [x] 43.6 Perform manual smoke test of critical flows (register, browse, cart, checkout, admin)
  - [x] 43.7 Create `README.md` with setup instructions, environment variables, and Docker commands

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": [1, 2, 3, 4, 5],
      "description": "Project Setup & Infrastructure"
    },
    {
      "wave": 2,
      "tasks": [6, 7, 8],
      "description": "Backend - Core Infrastructure",
      "dependsOn": [1]
    },
    {
      "wave": 3,
      "tasks": [9],
      "description": "Backend - Data Models",
      "dependsOn": [2]
    },
    {
      "wave": 4,
      "tasks": [10, 11],
      "description": "Backend - Authentication Module",
      "dependsOn": [3]
    },
    {
      "wave": 5,
      "tasks": [12, 13],
      "description": "Backend - User & Address Module",
      "dependsOn": [4]
    },
    {
      "wave": 6,
      "tasks": [14, 15, 16],
      "description": "Backend - Product & Category Module",
      "dependsOn": [5]
    },
    {
      "wave": 7,
      "tasks": [17],
      "description": "Backend - Cart Module",
      "dependsOn": [6]
    },
    {
      "wave": 8,
      "tasks": [18, 19, 20],
      "description": "Backend - Order & Payment Module",
      "dependsOn": [7]
    },
    {
      "wave": 9,
      "tasks": [21, 22],
      "description": "Backend - Reviews & Admin Module",
      "dependsOn": [8]
    },
    {
      "wave": 10,
      "tasks": [23, 24],
      "description": "Frontend - Core Setup",
      "dependsOn": [1, 9]
    },
    {
      "wave": 11,
      "tasks": [25],
      "description": "Frontend - Auth Pages",
      "dependsOn": [10]
    },
    {
      "wave": 12,
      "tasks": [26, 27, 28],
      "description": "Frontend - Product Pages",
      "dependsOn": [11]
    },
    {
      "wave": 13,
      "tasks": [29, 30],
      "description": "Frontend - Cart & Checkout",
      "dependsOn": [12]
    },
    {
      "wave": 14,
      "tasks": [31, 32],
      "description": "Frontend - Orders & Reviews",
      "dependsOn": [13]
    },
    {
      "wave": 15,
      "tasks": [33, 34, 35],
      "description": "Frontend - Admin Panel",
      "dependsOn": [14]
    },
    {
      "wave": 16,
      "tasks": [36, 37, 38, 39],
      "description": "Testing",
      "dependsOn": [9, 15]
    },
    {
      "wave": 17,
      "tasks": [40, 41],
      "description": "Performance & Security Hardening",
      "dependsOn": [16]
    },
    {
      "wave": 18,
      "tasks": [42, 43],
      "description": "Bangladesh Localization & Final Polish",
      "dependsOn": [17]
    }
  ]
}
```

## Notes

- All tasks are organized sequentially by phase to ensure proper dependency resolution
- Backend infrastructure (Phases 1-5) must be completed before frontend development (Phases 10-15)
- Testing (Phase 16) should be conducted throughout development, not just at the end
- Security hardening (Phase 17) should be integrated into each phase rather than treated as a final step
- Bangladesh localization (Phase 18) should be considered during design and implementation of all phases
- Property-based tests for the configuration parser (Task 37) require the `fast-check` library
- All phases include both completed tasks (marked with [x]) and pending tasks (marked with [ ])

