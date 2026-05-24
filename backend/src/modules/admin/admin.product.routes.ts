/**
 * Admin product routes for managing products.
 * 
 * All routes require admin authentication.
 */

import { Router, Request, Response } from 'express'
import express from 'express'
import Joi from 'joi'
import { authenticateToken, requireRole } from '../../middleware/auth'
import { validateBody, validateParams } from '../../middleware/validate'
import { uploadMultipleImages, handleUploadError } from '../../middleware/fileUpload'
import { createProductHandler, updateProductHandler, deleteProductHandler, uploadProductImagesHandler, getAdminProductsHandler } from './admin.product.controller'
import variantRoutes from './admin.product.variant.routes'

const router = Router()

/**
 * Joi validation schema for product images.
 * Each image must have a url and optional alt text.
 */
const productImageSchema = Joi.object({
  url: Joi.string().uri().required().messages({
    'string.uri': 'Image URL must be a valid URL',
    'any.required': 'Image URL is required',
  }),
  alt: Joi.string().max(500).optional().allow(''),
  thumbnail: Joi.string().uri().optional().allow(''),
  mobile: Joi.string().uri().optional().allow(''),
})

/**
 * Joi validation schema for product specifications.
 * Each specification has a key and value.
 */
const productSpecificationSchema = Joi.object({
  key: Joi.string().max(100).required().messages({
    'any.required': 'Specification key is required',
  }),
  value: Joi.string().max(500).required().messages({
    'any.required': 'Specification value is required',
  }),
})

/**
 * Joi validation schema for product variants.
 * Each variant has a name, optional SKU, price, and stock.
 */
const productVariantSchema = Joi.object({
  name: Joi.string().max(200).required().messages({
    'any.required': 'Variant name is required',
  }),
  sku: Joi.string().max(100).optional(),
  price: Joi.number().min(0).precision(2).required().messages({
    'any.required': 'Variant price is required',
    'number.min': 'Variant price must be at least 0',
  }),
  stock: Joi.number().integer().min(0).required().messages({
    'any.required': 'Variant stock is required',
    'number.min': 'Variant stock must be at least 0',
  }),
})

/**
 * Joi validation schema for creating a product.
 *
 * Required fields:
 *   - name: 3-200 characters
 *   - description: 10-5000 characters
 *   - price: non-negative number
 *   - category: valid MongoDB ObjectId
 *   - images: array with at least one image object
 *
 * Optional fields:
 *   - compareAtPrice: non-negative number
 *   - specifications: array of { key, value } objects
 *   - variants: array of variant objects
 *   - stock: non-negative integer (default 0)
 *   - isFeatured: boolean (default false)
 *   - tags: array of strings
 */
const createProductSchema = Joi.object({
  name: Joi.string().min(3).max(200).required().messages({
    'any.required': 'Product name is required',
    'string.empty': 'Product name is required',
    'string.min': 'Product name must be at least 3 characters',
    'string.max': 'Product name must not exceed 200 characters',
  }),
  description: Joi.string().min(10).max(5000).required().messages({
    'any.required': 'Product description is required',
    'string.empty': 'Product description is required',
    'string.min': 'Product description must be at least 10 characters',
    'string.max': 'Product description must not exceed 5000 characters',
  }),
  price: Joi.number().min(0).precision(2).required().messages({
    'any.required': 'Product price is required',
    'number.base': 'Product price must be a number',
    'number.min': 'Product price must be at least 0',
  }),
  compareAtPrice: Joi.number().min(0).precision(2).optional().messages({
    'number.min': 'Compare at price must be at least 0',
  }),
  category: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'any.required': 'Category ID is required',
      'string.pattern.base': 'Category ID must be a valid MongoDB ObjectId',
    }),
  images: Joi.array()
    .items(productImageSchema)
    .min(1)
    .required()
    .messages({
      'any.required': 'At least one product image is required',
      'array.min': 'At least one product image is required',
    }),
  specifications: Joi.array().items(productSpecificationSchema).optional(),
  variants: Joi.array().items(productVariantSchema).optional(),
  stock: Joi.number().integer().min(0).optional().default(0).messages({
    'number.min': 'Stock must be at least 0',
  }),
  isFeatured: Joi.boolean().optional().default(false),
  tags: Joi.array().items(Joi.string().max(100)).optional(),
  colors: Joi.array().items(Joi.string().max(50)).optional(),
  sizes: Joi.array().items(Joi.string().max(20)).optional(),
  brand: Joi.string().max(100).optional(),
})

/**
 * Joi validation schema for updating a product.
 * All fields are optional — only provided fields are updated.
 */
