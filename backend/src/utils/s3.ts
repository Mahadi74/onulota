/**
 * Cloudinary utility for uploading and deleting images.
 *
 * Drop-in replacement for the previous AWS S3 module.
 * Exports the same function signatures so all callers work unchanged.
 */

import { v2 as cloudinary } from 'cloudinary'
import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'
import { logger } from './logger'

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || ''
const API_KEY = process.env.CLOUDINARY_API_KEY || ''
const API_SECRET = process.env.CLOUDINARY_API_SECRET || ''

export const isS3Configured = (): boolean =>
  Boolean(CLOUD_NAME && API_KEY && API_SECRET &&
    CLOUD_NAME !== 'your_cloud_name' && API_KEY !== '123456789012345')

function getClient() {
  cloudinary.config({ cloud_name: CLOUD_NAME, api_key: API_KEY, api_secret: API_SECRET })
  return cloudinary
}

/**
 * Image size configs for the three versions.
 */
const VERSIONS = {
  thumbnail: { width: 200, height: 200, fit: 'cover' as const, quality: 80 },
  mobile:    { width: 800, height: 800, fit: 'inside' as const, quality: 80 },
  desktop:   { width: 1200, height: 1200, fit: 'inside' as const, quality: 85 },
}

/**
 * Uploads a buffer to Cloudinary and returns the secure URL.
 */
async function uploadBuffer(
  buffer: Buffer,
  publicId: string,
  folder: string
): Promise<string> {
  const client = getClient()
  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        public_id: publicId,
        folder,
        resource_type: 'image',
        overwrite: true,
        format: 'webp',
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'))
        resolve(result.secure_url)
      }
    )
    stream.end(buffer)
  })
}

/**
 * Processes a raw image buffer into 3 sizes (thumbnail/mobile/desktop)
 * and uploads all three to Cloudinary.
 *
 * Returns { thumbnail, mobile, desktop } public URLs.
 */
export async function uploadProductImagesToS3(
  buffer: Buffer,
  _originalName: string,
  folder: string = 'products'
): Promise<{ thumbnail: string; mobile: string; desktop: string }> {
  if (!isS3Configured()) {
    throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env')
  }

  const id = uuidv4()
  const urls: Record<string, string> = {}

  for (const [name, cfg] of Object.entries(VERSIONS)) {
    const processed = await sharp(buffer)
      .resize(cfg.width, cfg.height, { fit: cfg.fit, withoutEnlargement: true })
      .webp({ quality: cfg.quality })
      .toBuffer()

    const publicId = `${id}-${name}`
    urls[name] = await uploadBuffer(processed, publicId, folder)
    logger.info(`Cloudinary upload: ${folder}/${publicId}`)
  }

  return { thumbnail: urls.thumbnail, mobile: urls.mobile, desktop: urls.desktop }
}

/**
 * Uploads a category image (single version) to Cloudinary.
 * Returns the secure URL.
 */
export async function uploadCategoryImageToS3(
  buffer: Buffer,
  folder: string = 'categories'
): Promise<string> {
  if (!isS3Configured()) {
    throw new Error('Cloudinary is not configured.')
  }

  const id = uuidv4()
  const processed = await sharp(buffer)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer()

  return uploadBuffer(processed, id, folder)
}

/**
 * Deletes one or more Cloudinary images by their secure URLs.
 * Silently ignores errors.
 */
export async function deleteS3Images(urls: (string | undefined)[]): Promise<void> {
  if (!isS3Configured()) return
  const client = getClient()

  for (const url of urls) {
    if (!url) continue
    try {
      // Extract public_id from Cloudinary URL:
      // https://res.cloudinary.com/<cloud>/image/upload/v123/<folder>/<id>.webp
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/)
      if (!match) continue
      const publicId = match[1]
      await client.uploader.destroy(publicId)
      logger.info(`Cloudinary deleted: ${publicId}`)
    } catch (err) {
      logger.warn(`Cloudinary delete failed for ${url}: ${(err as Error).message}`)
    }
  }
}
