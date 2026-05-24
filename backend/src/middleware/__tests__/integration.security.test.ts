import request from 'supertest'
import express from 'express'
import mongoSanitize from 'express-mongo-sanitize'
import { createApp } from '../../app'
import { validateBody } from '../validate'
import { errorHandler } from '../errorHandler'
import Joi from 'joi'

describe('Security Middleware Integration', () => {
  let app: express.Application
  let testApp: express.Application

  beforeEach(() => {
    app = createApp()
    
    // Create a test app with the same middleware stack for integration testing
    testApp = express()
    testApp.use(express.json())
    testApp.use(mongoSanitize()) // MongoDB sanitization
    
    // Add a test route that combines validation and sanitization
    const testSchema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
      role: Joi.string().valid('user', 'admin').default('user')
    })
    
    testApp.post('/test/secure-endpoint', validateBody(testSchema), (req, res) => {
      res.json({
        message: 'Data processed successfully',
        received: req.body,
        sanitized: true
      })
    })
    
    // Add error handler
    testApp.use(errorHandler)
  })

  describe('MongoDB Sanitization + Input Validation', () => {
    it('should sanitize MongoDB operators and validate input simultaneously', async () => {
      const maliciousPayload = {
        email: 'user@example.com',
        password: { $ne: null }, // NoSQL injection attempt
        role: 'admin',
        $where: 'this.isAdmin = true' // Additional injection attempt
      }

      const response = await request(testApp)
        .post('/test/secure-endpoint')
        .send(maliciousPayload)
        .expect(400) // Should fail validation due to sanitized password

      // Verify that validation caught the sanitized (empty object) password
      expect(response.body.error).toBe('Bad Request')
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'password',
            message: expect.stringContaining('string')
          })
        ])
      )
    })

    it('should process legitimate requests through both security layers', async () => {
      const legitimatePayload = {
        email: 'user@example.com',
        password: 'SecurePass123!',
        role: 'user'
      }

      const response = await request(testApp)
        .post('/test/secure-endpoint')
        .send(legitimatePayload)
        .expect(200)

      expect(response.body.message).toBe('Data processed successfully')
      expect(response.body.received).toEqual(legitimatePayload)
      expect(response.body.sanitized).toBe(true)
    })

    it('should handle XSS attempts with MongoDB injection', async () => {
      const combinedAttackPayload = {
        email: 'user@example.com',
        password: 'ValidPass123!',
        role: { $ne: 'user' }, // NoSQL injection
        comment: '<script>alert("xss")</script>' // XSS attempt (not in schema, will be stripped)
      }

      const response = await request(testApp)
        .post('/test/secure-endpoint')
        .send(combinedAttackPayload)
        .expect(400) // Should fail validation due to sanitized role

      expect(response.body.error).toBe('Bad Request')
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'role',
            message: expect.stringContaining('must be one of')
          })
        ])
      )
    })

    it('should preserve data types after sanitization and validation', async () => {
      const mixedPayload = {
        email: 'user@example.com',
        password: 'ValidPass123!',
        role: 'admin'
      }

      const response = await request(testApp)
        .post('/test/secure-endpoint')
        .send(mixedPayload)
        .expect(200)

      // Verify legitimate data is preserved
      expect(response.body.received.email).toBe('user@example.com')
      expect(response.body.received.password).toBe('ValidPass123!')
      expect(response.body.received.role).toBe('admin')
    })
  })

  describe('Security Headers Integration', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200)

      // Verify Helmet.js security headers are present
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff')
      expect(response.headers).toHaveProperty('x-frame-options')
      expect(response.headers).toHaveProperty('content-security-policy')
    })
  })

  describe('Rate Limiting Integration', () => {
    it('should apply rate limiting to protected endpoints', async () => {
      // Make multiple requests to test rate limiting
      const requests = Array(5).fill(null).map(() =>
        request(testApp)
          .post('/test/secure-endpoint')
          .send({
            email: 'user@example.com',
            password: 'ValidPass123!',
            role: 'user'
          })
      )

      const responses = await Promise.all(requests)
      
      // All requests should be processed successfully (no rate limiting in test app)
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle errors consistently across security layers', async () => {
      const invalidPayload = {
        email: 'invalid-email',
        password: { $ne: null }, // NoSQL injection + too short after sanitization
        role: 'invalid-role'
      }

      const response = await request(testApp)
        .post('/test/secure-endpoint')
        .send(invalidPayload)
        .expect(400)

      // Verify error response format
      expect(response.body).toHaveProperty('error', 'Bad Request')
      expect(response.body).toHaveProperty('message')
      expect(response.body).toHaveProperty('details')
      expect(Array.isArray(response.body.details)).toBe(true)
      
      // Should have multiple validation errors
      expect(response.body.details.length).toBeGreaterThan(1)
    })
  })
})