/**
 * File upload middleware using Multer.
 * 
 * Handles:
 * - File upload configuration
 * - File validation (size, type)
 * - Error handling for upload failures
 */

import multer, { StorageEngine, FileFilterCallback } from 'multer'
import { Request } from 'express'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { IMAGE_CONFIG } from '../utils/imageProcessor'

/**
 * Memory storage for file uploads (files are processed and stored separately)
 */
const storage: StorageEngine = multer.memoryStorage()

/**
 * File filter for image uploads
 */
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  // Check MIME type
  if (!IMAGE_CONFIG.SUPPORTED_FORMATS.includes(file.mimetype)) {
    cb(
      new Error(
        `Invalid file type. Supported types: ${IMAGE_CONFIG.SUPPORTED_FORMATS.join(', ')}`
      )
    )
    return
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase()
  if (!IMAGE_CONFIG.SUPPORTED_EXTENSIONS.includes(ext)) {
    cb(
      new Error(
        `Invalid file extension. Supported extensions: ${IMAGE_CONFIG.SUPPORTED_EXTENSIONS.join(', ')}`
      )
    )
    return
  }

  cb(null, true)
}

/**
 * Multer configuration for product image uploads
 */
const uploadConfig = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: IMAGE_CONFIG.MAX_FILE_SIZE,
    files: 10, // Maximum 10 files per request
  },
})

/**
 * Middleware for single file upload
 */
export const uploadSingleImage = uploadConfig.single('image')

/**
 * Middleware for multiple file uploads
 */
export const uploadMultipleImages = uploadConfig.array('images', 10)

/**
 * Error handler for multer errors
 */
export const handleUploadError = (
  err: any,
  _req: Request,
  res: any,
  next: any
): void => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        error: 'File too large',
        message: `Maximum file size is ${IMAGE_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`,
      })
      return
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        error: 'Too many files',
        message: 'Maximum 10 files allowed per request',
      })
      return
    }
    res.status(400).json({
      error: 'Upload error',
      message: err.message,
    })
    return
  }

  if (err) {
    res.status(400).json({
      error: 'Upload error',
      message: err.message,
    })
    return
  }

  next()
}
