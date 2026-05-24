/**
 * Integration tests for POST /api/auth/refresh
 *
 * Covers Requirement 1, Acceptance Criteria 1.7:
 *   WHEN a User submits a valid Refresh_Token, THE Platform SHALL generate a new JWT_Token
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
process.env.JWT_SECRET = 'test-jwt-secret-for-refresh-tests'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-refresh-tests'

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

/** Helper: create a user and log in to get a valid refresh token */
async function createUserAndLogin(overrides: Partial<{
  isActive: boolean
}> = {}): Promise<{ userId: string; refreshToken: string }> {
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

  return { userId: user._id.toString(), refreshToken: res.body.refreshToken }
}

/** Helper: generate a raw (unhashed) refresh token and store its hash in DB */
async function storeRefreshToken(
  userId: string,
  expiresAt: Date
): Promise<string> {
  const rawToken = jwt.sign(
    { id: userId, role: 'user' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  )
  const hashed = await bcrypt.hash(rawToken, 10)
  await RefreshToken.create({ user: userId, token: hashed, expiresAt })
  return rawToken
}

describe('POST /api/auth/refresh', () => {
  // ─── Happy path ────────────────────────────────────────────────────────────

  it('returns 200 with a new access token for a valid refresh token (Req 1.7)', async () => {
    const { refreshToken } = await createUserAndLogin()

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      accessToken: expect.any(String),
    })
    // refreshToken should NOT be returned
    expect(res.body.refreshToken).toBeUndefined()
  })

  it('returned access token is a valid JWT signed with JWT_SECRET', async () => {
    const { refreshToken } = await createUserAndLogin()

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken })

    expect(() =>
      jwt.verify(res.body.accessToken, process.env.JWT_SECRET!)
    ).not.toThrow()
  })

  it('returned access token expires in 15 minutes (Req 1.5)', async () => {
    const { refreshToken } = await createUserAndLogin()

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken })

    const decoded = jwt.decode(res.body.accessToken) as jwt.JwtPayload
    expect(decoded).not.toBeNull()
    const expiresIn = decoded.exp! - decoded.iat!
    expect(expiresIn).toBe(15 * 60) // 900 seconds
  })

  it('returned access token payload contains user id and role', async () => {
    const { userId, refreshToken } = await createUserAndLogin()

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken })

    const decoded = jwt.verify(res.body.accessToken, process.env.JWT_SECRET!) as jwt.JwtPayload
    expect(decoded.id).toBe(userId)
    expect(decoded.role).toBe('user')
  })

  // ─── Invalid / tampered token ───────────────────────────────────────────────

  it('returns 401 "Invalid refresh token" when token has wrong signature', async () => {
    const fakeToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), role: 'user' },
      'wrong-secret',
      { expiresIn: '7d' }
    )

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: fakeToken })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid refresh token/i)
  })

  it('returns 401 "Invalid refresh token" when token is not stored in DB', async () => {
    // Valid JWT signature but never stored
    const orphanToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), role: 'user' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    )

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: orphanToken })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid refresh token/i)
  })

  it('returns 401 "Invalid refresh token" when token is a random string', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'not.a.valid.jwt' })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid refresh token/i)
  })

  // ─── Expired stored token ───────────────────────────────────────────────────

  it('returns 401 "Refresh token expired" when stored token expiresAt is in the past', async () => {
    const user = await User.create({
      name: 'Expiry User',
      email: 'expiry@example.com',
      password: await bcrypt.hash('Secure@123', 10),
      isActive: true,
      role: 'user',
    })

    const pastDate = new Date(Date.now() - 1000) // 1 second ago
    const rawToken = await storeRefreshToken(user._id.toString(), pastDate)

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: rawToken })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/refresh token expired/i)
  })

  // ─── Inactive user ──────────────────────────────────────────────────────────

  it('returns 401 when the user account is deactivated after token was issued', async () => {
    const { userId, refreshToken } = await createUserAndLogin()

    // Deactivate the user after login
    await User.findByIdAndUpdate(userId, { isActive: false })

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid refresh token/i)
  })

  // ─── Input validation ───────────────────────────────────────────────────────

  it('returns 400 when refreshToken field is missing', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({})

    expect(res.status).toBe(400)
  })

  it('returns 400 when refreshToken is an empty string', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: '' })

    expect(res.status).toBe(400)
  })
})
