/**
 * Admin product variant service for managing product variants.
 * 
 * Handles:
 * - Adding variants to products
 * - Updating existing variants
 * - Deleting variants
 * - Validating variant data
 */

import { Product, IProduct, IProductVariant } from '../../models/Product'
import { Types } from 'mongoose'
import { AppError } from '../../middleware/errorHandler'
import { invalidateProductCaches } from './admin.product.service'
import { logger } from '../../utils/logger'

/**
 * Interface for variant creation input
 */
export interface CreateVariantInput {
  name: string
  sku?: string
  price: number
  stock: number
}

/**
 * Interface for variant update input
 */
export interface UpdateVariantInput {
  name?: string
  sku?: string
  price?: number
  stock?: number
}

/**
 * Validates variant data
 */
function validateVariantData(variant: CreateVariantInput | UpdateVariantInput): void {
  if (variant.name !== undefined && (!variant.name || variant.name.trim().length === 0)) {
    throw new AppError('Variant name cannot be empty', 400)
  }

  if (variant.name !== undefined && variant.name.length > 200) {
    throw new AppError('Variant name must not exceed 200 characters', 400)
  }

  if (variant.sku !== undefined && variant.sku.length > 100) {
    throw new AppError('Variant SKU must not exceed 100 characters', 400)
  }

  if (variant.price !== undefined && variant.price < 0) {
    throw new AppError('Variant price must be at least 0', 400)
  }

  if (variant.stock !== undefined && (variant.stock < 0 || !Number.isInteger(variant.stock))) {
    throw new AppError('Variant stock must be a non-negative integer', 400)
  }
}

/**
 * Validates that SKUs are unique within a product's variants
 */
function validateUniqueSKUs(variants: IProductVariant[], excludeVariantId?: string): void {
  const skus = variants
    .filter(v => v.sku && (!excludeVariantId || v._id?.toString() !== excludeVariantId))
    .map(v => v.sku)

  const uniqueSkus = new Set(skus)
  if (skus.length !== uniqueSkus.size) {
    throw new AppError('Variant SKUs must be unique within the product', 400)
  }
}

/**
 * Adds a new variant to a product
 * 
 * @param productId - Product ID
 * @param variantData - Variant data to add
 * @returns Updated product
 */
export async function addVariant(
  productId: string,
  variantData: CreateVariantInput
): Promise<IProduct> {
  // Validate product ID
  if (!Types.ObjectId.isValid(productId)) {
    throw new AppError('Invalid product ID', 400)
  }

  // Validate variant data
  validateVariantData(variantData)

  // Get product
  const product = await Product.findById(productId)
  if (!product) {
    throw new AppError('Product not found', 404)
  }

  // Create new variant
  const newVariant: IProductVariant = {
    name: variantData.name.trim(),
    sku: variantData.sku ? variantData.sku.trim() : undefined,
    price: variantData.price,
    stock: variantData.stock,
  }

  // Add variant to product
  product.variants.push(newVariant)

  // Validate unique SKUs
  validateUniqueSKUs(product.variants)

  // Save product
  await product.save()

  // Invalidate caches
  await invalidateProductCaches(productId)

  logger.info(`Variant added to product ${productId}: ${newVariant.name}`)

  return product
}

/**
 * Updates an existing variant in a product
 * 
 * @param productId - Product ID
 * @param variantId - Variant ID
 * @param variantData - Updated variant data
 * @returns Updated product
 */
export async function updateVariant(
  productId: string,
  variantId: string,
  variantData: UpdateVariantInput
): Promise<IProduct> {
  // Validate IDs
  if (!Types.ObjectId.isValid(productId)) {
    throw new AppError('Invalid product ID', 400)
  }

  if (!Types.ObjectId.isValid(variantId)) {
    throw new AppError('Invalid variant ID', 400)
  }

  // Validate variant data
  validateVariantData(variantData)

  // Get product
  const product = await Product.findById(productId)
  if (!product) {
    throw new AppError('Product not found', 404)
  }

  // Find variant
  const variant = product.variants.find(v => v._id?.toString() === variantId)
  if (!variant) {
    throw new AppError('Variant not found', 404)
  }

  // Update variant fields
  if (variantData.name !== undefined) {
    variant.name = variantData.name.trim()
  }
  if (variantData.sku !== undefined) {
    variant.sku = variantData.sku ? variantData.sku.trim() : undefined
  }
  if (variantData.price !== undefined) {
    variant.price = variantData.price
  }
  if (variantData.stock !== undefined) {
    variant.stock = variantData.stock
  }

  // Validate unique SKUs
  validateUniqueSKUs(product.variants, variantId)

  // Save product
  await product.save()

  // Invalidate caches
  await invalidateProductCaches(productId)

  logger.info(`Variant updated in product ${productId}: ${variant.name}`)

  return product
}

/**
 * Deletes a variant from a product
 * 
 * @param productId - Product ID
 * @param variantId - Variant ID
 * @returns Updated product
 */
export async function deleteVariant(
  productId: string,
  variantId: string
): Promise<IProduct> {
  // Validate IDs
  if (!Types.ObjectId.isValid(productId)) {
    throw new AppError('Invalid product ID', 400)
  }

  if (!Types.ObjectId.isValid(variantId)) {
    throw new AppError('Invalid variant ID', 400)
  }

  // Get product
  const product = await Product.findById(productId)
  if (!product) {
    throw new AppError('Product not found', 404)
  }

  // Find variant
  const variantIndex = product.variants.findIndex(v => v._id?.toString() === variantId)
  if (variantIndex === -1) {
    throw new AppError('Variant not found', 404)
  }

  // Remove variant
  const removedVariant = product.variants[variantIndex]
  product.variants.splice(variantIndex, 1)

  // Save product
  await product.save()

  // Invalidate caches
  await invalidateProductCaches(productId)

  logger.info(`Variant deleted from product ${productId}: ${removedVariant.name}`)

  return product
}

/**
 * Gets all variants for a product
 * 
 * @param productId - Product ID
 * @returns Array of variants
 */
export async function getVariants(productId: string): Promise<IProductVariant[]> {
  // Validate product ID
  if (!Types.ObjectId.isValid(productId)) {
    throw new AppError('Invalid product ID', 400)
  }

  // Get product
  const product = await Product.findById(productId)
  if (!product) {
    throw new AppError('Product not found', 404)
  }

  return product.variants
}

/**
 * Gets a specific variant from a product
 * 
 * @param productId - Product ID
 * @param variantId - Variant ID
 * @returns Variant data
 */
export async function getVariant(
  productId: string,
  variantId: string
): Promise<IProductVariant> {
  // Validate IDs
  if (!Types.ObjectId.isValid(productId)) {
    throw new AppError('Invalid product ID', 400)
  }

  if (!Types.ObjectId.isValid(variantId)) {
    throw new AppError('Invalid variant ID', 400)
  }

  // Get product
  const product = await Product.findById(productId)
  if (!product) {
    throw new AppError('Product not found', 404)
  }

  // Find variant
  const variant = product.variants.find(v => v._id?.toString() === variantId)
  if (!variant) {
    throw new AppError('Variant not found', 404)
  }

  return variant
}
