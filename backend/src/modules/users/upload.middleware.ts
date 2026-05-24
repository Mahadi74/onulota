import multer, { FileFilterCallback } from 'multer'
import { Request } from 'express'
import { AppError } from '../../middleware/errorHandler'

/** Allowed MIME types for profile image upload (Req 3.3) */
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Maximum file size: 5 MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024

/**
 * Multer upload middleware for profile images.
 * - Stores files in memory (memoryStorage) for Sharp processing
 * - Accepts only JPEG, PNG, WebP
 * - Enforces 5 MB size limit
 */
export const profileImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new AppError('Invalid image format. Only JPEG, PNG, and WebP are allowed', 400))
    }
  },
})
