import { Router } from 'express'
import express from 'express'
import Joi from 'joi'
import { authenticateToken, requireRole } from '../../middleware/auth'
import { validateBody, validateParams } from '../../middleware/validate'
import { createCategoryHandler, updateCategoryHandler, deleteCategoryHandler, reorderCategoriesHandler } from './admin.category.controller'

const router = Router()

/**
 * Joi validation schema for creating a category.
 *
 * Fields:
 *   - name: required, 2–100 characters
 *   - parent: optional MongoDB ObjectId string
 *   - icon: optional string (URL or icon name)
 *   - image: optional URL string
 *   - order: optional non-negative integer for sort ordering
 */
const createCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'any.required': 'Category name is required',
    'string.empty': 'Category name is required',
    'string.min': 'Category name must be at least 2 characters',
    'string.max': 'Category name must not exceed 100 characters',
  }),
  parent: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .optional()
    .allow('')
    .messages({
      'string.pattern.base': 'parent must be a valid category ID',
    }),
  icon: Joi.string().max(500).optional(),
  image: Joi.string().uri().max(2000).optional().messages({
    'string.uri': 'image must be a valid URL',
  }),
  order: Joi.number().integer().min(0).optional().default(0),
})

/**
 * Joi validation schema for updating a category.
 *
 * All fields are optional — only provided fields are updated.
 * Fields:
 *   - name: optional, 2–100 characters
 *   - icon: optional string (URL or icon name)
 *   - image: optional URL string
 *   - order: optional non-negative integer for sort ordering
 */
const updateCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).optional().messages({
    'string.empty': 'Category name cannot be empty',
    'string.min': 'Category name must be at least 2 characters',
    'string.max': 'Category name must not exceed 100 characters',
  }),
  parent: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .optional()
    .allow('')
    .messages({
      'string.pattern.base': 'parent must be a valid category ID',
    }),
  icon: Joi.string().max(500).optional().allow(''),
  image: Joi.string().uri().max(2000).optional().allow('').messages({
    'string.uri': 'image must be a valid URL',
  }),
  order: Joi.number().integer().min(0).optional(),
})

/**
 * Joi validation schema for category ID URL param.
 */
const categoryIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'id must be a valid category ID',
      'any.required': 'Category ID is required',
    }),
})

const auth = authenticateToken as express.RequestHandler
const adminOnly = requireRole('admin') as express.RequestHandler

/**
 * POST /api/admin/categories
 *
 * Creates a new category. Requires admin role.
 *
 * Requirement 16.1 & 16.2
 */
router.post(
  '/categories',
  auth,
  adminOnly,
  validateBody(createCategorySchema) as express.RequestHandler,
  createCategoryHandler as express.RequestHandler
)

/**
 * Joi validation schema for reordering categories.
 *
 * Body:
 *   - categories: required array of objects, each with:
 *       - id: required MongoDB ObjectId string
 *       - order: required non-negative integer
 */
const reorderCategoriesSchema = Joi.object({
  categories: Joi.array()
    .items(
      Joi.object({
        id: Joi.string()
          .pattern(/^[a-f\d]{24}$/i)
          .required()
          .messages({
            'string.pattern.base': 'Each category id must be a valid MongoDB ObjectId',
            'any.required': 'Each item must have an id',
          }),
        order: Joi.number().integer().min(0).required().messages({
          'any.required': 'Each item must have an order value',
          'number.base': 'order must be a number',
          'number.integer': 'order must be an integer',
          'number.min': 'order must be a non-negative integer',
        }),
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one category must be provided',
      'any.required': 'categories array is required',
    }),
})

/**
 * PUT /api/admin/categories/reorder
 *
 * Reorders categories within the same parent level. Requires admin role.
 * This route must be declared BEFORE PUT /categories/:id to prevent Express
 * from treating "reorder" as an :id parameter.
 *
 * Requirement 16.5
 */
router.put(
  '/categories/reorder',
  auth,
  adminOnly,
  validateBody(reorderCategoriesSchema) as express.RequestHandler,
  reorderCategoriesHandler as express.RequestHandler
)

/**
 * PUT /api/admin/categories/:id
 *
 * Updates an existing category. Requires admin role.
 *
 * Requirement 16.3
 */
router.put(
  '/categories/:id',
  auth,
  adminOnly,
  validateParams(categoryIdParamSchema) as express.RequestHandler,
  validateBody(updateCategorySchema) as express.RequestHandler,
  updateCategoryHandler as express.RequestHandler
)

/**
 * DELETE /api/admin/categories/:id
 *
 * Deletes a category. Requires admin role.
 * Prevents deletion if products or child categories exist.
 *
 * Requirement 16.4
 */
router.delete(
  '/categories/:id',
  auth,
  adminOnly,
  validateParams(categoryIdParamSchema) as express.RequestHandler,
  deleteCategoryHandler as express.RequestHandler
)

export default router
