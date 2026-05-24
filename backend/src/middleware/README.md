# Middleware Documentation

This directory contains security and validation middleware for the onulota eCommerce Platform, providing comprehensive protection against common web vulnerabilities.

## Security Middleware

### 🛡️ MongoDB Sanitization Middleware

**Location**: Integrated in `app.ts` via `express-mongo-sanitize`  
**Documentation**: See `README_MONGO_SANITIZE.md` for detailed information

Protects against NoSQL injection attacks by automatically removing MongoDB query operators from user input.

**Key Features:**
- Removes dangerous MongoDB operators (`$ne`, `$gt`, `$where`, etc.)
- Processes request body, query parameters, and nested objects
- Maintains application performance with minimal overhead
- Provides comprehensive test coverage

**Requirements Compliance:**
- ✅ **Requirement 24.3**: Platform SHALL prevent NoSQL injection by sanitizing MongoDB query operators

### 📝 Input Validation Middleware

**Location**: `validate.ts`  
**Documentation**: See sections below for detailed usage

Provides comprehensive input validation, sanitization, and error handling for API requests.

## Features

### ✅ Requirements Compliance

**Input Validation (Requirement 22):**
- **22.1** ✅ Returns 400 Bad Request with specific field errors for invalid data types
- **22.2** ✅ Returns 400 Bad Request listing missing required fields  
- **22.3** ✅ Sanitizes string inputs to prevent XSS attacks by escaping HTML special characters
- **22.4** ✅ Validates email addresses using RFC 5322 format
- **22.5** ✅ Validates numeric fields within specified ranges
- **22.6** ✅ Validates string fields don't exceed maximum length constraints
- **22.7** ✅ Validates enum fields contain only allowed values

**Security Protection (Requirement 24):**
- **24.3** ✅ Platform SHALL prevent NoSQL injection by sanitizing MongoDB query operators

### 🚀 Enhanced Features

- **Multi-target validation**: Validate `req.body`, `req.query`, and `req.params` simultaneously
- **XSS protection**: Automatic sanitization of string inputs while preserving other data types
- **Bangladesh localization**: Built-in schemas for local formats (phone, postal code)
- **Comprehensive error reporting**: Detailed field-level errors with location information
- **Type safety**: Full TypeScript support with proper type definitions
- **Backward compatibility**: Existing code continues to work without changes

## Usage

### Basic Usage (Body Validation)

```typescript
import { validateBody, commonSchemas } from '../middleware/validate'
import Joi from 'joi'

const userSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: commonSchemas.email,
  password: commonSchemas.password,
})

router.post('/users', validateBody(userSchema), (req, res) => {
  // req.body is validated and sanitized
  const { name, email, password } = req.body
  res.json({ message: 'User created', user: { name, email } })
})
```

### Multi-target Validation

```typescript
import { validate, ValidationSchemas } from '../middleware/validate'

const schemas: ValidationSchemas = {
  params: Joi.object({
    id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  }),
  body: Joi.object({
    name: Joi.string().min(3).max(200).optional(),
    price: commonSchemas.price.optional(),
  }),
  query: Joi.object({
    notify: Joi.boolean().default(false),
  }),
}

router.put('/products/:id', validate(schemas), (req, res) => {
  // All targets validated: req.params, req.body, req.query
  const { id } = req.params
  const updates = req.body
  const { notify } = req.query
  
  res.json({ productId: id, updates, notificationSent: notify })
})
```

### Query Parameter Validation

```typescript
import { validateQuery } from '../middleware/validate'

const searchSchema = Joi.object({
  q: Joi.string().min(1).max(100).optional(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
})

router.get('/products', validateQuery(searchSchema), (req, res) => {
  // req.query is validated with defaults applied
  const { q, page, limit } = req.query
  res.json({ query: q, pagination: { page, limit } })
})
```

### URL Parameter Validation

```typescript
import { validateParams } from '../middleware/validate'

const paramsSchema = Joi.object({
  userId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
})

router.get('/users/:userId', validateParams(paramsSchema), (req, res) => {
  // req.params.userId is validated
  const { userId } = req.params
  res.json({ userId })
})
```

## Common Schemas

Pre-built validation schemas for common eCommerce data types:

