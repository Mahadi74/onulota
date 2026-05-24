/**
 * Integration tests for POST /api/users/profile/image
 *
 * Covers Requirement 3.3: WHEN an authenticated User uploads a profile image,
 * THE Platform SHALL validate the image format (JPEG, PNG, WebP) and size (maximum 5MB).
 *
 * Also covers:
 * - Requirement 20.1: 401 when no token provided
 * - Successful upload returns { profileImage: '/uploads/profiles/{filename}' }
 * - Processed image is saved as WebP 400×400
 * - User's profileImage field is updated in the database
 */

// Set required env vars BEFORE importing app
process.env.JWT_SECRET = 'test-jwt-secret-for-profile-image-tests'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-profile-image-tests'
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:5000/api/auth/google/callback'

import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import { createApp } from '../../../app'
import { User } from '../../../models/User'

let mongoServer: MongoMemoryServer
const app = createApp()

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()

  // Clean up any uploaded test files
  const uploadsDir = path.join(process.cwd(), 'uploads', 'profiles')
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir)
    for (const file of files) {
      fs.unlinkSync(path.join(uploadsDir, file))
    }
  }
})

afterEach(async () => {
  await User.deleteMany({})
})

/** Helper: create a user directly in the DB */
async function createUser(overrides: Partial<{
  name: string
  email: string
  password: string
  role: 'user' | 'admin'
  isActive: boolean
}> = {}) {
  const hashedPassword = await bcrypt.hash(overrides.password ?? 'Secure@123', 10)
  return User.create({
    name: overrides.name ?? 'Test User',
    email: (overrides.email ?? 'test@example.com').toLowerCase(),
    password: hashedPassword,
    role: overrides.role ?? 'user',
    isActive: overrides.isActive ?? true,
  })
}

/** Helper: generate a valid access token for a user */
function generateAccessToken(userId: string, role = 'user'): string {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  )
}

