# onulota eCommerce Platform

A production-ready, scalable eCommerce web application designed for the Bangladesh market.

## Project Structure

```
onulota-ecommerce-platform/
├── frontend/                 # React + Vite + TypeScript frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/api/    # API client services
│   │   ├── store/           # State management (Zustand)
│   │   └── utils/           # Utility functions
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env.example
├── backend/                  # Node.js + Express + TypeScript backend
│   ├── src/
│   │   ├── modules/         # Feature modules
│   │   ├── middleware/      # Express middleware
│   │   ├── config/          # Configuration files
│   │   ├── utils/           # Utility functions
│   │   ├── models/          # Mongoose models
│   │   └── routes/          # API routes
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── package.json              # Root workspace configuration
└── README.md
```

## Technology Stack

### Frontend
- React 18+ with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- React Router for navigation
- Zustand for state management
- React Query for server state
- Axios for API communication

### Backend
- Node.js 18+ with Express.js
- TypeScript
- MongoDB with Mongoose ODM
- Redis for caching
- JWT for authentication
- Bcrypt for password hashing

## Getting Started

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- MongoDB (local or cloud)
- Redis (optional, for caching)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd onulota-ecommerce-platform
```

2. Install dependencies for all workspaces:
```bash
npm install
```

3. Set up environment variables:
```bash
# Copy example env files
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

# Edit the .env files with your configuration
```

4. Start the development servers:
```bash
# Start both frontend and backend
npm start

# Or start individually
npm run start:frontend
npm run start:backend
```

### Available Scripts

- `npm start` - Start both frontend and backend in development mode
- `npm run build` - Build both frontend and backend for production
- `npm test` - Run tests for both frontend and backend
- `npm run lint` - Lint both frontend and backend code

### Frontend Scripts
- `npm run start:frontend` - Start frontend dev server (port 3000)
- `npm run build:frontend` - Build frontend for production
- `npm run test:frontend` - Run frontend tests

### Backend Scripts
- `npm run start:backend` - Start backend dev server (port 5000)
- `npm run build:backend` - Build backend for production
- `npm run test:backend` - Run backend tests

## Environment Variables

### Frontend (.env)
- `VITE_API_URL` - Backend API URL (default: http://localhost:5000)
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID

### Backend (.env)
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret (min 32 chars)
- `JWT_REFRESH_SECRET` - JWT refresh token secret
- `BCRYPT_ROUNDS` - Bcrypt hashing rounds (default: 10)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `SSLCOMMERZ_STORE_ID` - SSLCommerz payment gateway store ID
- `SSLCOMMERZ_STORE_PASSWORD` - SSLCommerz password
- `FRONTEND_URL` - Frontend URL for CORS (default: http://localhost:3000)
- `AWS_ACCESS_KEY_ID` - AWS access key (optional)
- `AWS_SECRET_ACCESS_KEY` - AWS secret key (optional)
- `AWS_S3_BUCKET` - S3 bucket name (optional)
- `SENDGRID_API_KEY` - SendGrid API key for emails

## Development

The project uses a monorepo structure with npm workspaces. Both frontend and backend are separate packages that can be developed independently.

### Frontend Development
The frontend runs on port 3000 and proxies API requests to the backend on port 5000.

### Backend Development
The backend runs on port 5000 and provides RESTful API endpoints.

## Testing

The project includes comprehensive testing at three levels:

### Unit & Integration Tests

```bash
# Run all tests
npm test

# Run frontend tests only
npm run test:frontend

# Run backend tests only
npm run test:backend

# Run backend tests with coverage
npm run test:backend -- --coverage
```

**Frontend Tests** (Vitest):
- Currency formatting with Bengali numerals
- Validation schemas
- Cart store operations
- Component rendering
- **Coverage**: 45 tests, 100% passing

**Backend Tests** (Jest):
- Authentication flows
- Product operations
- Cart operations
- Order operations
- Admin operations
- Configuration parser (property-based tests)
- **Coverage**: 337 tests, 98.5% passing

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
```

**E2E Test Coverage** (Playwright):
- User registration and login
- Product search and filtering
- Add to cart and checkout
- Order history and cancellation
- Product reviews
- Admin product creation
- Responsive design (mobile, tablet, desktop)
- **Coverage**: 20 test cases, 40+ scenarios

### Running All Tests

```bash
# Run all tests (unit, integration, and E2E)
npm run test:all
```

### Test Data

Before running E2E tests, seed the database:

```bash
npm run seed --workspace=backend
```

This creates:
- Admin user: `admin@example.com` / `admin123`
- Test user: `test@example.com` / `password123`
- Sample products, categories, and orders

### View Test Reports

```bash
# View E2E test report
npx playwright show-report

# View backend coverage report
open backend/coverage/lcov-report/index.html
```

For detailed testing information, see:
- [Testing Quick Start Guide](./TESTING_QUICK_START.md)
- [E2E Testing Guide](./E2E_TESTING_GUIDE.md)
- [Phase 16 Testing Summary](./backend/IMPLEMENTATION_NOTES_16_TESTING.md)

## License

MIT
