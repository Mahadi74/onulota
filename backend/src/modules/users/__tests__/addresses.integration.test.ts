/**
 * Integration tests for Address Book endpoints (Tasks 13.1–13.5)
 *
 * Covers Requirement 4: Address Book Management
 *   4.1 – GET /api/users/addresses  – return all user addresses
 *   4.2 – POST /api/users/addresses – add a new address (max 10)
 *   4.3 – PUT /api/users/addresses/:id – update an address
 *   4.4 – DELETE /api/users/addresses/:id – delete an address
 *   4.5 – PATCH /api/users/addresses/:id/default – set default address
 *
 * Also covers:
 *   Requirement 20.1 – 401 when no token provided
 */

// Set required env vars BEFORE importing app
process.env.JWT_SECRET = 'test-jwt-secret-for-address-tests'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-address-tests'
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function generateAccessToken(userId: string, role = 'user'): string {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  )
}

/** A valid address payload satisfying Requirement 4.1 fields */
const validAddress = {
  label: 'Home',
  recipientName: 'Jane Doe',
  phone: '01711111111',
  street: '123 Main St',
  city: 'Dhaka',
  postalCode: '1200',
  country: 'Bangladesh',
  isDefault: false,
}

// ─── GET /api/users/addresses (Task 13.1) ─────────────────────────────────────

describe('GET /api/users/addresses', () => {
  it('returns 200 with an empty array when the user has no addresses (Req 4.1)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .get('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(0)
  })

  it('returns all addresses with correct fields (Req 4.1)', async () => {
    const user = await createUser()
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
      .get('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toMatchObject({
      label: 'Home',
      recipientName: 'Jane Doe',
      phone: '01711111111',
      street: '123 Main St',
      city: 'Dhaka',
      postalCode: '1200',
      country: 'Bangladesh',
      isDefault: true,
    })
    // _id should be present
    expect(res.body[0]._id).toBeDefined()
  })

  it('returns multiple addresses in the order they were added (Req 4.1)', async () => {
    const user = await createUser()
    await User.findByIdAndUpdate(user._id, {
      $push: {
        addresses: {
          $each: [
            { ...validAddress, label: 'Home', recipientName: 'Alice' },
            { ...validAddress, label: 'Office', recipientName: 'Bob' },
          ],
        },
      },
    })
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .get('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].label).toBe('Home')
    expect(res.body[1].label).toBe('Office')
  })

  it('returns 401 when no Authorization header is provided (Req 20.1)', async () => {
    const res = await request(app).get('/api/users/addresses')

    expect(res.status).toBe(401)
  })

  it('returns 401 for an invalid token (Req 20.3)', async () => {
    const res = await request(app)
      .get('/api/users/addresses')
      .set('Authorization', 'Bearer not.a.valid.token')

    expect(res.status).toBe(401)
  })

  it('returns 404 when the user referenced by the token no longer exists', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString()
    const token = generateAccessToken(fakeId)

    const res = await request(app)
      .get('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/user not found/i)
  })
})


// ─── POST /api/users/addresses (Task 13.2) ────────────────────────────────────

describe('POST /api/users/addresses', () => {
  it('returns 201 with the new address when valid data is provided (Req 4.1)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress)

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      label: 'Home',
      recipientName: 'Jane Doe',
      phone: '01711111111',
      street: '123 Main St',
      city: 'Dhaka',
      postalCode: '1200',
      country: 'Bangladesh',
      isDefault: false,
    })
    expect(res.body._id).toBeDefined()
  })

  it('persists the address so GET /addresses returns it (Req 4.1)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress)

    const getRes = await request(app)
      .get('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)

    expect(getRes.status).toBe(200)
    expect(getRes.body).toHaveLength(1)
    expect(getRes.body[0].recipientName).toBe('Jane Doe')
  })

  it('defaults country to Bangladesh when not provided (Req 4.1)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const { country: _omitted, ...addressWithoutCountry } = validAddress

    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(addressWithoutCountry)

    expect(res.status).toBe(201)
    expect(res.body.country).toBe('Bangladesh')
  })

  it('returns 400 when user already has 10 addresses (Req 4.2)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    // Add 10 addresses directly
    const tenAddresses = Array.from({ length: 10 }, (_, i) => ({
      ...validAddress,
      label: `Address ${i + 1}`,
      recipientName: `Person ${i + 1}`,
    }))
    await User.findByIdAndUpdate(user._id, { $set: { addresses: tenAddresses } })

    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/10 addresses/i)
  })

  it('returns 400 when recipientName is missing (Req 22.2)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const { recipientName: _omitted, ...withoutRecipient } = validAddress

    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(withoutRecipient)

    expect(res.status).toBe(400)
  })

  it('returns 400 when phone is missing (Req 22.2)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const { phone: _omitted, ...withoutPhone } = validAddress

    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(withoutPhone)

    expect(res.status).toBe(400)
  })

  it('returns 400 when street is missing (Req 22.2)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const { street: _omitted, ...withoutStreet } = validAddress

    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(withoutStreet)

    expect(res.status).toBe(400)
  })

  it('returns 400 when city is missing (Req 22.2)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const { city: _omitted, ...withoutCity } = validAddress

    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(withoutCity)

    expect(res.status).toBe(400)
  })

  it('returns 400 when postalCode is missing (Req 22.2)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const { postalCode: _omitted, ...withoutPostal } = validAddress

    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(withoutPostal)

    expect(res.status).toBe(400)
  })

  it('returns 400 when postalCode is not 4 digits (Req 22.1)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validAddress, postalCode: '12345' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when postalCode contains non-digits (Req 22.1)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validAddress, postalCode: 'ABCD' })

    expect(res.status).toBe(400)
  })

  it('returns 401 when no Authorization header is provided (Req 20.1)', async () => {
    const res = await request(app)
      .post('/api/users/addresses')
      .send(validAddress)

    expect(res.status).toBe(401)
  })

  it('returns 404 when the user referenced by the token no longer exists', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString()
    const token = generateAccessToken(fakeId)

    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress)

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/user not found/i)
  })

  it('allows adding up to 9 addresses successfully (Req 4.2 boundary)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    for (let i = 1; i <= 9; i++) {
      const res = await request(app)
        .post('/api/users/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validAddress, label: `Address ${i}`, recipientName: `Person ${i}` })
      expect(res.status).toBe(201)
    }

    const getRes = await request(app)
      .get('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)

    expect(getRes.body).toHaveLength(9)
  })
})

