/**
 * Integration tests for PUT /api/users/profile
 *
 * Covers Requirement 3.2: WHEN an authenticated User submits updated profile data,
 * THE Platform SHALL validate and save the changes.
 *
 * Also covers:
 * - Requirement 20.1: 401 when no token provided
 * - Requirement 22.1/22.2: 400 for invalid/missing fields
 * - Password must never be returned in the response
 */

// Set required env vars BEFORE importing app
process.env.JWT_SECRET = 'test-jwt-secret-for-update-profile-tests'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-update-profile-tests'
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
  role: 'user' | 'admin'
  isActive: boolean
}> = {}) {
  const hashedPassword = await bcrypt.hash(overrides.password ?? 'Secure@123', 10)
  return User.create({
    name: overrides.name ?? 'Test User',
    email: (overrides.email ?? 'test@example.com').toLowerCase(),
    password: hashedPassword,
    phone: overrides.phone,
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

describe('PUT /api/users/profile', () => {
  // ─── Happy path ────────────────────────────────────────────────────────────

  it('returns 200 and updated profile when name is changed (Req 3.2)', async () => {
    const user = await createUser({ name: 'Old Name' })
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('New Name')
    expect(res.body.email).toBe('test@example.com')
    expect(res.body.id).toBe(user._id.toString())
  })

  it('returns 200 and updated profile when phone is changed (Req 3.2)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+8801711111111' })

    expect(res.status).toBe(200)
    expect(res.body.phone).toBe('+8801711111111')
  })

  it('returns 200 when both name and phone are updated together (Req 3.2)', async () => {
    const user = await createUser({ name: 'Old Name' })
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name', phone: '+8801912345678' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Updated Name')
    expect(res.body.phone).toBe('+8801912345678')
  })

  it('persists the update in the database (Req 3.2)', async () => {
    const user = await createUser({ name: 'Before Update' })
    const token = generateAccessToken(user._id.toString())

    await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'After Update' })

    const dbUser = await User.findById(user._id).lean()
    expect(dbUser?.name).toBe('After Update')
  })

  it('never returns the password field (security)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Safe Name' })

    expect(res.status).toBe(200)
    expect(res.body.password).toBeUndefined()
  })

  it('returns all expected profile fields in the response', async () => {
    const user = await createUser({ name: 'Full Fields', phone: '+8801700000000' })
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Full Fields' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: user._id.toString(),
      name: 'Updated Full Fields',
      email: 'test@example.com',
      role: 'user',
    })
    expect(res.body.createdAt).toBeDefined()
    expect(Array.isArray(res.body.addresses)).toBe(true)
  })

  it('does not change email when updating name (Req 3.2)', async () => {
    const user = await createUser({ email: 'original@example.com' })
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' })

    expect(res.status).toBe(200)
    expect(res.body.email).toBe('original@example.com')
  })

  // ─── Validation: name ──────────────────────────────────────────────────────

  it('returns 400 when name is shorter than 2 characters (Req 22.1)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when name exceeds 100 characters (Req 22.6)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A'.repeat(101) })

    expect(res.status).toBe(400)
  })

  it('accepts a name of exactly 2 characters', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Jo' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Jo')
  })

  it('accepts a name of exactly 100 characters', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A'.repeat(100) })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('A'.repeat(100))
  })

  // ─── Validation: phone ─────────────────────────────────────────────────────

  it('returns 400 for phone not in Bangladesh format (Req 22.1)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '01711111111' }) // missing +880 prefix

    expect(res.status).toBe(400)
  })

  it('returns 400 for phone with wrong country code (Req 22.1)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+441711111111' }) // UK code

    expect(res.status).toBe(400)
  })

  it('returns 400 for phone that is too short (Req 22.1)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+88017111' })

    expect(res.status).toBe(400)
  })

  it('accepts a valid Bangladesh phone number (+880XXXXXXXXXX)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+8801812345678' })

    expect(res.status).toBe(200)
    expect(res.body.phone).toBe('+8801812345678')
  })

  // ─── Validation: empty body ────────────────────────────────────────────────

  it('returns 400 when body is empty (at least one field required)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(res.status).toBe(400)
  })

  // ─── Authentication failures ────────────────────────────────────────────────

  it('returns 401 when no Authorization header is provided (Req 20.1)', async () => {
    const res = await request(app)
      .put('/api/users/profile')
      .send({ name: 'New Name' })

    expect(res.status).toBe(401)
  })

  it('returns 401 for an expired token (Req 20.2)', async () => {
    const user = await createUser()
    const expiredToken = jwt.sign(
      { id: user._id.toString(), role: 'user' },
      process.env.JWT_SECRET!,
      { expiresIn: '-1s' }
    )

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({ name: 'New Name' })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/token expired/i)
  })

  it('returns 401 for an invalid token (Req 20.3)', async () => {
    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', 'Bearer this.is.not.valid')
      .send({ name: 'New Name' })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid token/i)
  })

  // ─── Edge cases ─────────────────────────────────────────────────────────────

  it('returns 404 when the user referenced by the token no longer exists', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString()
    const token = generateAccessToken(fakeId)

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ghost User' })

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/user not found/i)
  })
})
