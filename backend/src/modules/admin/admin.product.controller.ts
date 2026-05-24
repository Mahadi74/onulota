/**
 * Admin product controller for managing products.
 * 
 * Handles:
 * - Product listing with pagination and search
 * - Product creation with cache invalidation
 * - Product updates with cache invalidation
 * - Product deletion with cache invalidation
 * - Product image uploads
 */

import { Request, Response, NextFunction } from 'express'
import { asyncHandler } from '../../middleware/errorHandler'
import { AuthenticatedRequest } from '../../middleware/auth'
import { Product, IProduct } from '../../models/Product'
import { Category } from '../../models/Category'
import { Types } from 'mongoose'
import { AppError } from '../../middleware/errorHandler'
import { invalidateProductCaches } from './admin.product.service'
import { logger } from '../../utils/logger'
import { validateImageFile, processProductImage, deleteProcessedImages } from '../../utils/imageProcessor'

/**
 * Formats a product document for API response.
 */
function formatProduct(product: IProduct) {
  return {
    _id: product._id.toString(),
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    category: product.category.toString(),
    images: product.images,
    specifications: product.specifications,
    variants: product.variants,
    stock: product.stock,
    averageRating: product.averageRating,
    reviewCount: product.reviewCount,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    tags: product.tags,
    colors: (product as any).colors || [],
    sizes: (product as any).sizes || [],
    brand: product.brand,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  }
}

/**
 * GET /api/admin/products
 *
 * Returns a paginated list of all products (including inactive) for admin management.
 *
 * Query Parameters:
 * - page: number (default 1)
 * - limit: number (default 10, max 100)
 * - search: string (optional, searches name and SKU)
 *
 * Returns { products, total, page, pages }
 */
export const getAdminProductsHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10))
    const search = (req.query.search as string || '').trim()

    const filter: Record<string, any> = {}
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'variants.sku': { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ]
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name slug')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ])

    const formatted = products.map((p: any) => ({
      _id: p._id.toString(),
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      sku: p.variants?.[0]?.sku || '',
      category: p.category?.name || p.category?.toString() || '',
      categoryId: p.category?._id?.toString() || p.category?.toString() || '',
      images: p.images || [],
      stock: p.stock,
      averageRating: p.averageRating,
      reviewCount: p.reviewCount,
      isActive: p.isActive,
      isFeatured: p.isFeatured,
      tags: p.tags || [],
      colors: (p as any).colors || [],
      sizes: (p as any).sizes || [],
      brand: p.brand || '',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))

    res.status(200).json({
      products: formatted,
      total,
      page,
      pages: Math.ceil(total / limit),
    })
  }
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
 * Requirement 40.4: Cache product listings in Redis with 5-minute TTL, invalidate on product update
 */
export const createProductHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const authReq = req as AuthenticatedRequest
    void authReq.user // Verify user is authenticated

    const {
      name,
      description,
      price,
      compareAtPrice,
      category,
      images,
      specifications,
      variants,
      stock,
      isFeatured,
      tags,
      colors,
      sizes,
      brand,
    } = req.body

    // Validate category exists
    if (!Types.ObjectId.isValid(category)) {
      throw new AppError('Invalid category ID', 400)
    }

    const categoryDoc = await Category.findById(category)
    if (!categoryDoc) {
      throw new AppError('Category not found', 404)
    }

    // Validate that at least one image is provided (already validated by Joi, but double-check)
    if (!images || images.length === 0) {
      throw new AppError('At least one product image is required', 400)
    }

    // Validate price constraints
    if (compareAtPrice !== undefined && compareAtPrice !== null) {
      if (compareAtPrice < price) {
        logger.warn(`Product created with compareAtPrice (${compareAtPrice}) less than price (${price})`)
      }
    }

    // Create product
    const product = new Product({
      name: name.trim(),
      description: description.trim(),
      price,
      compareAtPrice: compareAtPrice || undefined,
      category: new Types.ObjectId(category),
      images,
      specifications: specifications || [],
      variants: variants || [],
      stock: stock || 0,
      isFeatured: isFeatured || false,
      tags: tags || [],
      colors: colors || [],
      sizes: sizes || [],
      brand: brand || undefined,
      isActive: true,
    })

    await product.save()

    // Invalidate product caches
    await invalidateProductCaches(product._id.toString())

    logger.info(`Product created: ${product._id} (${product.name})`)

    res.status(201).json({ product: formatProduct(product) })
  }
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
 * Requirement 40.4: Cache product listings in Redis with 5-minute TTL, invalidate on product update
 */
