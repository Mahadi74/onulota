import { Request, Response, NextFunction } from 'express'
import Joi from 'joi'
import { AppError } from './errorHandler'

/**
 * Validation target types
 */
export type ValidationTarget = 'body' | 'query' | 'params'

/**
 * Validation schema configuration
 */
export interface ValidationSchemas {
  body?: Joi.ObjectSchema
  query?: Joi.ObjectSchema
  params?: Joi.ObjectSchema
}

/**
 * Sanitizes string inputs to prevent XSS attacks.
 * Only strips/encodes actual HTML tags — does NOT encode apostrophes,
 * slashes, or ampersands, which breaks URLs and normal text content.
 * React auto-escapes all text rendered via JSX, so input-time encoding
 * is unnecessary and causes double-encoding issues.
 */
function sanitizeString(value: string): string {
  // Remove HTML tags entirely — React handles display-time escaping
  return value.replace(/<[^>]*>/g, '')
}

/**
 * Recursively sanitizes all string values in an object
 */
function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return sanitizeString(obj)
  }
  
  if (obj instanceof Date) {
    return obj // Preserve Date objects
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject)
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value)
    }
    return sanitized
  }
  
  return obj
}

/**
 * Enhanced Joi schema extensions for eCommerce validation
 */
export const customJoi = Joi.extend({
  type: 'string',
  base: Joi.string(),
  messages: {
    'string.email.rfc5322': '{{#label}} must be a valid email address (RFC 5322 format)',
  },
  rules: {
    emailRFC5322: {
      method() {
        return this.$_addRule({ name: 'emailRFC5322' })
      },
      validate(value: string, helpers) {
        // RFC 5322 email validation regex (simplified but comprehensive)
        const rfc5322Regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
        
        if (!rfc5322Regex.test(value)) {
          return helpers.error('string.email.rfc5322')
        }
        
        return value
      },
    },
  },
})

/**
 * Common validation schemas for reuse
 */
export const commonSchemas = {
  email: customJoi.string().emailRFC5322().required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    }),
  phone: Joi.string()
    .pattern(/^\+880[1-9]\d{9}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Phone number must be in Bangladesh format (+880XXXXXXXXXX)',
    }),
  postalCode: Joi.string()
    .pattern(/^\d{4}$/)
    .messages({
      'string.pattern.base': 'Postal code must be 4 digits',
    }),
  price: Joi.number().min(0).max(1000000).precision(2),
  rating: Joi.number().min(1).max(5).integer(),
  quantity: Joi.number().min(1).max(999).integer(),
  orderStatus: Joi.string().valid('pending', 'processing', 'shipped', 'delivered', 'cancelled'),
  paymentMethod: Joi.string().valid('cod', 'sslcommerz', 'bkash', 'nagad'),
  userRole: Joi.string().valid('user', 'admin'),
}

/**
 * Validation middleware factory that supports body, query, and params validation
 */
export function validate(schemas: ValidationSchemas | Joi.ObjectSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Handle legacy single schema format (backward compatibility)
    const validationSchemas: ValidationSchemas = Joi.isSchema(schemas) 
      ? { body: schemas as Joi.ObjectSchema }
      : schemas as ValidationSchemas

    const errors: Array<{ field: string; message: string; location: ValidationTarget }> = []
    
    // Validate each target (body, query, params)
    for (const [target, schema] of Object.entries(validationSchemas)) {
      if (!schema) continue
      
      const targetData = req[target as ValidationTarget]
      const { error, value } = schema.validate(targetData, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      })

      if (error) {
        const targetErrors = error.details.map((detail: Joi.ValidationErrorItem) => ({
          field: detail.path.join('.'),
          message: detail.message.replace(/['"]/g, ''),
          location: target as ValidationTarget,
        }))
        errors.push(...targetErrors)
      } else {
        // Sanitize validated data to prevent XSS
        const sanitizedValue = sanitizeObject(value)
        ;(req as unknown as Record<string, unknown>)[target] = sanitizedValue
      }
    }

    if (errors.length > 0) {
      // Group errors by type for better error messages
      const missingFields = errors.filter(e => e.message.includes('required'))
      const invalidFields = errors.filter(e => !e.message.includes('required'))
      
      let errorMessage = 'Invalid input data'
      if (missingFields.length > 0 && invalidFields.length === 0) {
        const fields = missingFields.map(e => e.field).join(', ')
        errorMessage = `Missing required fields: ${fields}`
      } else if (missingFields.length > 0) {
        const fields = missingFields.map(e => e.field).join(', ')
        errorMessage = `Missing required fields: ${fields}. Additional validation errors found.`
      }

      return next(
        Object.assign(new AppError(errorMessage, 400), { details: errors })
      )
    }

    next()
  }
}

/**
 * Convenience function for validating request body only
 */
export function validateBody(schema: Joi.ObjectSchema) {
  return validate({ body: schema })
}

/**
 * Convenience function for validating query parameters only
 */
export function validateQuery(schema: Joi.ObjectSchema) {
  return validate({ query: schema })
}

/**
 * Convenience function for validating URL parameters only
 */
export function validateParams(schema: Joi.ObjectSchema) {
  return validate({ params: schema })
}

/**
 * Alias for `validateBody` — validates `req.body` against the provided Joi schema.
 * Returns 400 with field-level error details on validation failure.
 * 
 * @deprecated Use `validateBody` instead for clarity
 */
export const validateRequest = validateBody
