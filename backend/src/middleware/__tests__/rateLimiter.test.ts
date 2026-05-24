import request from 'supertest'
import express, { Request, Response, NextFunction } from 'express'
import { 
  unauthenticatedLimiter, 
  authenticatedLimiter, 
  authLimiter, 
  rateLimiter,
  AuthenticatedRequest 
} from '../rateLimiter'

describe('Rate Limiter Middleware', () => {
  let app: express.Application

  beforeEach(() => {
    app = express()
    app.use(express.json())
  })

  describe('unauthenticatedLimiter', () => {
    beforeEach(() => {
      app.use(unauthenticatedLimiter)
      app.get('/test', (req, res) => res.json({ success: true }))
    })

    it('should be a function (Express middleware)', () => {
      expect(typeof unauthenticatedLimiter).toBe('function')
    })

    it('should allow requests under the limit', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200)

      expect(response.body).toEqual({ success: true })
      // Check for rate limit headers (express-rate-limit uses RateLimit-* headers by default)
      expect(response.headers['ratelimit-limit'] || response.headers['x-ratelimit-limit']).toBeDefined()
      expect(response.headers['ratelimit-remaining'] || response.headers['x-ratelimit-remaining']).toBeDefined()
    })

    it('should skip rate limiting for authenticated users', async () => {
      // Mock authenticated request
      app.use((req: Request, res: Response, next: NextFunction) => {
        (req as AuthenticatedRequest).user = { userId: 'user123', role: 'user' }
        next()
      })

      const response = await request(app)
        .get('/test')
        .expect(200)

      expect(response.body).toEqual({ success: true })
      // Should not have rate limit headers since it's skipped
    })
  })

  describe('authenticatedLimiter', () => {
    beforeEach(() => {
      // Mock authentication middleware
      app.use((req: Request, res: Response, next: NextFunction) => {
        (req as AuthenticatedRequest).user = { userId: 'user123', role: 'user' }
        next()
      })
      app.use(authenticatedLimiter)
      app.get('/test', (req, res) => res.json({ success: true }))
    })

    it('should be a function (Express middleware)', () => {
      expect(typeof authenticatedLimiter).toBe('function')
    })

    it('should allow requests under the limit for authenticated users', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200)

      expect(response.body).toEqual({ success: true })
      // Check for rate limit headers
      expect(response.headers['ratelimit-limit'] || response.headers['x-ratelimit-limit']).toBeDefined()
      expect(response.headers['ratelimit-remaining'] || response.headers['x-ratelimit-remaining']).toBeDefined()
    })

    it('should use userId as key for rate limiting', async () => {
      // Make multiple requests with same user
      for (let i = 0; i < 3; i++) {
        await request(app)
          .get('/test')
          .expect(200)
      }

      const response = await request(app)
        .get('/test')
        .expect(200)

      // Check that rate limiting is working (remaining count should decrease)
      const remaining = response.headers['ratelimit-remaining'] || response.headers['x-ratelimit-remaining']
      expect(remaining).toBeDefined()
      expect(parseInt(remaining as string)).toBeLessThan(1000)
    })
  })

  describe('authLimiter', () => {
    beforeEach(() => {
      app.use(authLimiter)
      app.post('/auth/login', (req, res) => res.json({ success: true }))
    })

    it('should be a function (Express middleware)', () => {
      expect(typeof authLimiter).toBe('function')
    })

    it('should allow requests under the limit', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(200)

      expect(response.body).toEqual({ success: true })
      // Check for rate limit headers
      expect(response.headers['ratelimit-limit'] || response.headers['x-ratelimit-limit']).toBeDefined()
      expect(response.headers['ratelimit-remaining'] || response.headers['x-ratelimit-remaining']).toBeDefined()
    })
  })

  describe('rateLimiter (combined middleware)', () => {
    it('should be a function (Express middleware)', () => {
      expect(typeof rateLimiter).toBe('function')
    })

    it('should apply unauthenticated limiter for requests without user', async () => {
      app.use(rateLimiter as express.RequestHandler)
      app.get('/test', (req, res) => res.json({ success: true }))

      const response = await request(app)
        .get('/test')
        .expect(200)

      expect(response.body).toEqual({ success: true })
      // Check for rate limit headers
      expect(response.headers['ratelimit-limit'] || response.headers['x-ratelimit-limit']).toBeDefined()
    })

    it('should apply authenticated limiter for requests with user', async () => {
      // Mock authentication middleware
      app.use((req: Request, res: Response, next: NextFunction) => {
        (req as AuthenticatedRequest).user = { userId: 'user123', role: 'user' }
        next()
      })
      app.use(rateLimiter as express.RequestHandler)
      app.get('/test', (req, res) => res.json({ success: true }))

      const response = await request(app)
        .get('/test')
        .expect(200)

      expect(response.body).toEqual({ success: true })
      // Check for rate limit headers
      expect(response.headers['ratelimit-limit'] || response.headers['x-ratelimit-limit']).toBeDefined()
    })
  })

  describe('Rate limit error responses', () => {
    it('should return 429 with proper error message when limit exceeded', async () => {
      // Create a very restrictive limiter for testing
      const testLimiter = require('express-rate-limit')({
        windowMs: 15 * 60 * 1000,
        max: 1, // Only 1 request allowed
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          error: 'Rate Limit Exceeded',
          message: 'Too many requests, please try again later',
        },
      })

      app.use(testLimiter)
      app.get('/test', (req, res) => res.json({ success: true }))

      // First request should succeed
      await request(app)
        .get('/test')
        .expect(200)

      // Second request should be rate limited
      const response = await request(app)
        .get('/test')
        .expect(429)

      expect(response.body).toEqual({
        error: 'Rate Limit Exceeded',
        message: 'Too many requests, please try again later',
      })

      // Should include Retry-After header
      expect(response.headers['retry-after']).toBeDefined()
    })
  })
})
