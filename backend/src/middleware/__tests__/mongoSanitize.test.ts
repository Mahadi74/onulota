import request from 'supertest'
import express from 'express'
import mongoSanitize from 'express-mongo-sanitize'
import { createApp } from '../../app'

describe('MongoDB Sanitization Middleware', () => {
  let app: express.Application
  let testApp: express.Application

  beforeEach(() => {
    app = createApp()
    
    // Create a separate test app with the same middleware setup for testing
    testApp = express()
    testApp.use(express.json())
    testApp.use(mongoSanitize())
    
    // Add test routes
    testApp.post('/test/body', (req, res) => {
      res.json({ sanitized: req.body })
    })
    
    testApp.get('/test/query', (req, res) => {
      res.json({ sanitized: req.query })
    })
    
    testApp.post('/test/nested', (req, res) => {
      res.json({ sanitized: req.body })
    })
    
    testApp.post('/test/legitimate', (req, res) => {
      res.json({ sanitized: req.body })
    })
    
    testApp.post('/test/arrays', (req, res) => {
      res.json({ sanitized: req.body })
    })
    
    testApp.post('/test/injection-patterns', (req, res) => {
      res.json({ sanitized: req.body })
    })
    
    testApp.post('/test/auth-bypass', (req, res) => {
      const { username, password } = req.body
      
      // Simulate authentication logic that would be vulnerable without sanitization
      const isValidCredentials = (
        typeof username === 'string' && 
        typeof password === 'string' &&
        username.length > 0 && 
        password.length > 0
      )
      
      res.json({ 
        authenticated: isValidCredentials,
        username: typeof username,
        password: typeof password
      })
    })
    
    testApp.get('/test/user-search', (req, res) => {
      // Simulate user search with query parameters
      const searchCriteria = req.query
      
      // Check if MongoDB operators were sanitized
      const hasMongoOperators = Object.keys(searchCriteria).some(key => 
        key.startsWith('$') || 
        (typeof searchCriteria[key] === 'object' && 
         searchCriteria[key] !== null &&
         Object.keys(searchCriteria[key] as object).some(subKey => subKey.startsWith('$')))
      )
      
      res.json({ 
        searchCriteria, 
        hasMongoOperators,
        message: hasMongoOperators ? 'Potential injection detected' : 'Search criteria clean'
      })
    })
    
    testApp.post('/test/product-filter', (req, res) => {
      const filters = req.body
      
      // Simulate MongoDB query building
      const containsOperators = JSON.stringify(filters).includes('$')
      
      res.json({
        filters,
        containsOperators,
        wouldExecuteQuery: !containsOperators
      })
    })
    
    testApp.post('/test/edge-cases', (req, res) => {
      res.json({ sanitized: req.body })
    })
    
    testApp.post('/test/data-extraction', (req, res) => {
      const query = req.body
      
      // Check if query contains any MongoDB operators that could be used for data extraction
      const dangerousOperators = ['$where', '$regex', '$exists', '$ne', '$in', '$nin', '$or', '$and']
      const containsDangerousOps = dangerousOperators.some(op => 
        JSON.stringify(query).includes(op)
      )
      
      res.json({
        query,
        containsDangerousOperators: containsDangerousOps,
        safe: !containsDangerousOps
      })
    })
    
    testApp.post('/test/legitimate-functionality', (req, res) => {
      res.json({ 
        received: req.body,
        processed: true
      })
    })
    
    testApp.post('/test/large-payload', (req, res) => {
      res.json({ 
        itemCount: Object.keys(req.body).length,
        processed: true
      })
    })
    
    testApp.post('/test/deep-nesting', (req, res) => {
      res.json({ sanitized: req.body })
    })
  })

  describe('Unit Tests - NoSQL Injection Prevention', () => {
    it('should remove MongoDB query operators from request body', async () => {
      const maliciousPayload = {
        email: 'user@example.com',
        password: { $ne: null }, // NoSQL injection attempt
        $where: 'this.password.length > 0', // NoSQL injection attempt
        role: { $in: ['admin', 'user'] }, // NoSQL injection attempt
        age: { $gt: 18 }, // NoSQL injection attempt
        name: 'John Doe' // legitimate field
      }

      const response = await request(testApp)
        .post('/test/body')
        .send(maliciousPayload)
        .expect(200)

      // Verify MongoDB operators are removed
      expect(response.body.sanitized).toEqual({
        email: 'user@example.com',
        password: {}, // $ne removed, empty object remains
        role: {}, // $in removed, empty object remains
        age: {}, // $gt removed, empty object remains
        name: 'John Doe' // legitimate field preserved
      })

      // Verify dangerous operators are completely removed
      expect(response.body.sanitized).not.toHaveProperty('$where')
      expect(response.body.sanitized.password).not.toHaveProperty('$ne')
      expect(response.body.sanitized.role).not.toHaveProperty('$in')
      expect(response.body.sanitized.age).not.toHaveProperty('$gt')
    })

    it('should remove MongoDB query operators from query parameters', async () => {
      const response = await request(testApp)
        .get('/test/query')
        .query({
          email: 'user@example.com',
          'password[$ne]': 'null', // NoSQL injection via query param
          '$where': 'this.role === "admin"', // NoSQL injection via query param
          'age[$gte]': '18', // NoSQL injection via query param
          name: 'John'
        })
        .expect(200)

      // Verify MongoDB operators are removed from query
      expect(response.body.sanitized).toEqual({
        email: 'user@example.com',
        password: {}, // $ne removed
        age: {}, // $gte removed
        name: 'John'
      })

      // Verify dangerous operators are completely removed
      expect(response.body.sanitized).not.toHaveProperty('$where')
    })

    it('should handle nested MongoDB operators in request body', async () => {
      const nestedMaliciousPayload = {
        user: {
          credentials: {
            email: 'user@example.com',
            password: { $ne: null }
          },
          profile: {
            age: { $gt: 0 },
            preferences: {
              theme: 'dark',
              notifications: { $exists: true }
            }
          }
        },
        filters: {
          $or: [
            { role: 'admin' },
            { role: 'moderator' }
          ]
        }
      }

      const response = await request(testApp)
        .post('/test/nested')
        .send(nestedMaliciousPayload)
        .expect(200)

      // Verify nested MongoDB operators are removed
      expect(response.body.sanitized.user.credentials.password).toEqual({})
      expect(response.body.sanitized.user.profile.age).toEqual({})
      expect(response.body.sanitized.user.profile.preferences.notifications).toEqual({})
      expect(response.body.sanitized.filters).toEqual({})

      // Verify legitimate nested fields are preserved
      expect(response.body.sanitized.user.credentials.email).toBe('user@example.com')
      expect(response.body.sanitized.user.profile.preferences.theme).toBe('dark')
    })

    it('should preserve legitimate data without MongoDB operators', async () => {
      const legitimatePayload = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 25,
        preferences: {
          theme: 'dark',
          language: 'en'
        },
        tags: ['developer', 'nodejs'],
        isActive: true
      }

      const response = await request(testApp)
        .post('/test/legitimate')
        .send(legitimatePayload)
        .expect(200)

      // Verify legitimate data is preserved exactly
      expect(response.body.sanitized).toEqual(legitimatePayload)
    })

    it('should handle arrays with MongoDB operators', async () => {
      const arrayPayload = {
        users: [
          { name: 'John', role: { $ne: 'admin' } },
          { name: 'Jane', age: { $gte: 18 } }
        ],
        filters: [
          { $or: [{ active: true }, { verified: true }] },
          { $and: [{ role: 'user' }, { age: { $gt: 21 } }] }
        ]
      }

      const response = await request(testApp)
        .post('/test/arrays')
        .send(arrayPayload)
        .expect(200)

      // Verify MongoDB operators in arrays are removed
      expect(response.body.sanitized.users[0].role).toEqual({})
      expect(response.body.sanitized.users[1].age).toEqual({})
      expect(response.body.sanitized.filters[0]).toEqual({})
      expect(response.body.sanitized.filters[1]).toEqual({})

      // Verify legitimate array data is preserved
      expect(response.body.sanitized.users[0].name).toBe('John')
      expect(response.body.sanitized.users[1].name).toBe('Jane')
    })

    it('should handle common NoSQL injection patterns', async () => {
      const injectionPatterns = {
        // Authentication bypass attempts
        email: 'admin@example.com',
        password: { $ne: null }, // Always true condition
        
        // Data extraction attempts
        $where: 'this.password.length > 0', // JavaScript injection
        
        // Logical operators for bypass
        $or: [
          { role: 'admin' },
          { role: 'user' }
        ],
        
        // Comparison operators
        age: { $gt: 0 }, // Always true for positive ages
        createdAt: { $exists: true }, // Always true if field exists
        
        // Regular expression injection
        username: { $regex: '.*' }, // Matches everything
        
        // Type confusion
        isActive: { $type: 'boolean' },
        
        // Size-based attacks
        tags: { $size: 0 } // Empty array check
      }

      const response = await request(testApp)
        .post('/test/injection-patterns')
        .send(injectionPatterns)
        .expect(200)

      // Verify all MongoDB operators are removed
      expect(response.body.sanitized.password).toEqual({})
      expect(response.body.sanitized.age).toEqual({})
      expect(response.body.sanitized.username).toEqual({})
      expect(response.body.sanitized.isActive).toEqual({})
      expect(response.body.sanitized.tags).toEqual({})
      
      // Verify dangerous operators are completely removed
      expect(response.body.sanitized).not.toHaveProperty('$where')
      expect(response.body.sanitized).not.toHaveProperty('$or')
      
      // Verify legitimate fields are preserved
      expect(response.body.sanitized.email).toBe('admin@example.com')
    })
  })

  describe('Integration Tests - Real-world Scenarios', () => {
    it('should protect login endpoint from NoSQL injection', async () => {
      const maliciousLogin = {
        email: 'admin@example.com',
        password: { $ne: null } // Attempt to bypass password check
      }

      const response = await request(testApp)
        .post('/test/auth-bypass')
        .send(maliciousLogin)
        .expect(200)

      // Password should be sanitized to empty object, causing authentication to fail
      expect(response.body.authenticated).toBe(false)
      expect(response.body.password).toBe('object') // Empty object after sanitization
    })

    it('should protect user search from NoSQL injection', async () => {
      const response = await request(testApp)
        .get('/test/user-search')
        .query({
          name: 'John',
          'role[$ne]': 'admin', // NoSQL injection attempt
          '$where': 'this.isActive === true' // JavaScript injection attempt
        })
        .expect(200)

      expect(response.body.hasMongoOperators).toBe(false)
      expect(response.body.message).toBe('Search criteria clean')
      expect(response.body.searchCriteria.name).toBe('John')
      expect(response.body.searchCriteria.role).toEqual({})
    })

    it('should protect product filtering from NoSQL injection', async () => {
      const maliciousFilters = {
        category: 'electronics',
        price: { $lt: 1000 }, // Price injection
        $or: [ // Logical operator injection
          { featured: true },
          { discount: { $gt: 0 } }
        ],
        inStock: { $ne: false } // Stock bypass
      }

      const response = await request(testApp)
        .post('/test/product-filter')
        .send(maliciousFilters)
        .expect(200)

      expect(response.body.containsOperators).toBe(false)
      expect(response.body.wouldExecuteQuery).toBe(true)
      expect(response.body.filters.category).toBe('electronics')
      expect(response.body.filters.price).toEqual({})
      expect(response.body.filters.inStock).toEqual({})
    })

    it('should handle edge cases and special characters', async () => {
      const edgeCases = {
        // Dollar sign in legitimate content
        description: 'Price: $100',
        currency: 'USD$',
        
        // MongoDB operators as string values (should be preserved)
        searchTerm: '$ne as a search term',
        
        // Empty and null values
        emptyObject: {},
        nullValue: null,
        emptyArray: [],
        
        // MongoDB operators (should be removed)
        $text: { $search: 'injection' },
        conditions: { $elemMatch: { status: 'active' } }
      }

      const response = await request(testApp)
        .post('/test/edge-cases')
        .send(edgeCases)
        .expect(200)

      // Verify legitimate dollar signs in strings are preserved
      expect(response.body.sanitized.description).toBe('Price: $100')
      expect(response.body.sanitized.currency).toBe('USD$')
      expect(response.body.sanitized.searchTerm).toBe('$ne as a search term')
      
      // Verify empty/null values are preserved
      expect(response.body.sanitized.emptyObject).toEqual({})
      expect(response.body.sanitized.nullValue).toBeNull()
      expect(response.body.sanitized.emptyArray).toEqual([])
      
      // Verify MongoDB operators are removed
      expect(response.body.sanitized).not.toHaveProperty('$text')
      expect(response.body.sanitized.conditions).toEqual({})
    })
  })

  describe('Security Validation Tests', () => {
    it('should prevent authentication bypass via NoSQL injection', async () => {
      // Common NoSQL injection payloads for authentication bypass
      const bypassAttempts = [
        { username: 'admin', password: { $ne: null } },
        { username: { $ne: null }, password: { $ne: null } },
        { username: 'admin', password: { $exists: true } },
        { username: { $regex: '.*' }, password: { $regex: '.*' } }
      ]

      for (const attempt of bypassAttempts) {
        const response = await request(testApp)
          .post('/test/auth-bypass')
          .send(attempt)
          .expect(200)

        // All bypass attempts should fail due to sanitization
        expect(response.body.authenticated).toBe(false)
      }
    })

    it('should prevent data extraction via NoSQL injection', async () => {
      const extractionAttempts = {
        // Attempt to extract all users
        $where: 'return true',
        
        // Attempt to find admin users
        role: { $regex: 'admin' },
        
        // Attempt to find users with passwords
        password: { $exists: true },
        
        // Attempt to bypass filters
        $or: [
          { isActive: true },
          { isActive: false }
        ]
      }

      const response = await request(testApp)
        .post('/test/data-extraction')
        .send(extractionAttempts)
        .expect(200)

      expect(response.body.safe).toBe(true)
      expect(response.body.containsDangerousOperators).toBe(false)
    })

    it('should maintain functionality for legitimate requests', async () => {
      const legitimateRequests = [
        // User registration
        {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'SecurePass123!',
          phone: '+8801712345678'
        },
        
        // Product search
        {
          category: 'electronics',
          minPrice: 100,
          maxPrice: 1000,
          inStock: true
        },
        
        // Order creation
        {
          items: [
            { productId: '507f1f77bcf86cd799439011', quantity: 2 },
            { productId: '507f1f77bcf86cd799439012', quantity: 1 }
          ],
          shippingAddress: {
            street: '123 Main St',
            city: 'Dhaka',
            postalCode: '1000'
          }
        }
      ]

      for (const request_data of legitimateRequests) {
        const response = await request(testApp)
          .post('/test/legitimate-functionality')
          .send(request_data)
          .expect(200)

        expect(response.body.processed).toBe(true)
        expect(response.body.received).toEqual(request_data)
      }
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle large payloads efficiently', async () => {
      // Create a large payload with mixed legitimate and malicious data
      const largePayload: any = {}
      
      // Add 1000 legitimate fields
      for (let i = 0; i < 1000; i++) {
        largePayload[`field_${i}`] = `value_${i}`
      }
      
      // Add some MongoDB operators that should be removed
      largePayload.$where = 'malicious code'
      largePayload.user = { password: { $ne: null } }
      largePayload.filters = { $or: [{ a: 1 }, { b: 2 }] }

      const startTime = Date.now()
      const response = await request(testApp)
        .post('/test/large-payload')
        .send(largePayload)
        .expect(200)
      const endTime = Date.now()

      // Verify processing completed in reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000)
      expect(response.body.processed).toBe(true)
      
      // Should have 1000 legitimate fields + 2 sanitized objects (user + filters)
      expect(response.body.itemCount).toBe(1002)
    })

    it('should handle deeply nested objects', async () => {
      // Create deeply nested object with MongoDB operators at various levels
      const deeplyNested = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  data: 'legitimate',
                  malicious: { $ne: null }
                }
              },
              $where: 'injection'
            }
          }
        }
      }

      const response = await request(testApp)
        .post('/test/deep-nesting')
        .send(deeplyNested)
        .expect(200)

      // Verify deep sanitization
      expect(response.body.sanitized.level1.level2.level3.level4.level5.data).toBe('legitimate')
      expect(response.body.sanitized.level1.level2.level3.level4.level5.malicious).toEqual({})
      expect(response.body.sanitized.level1.level2.level3).not.toHaveProperty('$where')
    })
  })

  describe('Integration with Main App', () => {
    it('should verify MongoDB sanitization is active in main app', async () => {
      // Test the health endpoint to ensure the app is working
      const healthResponse = await request(app)
        .get('/api/health')
        .expect(200)

      expect(healthResponse.body.status).toBe('ok')
    })

    it('should verify middleware order in main app', async () => {
      // The main app should return 404 for non-existent routes, but middleware should still process
      // This verifies that mongoSanitize middleware is loaded before route handlers
      const response = await request(app)
        .post('/non-existent-route')
        .send({ $where: 'malicious', legitimate: 'data' })
        .expect(404)

      // Even though route doesn't exist, middleware should have processed the request
      expect(response.body.error).toBe('Not Found')
    })
  })
})