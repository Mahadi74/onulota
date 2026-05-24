/**
 * POST /api/upload/image
 *
 * Accepts a multipart image file, processes it with Sharp, uploads to S3,
 * and returns { urls: { thumbnail, mobile, desktop } } for products,
 * or { url } for category/general uploads.
 *
 * Query params:
 *   - type: 'product' (default) | 'category'
 *
 * Requires admin authentication.
 */

import { Router, Request, Response } from 'express'
import express from 'express'
import multer from 'multer'
import { authenticateToken, requireRole } from '../middleware/auth'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import {
  uploadProductImagesToS3,
  uploadCategoryImageToS3,
  isS3Configured,
} from '../utils/s3'
import { validateImageFile } from '../utils/imageProcessor'
import { logger } from '../utils/logger'

const router = Router()

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only JPEG, PNG and WebP images are allowed'))
    }
  },
})

const auth = authenticateToken as express.RequestHandler
const adminOnly = requireRole('admin') as express.RequestHandler

/**
 * POST /api/upload/image
 * Body: multipart/form-data, field name = "image"
 * Query: ?type=product|category
 */
router.post(
  '/image',
  auth,
  adminOnly,
  upload.single('image'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!isS3Configured()) {
      throw new AppError(
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in backend .env',
        500
      )
    }

    const file = req.file
    if (!file) {
      throw new AppError('No image file provided', 400)
    }

    // Validate
    validateImageFile(file.buffer, file.mimetype, file.originalname)

    const type = (req.query.type as string) || 'product'
    logger.info(`Uploading ${type} image: ${file.originalname} (${file.size} bytes)`)

    if (type === 'category') {
      const url = await uploadCategoryImageToS3(file.buffer)
      return res.status(200).json({ url })
    }

    // Default: product — returns three sizes
    const urls = await uploadProductImagesToS3(file.buffer, file.originalname)
    return res.status(200).json({ urls })
  })
)

export default router