```typescript
import { commonSchemas } from '../middleware/validate'

// Email with RFC 5322 validation
commonSchemas.email

// Strong password requirements
commonSchemas.password

// Bangladesh phone number (+880XXXXXXXXXX)
commonSchemas.phone

// Bangladesh postal code (4 digits)
commonSchemas.postalCode

// Price with range validation (0-1,000,000)
commonSchemas.price

// Rating (1-5 stars)
commonSchemas.rating

// Quantity (1-999)
commonSchemas.quantity

// Order status enum
commonSchemas.orderStatus

// Payment method enum
commonSchemas.paymentMethod

// User role enum
commonSchemas.userRole
```

## Custom Joi Extensions

### RFC 5322 Email Validation

```typescript
import { customJoi } from '../middleware/validate'

const schema = Joi.object({
  email: customJoi.string().emailRFC5322().required(),
})
```

## XSS Protection

The middleware automatically sanitizes string inputs to prevent XSS attacks:

```typescript
// Input
{
  comment: '<script>alert("xss")</script>',
  rating: 5
}

// After validation and sanitization
{
  comment: '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;',
  rating: 5  // Non-strings preserved
}
```

## Error Response Format

### Validation Errors (400 Bad Request)

```json
{
  "error": "Bad Request",
  "message": "Missing required fields: email, password",
  "details": [
    {
      "field": "email",
      "message": "email is required",
      "location": "body"
    },
    {
      "field": "password", 
      "message": "password is required",
      "location": "body"
    },
    {
      "field": "page",
      "message": "page must be greater than or equal to 1",
      "location": "query"
    }
  ],
  "requestId": "req_abc123"
}
```

### Error Message Types

- **Missing fields only**: "Missing required fields: email, password"
- **Invalid fields only**: "Invalid input data"
- **Mixed errors**: "Missing required fields: email. Additional validation errors found."

## API Reference

### Functions

#### `validate(schemas: ValidationSchemas | Joi.ObjectSchema)`

Main validation middleware factory supporting multiple targets.

**Parameters:**
- `schemas`: Object with `body`, `query`, and/or `params` Joi schemas, or single schema for backward compatibility

**Returns:** Express middleware function

#### `validateBody(schema: Joi.ObjectSchema)`

Convenience function for body-only validation.

#### `validateQuery(schema: Joi.ObjectSchema)`

Convenience function for query parameter validation.

#### `validateParams(schema: Joi.ObjectSchema)`

Convenience function for URL parameter validation.

#### `validateRequest(schema: Joi.ObjectSchema)` (deprecated)

Legacy alias for `validateBody`. Use `validateBody` for new code.

### Types

#### `ValidationTarget`

```typescript
type ValidationTarget = 'body' | 'query' | 'params'
```

#### `ValidationSchemas`

```typescript
interface ValidationSchemas {
  body?: Joi.ObjectSchema
  query?: Joi.ObjectSchema  
  params?: Joi.ObjectSchema
}
```

## Testing

The validation middleware includes comprehensive test coverage:

- ✅ Basic validation (backward compatibility)
- ✅ Multi-target validation
- ✅ XSS sanitization
- ✅ Convenience functions
- ✅ Custom Joi extensions
- ✅ Common schemas
- ✅ Error message formatting

Run tests:

```bash
npm test -- --testPathPattern=validate.test.ts
```

## Examples

See `examples/validation-examples.ts` for comprehensive usage examples including:

- User registration
- Product management
- Search and filtering
- Order creation
- Review submission
- Admin operations
- Newsletter subscription

## Security Considerations

1. **NoSQL Injection Prevention**: MongoDB operators automatically removed from all user input
2. **XSS Prevention**: All string inputs are automatically sanitized
3. **Input Validation**: Strict validation prevents malformed data
4. **Error Information**: Detailed errors help developers without exposing sensitive data
5. **Type Safety**: TypeScript ensures correct usage at compile time
6. **Rate Limiting**: Use with rate limiting middleware for additional protection
7. **Defense in Depth**: Multiple security layers work together for comprehensive protection

## Performance

- **Efficient Sanitization**: Only processes strings, preserves other types
- **Early Validation**: Fails fast on invalid input
- **Minimal Overhead**: Lightweight validation with Joi
- **Caching**: Joi schemas can be reused across requests

## Migration Guide

### From Basic Validation

```typescript
// Old
validate(schema)

// New (same functionality)
validateBody(schema)
// or
validate({ body: schema })
```

### Adding Query/Param Validation

```typescript
// Old
router.get('/products', validate(bodySchema), handler)

// New
router.get('/products', validate({
  body: bodySchema,
  query: querySchema,
  params: paramsSchema
}), handler)
```

The middleware is fully backward compatible - existing code continues to work without changes.