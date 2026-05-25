import express from 'express'
import path from 'path'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import compression from 'compression'
import mongoSanitize from 'express-mongo-sanitize'
import passport from './config/passport'
import { errorHandler } from './middleware/errorHandler'
import { rateLimiter } from './middleware/rateLimiter'
import { optionalAuth } from './middleware/auth'
import { logger } from './utils/logger'
import authRoutes from './modules/auth/auth.routes'
import userRoutes from './modules/users/user.routes'
import categoryRoutes from './modules/categories/category.routes'
import productRoutes from './modules/products/product.routes'
import cartRoutes from './modules/cart/cart.routes'
import couponRoutes from './modules/coupons/coupon.routes'
import orderRoutes from './modules/orders/order.routes'
import paymentRoutes from './modules/payments/payment.routes'
import reviewRoutes from './modules/reviews/review.routes'
import homepageRoutes from './modules/homepage/homepage.routes'
import adminCategoryRoutes from './modules/admin/admin.category.routes'
import adminProductRoutes from './modules/admin/admin.product.routes'
import adminHomepageRoutes from './modules/admin/admin.homepage.routes'
import adminRoutes from './modules/admin/admin.routes'
import settingsRoutes from './modules/settings/settings.routes'
import shareRoutes from './routes/shareRoutes'
import uploadRoutes from './routes/uploadRoutes'

export function createApp(): express.Application {
  const app = express()

  // Gzip compression — reduces response size by 60-70%
  app.use(compression())

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }))

  // CORS — build allowed list from FRONTEND_URL env var and always include www variant
  const rawOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map((o) => o.trim())
  const allowedOrigins = new Set<string>(rawOrigins)
  // Auto-add www ↔ non-www variants so both always work
  rawOrigins.forEach((origin) => {
    try {
      const url = new URL(origin)
      if (url.hostname.startsWith('www.')) {
        allowedOrigins.add(`${url.protocol}//${url.hostname.replace(/^www\./, '')}`)
      } else {
        allowedOrigins.add(`${url.protocol}//www.${url.hostname}`)
      }
    } catch {
      // ignore malformed
    }
  })
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))

  // Body parsing
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))

  // NoSQL injection prevention
  app.use(mongoSanitize())

  // Passport initialization (used for Google OAuth strategy)
  app.use(passport.initialize())

  // HTTP request logging
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
    skip: (req) => req.url === '/api/health',
  }))

  // Optional authentication (for rate limiting differentiation)
  app.use('/api', optionalAuth as express.RequestHandler)

  // Adaptive rate limiting (100 req/15min unauthenticated, 1000 req/15min authenticated)
  app.use('/api', rateLimiter as express.RequestHandler)

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() })
  })

  // Debug endpoint — only active when DEBUG_MODE env var is set
  app.get('/api/debug', async (_req, res) => {
    if (!process.env.DEBUG_MODE) {
      return res.status(404).json({ error: 'Not Found' })
    }
    const mongoose = await import('mongoose')
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting']
    const readyState = mongoose.default.connection.readyState
    try {
      const { SiteSettings } = await import('./models/SiteSettings')
      const count = await SiteSettings.countDocuments()
      return res.json({
        mongo: { state: states[readyState] ?? readyState, dbName: mongoose.default.connection.db?.databaseName },
        settingsCount: count,
        env: { NODE_ENV: process.env.NODE_ENV, hasMongoUri: !!process.env.MONGODB_URI },
      })
    } catch (err) {
      return res.status(500).json({
        mongo: { state: states[readyState] ?? readyState },
        error: (err as Error).message,
        env: { NODE_ENV: process.env.NODE_ENV, hasMongoUri: !!process.env.MONGODB_URI },
      })
    }
  })

  // Serve uploaded files (profile images, etc.)
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

  // Auth routes
  app.use('/api/auth', authRoutes)

  // User routes
  app.use('/api/users', userRoutes)

  // Category routes (public)
  app.use('/api/categories', categoryRoutes)

  // Product routes (public)
  app.use('/api/products', productRoutes)

  // Cart routes
  app.use('/api/cart', cartRoutes)

  // Coupon routes
  app.use('/api/coupons', couponRoutes)

  // Order routes
  app.use('/api/orders', orderRoutes)

  // Payment routes
  app.use('/api/payments', paymentRoutes)

  // Review routes
  app.use('/api/products', reviewRoutes)

  // Site settings (public GET, admin PUT)
  app.use('/api/settings', settingsRoutes)

  // Public homepage route and admin homepage management
  app.use('/api/homepage', homepageRoutes)
  app.use('/api/admin/homepage', adminHomepageRoutes)

  // Admin routes (require admin role)
  app.use('/api/admin', adminCategoryRoutes)
  app.use('/api/admin/products', adminProductRoutes)
  app.use('/api/admin', adminRoutes)

  // Image upload to S3 (admin only)
  app.use('/api/upload', uploadRoutes)

  // Social share / OG tag pages (crawler-friendly product pages)
  app.use('/share', shareRoutes)

  // robots.txt — allow all social media crawlers
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain')
    res.send([
      'User-agent: *',
      'Allow: /',
      '',
      'User-agent: facebookexternalhit',
      'Allow: /',
      '',
      'User-agent: Twitterbot',
      'Allow: /',
      '',
      'User-agent: WhatsApp',
      'Allow: /',
      '',
      'User-agent: LinkedInBot',
      'Allow: /',
      '',
      'User-agent: TelegramBot',
      'Allow: /',
    ].join('\n'))
  })

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not Found', message: 'The requested resource was not found' })
  })

  // Global error handler
  app.use(errorHandler)

  return app
}
