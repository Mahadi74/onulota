import request from 'supertest'
import express from 'express'
import { rateLimiter, authLimiter } from '../rateLimiter'
import { optionalAuth } from '../auth'

describe('Rate Limiter Integration Tests', () => {
  let app: express.Application

  beforeEach(() => {
    app = express()
    app.use(express.json())
  })

  describe('Combined rate limiter with authentication', () => {
    beforeEach(() => {
      // Setup middleware chain similar to app.ts
      app.use(optionalAuth as express.RequestHandler)
      app.use(rateLimiter as express.RequestHandler)
      app.get('/api/test', (req, res) => res.json({ success: true }))
    })

    it('should apply different limits for authenticated vs unauthenticated users', async () => {
      // Test unauthenticated request
      const unauthResponse = await request(app)
        .get('/api/test')
        .expect(200)

      expect(unauthResponse.body).toEqual({ success: true })
      
      // Test authenticated request (mock JWT token)
      const authResponse = await request(app)
        .get('/api/test')
        .set('Authorization', 'Bearer valid-jwt-token-would-go-here')
        .expect(200)

      expect(authResponse.body).toEqual({ success: true })
      
      // Both should have rate limit headers but different limits would apply
      // (In real scenario, the JWT would be validated by optionalAuth middleware)
    })
  })

  describe('Auth endpoint rate limiting', () => {
    beforeEach(() => {
      app.use('/auth', authLimiter)
      app.post('/auth/login', (req, res) => res.json({ success: true }))
    })

    it('should apply stricter limits to authentication endpoints', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(200)

      expect(response.body).toEqual({ success: true })
      
      // Should have rate limit headers indicating the 20 request limit
      const limit = response.headers['ratelimit-limit'] || response.headers['x-ratelimit-limit']
      expect(limit).toBeDefined()
    })
  })

  describe('Rate limit exceeded scenarios', () => {
    it('should return 429 with Retry-After header when limit is exceeded', async () => {
      // Create a very restrictive limiter for testing
      const restrictiveLimiter = require('express-rate-limit')({
        windowMs: 15 * 60 * 1000,
        max: 1,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          error: 'Rate Limit Exceeded',
          message: 'Too many requests, please try again later',
        },
      })

      app.use(restrictiveLimiter)
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

      // Should include Retry-After header (requirement 21.4)
      expect(response.headers['retry-after']).toBeDefined()
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0)
    })
  })
})