/** Helper: create a minimal valid JPEG buffer (1×1 pixel) */
async function createJpegBuffer(): Promise<Buffer> {
  return sharp({
    create: { width: 1, height: 1, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .jpeg()
    .toBuffer()
}

/** Helper: create a minimal valid PNG buffer (1×1 pixel) */
async function createPngBuffer(): Promise<Buffer> {
  return sharp({
    create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer()
}

/** Helper: create a minimal valid WebP buffer (1×1 pixel) */
async function createWebpBuffer(): Promise<Buffer> {
  return sharp({
    create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 255 } },
  })
    .webp()
    .toBuffer()
}

describe('POST /api/users/profile/image', () => {
  // ─── Authentication ─────────────────────────────────────────────────────────

  it('returns 401 when no Authorization header is provided (Req 20.1)', async () => {
    const jpegBuffer = await createJpegBuffer()

    const res = await request(app)
      .post('/api/users/profile/image')
      .attach('image', jpegBuffer, { filename: 'test.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(401)
  })

  it('returns 401 when an invalid token is provided (Req 20.3)', async () => {
    const jpegBuffer = await createJpegBuffer()

    const res = await request(app)
      .post('/api/users/profile/image')
      .set('Authorization', 'Bearer invalid.token.here')
      .attach('image', jpegBuffer, { filename: 'test.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(401)
  })

  // ─── Missing file ────────────────────────────────────────────────────────────

  it('returns 400 when no file is attached', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .post('/api/users/profile/image')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })

  // ─── Format validation (Req 3.3) ────────────────────────────────────────────

  it('returns 400 for an unsupported file type (e.g. GIF)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    // Minimal GIF89a header bytes
    const gifBuffer = Buffer.from('47494638396101000100800000ffffff00000021f90400000000002c00000000010001000002024401003b', 'hex')

    const res = await request(app)
      .post('/api/users/profile/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', gifBuffer, { filename: 'test.gif', contentType: 'image/gif' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/invalid image format/i)
  })

  it('returns 400 for a text/plain file', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .post('/api/users/profile/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('hello world'), { filename: 'test.txt', contentType: 'text/plain' })

    expect(res.status).toBe(400)
  })

  // ─── Size validation (Req 3.3) ───────────────────────────────────────────────

  it('returns 400 when the file exceeds 5MB', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    // Create a buffer slightly larger than 5MB
    const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1, 0)

    const res = await request(app)
      .post('/api/users/profile/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', oversizedBuffer, { filename: 'big.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(400)
  })

  // ─── Successful uploads ──────────────────────────────────────────────────────

  it('accepts a JPEG image and returns profileImage URL (Req 3.3)', async () => {
    const user = await createUser({ email: 'jpeg@example.com' })
    const token = generateAccessToken(user._id.toString())
    const jpegBuffer = await createJpegBuffer()

    const res = await request(app)
      .post('/api/users/profile/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', jpegBuffer, { filename: 'photo.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(200)
    expect(res.body.profileImage).toMatch(/^\/uploads\/profiles\/.+\.webp$/)
  })

  it('accepts a PNG image and returns profileImage URL (Req 3.3)', async () => {
    const user = await createUser({ email: 'png@example.com' })
    const token = generateAccessToken(user._id.toString())
    const pngBuffer = await createPngBuffer()

    const res = await request(app)
      .post('/api/users/profile/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', pngBuffer, { filename: 'photo.png', contentType: 'image/png' })

    expect(res.status).toBe(200)
    expect(res.body.profileImage).toMatch(/^\/uploads\/profiles\/.+\.webp$/)
  })

  it('accepts a WebP image and returns profileImage URL (Req 3.3)', async () => {
    const user = await createUser({ email: 'webp@example.com' })
    const token = generateAccessToken(user._id.toString())
    const webpBuffer = await createWebpBuffer()

    const res = await request(app)
      .post('/api/users/profile/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', webpBuffer, { filename: 'photo.webp', contentType: 'image/webp' })

    expect(res.status).toBe(200)
    expect(res.body.profileImage).toMatch(/^\/uploads\/profiles\/.+\.webp$/)
  })

  it('updates the user profileImage field in the database after upload', async () => {
    const user = await createUser({ email: 'dbupdate@example.com' })
    const token = generateAccessToken(user._id.toString())
    const jpegBuffer = await createJpegBuffer()

    const res = await request(app)
      .post('/api/users/profile/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', jpegBuffer, { filename: 'photo.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(200)

    // Verify the DB was updated
    const updatedUser = await User.findById(user._id).lean()
    expect(updatedUser?.profileImage).toBe(res.body.profileImage)
  })

  it('saves the processed image as a WebP file on disk', async () => {
    const user = await createUser({ email: 'disk@example.com' })
    const token = generateAccessToken(user._id.toString())
    const jpegBuffer = await createJpegBuffer()

    const res = await request(app)
      .post('/api/users/profile/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', jpegBuffer, { filename: 'photo.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(200)

    // Verify the file exists on disk
    const filename = path.basename(res.body.profileImage)
    const filePath = path.join(process.cwd(), 'uploads', 'profiles', filename)
    expect(fs.existsSync(filePath)).toBe(true)

    // Verify it is a valid WebP image with 400×400 dimensions
    const metadata = await sharp(filePath).metadata()
    expect(metadata.format).toBe('webp')
    expect(metadata.width).toBe(400)
    expect(metadata.height).toBe(400)
  })

  it('filename follows the {userId}-{timestamp}.webp pattern', async () => {
    const user = await createUser({ email: 'filename@example.com' })
    const token = generateAccessToken(user._id.toString())
    const jpegBuffer = await createJpegBuffer()

    const res = await request(app)
      .post('/api/users/profile/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', jpegBuffer, { filename: 'photo.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(200)

    const filename = path.basename(res.body.profileImage)
    // Pattern: {userId}-{timestamp}.webp
    const pattern = new RegExp(`^${user._id.toString()}-\\d+\\.webp$`)
    expect(filename).toMatch(pattern)
  })

  it('profile endpoint returns updated profileImage URL after upload', async () => {
    const user = await createUser({ email: 'profilecheck@example.com' })
    const token = generateAccessToken(user._id.toString())
    const jpegBuffer = await createJpegBuffer()

    // Upload image
    const uploadRes = await request(app)
      .post('/api/users/profile/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', jpegBuffer, { filename: 'photo.jpg', contentType: 'image/jpeg' })

    expect(uploadRes.status).toBe(200)

    // Fetch profile and verify profileImage is updated
    const profileRes = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)

    expect(profileRes.status).toBe(200)
    expect(profileRes.body.profileImage).toBe(uploadRes.body.profileImage)
  })
})
