/**
 * Integration tests for GET /api/users/profile
 *
 * Covers Requirement 3.1: WHEN an authenticated User requests their profile,
 * THE Platform SHALL return the User's name, email, phone number, and profile image URL.
 *
 * Also covers:
 * - Requirement 20.1: 401 when no token provided
 * - Requirement 20.2: 401 when token is expired
 * - Requirement 20.3: 401 when token is invalid
 * - Password must never be returned in the response
 */

// Set required env vars BEFORE importing app (passport.ts reads them at module load time)
process.env.JWT_SECRET = 'test-jwt-secret-for-profile-tests'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-profile-tests'
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:5000/api/auth/google/callback'

import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'
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
})

afterEach(async () => {
  await User.deleteMany({})
})

/** Helper: create a user directly in the DB */
async function createUser(overrides: Partial<{
  name: string
  email: string
  password: string
  phone: string
  profileImage: string
  role: 'user' | 'admin'
  isActive: boolean
}> = {}) {
  const hashedPassword = await bcrypt.hash(overrides.password ?? 'Secure@123', 10)
  return User.create({
    name: overrides.name ?? 'Test User',
    email: (overrides.email ?? 'test@example.com').toLowerCase(),
    password: hashedPassword,
    phone: overrides.phone,
    profileImage: overrides.profileImage,
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

describe('GET /api/users/profile', () => {
  // ─── Happy path ────────────────────────────────────────────────────────────

  it('returns 200 with profile fields for an authenticated user (Req 3.1)', async () => {
    const user = await createUser({
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '01711111111',
      profileImage: 'https://example.com/avatar.jpg',
    })
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: user._id.toString(),
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '01711111111',
      profileImage: 'https://example.com/avatar.jpg',
      role: 'user',
    })
    expect(res.body.createdAt).toBeDefined()
    expect(Array.isArray(res.body.addresses)).toBe(true)
  })

  it('never returns the password field (Req 3.1 / security)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.password).toBeUndefined()
  })

  it('returns phone and profileImage as undefined when not set', async () => {
    const user = await createUser({ name: 'No Phone', email: 'nophone@example.com' })
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    // phone and profileImage should be absent or undefined
    expect(res.body.phone).toBeUndefined()
    expect(res.body.profileImage).toBeUndefined()
  })

  it('returns addresses array for a user with saved addresses', async () => {
    const user = await createUser()
    // Add an address directly via model
    await User.findByIdAndUpdate(user._id, {
      $push: {
        addresses: {
          label: 'Home',
          recipientName: 'Jane Doe',
          phone: '01711111111',
          street: '123 Main St',
          city: 'Dhaka',
          postalCode: '1200',
          country: 'Bangladesh',
          isDefault: true,
        },
      },
    })
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.addresses).toHaveLength(1)
    expect(res.body.addresses[0]).toMatchObject({
      label: 'Home',
      recipientName: 'Jane Doe',
      city: 'Dhaka',
    })
  })

  it('returns correct role for an admin user', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' })
    const token = generateAccessToken(admin._id.toString(), 'admin')

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.role).toBe('admin')
  })

  // ─── Authentication failures ────────────────────────────────────────────────

  it('returns 401 when no Authorization header is provided (Req 20.1)', async () => {
    const res = await request(app).get('/api/users/profile')

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/access token required/i)
  })

  it('returns 401 when Authorization header is missing Bearer prefix (Req 20.1)', async () => {
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', 'invalid-token')

    expect(res.status).toBe(401)
  })

  it('returns 401 with "Token expired" for an expired token (Req 20.2)', async () => {
    const user = await createUser()
    // Generate a token that is already expired
    const expiredToken = jwt.sign(
      { id: user._id.toString(), role: 'user' },
      process.env.JWT_SECRET!,
      { expiresIn: '-1s' }
    )

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${expiredToken}`)

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/token expired/i)
  })

  it('returns 401 with "Invalid token" for a malformed token (Req 20.3)', async () => {
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', 'Bearer this.is.not.a.valid.jwt')

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid token/i)
  })

  it('returns 401 for a token signed with the wrong secret (Req 20.3)', async () => {
    const user = await createUser()
    const wrongToken = jwt.sign(
      { id: user._id.toString(), role: 'user' },
      'wrong-secret',
      { expiresIn: '15m' }
    )

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${wrongToken}`)

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid token/i)
  })

  // ─── Edge cases ─────────────────────────────────────────────────────────────

  it('returns 404 when the user referenced by the token no longer exists', async () => {
    // Generate a token for a non-existent user ID
    const fakeId = new mongoose.Types.ObjectId().toString()
    const token = generateAccessToken(fakeId)

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/user not found/i)
  })
})
