/**
 * Integration tests for PUT /api/users/password
 *
 * Covers Requirement 3.4: WHEN an authenticated User changes their password,
 * THE Platform SHALL require the current password for verification.
 *
 * Also covers:
 * - Requirement 1.10: password strength rules (min 8 chars, uppercase, lowercase, digit, special char)
 * - Requirement 20.1: 401 when no token provided
 * - Requirement 1.3: new password is hashed with bcrypt cost factor 10
 */

// Set required env vars BEFORE importing app
process.env.JWT_SECRET = 'test-jwt-secret-for-change-password-tests'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-change-password-tests'
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

/** Helper: create a user with a known plain-text password */
async function createUser(overrides: Partial<{
  name: string
  email: string
  password: string
  isActive: boolean
  role: 'user' | 'admin'
}> = {}) {
  const plainPassword = overrides.password ?? 'OldPass@123'
  const hashedPassword = await bcrypt.hash(plainPassword, 10)
  return User.create({
    name: overrides.name ?? 'Test User',
    email: (overrides.email ?? 'test@example.com').toLowerCase(),
    password: hashedPassword,
    isActive: overrides.isActive ?? true,
    role: overrides.role ?? 'user',
  })
}

/** Helper: generate a valid access token */
function generateAccessToken(userId: string, role = 'user'): string {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  )
}

const VALID_NEW_PASSWORD = 'NewPass@456'

describe('PUT /api/users/password', () => {
  // ─── Happy path ────────────────────────────────────────────────────────────

  it('returns 200 with success message when current password is correct (Req 3.4)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'OldPass@123', newPassword: VALID_NEW_PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ message: 'Password updated successfully' })
  })

  it('stores the new password as a bcrypt hash in the database (Req 1.3)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    await request(app)
      .put('/api/users/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'OldPass@123', newPassword: VALID_NEW_PASSWORD })

    const updatedUser = await User.findById(user._id).select('+password')
    expect(updatedUser).not.toBeNull()
    const isHashed = await bcrypt.compare(VALID_NEW_PASSWORD, updatedUser!.password)
    expect(isHashed).toBe(true)
  })

  it('old password no longer works after change', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    await request(app)
      .put('/api/users/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'OldPass@123', newPassword: VALID_NEW_PASSWORD })

    const updatedUser = await User.findById(user._id).select('+password')
    const oldStillWorks = await bcrypt.compare('OldPass@123', updatedUser!.password)
    expect(oldStillWorks).toBe(false)
  })

  it('new password can be used to verify after change', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    await request(app)
      .put('/api/users/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'OldPass@123', newPassword: VALID_NEW_PASSWORD })

    const updatedUser = await User.findById(user._id).select('+password')
    const newWorks = await bcrypt.compare(VALID_NEW_PASSWORD, updatedUser!.password)
    expect(newWorks).toBe(true)
  })

  // ─── Current password verification (Req 3.4) ───────────────────────────────

  it('returns 401 when current password is incorrect (Req 3.4)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPass@999', newPassword: VALID_NEW_PASSWORD })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/current password is incorrect/i)
  })

  it('does not update the password when current password is wrong', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())
    const originalHash = user.password

    await request(app)
      .put('/api/users/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPass@999', newPassword: VALID_NEW_PASSWORD })

    const unchanged = await User.findById(user._id).select('+password')
    expect(unchanged!.password).toBe(originalHash)
  })

  // ─── New password strength validation (Req 1.10) ───────────────────────────

  it('returns 400 when new password is too short (< 8 chars)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'OldPass@123', newPassword: 'Ab1@' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when new password has no uppercase letter', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'OldPass@123', newPassword: 'nouppercase@1' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when new password has no lowercase letter', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'OldPass@123', newPassword: 'NOLOWER@123' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when new password has no digit', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'OldPass@123', newPassword: 'NoDigit@Pass' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when new password has no special character', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'OldPass@123', newPassword: 'NoSpecial123' })

    expect(res.status).toBe(400)
  })

  // ─── Input validation ───────────────────────────────────────────────────────

  it('returns 400 when currentPassword is missing', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: VALID_NEW_PASSWORD })

    expect(res.status).toBe(400)
  })

  it('returns 400 when newPassword is missing', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'OldPass@123' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when body is empty', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .put('/api/users/password')
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(res.status).toBe(400)
  })

  // ─── Authentication failures (Req 20.1) ────────────────────────────────────

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app)
      .put('/api/users/password')
      .send({ currentPassword: 'OldPass@123', newPassword: VALID_NEW_PASSWORD })

    expect(res.status).toBe(401)
  })

  it('returns 401 for an expired token', async () => {
    const user = await createUser()
    const expiredToken = jwt.sign(
      { id: user._id.toString(), role: 'user' },
      process.env.JWT_SECRET!,
      { expiresIn: '-1s' }
    )

    const res = await request(app)
      .put('/api/users/password')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({ currentPassword: 'OldPass@123', newPassword: VALID_NEW_PASSWORD })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/token expired/i)
  })

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .put('/api/users/password')
      .set('Authorization', 'Bearer this.is.not.valid')
      .send({ currentPassword: 'OldPass@123', newPassword: VALID_NEW_PASSWORD })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid token/i)
  })

  // ─── Edge cases ─────────────────────────────────────────────────────────────

  it('returns 404 when the user referenced by the token no longer exists', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString()
    const token = generateAccessToken(fakeId)

    const res = await request(app)
      .put('/api/users/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'OldPass@123', newPassword: VALID_NEW_PASSWORD })

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/user not found/i)
  })
})
