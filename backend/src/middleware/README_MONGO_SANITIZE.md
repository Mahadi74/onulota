# MongoDB Sanitization Middleware

## Overview

The MongoDB sanitization middleware protects the onulota eCommerce Platform from NoSQL injection attacks by automatically removing MongoDB query operators from user input. This middleware is implemented using the `express-mongo-sanitize` library and is integrated into the Express application pipeline.

## Security Protection

### What is NoSQL Injection?

NoSQL injection is a security vulnerability where attackers inject malicious MongoDB query operators into user input to:
- Bypass authentication mechanisms
- Extract unauthorized data
- Manipulate database queries
- Gain unauthorized access to the system

### Common Attack Vectors

#### 1. Authentication Bypass
```javascript
// Malicious login attempt
{
  "email": "admin@example.com",
  "password": { "$ne": null }  // Always evaluates to true
}

// After sanitization
{
  "email": "admin@example.com", 
  "password": {}  // Empty object, authentication fails
}
```

#### 2. Data Extraction
```javascript
// Attempt to extract all users
{
  "$where": "return true",
  "role": { "$regex": ".*" }
}

// After sanitization
{
  "role": {}  // MongoDB operators removed
}
```

#### 3. Query Manipulation
```javascript
// Attempt to bypass filters
{
  "category": "electronics",
  "$or": [
    { "price": { "$lt": 1000 } },
    { "featured": true }
  ]
}

// After sanitization
{
  "category": "electronics"
  // $or operator completely removed
}
```

## Implementation Details

### Middleware Integration

The middleware is integrated in `backend/src/app.ts`:

```typescript
import mongoSanitize from 'express-mongo-sanitize'

// NoSQL injection prevention
app.use(mongoSanitize())
```

### Sanitization Behavior

The middleware automatically:

1. **Removes MongoDB Operators**: All keys starting with `$` are removed from request data
2. **Processes Nested Objects**: Recursively sanitizes deeply nested objects and arrays
3. **Preserves Legitimate Data**: Keeps all non-operator data intact
4. **Handles Query Parameters**: Sanitizes both request body and query parameters

### Protected MongoDB Operators

The middleware removes these dangerous operators:

- **Comparison**: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`
- **Logical**: `$and`, `$or`, `$not`, `$nor`
- **Element**: `$exists`, `$type`
- **Evaluation**: `$regex`, `$text`, `$where`, `$expr`
- **Array**: `$all`, `$elemMatch`, `$size`
- **Update**: `$set`, `$unset`, `$inc`, `$push`, `$pull`
- **Aggregation**: `$match`, `$group`, `$sort`, `$limit`

## Security Benefits

### 1. Authentication Protection
- Prevents login bypass attempts using `{ $ne: null }`
- Blocks password field manipulation
- Ensures proper credential validation

### 2. Data Access Control
- Prevents unauthorized data extraction
- Blocks query manipulation attempts
- Maintains proper access controls

### 3. Query Integrity
- Ensures queries execute as intended
- Prevents logical operator injection
- Maintains application business logic

### 4. Defense in Depth
- Works alongside input validation
- Complements parameterized queries
- Provides automatic protection

## Performance Characteristics

### Efficiency
- **Low Overhead**: Minimal performance impact on request processing
- **Fast Processing**: Handles large payloads efficiently (< 1 second for 1000+ fields)
- **Memory Efficient**: In-place sanitization without data duplication

### Scalability
- **Concurrent Safe**: Thread-safe operation for multiple requests
- **Deep Nesting**: Handles deeply nested objects without performance degradation
- **Large Arrays**: Efficiently processes arrays with many elements

## Testing Coverage

The middleware is thoroughly tested with:

### Unit Tests
- MongoDB operator removal from request body
- Query parameter sanitization
- Nested object handling
- Array processing
- Edge case handling

### Integration Tests
- Real-world attack scenario simulation
- Authentication bypass prevention
- Data extraction blocking
- Legitimate request preservation

### Security Tests
- Common injection pattern detection
- Performance under load
- Deep nesting scenarios
- Large payload handling

## Configuration

### Default Configuration
The middleware uses default settings that:
- Remove all MongoDB operators
- Process both body and query parameters
- Handle nested objects recursively
- Preserve legitimate data

### Custom Configuration (if needed)
```typescript
app.use(mongoSanitize({
  replaceWith: '_',  // Replace operators with underscore
  onSanitize: ({ req, key }) => {
    console.log(`Sanitized ${key} in ${req.method} ${req.path}`)
  }
}))
```

## Compliance

### Security Requirements
- **Requirement 24.3**: ✅ Platform SHALL prevent NoSQL injection by sanitizing MongoDB query operators
- **Requirement 22.3**: ✅ Validator SHALL sanitize string inputs to prevent XSS attacks
- **Requirement 24**: ✅ Platform SHALL implement security best practices

### Standards Compliance
- **OWASP Top 10**: Addresses A03:2021 – Injection
- **CWE-943**: Improper Neutralization of Special Elements in Data Query Logic
- **NIST Cybersecurity Framework**: Protect function implementation

## Monitoring and Logging

### Security Events
The middleware operates silently but can be monitored through:
- Request logging (via Morgan middleware)
- Error tracking (via Winston logger)
- Security audit trails

### Recommended Monitoring
```typescript
// Log sanitization events (optional)
app.use(mongoSanitize({
  onSanitize: ({ req, key }) => {
    logger.warn('NoSQL injection attempt detected', {
      method: req.method,
      path: req.path,
      sanitizedKey: key,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    })
  }
}))
```

## Best Practices

### 1. Layer Security
- Use alongside input validation (Joi schemas)
- Implement parameterized queries in database layer
- Apply principle of least privilege

### 2. Regular Updates
- Keep `express-mongo-sanitize` library updated
- Monitor security advisories
- Test after updates

### 3. Comprehensive Testing
- Test all input vectors (body, query, params)
- Validate against known attack patterns
- Include performance testing

### 4. Documentation
- Document security measures for team
- Include in security review processes
- Maintain incident response procedures

## Troubleshooting

### Common Issues

#### Legitimate Dollar Signs Removed
**Problem**: Fields with legitimate `$` characters are sanitized
**Solution**: Use string values instead of object keys
```javascript
// ❌ This will be sanitized
{ price: { $currency: "USD" } }

// ✅ This will be preserved  
{ price: "100 USD$", currency: "USD" }
```

#### Performance with Large Objects
**Problem**: Slow processing of very large nested objects
**Solution**: Implement request size limits and pagination
```typescript
app.use(express.json({ limit: '10mb' }))
```

### Debugging
Enable detailed logging to debug sanitization:
```typescript
const debug = require('debug')('app:security')
app.use((req, res, next) => {
  debug('Request body before sanitization:', req.body)
  next()
})
```

## Related Security Measures

### Input Validation
- Joi schema validation in `validate.ts`
- Type checking and format validation
- Business rule enforcement

### Authentication
- JWT token validation
- Role-based access control
- Session management

### Rate Limiting
- Request throttling per IP/user
- Brute force protection
- DDoS mitigation

### Security Headers
- Helmet.js security headers
- CORS policy enforcement
- Content Security Policy

## Conclusion

The MongoDB sanitization middleware provides essential protection against NoSQL injection attacks while maintaining application performance and functionality. It serves as a critical security layer in the defense-in-depth strategy for the onulota eCommerce Platform.

For questions or security concerns, contact the development team or security team.