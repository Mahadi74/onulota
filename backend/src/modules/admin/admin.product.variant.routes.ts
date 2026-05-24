/**
 * Admin product variant routes for managing product variants.
 * 
 * All routes require admin authentication.
 */

import { Router } from 'express'
import express from 'express'
import Joi from 'joi'
import { authenticateToken, requireRole } from '../../middleware/auth'
import { validateBody, validateParams } from '../../middleware/validate'
import {
  addVariantHandler,
  updateVariantHandler,
  deleteVariantHandler,
  getVariantsHandler,
  getVariantHandler,
} from './admin.product.variant.controller'

const router = Router({ mergeParams: true })

/**
 * Joi validation schema for adding a variant.
 * 
 * Required fields:
 *   - name: Variant name (max 200 chars)
 *   - price: Variant price (min 0)
 *   - stock: Variant stock (min 0, integer)
 * 
 * Optional fields:
 *   - sku: Variant SKU (max 100 chars)
 */
const addVariantSchema = Joi.object({
  name: Joi.string().max(200).required().messages({
    'any.required': 'Variant name is required',
    'string.empty': 'Variant name cannot be empty',
    'string.max': 'Variant name must not exceed 200 characters',
  }),
  sku: Joi.string().max(100).optional().messages({
    'string.max': 'Variant SKU must not exceed 100 characters',
  }),
  price: Joi.number().min(0).precision(2).required().messages({
    'any.required': 'Variant price is required',
    'number.base': 'Variant price must be a number',
    'number.min': 'Variant price must be at least 0',
  }),
  stock: Joi.number().integer().min(0).required().messages({
    'any.required': 'Variant stock is required',
    'number.base': 'Variant stock must be a number',
    'number.integer': 'Variant stock must be an integer',
    'number.min': 'Variant stock must be at least 0',
  }),
})

/**
 * Joi validation schema for updating a variant.
 * All fields are optional.
 */
const updateVariantSchema = Joi.object({
  name: Joi.string().max(200).optional().messages({
    'string.empty': 'Variant name cannot be empty',
    'string.max': 'Variant name must not exceed 200 characters',
  }),
  sku: Joi.string().max(100).optional().messages({
    'string.max': 'Variant SKU must not exceed 100 characters',
  }),
  price: Joi.number().min(0).precision(2).optional().messages({
    'number.min': 'Variant price must be at least 0',
  }),
  stock: Joi.number().integer().min(0).optional().messages({
    'number.integer': 'Variant stock must be an integer',
    'number.min': 'Variant stock must be at least 0',
  }),
})

/**
 * Joi validation schema for product and variant IDs in URL params.
 */
const productIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'id must be a valid product ID',
      'any.required': 'Product ID is required',
    }),
})

const variantIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'id must be a valid product ID',
      'any.required': 'Product ID is required',
    }),
  variantId: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'variantId must be a valid variant ID',
      'any.required': 'Variant ID is required',
    }),
})

const auth = authenticateToken as express.RequestHandler
const adminOnly = requireRole('admin') as express.RequestHandler

/**
 * POST /api/admin/products/:id/variants
 *
 * Adds a new variant to a product. Requires admin authentication.
 *
 * URL params:
 *   - id: Product ID (MongoDB ObjectId)
 *
 * Request body:
 *   - name (required): Variant name (e.g., 'Size: L, Color: Red')
 *   - sku (optional): Variant SKU (must be unique within product)
 *   - price (required): Variant price (min 0)
 *   - stock (required): Variant stock quantity (min 0, integer)
 *
 * Returns 201 with the updated product on success.
 *
 * Requirement 15.6: THE Platform SHALL allow Admins to set product variants (size, color) with separate stock quantities and prices
 */
router.post(
  '/',
  auth,
  adminOnly,
  validateParams(productIdParamSchema) as express.RequestHandler,
  validateBody(addVariantSchema) as express.RequestHandler,
  addVariantHandler as express.RequestHandler
)

/**
 * GET /api/admin/products/:id/variants
 *
 * Gets all variants for a product. Requires admin authentication.
 *
 * URL params:
 *   - id: Product ID (MongoDB ObjectId)
 *
 * Returns 200 with array of variants on success.
 *
 * Requirement 15.6: THE Platform SHALL allow Admins to set product variants (size, color) with separate stock quantities and prices
 */
router.get(
  '/',
  auth,
  adminOnly,
  validateParams(productIdParamSchema) as express.RequestHandler,
  getVariantsHandler as express.RequestHandler
)

/**
 * GET /api/admin/products/:id/variants/:variantId
 *
 * Gets a specific variant from a product. Requires admin authentication.
 *
 * URL params:
 *   - id: Product ID (MongoDB ObjectId)
 *   - variantId: Variant ID (MongoDB ObjectId)
 *
 * Returns 200 with the variant data on success.
 *
 * Requirement 15.6: THE Platform SHALL allow Admins to set product variants (size, color) with separate stock quantities and prices
 */
router.get(
  '/:variantId',
  auth,
  adminOnly,
  validateParams(variantIdParamSchema) as express.RequestHandler,
  getVariantHandler as express.RequestHandler
)

/**
 * PUT /api/admin/products/:id/variants/:variantId
 *
 * Updates an existing variant in a product. Requires admin authentication.
 *
 * URL params:
 *   - id: Product ID (MongoDB ObjectId)
 *   - variantId: Variant ID (MongoDB ObjectId)
 *
 * Request body (all optional):
 *   - name: Variant name
 *   - sku: Variant SKU (must be unique within product)
 *   - price: Variant price
 *   - stock: Variant stock quantity
 *
 * Returns 200 with the updated product on success.
 *
 * Requirement 15.6: THE Platform SHALL allow Admins to set product variants (size, color) with separate stock quantities and prices
 */
router.put(
  '/:variantId',
  auth,
  adminOnly,
  validateParams(variantIdParamSchema) as express.RequestHandler,
  validateBody(updateVariantSchema) as express.RequestHandler,
  updateVariantHandler as express.RequestHandler
)

/**
 * DELETE /api/admin/products/:id/variants/:variantId
 *
 * Deletes a variant from a product. Requires admin authentication.
 *
 * URL params:
 *   - id: Product ID (MongoDB ObjectId)
 *   - variantId: Variant ID (MongoDB ObjectId)
 *
 * Returns 200 with a success message on successful deletion.
 *
 * Requirement 15.6: THE Platform SHALL allow Admins to set product variants (size, color) with separate stock quantities and prices
 */
router.delete(
  '/:variantId',
  auth,
  adminOnly,
  validateParams(variantIdParamSchema) as express.RequestHandler,
  deleteVariantHandler as express.RequestHandler
)

export default router