const updateProductSchema = Joi.object({
  name: Joi.string().min(3).max(200).optional().messages({
    'string.empty': 'Product name cannot be empty',
    'string.min': 'Product name must be at least 3 characters',
    'string.max': 'Product name must not exceed 200 characters',
  }),
  description: Joi.string().min(10).max(5000).optional().messages({
    'string.empty': 'Product description cannot be empty',
    'string.min': 'Product description must be at least 10 characters',
    'string.max': 'Product description must not exceed 5000 characters',
  }),
  price: Joi.number().min(0).precision(2).optional().messages({
    'number.min': 'Product price must be at least 0',
  }),
  compareAtPrice: Joi.number().min(0).precision(2).optional().allow(null).messages({
    'number.min': 'Compare at price must be at least 0',
  }),
  category: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .optional()
    .messages({
      'string.pattern.base': 'Category ID must be a valid MongoDB ObjectId',
    }),
  images: Joi.array().items(productImageSchema).optional(),
  specifications: Joi.array().items(productSpecificationSchema).optional(),
  variants: Joi.array().items(productVariantSchema).optional(),
  stock: Joi.number().integer().min(0).optional().messages({
    'number.min': 'Stock must be at least 0',
  }),
  isFeatured: Joi.boolean().optional(),
  tags: Joi.array().items(Joi.string().max(100)).optional(),
  colors: Joi.array().items(Joi.string().max(50)).optional(),
  sizes: Joi.array().items(Joi.string().max(20)).optional(),
  brand: Joi.string().max(100).optional().allow(''),
})

/**
 * Joi validation schema for product ID URL param.
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

const auth = authenticateToken as express.RequestHandler
const adminOnly = requireRole('admin') as express.RequestHandler

/**
 * GET /api/admin/products
 *
 * Returns paginated list of all products for admin management.
 * Supports search by name/SKU and pagination.
 */
router.get(
  '/',
  auth,
  adminOnly,
  getAdminProductsHandler as express.RequestHandler
)

/**
 * POST /api/admin/products
 *
 * Creates a new product. Requires admin authentication.
 *
 * Request body:
 *   - name (required): Product name (3-200 chars)
 *   - description (required): Product description (10-5000 chars)
 *   - price (required): Product price (min 0)
 *   - compareAtPrice (optional): Original price for showing discounts
 *   - category (required): Category ID (MongoDB ObjectId)
 *   - images (required): Array of image objects with url, alt, etc.
 *   - specifications (optional): Array of { key, value } objects
 *   - variants (optional): Array of variant objects
 *   - stock (optional): Stock quantity (default 0)
 *   - isFeatured (optional): Whether product is featured (default false)
 *   - tags (optional): Array of tag strings
 *
 * Returns 201 with the created product on success.
 *
 * Requirement 15.1: WHEN an Admin creates a Product, THE Platform SHALL require name, description, price, category, and at least one image
 */
router.post(
  '/',
  auth,
  adminOnly,
  validateBody(createProductSchema) as express.RequestHandler,
  createProductHandler as express.RequestHandler
)

/**
 * PUT /api/admin/products/:id
 *
 * Updates an existing product. Requires admin authentication.
 *
 * URL params:
 *   - id: Product ID (MongoDB ObjectId)
 *
 * Request body (all optional):
 *   - name: Product name
 *   - description: Product description
 *   - price: Product price
 *   - compareAtPrice: Original price
 *   - category: Category ID
 *   - images: Array of image objects
 *   - specifications: Array of { key, value } objects
 *   - variants: Array of variant objects
 *   - stock: Stock quantity
 *   - isFeatured: Whether product is featured
 *   - tags: Array of tag strings
 *
 * Returns 200 with the updated product on success.
 *
 * Requirement 15.2: WHEN an Admin updates a Product, THE Platform SHALL validate all required fields are present
 */
router.put(
  '/:id',
  auth,
  adminOnly,
  validateParams(productIdParamSchema) as express.RequestHandler,
  validateBody(updateProductSchema) as express.RequestHandler,
  updateProductHandler as express.RequestHandler
)

/**
 * DELETE /api/admin/products/:id
 *
 * Soft-deletes a product (marks as inactive). Requires admin authentication.
 *
 * URL params:
 *   - id: Product ID (MongoDB ObjectId)
 *
 * Returns 200 with a success message on successful deletion.
 *
 * Requirement 15.3: WHEN an Admin deletes a Product, THE Platform SHALL soft-delete the Product (mark as inactive)
 */
router.delete(
  '/:id',
  auth,
  adminOnly,
  validateParams(productIdParamSchema) as express.RequestHandler,
  deleteProductHandler as express.RequestHandler
)

/**
 * POST /api/admin/products/:id/images
 *
 * Uploads and processes product images. Generates thumbnail, mobile, and desktop versions
 * with WebP format. Requires admin authentication.
 *
 * URL params:
 *   - id: Product ID (MongoDB ObjectId)
 *
 * Request body (multipart/form-data):
 *   - images: Array of image files (max 10 files, max 10MB each)
 *
 * Returns 200 with the updated product including new images on success.
 *
 * Requirement 15.2: WHEN an Admin uploads product images, THE Platform SHALL validate image format (JPEG, PNG, WebP) and size (maximum 10MB per image)
 * Requirement 15.7: THE Platform SHALL generate optimized image versions (thumbnail, mobile, desktop) when images are uploaded
 */
router.post(
  '/:id/images',
  auth,
  adminOnly,
  validateParams(productIdParamSchema) as express.RequestHandler,
  uploadMultipleImages as express.RequestHandler,
  (err: any, _req: Request, res: Response, next: express.NextFunction) => {
    handleUploadError(err, _req, res, next)
  },
  uploadProductImagesHandler as express.RequestHandler
)

/**
 * Mount variant routes at /api/admin/products/:id/variants
 */
router.use('/:id/variants', variantRoutes)

export default router
