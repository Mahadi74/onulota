import * as jwt from 'jsonwebtoken'
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  TokenPayload,
} from '../jwt'

const TEST_SECRET = 'test-jwt-secret-at-least-256-bits-long-for-security'
const TEST_REFRESH_SECRET = 'test-refresh-secret-at-least-256-bits-long-for-security'

const payload: TokenPayload = { id: 'user123', role: 'user' }

beforeEach(() => {
  process.env.JWT_SECRET = TEST_SECRET
  process.env.JWT_REFRESH_SECRET = TEST_REFRESH_SECRET
})

afterEach(() => {
  delete process.env.JWT_SECRET
  delete process.env.JWT_REFRESH_SECRET
})

describe('generateAccessToken', () => {
  it('returns a signed JWT string', () => {
    const token = generateAccessToken(payload)
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)
  })

  it('encodes the payload correctly', () => {
    const token = generateAccessToken(payload)
    const decoded = jwt.decode(token) as TokenPayload & { exp: number; iat: number }
    expect(decoded.id).toBe(payload.id)
    expect(decoded.role).toBe(payload.role)
  })

  it('expires in 15 minutes', () => {
    const before = Math.floor(Date.now() / 1000)
    const token = generateAccessToken(payload)
    const decoded = jwt.decode(token) as { exp: number; iat: number }
    const ttl = decoded.exp - decoded.iat
    expect(ttl).toBe(15 * 60)
    expect(decoded.iat).toBeGreaterThanOrEqual(before)
  })

  it('throws when JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET
    expect(() => generateAccessToken(payload)).toThrow('JWT_SECRET not configured')
  })
})

describe('generateRefreshToken', () => {
  it('returns a signed JWT string', () => {
    const token = generateRefreshToken(payload)
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)
  })

  it('encodes the payload correctly', () => {
    const token = generateRefreshToken(payload)
    const decoded = jwt.decode(token) as TokenPayload & { exp: number; iat: number }
    expect(decoded.id).toBe(payload.id)
    expect(decoded.role).toBe(payload.role)
  })

  it('expires in 7 days', () => {
    const token = generateRefreshToken(payload)
    const decoded = jwt.decode(token) as { exp: number; iat: number }
    const ttl = decoded.exp - decoded.iat
    expect(ttl).toBe(7 * 24 * 60 * 60)
  })

  it('throws when JWT_REFRESH_SECRET is not set', () => {
    delete process.env.JWT_REFRESH_SECRET
    expect(() => generateRefreshToken(payload)).toThrow('JWT_REFRESH_SECRET not configured')
  })
})

describe('verifyToken', () => {
  it('returns the decoded payload for a valid access token', () => {
    const token = generateAccessToken(payload)
    const decoded = verifyToken(token)
    expect(decoded.id).toBe(payload.id)
    expect(decoded.role).toBe(payload.role)
  })

  it('throws for an invalid token', () => {
    expect(() => verifyToken('invalid.token.here')).toThrow()
  })

  it('throws for an expired token', () => {
    const expiredToken = jwt.sign(payload, TEST_SECRET, { expiresIn: -1 })
    expect(() => verifyToken(expiredToken)).toThrow(jwt.TokenExpiredError)
  })

  it('throws when JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET
    expect(() => verifyToken('any.token.here')).toThrow('JWT_SECRET not configured')
  })

  it('throws for a token signed with the wrong secret', () => {
    const token = jwt.sign(payload, 'wrong-secret')
    expect(() => verifyToken(token)).toThrow(jwt.JsonWebTokenError)
  })
})

describe('verifyRefreshToken', () => {
  it('returns the decoded payload for a valid refresh token', () => {
    const token = generateRefreshToken(payload)
    const decoded = verifyRefreshToken(token)
    expect(decoded.id).toBe(payload.id)
    expect(decoded.role).toBe(payload.role)
  })

  it('throws for an invalid token', () => {
    expect(() => verifyRefreshToken('bad.token.value')).toThrow()
  })

  it('throws when JWT_REFRESH_SECRET is not set', () => {
    delete process.env.JWT_REFRESH_SECRET
    expect(() => verifyRefreshToken('any.token.here')).toThrow('JWT_REFRESH_SECRET not configured')
  })

  it('rejects an access token (signed with wrong secret)', () => {
    const accessToken = generateAccessToken(payload)
    expect(() => verifyRefreshToken(accessToken)).toThrow(jwt.JsonWebTokenError)
  })
})