// ─── PUT /api/users/addresses/:id (Task 13.3) ─────────────────────────────────

describe('PUT /api/users/addresses/:id', () => {
  it('returns 200 with the updated address when valid data is provided (Req 4.5)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    // First add an address
    const postRes = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress)
    expect(postRes.status).toBe(201)
    const addressId = postRes.body._id

    // Now update it
    const res = await request(app)
      .put(`/api/users/addresses/${addressId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ city: 'Chittagong' })

    expect(res.status).toBe(200)
    expect(res.body.city).toBe('Chittagong')
    // Other fields should remain unchanged
    expect(res.body.recipientName).toBe('Jane Doe')
    expect(res.body.street).toBe('123 Main St')
  })

  it('updates only the provided fields and leaves others unchanged (Req 4.5)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const postRes = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress)
    const addressId = postRes.body._id

    const res = await request(app)
      .put(`/api/users/addresses/${addressId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recipientName: 'John Smith', phone: '01722222222' })

    expect(res.status).toBe(200)
    expect(res.body.recipientName).toBe('John Smith')
    expect(res.body.phone).toBe('01722222222')
    expect(res.body.street).toBe(validAddress.street)
    expect(res.body.city).toBe(validAddress.city)
    expect(res.body.postalCode).toBe(validAddress.postalCode)
  })

  it('persists the update so GET /addresses reflects the change (Req 4.5)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const postRes = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress)
    const addressId = postRes.body._id

    await request(app)
      .put(`/api/users/addresses/${addressId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Work' })

    const getRes = await request(app)
      .get('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)

    expect(getRes.status).toBe(200)
    expect(getRes.body[0].label).toBe('Work')
  })

  it('returns 404 when the address ID does not exist (Req 4.5)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())
    const fakeAddressId = new mongoose.Types.ObjectId().toString()

    const res = await request(app)
      .put(`/api/users/addresses/${fakeAddressId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ city: 'Sylhet' })

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/address not found/i)
  })

  it('returns 404 when the user referenced by the token no longer exists (Req 4.5)', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString()
    const token = generateAccessToken(fakeId)
    const fakeAddressId = new mongoose.Types.ObjectId().toString()

    const res = await request(app)
      .put(`/api/users/addresses/${fakeAddressId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ city: 'Sylhet' })

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/user not found/i)
  })

  it('returns 400 when no fields are provided (Req 22.2)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())
    const fakeAddressId = new mongoose.Types.ObjectId().toString()

    const res = await request(app)
      .put(`/api/users/addresses/${fakeAddressId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(res.status).toBe(400)
  })

  it('returns 400 when postalCode is invalid format (Req 22.1)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const postRes = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress)
    const addressId = postRes.body._id

    const res = await request(app)
      .put(`/api/users/addresses/${addressId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ postalCode: '12345' })

    expect(res.status).toBe(400)
  })

  it('returns 401 when no Authorization header is provided (Req 20.1)', async () => {
    const fakeAddressId = new mongoose.Types.ObjectId().toString()

    const res = await request(app)
      .put(`/api/users/addresses/${fakeAddressId}`)
      .send({ city: 'Dhaka' })

    expect(res.status).toBe(401)
  })

  it('can update all fields at once (Req 4.5)', async () => {
    const user = await createUser()
    const token = generateAccessToken(user._id.toString())

    const postRes = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress)
    const addressId = postRes.body._id

    const updatedData = {
      label: 'Office',
      recipientName: 'John Smith',
      phone: '01733333333',
      street: '456 Business Ave',
      city: 'Chittagong',
      postalCode: '4000',
      country: 'Bangladesh',
      isDefault: true,
    }

    const res = await request(app)
      .put(`/api/users/addresses/${addressId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(updatedData)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject(updatedData)
    expect(res.body._id).toBe(addressId)
  })
})
