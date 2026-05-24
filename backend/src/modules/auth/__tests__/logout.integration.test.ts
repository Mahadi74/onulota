/**
 * Integration tests for POST /api/auth/logout
 *
 * Covers Requirement 1, Acceptance Criteria 1.8:
 *   WHEN a User logs out, THE Platform SHALL invalidate the Refresh_Token
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'
import { createApp } from '../../../app'
import { User } from '../../../models/User'
import { RefreshToken } from '../../../models/RefreshToken'

let mongoServer: MongoMemoryServer
const app = createApp()

// Set required env vars for JWT
process.env.JWT_SECRET = 'test-jwt-secret-for-logout-tests'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-logout-tests'

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
  await RefreshToken.deleteMany({})
})

/** Helper: create a user and log in to get valid tokens */
async function createUserAndLogin(overrides: Partial<{
  isActive: boolean
}> = {}): Promise<{ userId: string; accessToken: string; refreshToken: string }> {
  const plainPassword = 'Secure@123'
  const hashedPassword = await bcrypt.hash(plainPassword, 10)
  const user = await User.create({
    name: 'Test User',
    email: 'test@example.com',
    password: hashedPassword,
    isActive: overrides.isActive ?? true,
    role: 'user',
  })

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'test@example.com', password: plainPassword })

  return {
    userId: user._id.toString(),
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
  }
}

describe('POST /api/auth/logout', () => {
  // ─── Happy path ────────────────────────────────────────────────────────────

  it('returns 200 with success message when valid tokens are provided (Req 1.8)', async () => {
    const { accessToken, refreshToken } = await createUserAndLogin()

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      message: expect.stringMatching(/logged out/i),
    })
  })

  it('invalidates the refresh token in the database (Req 1.8)', async () => {
    const { userId, accessToken, refreshToken } = await createUserAndLogin()

    // Confirm token exists before logout
    const tokensBefore = await RefreshToken.find({ user: userId })
    expect(tokensBefore).toHaveLength(1)

    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })

    // Token should be deleted after logout
    const tokensAfter = await RefreshToken.find({ user: userId })
    expect(tokensAfter).toHaveLength(0)
  })

  it('prevents using the refresh token after logout', async () => {
    const { accessToken, refreshToken } = await createUserAndLogin()

    // Logout
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })

    // Attempt to use the invalidated refresh token
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken })

    expect(refreshRes.status).toBe(401)
  })

  // ─── Idempotent logout ──────────────────────────────────────────────────────

  it('returns 200 even when called twice (idempotent logout)', async () => {
    const { accessToken, refreshToken } = await createUserAndLogin()

    // First logout
    const firstRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })

    expect(firstRes.status).toBe(200)

    // Second logout with same refresh token — should still succeed
    const secondRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })

    expect(secondRes.status).toBe(200)
  })

  it('returns 200 when refresh token is not found in database (idempotent)', async () => {
    const { userId, accessToken } = await createUserAndLogin()

    // Generate a valid JWT refresh token that is NOT stored in DB
    const orphanToken = jwt.sign(
      { id: userId, role: 'user' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    )

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken: orphanToken })

    expect(res.status).toBe(200)
  })

  it('returns 200 when refresh token has invalid signature (idempotent)', async () => {
    const { accessToken } = await createUserAndLogin()

    const invalidToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), role: 'user' },
      'wrong-secret',
      { expiresIn: '7d' }
    )

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken: invalidToken })

    expect(res.status).toBe(200)
  })

  // ─── Authentication required ────────────────────────────────────────────────

  it('returns 401 when no Authorization header is provided', async () => {
    const { refreshToken } = await createUserAndLogin()

    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken })

    expect(res.status).toBe(401)
  })

  it('returns 401 when access token is expired', async () => {
    const { userId, refreshToken } = await createUserAndLogin()

    // Generate an already-expired access token
    const expiredAccessToken = jwt.sign(
      { id: userId, role: 'user' },
      process.env.JWT_SECRET!,
      { expiresIn: -1 } // expired immediately
    )

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${expiredAccessToken}`)
      .send({ refreshToken })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/token expired/i)
  })

  it('returns 401 when access token is invalid', async () => {
    const { refreshToken } = await createUserAndLogin()

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer not.a.valid.token')
      .send({ refreshToken })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid token/i)
  })

  // ─── Input validation ───────────────────────────────────────────────────────

  it('returns 400 when refreshToken field is missing', async () => {
    const { accessToken } = await createUserAndLogin()

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})

    expect(res.status).toBe(400)
  })

  it('returns 400 when refreshToken is an empty string', async () => {
    const { accessToken } = await createUserAndLogin()

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken: '' })

    expect(res.status).toBe(400)
  })

  // ─── Only deletes the matching token (multi-device scenario) ───────────────

  it('only deletes the matching refresh token, leaving others intact', async () => {
    const plainPassword = 'Secure@123'
    const hashedPassword = await bcrypt.hash(plainPassword, 10)
    const user = await User.create({
      name: 'Multi Device User',
      email: 'multidevice@example.com',
      password: hashedPassword,
      isActive: true,
      role: 'user',
    })

    // Simulate two device logins by manually creating two refresh tokens
    const rawToken1 = jwt.sign(
      { id: user._id.toString(), role: 'user' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    )
    const rawToken2 = jwt.sign(
      { id: user._id.toString(), role: 'user' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    )

    const hashed1 = await bcrypt.hash(rawToken1, 10)
    const hashed2 = await bcrypt.hash(rawToken2, 10)
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await RefreshToken.create({ user: user._id, token: hashed1, expiresAt: expiry })
    await RefreshToken.create({ user: user._id, token: hashed2, expiresAt: expiry })

    // Generate a valid access token for the user
    const accessToken = jwt.sign(
      { id: user._id.toString(), role: 'user' },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    )

    // Logout with token1 only
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken: rawToken1 })

    expect(res.status).toBe(200)

    // Only token1 should be deleted; token2 should remain
    const remaining = await RefreshToken.find({ user: user._id })
    expect(remaining).toHaveLength(1)

    const token2StillValid = await bcrypt.compare(rawToken2, remaining[0].token)
    expect(token2StillValid).toBe(true)
  })
})
