/**
 * Image processing utility for product images.
 * 
 * Handles:
 * - Image validation (format, size)
 * - Image processing with Sharp (resize, convert to WebP)
 * - Generation of thumbnail, mobile, and desktop versions
 */

import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs/promises'
import { logger } from './logger'

/**
 * Image processing configuration
 */
export const IMAGE_CONFIG = {
  // Supported formats
  SUPPORTED_FORMATS: ['image/jpeg', 'image/png', 'image/webp'],
  SUPPORTED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],
  
  // Size limits (in bytes)
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB for products
  
  // Image dimensions for different versions
  VERSIONS: {
    thumbnail: {
      width: 200,
      height: 200,
      fit: 'cover' as const,
      quality: 80,
    },
    mobile: {
      width: 800,
      height: 800,
      fit: 'inside' as const,
      quality: 80,
    },
    desktop: {
      width: 1200,
      height: 1200,
      fit: 'inside' as const,
      quality: 85,
    },
  },
  
  // Output format
  OUTPUT_FORMAT: 'webp' as const,
  OUTPUT_QUALITY: 80,
}

/**
 * Validates image file
 * 
 * @param buffer - Image file buffer
 * @param mimetype - MIME type of the file
 * @param filename - Original filename
 * @returns true if valid, throws error otherwise
 */
export function validateImageFile(
  buffer: Buffer,
  mimetype: string,
  filename: string
): boolean {
  // Check MIME type
  if (!IMAGE_CONFIG.SUPPORTED_FORMATS.includes(mimetype)) {
    throw new Error(
      `Invalid image format. Supported formats: ${IMAGE_CONFIG.SUPPORTED_FORMATS.join(', ')}`
    )
  }

  // Check file size
  if (buffer.length > IMAGE_CONFIG.MAX_FILE_SIZE) {
    throw new Error(
      `Image file too large. Maximum size: ${IMAGE_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`
    )
  }

  // Check file extension
  const ext = path.extname(filename).toLowerCase()
  if (!IMAGE_CONFIG.SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Invalid file extension. Supported extensions: ${IMAGE_CONFIG.SUPPORTED_EXTENSIONS.join(', ')}`
    )
  }

  return true
}

/**
 * Processes a single image and generates multiple versions
 * 
 * @param buffer - Image file buffer
 * @param filename - Original filename (used for naming output files)
 * @param outputDir - Directory to save processed images
 * @returns Object with URLs for thumbnail, mobile, and desktop versions
 */
export async function processProductImage(
  buffer: Buffer,
  filename: string,
  outputDir: string = 'public/images/products'
): Promise<{
  thumbnail: string
  mobile: string
  desktop: string
}> {
  try {
    // Create output directory if it doesn't exist
    await fs.mkdir(outputDir, { recursive: true })

    // Generate unique ID for this image set
    const imageId = uuidv4()
    const baseFilename = `${imageId}`

    // Process each version
    const versions: Record<string, string> = {}

    for (const [versionName, config] of Object.entries(IMAGE_CONFIG.VERSIONS)) {
      const outputFilename = `${baseFilename}-${versionName}.${IMAGE_CONFIG.OUTPUT_FORMAT}`
      const outputPath = path.join(outputDir, outputFilename)

      // Process image with Sharp
      await sharp(buffer)
        .resize(config.width, config.height, {
          fit: config.fit,
          withoutEnlargement: true,
        })
        .webp({ quality: config.quality })
        .toFile(outputPath)

      // Store relative URL path
      versions[versionName] = `/images/products/${outputFilename}`

      logger.debug(`Processed ${versionName} version: ${outputFilename}`)
    }

    return {
      thumbnail: versions.thumbnail,
      mobile: versions.mobile,
      desktop: versions.desktop,
    }
  } catch (error) {
    logger.error(`Error processing image: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

/**
 * Deletes processed image files
 * 
 * @param imageUrls - Object containing thumbnail, mobile, desktop URLs
 * @param baseDir - Base directory where images are stored
 */
export async function deleteProcessedImages(
  imageUrls: { thumbnail?: string; mobile?: string; desktop?: string },
  baseDir: string = 'public'
): Promise<void> {
  try {
    for (const [_key, url] of Object.entries(imageUrls)) {
      if (url) {
        // Convert URL to file path
        const filePath = path.join(baseDir, url)
        try {
          await fs.unlink(filePath)
          logger.debug(`Deleted image file: ${filePath}`)
        } catch (err) {
          // File might not exist, continue
          logger.warn(`Could not delete image file: ${filePath}`)
        }
      }
    }
  } catch (error) {
    logger.error(`Error deleting processed images: ${error instanceof Error ? error.message : String(error)}`)
    // Don't throw - deletion errors shouldn't block the operation
  }
}
