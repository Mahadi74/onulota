import { Request, Response, NextFunction } from 'express'
import Joi from 'joi'
import { 
  validate, 
  validateBody, 
  validateQuery, 
  validateParams, 
  validateRequest,
  commonSchemas,
  customJoi,
  ValidationSchemas
} from '../validate'
import { AppError } from '../errorHandler'

function makeReq(body: unknown = {}, query: unknown = {}, params: unknown = {}): Request {
  return { body, query, params } as Request
}

function makeRes(): Response {
  return {} as Response
}

function makeNext(): jest.Mock {
  return jest.fn()
}

const basicSchema = Joi.object({
  email: Joi.string().email().required(),
  age: Joi.number().min(0).required(),
})

describe('validate middleware factory', () => {
  describe('basic validation (backward compatibility)', () => {
    it('calls next() and sets req.body to validated value on valid input', () => {
      const req = makeReq({ email: 'user@example.com', age: 25 })
      const next = makeNext()

      validate(basicSchema)(req, makeRes(), next)

      expect(next).toHaveBeenCalledWith()
      expect(req.body).toEqual({ email: 'user@example.com', age: 25 })
    })

    it('strips unknown fields from req.body', () => {
      const req = makeReq({ email: 'user@example.com', age: 25, extra: 'should be removed' })
      const next = makeNext()

      validate(basicSchema)(req, makeRes(), next)

      expect(next).toHaveBeenCalledWith()
      expect(req.body).not.toHaveProperty('extra')
    })

    it('calls next(AppError 400) when required field is missing', () => {
      const req = makeReq({ email: 'user@example.com' }) // missing age
      const next = makeNext()

      validate(basicSchema)(req, makeRes(), next)

      expect(next).toHaveBeenCalledWith(expect.any(AppError))
      const err = next.mock.calls[0][0] as AppError
      expect(err.statusCode).toBe(400)
      expect(err.message).toContain('Missing required fields: age')
    })

    it('includes field-level details in the error', () => {
      const req = makeReq({ email: 'not-an-email', age: -1 })
      const next = makeNext()

      validate(basicSchema)(req, makeRes(), next)

      expect(next).toHaveBeenCalledWith(expect.any(AppError))
      const err = next.mock.calls[0][0] as AppError & { details: Array<{ field: string; message: string; location: string }> }
      expect(err.details).toBeInstanceOf(Array)
      expect(err.details.length).toBeGreaterThan(0)
      expect(err.details[0]).toHaveProperty('field')
      expect(err.details[0]).toHaveProperty('message')
      expect(err.details[0]).toHaveProperty('location')
    })

    it('reports all validation errors (abortEarly: false)', () => {
      const req = makeReq({ email: 'bad', age: -5 })
      const next = makeNext()

      validate(basicSchema)(req, makeRes(), next)

      const err = next.mock.calls[0][0] as AppError & { details: Array<{ field: string }> }
      expect(err.details.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('multi-target validation', () => {
    const schemas: ValidationSchemas = {
      body: Joi.object({
        name: Joi.string().required(),
      }),
      query: Joi.object({
        page: Joi.number().min(1).required(),
      }),
      params: Joi.object({
        id: Joi.string().required(),
      }),
    }

    it('validates body, query, and params simultaneously', () => {
      const req = makeReq(
        { name: 'John' },
        { page: 1 },
        { id: 'abc123' }
      )
      const next = makeNext()

      validate(schemas)(req, makeRes(), next)

      expect(next).toHaveBeenCalledWith()
      expect(req.body).toEqual({ name: 'John' })
      expect(req.query).toEqual({ page: 1 })
      expect(req.params).toEqual({ id: 'abc123' })
    })

    it('reports errors from multiple targets with location information', () => {
      const req = makeReq(
        {}, // missing name
        {}, // missing page
        {} // missing id
      )
      const next = makeNext()

      validate(schemas)(req, makeRes(), next)

      const err = next.mock.calls[0][0] as AppError & { details: Array<{ field: string; location: string }> }
      expect(err.details).toHaveLength(3)
      
      const locations = err.details.map(d => d.location)
      expect(locations).toContain('body')
      expect(locations).toContain('query')
      expect(locations).toContain('params')
    })

    it('validates only specified targets', () => {
      const partialSchemas: ValidationSchemas = {
        body: Joi.object({
          name: Joi.string().required(),
        }),
      }

      const req = makeReq(
        { name: 'John' },
        { invalidQuery: 'should be ignored' },
        { invalidParam: 'should be ignored' }
      )
      const next = makeNext()

      validate(partialSchemas)(req, makeRes(), next)

      expect(next).toHaveBeenCalledWith()
      expect(req.body).toEqual({ name: 'John' })
      // query and params should remain unchanged since no schema provided
      expect(req.query).toEqual({ invalidQuery: 'should be ignored' })
      expect(req.params).toEqual({ invalidParam: 'should be ignored' })
    })
  })

  describe('XSS sanitization', () => {
    const xssSchema = Joi.object({
      comment: Joi.string().required(),
      nested: Joi.object({
        text: Joi.string().required(),
      }),
      items: Joi.array().items(Joi.string()),
    })

    it('sanitizes HTML special characters in strings', () => {
      const req = makeReq({
        comment: '<script>alert("xss")</script>',
        nested: {
          text: 'Hello & "world"',
        },
        items: ['<img src=x onerror=alert(1)>', "It's a test"],
      })
      const next = makeNext()

      validate(xssSchema)(req, makeRes(), next)

      expect(next).toHaveBeenCalledWith()
      expect(req.body.comment).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;')
      expect(req.body.nested.text).toBe('Hello &amp; &quot;world&quot;')
      expect(req.body.items[0]).toBe('&lt;img src=x onerror=alert(1)&gt;')
      expect(req.body.items[1]).toBe('It&#x27;s a test')
    })

    it('preserves non-string values during sanitization', () => {
      const mixedSchema = Joi.object({
        text: Joi.string().required(),
        number: Joi.number().required(),
        boolean: Joi.boolean().required(),
        date: Joi.date().required(),
      })

      const testDate = new Date('2023-01-01')
      const req = makeReq({
        text: '<script>',
        number: 42,
        boolean: true,
        date: testDate,
      })
      const next = makeNext()

      validate(mixedSchema)(req, makeRes(), next)

      expect(next).toHaveBeenCalledWith()
      expect(req.body.text).toBe('&lt;script&gt;')
      expect(req.body.number).toBe(42)
      expect(req.body.boolean).toBe(true)
      expect(req.body.date).toEqual(testDate)
    })
  })

  describe('convenience functions', () => {
    it('validateBody works correctly', () => {
      const req = makeReq({ name: 'John' })
      const next = makeNext()

      validateBody(Joi.object({ name: Joi.string().required() }))(req, makeRes(), next)

      expect(next).toHaveBeenCalledWith()
      expect(req.body).toEqual({ name: 'John' })
    })

    it('validateQuery works correctly', () => {
      const req = makeReq({}, { page: 1 })
      const next = makeNext()

      validateQuery(Joi.object({ page: Joi.number().required() }))(req, makeRes(), next)

      expect(next).toHaveBeenCalledWith()
      expect(req.query).toEqual({ page: 1 })
    })

    it('validateParams works correctly', () => {
      const req = makeReq({}, {}, { id: 'abc123' })
      const next = makeNext()

      validateParams(Joi.object({ id: Joi.string().required() }))(req, makeRes(), next)

      expect(next).toHaveBeenCalledWith()
      expect(req.params).toEqual({ id: 'abc123' })
    })

    it('validateRequest is an alias for validateBody', () => {
      const req = makeReq({ email: 'user@example.com', age: 30 })
      const next = makeNext()

      validateRequest(basicSchema)(req, makeRes(), next)

      expect(next).toHaveBeenCalledWith()
      expect(req.body).toEqual({ email: 'user@example.com', age: 30 })
    })
  })

  describe('custom Joi extensions', () => {
    it('validates RFC 5322 email format', () => {
      const emailSchema = Joi.object({
        email: customJoi.string().emailRFC5322().required(),
      })

      // Valid email
      const validReq = makeReq({ email: 'user@example.com' })
      const validNext = makeNext()
      validate(emailSchema)(validReq, makeRes(), validNext)
      expect(validNext).toHaveBeenCalledWith()

      // Invalid email
      const invalidReq = makeReq({ email: 'invalid.email' })
      const invalidNext = makeNext()
      validate(emailSchema)(invalidReq, makeRes(), invalidNext)
      expect(invalidNext).toHaveBeenCalledWith(expect.any(AppError))
    })
  })

  describe('common schemas', () => {
    it('validates email with RFC 5322 format', () => {
      const req = makeReq({ email: 'test@example.com' })
      const next = makeNext()

      validate(Joi.object({ email: commonSchemas.email }))(req, makeRes(), next)

      expect(next).toHaveBeenCalledWith()
    })

    it('validates password strength requirements', () => {
      const validReq = makeReq({ password: 'StrongPass123!' })
      const validNext = makeNext()
      validate(Joi.object({ password: commonSchemas.password }))(validReq, makeRes(), validNext)
      expect(validNext).toHaveBeenCalledWith()

      const invalidReq = makeReq({ password: 'weak' })
      const invalidNext = makeNext()
      validate(Joi.object({ password: commonSchemas.password }))(invalidReq, makeRes(), invalidNext)
      expect(invalidNext).toHaveBeenCalledWith(expect.any(AppError))
    })

    it('validates Bangladesh phone number format', () => {
      const validReq = makeReq({ phone: '+8801712345678' })
      const validNext = makeNext()
      validate(Joi.object({ phone: commonSchemas.phone }))(validReq, makeRes(), validNext)
      expect(validNext).toHaveBeenCalledWith()

      const invalidReq = makeReq({ phone: '01712345678' })
      const invalidNext = makeNext()
      validate(Joi.object({ phone: commonSchemas.phone }))(invalidReq, makeRes(), invalidNext)
      expect(invalidNext).toHaveBeenCalledWith(expect.any(AppError))
    })

    it('validates Bangladesh postal code format', () => {
      const validReq = makeReq({ postalCode: '1234' })
      const validNext = makeNext()
      validate(Joi.object({ postalCode: commonSchemas.postalCode }))(validReq, makeRes(), validNext)
      expect(validNext).toHaveBeenCalledWith()

      const invalidReq = makeReq({ postalCode: '12345' })
      const invalidNext = makeNext()
      validate(Joi.object({ postalCode: commonSchemas.postalCode }))(invalidReq, makeRes(), invalidNext)
      expect(invalidNext).toHaveBeenCalledWith(expect.any(AppError))
    })

    it('validates price within range', () => {
      const validReq = makeReq({ price: 99.99 })
      const validNext = makeNext()
      validate(Joi.object({ price: commonSchemas.price }))(validReq, makeRes(), validNext)
      expect(validNext).toHaveBeenCalledWith()

      const invalidReq = makeReq({ price: -10 })
      const invalidNext = makeNext()
      validate(Joi.object({ price: commonSchemas.price }))(invalidReq, makeRes(), invalidNext)
      expect(invalidNext).toHaveBeenCalledWith(expect.any(AppError))
    })

    it('validates rating range (1-5)', () => {
      const validReq = makeReq({ rating: 4 })
      const validNext = makeNext()
      validate(Joi.object({ rating: commonSchemas.rating }))(validReq, makeRes(), validNext)
      expect(validNext).toHaveBeenCalledWith()

      const invalidReq = makeReq({ rating: 6 })
      const invalidNext = makeNext()
      validate(Joi.object({ rating: commonSchemas.rating }))(invalidReq, makeRes(), invalidNext)
      expect(invalidNext).toHaveBeenCalledWith(expect.any(AppError))
    })

    it('validates enum values for order status', () => {
      const validReq = makeReq({ status: 'pending' })
      const validNext = makeNext()
      validate(Joi.object({ status: commonSchemas.orderStatus }))(validReq, makeRes(), validNext)
      expect(validNext).toHaveBeenCalledWith()

      const invalidReq = makeReq({ status: 'invalid_status' })
      const invalidNext = makeNext()
      validate(Joi.object({ status: commonSchemas.orderStatus }))(invalidReq, makeRes(), invalidNext)
      expect(invalidNext).toHaveBeenCalledWith(expect.any(AppError))
    })

    it('validates string length constraints', () => {
      const longStringSchema = Joi.object({
        name: Joi.string().min(2).max(100).required(),
      })

      const validReq = makeReq({ name: 'Valid Name' })
      const validNext = makeNext()
      validate(longStringSchema)(validReq, makeRes(), validNext)
      expect(validNext).toHaveBeenCalledWith()

      const tooShortReq = makeReq({ name: 'A' })
      const tooShortNext = makeNext()
      validate(longStringSchema)(tooShortReq, makeRes(), tooShortNext)
      expect(tooShortNext).toHaveBeenCalledWith(expect.any(AppError))

      const tooLongReq = makeReq({ name: 'A'.repeat(101) })
      const tooLongNext = makeNext()
      validate(longStringSchema)(tooLongReq, makeRes(), tooLongNext)
      expect(tooLongNext).toHaveBeenCalledWith(expect.any(AppError))
    })
  })

  describe('error message formatting', () => {
    it('provides specific message for missing required fields only', () => {
      const req = makeReq({}) // missing both email and age
      const next = makeNext()

      validate(basicSchema)(req, makeRes(), next)

      const err = next.mock.calls[0][0] as AppError
      expect(err.message).toMatch(/Missing required fields:/)
      expect(err.message).toContain('email')
      expect(err.message).toContain('age')
    })

    it('provides combined message for missing and invalid fields', () => {
      const req = makeReq({ email: 'invalid', age: -1 }) // invalid email, invalid age, missing nothing
      const next = makeNext()

      validate(basicSchema)(req, makeRes(), next)

      const err = next.mock.calls[0][0] as AppError
      expect(err.message).toBe('Invalid input data')
    })

    it('provides combined message when both missing and invalid fields exist', () => {
      const extendedSchema = Joi.object({
        email: Joi.string().email().required(),
        age: Joi.number().min(0).required(),
        name: Joi.string().required(),
      })

      const req = makeReq({ email: 'invalid', age: -1 }) // missing name, invalid email and age
      const next = makeNext()

      validate(extendedSchema)(req, makeRes(), next)

      const err = next.mock.calls[0][0] as AppError
      expect(err.message).toMatch(/Missing required fields: name\. Additional validation errors found\./)
    })
  })
})
