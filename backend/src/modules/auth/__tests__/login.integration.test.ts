/**
 * Integration tests for POST /api/auth/login
 *
 * Covers Requirements: 1.2, 1.4, 1.5, 1.6, 1.8
 * Acceptance criteria: 1.2 (invalid credentials), 1.4 (valid login → tokens),
 *   1.5 (access token 15 min), 1.6 (refresh token 7 days), 1.8 (deactivated account)
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
process.env.JWT_SECRET = 'test-jwt-secret-for-login-tests'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-login-tests'

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

/** Helper: create a user directly in the DB with a hashed password */
async function createUser(overrides: Partial<{
  name: string
  email: string
  password: string
  isActive: boolean
  role: 'user' | 'admin'
}> = {}) {
  const plainPassword = overrides.password ?? 'Secure@123'
  const hashedPassword = await bcrypt.hash(plainPassword, 10)
  return User.create({
    name: overrides.name ?? 'Test User',
    email: (overrides.email ?? 'test@example.com').toLowerCase(),
    password: hashedPassword,
    isActive: overrides.isActive ?? true,
    role: overrides.role ?? 'user',
  })
}

const validCredentials = {
  email: 'test@example.com',
  password: 'Secure@123',
}

describe('POST /api/auth/login', () => {
  // ─── Happy path ────────────────────────────────────────────────────────────

  it('returns 200 with user info and tokens for valid credentials (Req 1.4)', async () => {
    await createUser()

    const res = await request(app).post('/api/auth/login').send(validCredentials)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      user: {
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
      },
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    })
    expect(res.body.user.id).toBeDefined()
    // Password must NOT be returned
    expect(res.body.user.password).toBeUndefined()
  })

  it('access token expires in 15 minutes (Req 1.5)', async () => {
    await createUser()

    const res = await request(app).post('/api/auth/login').send(validCredentials)

    const decoded = jwt.decode(res.body.accessToken) as jwt.JwtPayload
    expect(decoded).not.toBeNull()
    const expiresIn = decoded.exp! - decoded.iat!
    expect(expiresIn).toBe(15 * 60) // 900 seconds
  })

  it('refresh token expires in 7 days (Req 1.6)', async () => {
    await createUser()

    const res = await request(app).post('/api/auth/login').send(validCredentials)

    const decoded = jwt.decode(res.body.refreshToken) as jwt.JwtPayload
    expect(decoded).not.toBeNull()
    const expiresIn = decoded.exp! - decoded.iat!
    expect(expiresIn).toBe(7 * 24 * 60 * 60) // 604800 seconds
  })

  it('access token payload contains user id and role', async () => {
    await createUser()

    const res = await request(app).post('/api/auth/login').send(validCredentials)

    const decoded = jwt.verify(res.body.accessToken, process.env.JWT_SECRET!) as jwt.JwtPayload
    expect(decoded.id).toBe(res.body.user.id)
    expect(decoded.role).toBe('user')
  })

  it('stores a hashed refresh token in the RefreshToken collection', async () => {
    const user = await createUser()

    const res = await request(app).post('/api/auth/login').send(validCredentials)

    const storedTokens = await RefreshToken.find({ user: user._id })
    expect(storedTokens).toHaveLength(1)

    // Stored token must be a bcrypt hash of the returned refresh token
    const isHashed = await bcrypt.compare(res.body.refreshToken, storedTokens[0].token)
    expect(isHashed).toBe(true)
  })

  it('removes old refresh tokens for the user before storing a new one (Req 1.8)', async () => {
    const user = await createUser()

    // First login — creates one refresh token
    await request(app).post('/api/auth/login').send(validCredentials)

    // Second login — should replace the old token
    const res = await request(app).post('/api/auth/login').send(validCredentials)
    expect(res.status).toBe(200)

    const storedTokens = await RefreshToken.find({ user: user._id })
    expect(storedTokens).toHaveLength(1)
  })

  it('email comparison is case-insensitive', async () => {
    await createUser()

    const res = await request(app)
      .post('/api/auth/login')
      .send({ ...validCredentials, email: 'TEST@EXAMPLE.COM' })

    expect(res.status).toBe(200)
  })

  // ─── Invalid credentials ────────────────────────────────────────────────────

  it('returns 401 when user is not found (Req 1.2)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Secure@123' })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid credentials/i)
  })

  it('returns 401 when password does not match (Req 1.2)', async () => {
    await createUser()

    const res = await request(app)
      .post('/api/auth/login')
      .send({ ...validCredentials, password: 'WrongPass@1' })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid credentials/i)
  })

  it('does not reveal whether email or password was wrong (Req 1.2)', async () => {
    await createUser()

    const wrongEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Secure@123' })

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ ...validCredentials, password: 'WrongPass@1' })

    // Both should return the same generic message
    expect(wrongEmail.body.message).toBe(wrongPassword.body.message)
  })

  // ─── Deactivated account ────────────────────────────────────────────────────

  it('returns 401 with "Account is deactivated" when user.isActive is false (Req 1.8 / Req 18.3)', async () => {
    await createUser({ isActive: false })

    const res = await request(app).post('/api/auth/login').send(validCredentials)

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/account is deactivated/i)
  })

  // ─── Input validation ───────────────────────────────────────────────────────

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'Secure@123' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com' })

    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'Secure@123' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when body is empty', async () => {
    const res = await request(app).post('/api/auth/login').send({})

    expect(res.status).toBe(400)
  })
})