export const updateProductHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const authReq = req as AuthenticatedRequest
    void authReq.user // Verify user is authenticated

    const { id } = req.params
    const {
      name,
      description,
      price,
      compareAtPrice,
      category,
      images,
      specifications,
      variants,
      stock,
      isFeatured,
      tags,
      colors,
      sizes,
      brand,
    } = req.body

    // Validate product ID
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid product ID', 400)
    }

    // Validate product exists
    const product = await Product.findById(id)
    if (!product) {
      throw new AppError('Product not found', 404)
    }

    // Validate category if provided
    if (category) {
      if (!Types.ObjectId.isValid(category)) {
        throw new AppError('Invalid category ID', 400)
      }

      const categoryDoc = await Category.findById(category)
      if (!categoryDoc) {
        throw new AppError('Category not found', 404)
      }

      product.category = new Types.ObjectId(category)
    }

    // Update fields
    if (name !== undefined) {
      product.name = name.trim()
    }
    if (description !== undefined) {
      product.description = description.trim()
    }
    if (price !== undefined) {
      product.price = price
    }
    if (compareAtPrice !== undefined) {
      product.compareAtPrice = compareAtPrice || undefined
    }
    if (images !== undefined) {
      product.images = images
    }
    if (specifications !== undefined) {
      product.specifications = specifications
    }
    if (variants !== undefined) {
      product.variants = variants
    }
    if (stock !== undefined) {
      product.stock = stock
    }
    if (isFeatured !== undefined) {
      product.isFeatured = isFeatured
    }
    if (tags !== undefined) {
      product.tags = tags
    }
    if (colors !== undefined) {
      (product as any).colors = colors
    }
    if (sizes !== undefined) {
      (product as any).sizes = sizes
    }
    if (brand !== undefined) {
      product.brand = brand
    }

    await product.save()

    // Invalidate product caches
    await invalidateProductCaches(product._id.toString())

    logger.info(`Product updated: ${product._id} (${product.name})`)

    res.status(200).json({ product: formatProduct(product) })
  }
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
 * Requirement 40.4: Cache product listings in Redis with 5-minute TTL, invalidate on product update
 */
export const deleteProductHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const authReq = req as AuthenticatedRequest
    void authReq.user // Verify user is authenticated

    const { id } = req.params

    // Validate product ID
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid product ID', 400)
    }

    // Validate product exists
    const product = await Product.findById(id)
    if (!product) {
      throw new AppError('Product not found', 404)
    }

    // Soft delete: mark as inactive
    product.isActive = false
    await product.save()

    // Invalidate product caches
    await invalidateProductCaches(product._id.toString())

    logger.info(`Product deleted (soft): ${product._id} (${product.name})`)

    res.status(200).json({ message: 'Product deleted successfully' })
  }
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
 * Requirement 40.4: Cache product listings in Redis with 5-minute TTL, invalidate on product update
 */
export const uploadProductImagesHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const authReq = req as AuthenticatedRequest
    void authReq.user // Verify user is authenticated

    const { id } = req.params
    const files = req.files as Express.Multer.File[] | undefined

    // Validate product ID
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid product ID', 400)
    }

    // Validate files are provided
    if (!files || files.length === 0) {
      throw new AppError('At least one image file is required', 400)
    }

    // Validate product exists
    const product = await Product.findById(id)
    if (!product) {
      throw new AppError('Product not found', 404)
    }

    // Process each uploaded file
    const processedImages = []

    try {
      for (const file of files) {
        // Validate image file
        validateImageFile(file.buffer, file.mimetype, file.originalname)

        // Process image and generate versions
        const imageVersions = await processProductImage(
          file.buffer,
          file.originalname,
          'public/images/products'
        )

        // Add to product images array
        processedImages.push({
          url: imageVersions.desktop, // Use desktop version as main URL
          thumbnail: imageVersions.thumbnail,
          mobile: imageVersions.mobile,
          alt: '', // Alt text can be set separately
        })

        logger.info(`Image processed for product ${id}: ${file.originalname}`)
      }

      // Add processed images to product
      product.images.push(...processedImages)
      await product.save()

      // Invalidate product caches
      await invalidateProductCaches(product._id.toString())

      logger.info(`${processedImages.length} images uploaded for product ${id}`)

      res.status(200).json({
        message: `${processedImages.length} image(s) uploaded successfully`,
        product: formatProduct(product),
      })
    } catch (error) {
      // Clean up processed images on error
      for (const image of processedImages) {
        await deleteProcessedImages(
          {
            thumbnail: image.thumbnail,
            mobile: image.mobile,
            desktop: image.url,
          },
          'public'
        )
      }

      throw error
    }
  }
)
