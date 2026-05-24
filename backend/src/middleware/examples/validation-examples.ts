/**
 * Example usage of the enhanced validation middleware
 * 
 * This file demonstrates how to use the validation middleware factory
 * with different validation targets and common schemas.
 */

import { Router } from 'express'
import Joi from 'joi'
import { 
  validate, 
  validateBody, 
  validateQuery, 
  validateParams,
  commonSchemas,
  customJoi,
  ValidationSchemas
} from '../validate'

const router = Router()

// Example 1: Basic body validation (backward compatible)
const userRegistrationSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: commonSchemas.email,
  password: commonSchemas.password,
  phone: commonSchemas.phone,
})

router.post('/register', validateBody(userRegistrationSchema), (req, res) => {
  // req.body is now validated and sanitized
  const { name, email, password, phone } = req.body
  res.json({ message: 'User registered successfully', user: { name, email, phone } })
})

// Example 2: Multi-target validation (body + query + params)
const updateProductSchemas: ValidationSchemas = {
  params: Joi.object({
    id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(), // MongoDB ObjectId
  }),
  body: Joi.object({
    name: Joi.string().min(3).max(200).optional(),
    price: commonSchemas.price.optional(),
    description: Joi.string().min(10).max(5000).optional(),
  }),
  query: Joi.object({
    notify: Joi.boolean().default(false),
  }),
}

router.put('/products/:id', validate(updateProductSchemas), (req, res) => {
  // All three targets are validated: req.params.id, req.body, req.query.notify
  const { id } = req.params
  const updates = req.body
  const { notify } = req.query
  
  res.json({ 
    message: 'Product updated successfully', 
    productId: id, 
    updates,
    notificationSent: notify 
  })
})

// Example 3: Query parameter validation for search/filtering
const productSearchSchema = Joi.object({
  q: Joi.string().min(1).max(100).optional(), // search query
  category: Joi.string().optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  rating: commonSchemas.rating.optional(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  sort: Joi.string().valid('price_asc', 'price_desc', 'rating', 'newest').default('newest'),
})

router.get('/products/search', validateQuery(productSearchSchema), (req, res) => {
  // req.query is validated with defaults applied
  const { q, category, minPrice, maxPrice, rating, page, limit, sort } = req.query
  
  res.json({
    message: 'Search results',
    filters: { q, category, minPrice, maxPrice, rating },
    pagination: { page, limit },
    sort,
  })
})

// Example 4: URL parameter validation
const getUserSchema = Joi.object({
  userId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
})

router.get('/users/:userId', validateParams(getUserSchema), (req, res) => {
  // req.params.userId is validated
  const { userId } = req.params
  res.json({ message: 'User details', userId })
})

// Example 5: Order creation with comprehensive validation
const createOrderSchemas: ValidationSchemas = {
  body: Joi.object({
    items: Joi.array().items(
      Joi.object({
        productId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
        quantity: commonSchemas.quantity,
        variantId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
      })
    ).min(1).required(),
    shippingAddress: Joi.object({
      recipientName: Joi.string().min(2).max(100).required(),
      phone: commonSchemas.phone.required(),
      street: Joi.string().min(5).max(200).required(),
      city: Joi.string().min(2).max(50).required(),
      postalCode: commonSchemas.postalCode.required(),
      country: Joi.string().default('Bangladesh'),
    }).required(),
    paymentMethod: commonSchemas.paymentMethod,
    couponCode: Joi.string().uppercase().optional(),
  }),
  query: Joi.object({
    validateOnly: Joi.boolean().default(false), // dry run validation
  }),
}

router.post('/orders', validate(createOrderSchemas), (req, res) => {
  // Comprehensive validation of order data
  const { items, shippingAddress, paymentMethod, couponCode } = req.body
  const { validateOnly } = req.query
  
  if (validateOnly) {
    return res.json({ message: 'Order validation passed', valid: true })
  }
  
  res.json({
    message: 'Order created successfully',
    order: {
      items,
      shippingAddress,
      paymentMethod,
      couponCode,
    },
  })
})

// Example 6: Review submission with XSS protection
const submitReviewSchema = Joi.object({
  rating: commonSchemas.rating,
  comment: Joi.string().max(1000).optional(),
  // Note: HTML in comment will be automatically sanitized
})

router.post('/products/:productId/reviews', 
  validateParams(Joi.object({ productId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required() })),
  validateBody(submitReviewSchema),
  (req, res) => {
    // req.body.comment is sanitized to prevent XSS attacks
    const { productId } = req.params
    const { rating, comment } = req.body
    
    res.json({
      message: 'Review submitted successfully',
      review: { productId, rating, comment },
    })
  }
)

// Example 7: Admin user management with role validation
const updateUserRoleSchema = Joi.object({
  role: commonSchemas.userRole,
  isActive: Joi.boolean().optional(),
})

router.put('/admin/users/:userId/role',
  validateParams(Joi.object({ userId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required() })),
  validateBody(updateUserRoleSchema),
  (req, res) => {
    const { userId } = req.params
    const { role, isActive } = req.body
    
    res.json({
      message: 'User role updated successfully',
      userId,
      updates: { role, isActive },
    })
  }
)

// Example 8: Custom email validation with RFC 5322 compliance
const newsletterSubscriptionSchema = Joi.object({
  email: customJoi.string().emailRFC5322().required(),
  preferences: Joi.object({
    promotions: Joi.boolean().default(true),
    newProducts: Joi.boolean().default(true),
    orderUpdates: Joi.boolean().default(true),
  }).default({}),
})

router.post('/newsletter/subscribe', validateBody(newsletterSubscriptionSchema), (req, res) => {
  // Email is validated against RFC 5322 standard
  const { email, preferences } = req.body
  
  res.json({
    message: 'Newsletter subscription successful',
    email,
    preferences,
  })
})

export default router