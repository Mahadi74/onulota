/**
 * Admin product variant controller for managing product variants.
 * 
 * Handles:
 * - Adding variants to products
 * - Updating existing variants
 * - Deleting variants
 * - Retrieving variants
 */

import { Request, Response, NextFunction } from 'express'
import { asyncHandler } from '../../middleware/errorHandler'
import { AuthenticatedRequest } from '../../middleware/auth'
import { AppError } from '../../middleware/errorHandler'
import {
  addVariant,
  updateVariant,
  deleteVariant,
  getVariants,
  getVariant,
  CreateVariantInput,
  UpdateVariantInput,
} from './admin.product.variant.service'
import { logger } from '../../utils/logger'

/**
 * Formats a variant for API response
 */
function formatVariant(variant: any) {
  return {
    _id: variant._id?.toString(),
    name: variant.name,
    sku: variant.sku,
    price: variant.price,
    stock: variant.stock,
  }
}

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
export const addVariantHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const authReq = req as AuthenticatedRequest
    void authReq.user // Verify user is authenticated

    const { id } = req.params
    const { name, sku, price, stock } = req.body as CreateVariantInput

    // Add variant
    const product = await addVariant(id, {
      name,
      sku,
      price,
      stock,
    })

    logger.info(`Variant added to product ${id}`)

    res.status(201).json({
      message: 'Variant added successfully',
      product: {
        _id: product._id.toString(),
        name: product.name,
        variants: product.variants.map(formatVariant),
      },
    })
  }
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
export const updateVariantHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const authReq = req as AuthenticatedRequest
    void authReq.user // Verify user is authenticated

    const { id, variantId } = req.params
    const { name, sku, price, stock } = req.body as UpdateVariantInput

    // Update variant
    const product = await updateVariant(id, variantId, {
      name,
      sku,
      price,
      stock,
    })

    logger.info(`Variant ${variantId} updated in product ${id}`)

    res.status(200).json({
      message: 'Variant updated successfully',
      product: {
        _id: product._id.toString(),
        name: product.name,
        variants: product.variants.map(formatVariant),
      },
    })
  }
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
export const deleteVariantHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const authReq = req as AuthenticatedRequest
    void authReq.user // Verify user is authenticated

    const { id, variantId } = req.params

    // Delete variant
    const product = await deleteVariant(id, variantId)

    logger.info(`Variant ${variantId} deleted from product ${id}`)

    res.status(200).json({
      message: 'Variant deleted successfully',
      product: {
        _id: product._id.toString(),
        name: product.name,
        variants: product.variants.map(formatVariant),
      },
    })
  }
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
export const getVariantsHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const authReq = req as AuthenticatedRequest
    void authReq.user // Verify user is authenticated

    const { id } = req.params

    // Get variants
    const variants = await getVariants(id)

    res.status(200).json({
      variants: variants.map(formatVariant),
    })
  }
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
export const getVariantHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const authReq = req as AuthenticatedRequest
    void authReq.user // Verify user is authenticated

    const { id, variantId } = req.params

    // Get variant
    const variant = await getVariant(id, variantId)

    res.status(200).json({
      variant: formatVariant(variant),
    })
  }
)
