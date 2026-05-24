/**
 * Integration tests for POST /api/auth/register
 *
 * Covers Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.9, 1.10
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
process.env.JWT_SECRET = 'test-jwt-secret-for-register-tests'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-register-tests'

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

const validPayload = {
  name: 'Alice Smith',
  email: 'alice@example.com',
  password: 'Secure@123',
}

describe('POST /api/auth/register', () => {
  // ─── Happy path ────────────────────────────────────────────────────────────

  it('returns 201 with user info and tokens for valid input (Req 1.1)', async () => {
    const res = await request(app).post('/api/auth/register').send(validPayload)

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      user: {
        name: 'Alice Smith',
        email: 'alice@example.com',
        role: 'user',
      },
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    })
    expect(res.body.user.id).toBeDefined()
    // Password must NOT be returned
    expect(res.body.user.password).toBeUndefined()
  })

  it('stores the user in MongoDB with a hashed password (Req 1.3)', async () => {
    await request(app).post('/api/auth/register').send(validPayload)

    const user = await User.findOne({ email: validPayload.email })
    expect(user).not.toBeNull()
    expect(user!.password).not.toBe(validPayload.password)
    const isHashed = await bcrypt.compare(validPayload.password, user!.password)
    expect(isHashed).toBe(true)
  })

  it('uses bcrypt cost factor ≥ 10 (Req 1.3)', async () => {
    await request(app).post('/api/auth/register').send(validPayload)

    const user = await User.findOne({ email: validPayload.email })
    // bcrypt hash encodes the cost factor: $2b$10$...
    expect(user!.password).toMatch(/^\$2[ab]\$10\$/)
  })

  it('access token expires in 15 minutes (Req 1.5)', async () => {
    const res = await request(app).post('/api/auth/register').send(validPayload)

    const decoded = jwt.decode(res.body.accessToken) as jwt.JwtPayload
    expect(decoded).not.toBeNull()
    const expiresIn = decoded.exp! - decoded.iat!
    expect(expiresIn).toBe(15 * 60) // 900 seconds
  })

  it('refresh token expires in 7 days (Req 1.6)', async () => {
    const res = await request(app).post('/api/auth/register').send(validPayload)

    const decoded = jwt.decode(res.body.refreshToken) as jwt.JwtPayload
    expect(decoded).not.toBeNull()
    const expiresIn = decoded.exp! - decoded.iat!
    expect(expiresIn).toBe(7 * 24 * 60 * 60) // 604800 seconds
  })

  it('stores a hashed refresh token in the RefreshToken collection', async () => {
    const res = await request(app).post('/api/auth/register').send(validPayload)

    const user = await User.findOne({ email: validPayload.email })
    const storedTokens = await RefreshToken.find({ user: user!._id })
    expect(storedTokens).toHaveLength(1)

    // Stored token must be a bcrypt hash of the returned refresh token
    const isHashed = await bcrypt.compare(res.body.refreshToken, storedTokens[0].token)
    expect(isHashed).toBe(true)
  })

  it('access token payload contains user id and role', async () => {
    const res = await request(app).post('/api/auth/register').send(validPayload)

    const decoded = jwt.verify(res.body.accessToken, process.env.JWT_SECRET!) as jwt.JwtPayload
    expect(decoded.id).toBe(res.body.user.id)
    expect(decoded.role).toBe('user')
  })

  // ─── Email uniqueness ───────────────────────────────────────────────────────

  it('returns 409 when email is already registered (Req 1.2)', async () => {
    await request(app).post('/api/auth/register').send(validPayload)
    const res = await request(app).post('/api/auth/register').send(validPayload)

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/already registered/i)
  })

  it('email comparison is case-insensitive', async () => {
    await request(app).post('/api/auth/register').send(validPayload)
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, email: 'ALICE@EXAMPLE.COM' })

    expect(res.status).toBe(409)
  })

  // ─── Input validation ───────────────────────────────────────────────────────

  it('returns 400 when name is missing', async () => {
    const { name: _name, ...payload } = validPayload
    const res = await request(app).post('/api/auth/register').send(payload)
    expect(res.status).toBe(400)
  })

  it('returns 400 when email is missing', async () => {
    const { email: _email, ...payload } = validPayload
    const res = await request(app).post('/api/auth/register').send(payload)
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const { password: _password, ...payload } = validPayload
    const res = await request(app).post('/api/auth/register').send(payload)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email format (Req 1.9)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, email: 'not-an-email' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for email without domain (Req 1.9)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, email: 'user@' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for password shorter than 8 characters (Req 1.10)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, password: 'Ab1@' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for password missing uppercase letter (Req 1.10)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, password: 'secure@123' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for password missing lowercase letter (Req 1.10)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, password: 'SECURE@123' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for password missing a number (Req 1.10)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, password: 'Secure@abc' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for password missing a special character (Req 1.10)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, password: 'Secure1234' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for name shorter than 2 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, name: 'A' })
    expect(res.status).toBe(400)
  })

  // ─── Default role ───────────────────────────────────────────────────────────

  it('assigns role "user" by default', async () => {
    const res = await request(app).post('/api/auth/register').send(validPayload)
    expect(res.body.user.role).toBe('user')
  })

  // ─── isActive default ───────────────────────────────────────────────────────

  it('creates user with isActive = true', async () => {
    await request(app).post('/api/auth/register').send(validPayload)
    const user = await User.findOne({ email: validPayload.email })
    expect(user!.isActive).toBe(true)
  })
})
