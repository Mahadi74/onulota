import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import {
  authenticateToken,
  requireRole,
  optionalAuth,
  AuthenticatedRequest,
} from '../auth'
import { AppError } from '../errorHandler'

const TEST_SECRET = 'test-jwt-secret-at-least-256-bits-long-for-security'
const TEST_REFRESH_SECRET = 'test-refresh-secret-at-least-256-bits-long-for-security'

beforeEach(() => {
  process.env.JWT_SECRET = TEST_SECRET
  process.env.JWT_REFRESH_SECRET = TEST_REFRESH_SECRET
})

afterEach(() => {
  delete process.env.JWT_SECRET
  delete process.env.JWT_REFRESH_SECRET
})

function makeReq(authHeader?: string): AuthenticatedRequest {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as AuthenticatedRequest
}

function makeRes(): Response {
  return {} as Response
}

function makeNext(): jest.Mock {
  return jest.fn()
}

function signToken(payload: object, expiresIn: string | number = '15m'): string {
  return jwt.sign(payload, TEST_SECRET, { expiresIn } as jwt.SignOptions)
}

// ─── authenticateToken ────────────────────────────────────────────────────────

describe('authenticateToken', () => {
  it('attaches user to req and calls next() for a valid token', () => {
    const token = signToken({ id: 'u1', role: 'user' })
    const req = makeReq(`Bearer ${token}`)
    const next = makeNext()

    authenticateToken(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith()
    expect(req.user).toMatchObject({ userId: 'u1', role: 'user' })
  })

  it('calls next(AppError 401) when Authorization header is missing', () => {
    const req = makeReq()
    const next = makeNext()

    authenticateToken(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.any(AppError))
    const err = next.mock.calls[0][0] as AppError
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Access token required')
  })

  it('calls next(AppError 401) when token is malformed', () => {
    const req = makeReq('Bearer not.a.valid.token')
    const next = makeNext()

    authenticateToken(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.any(AppError))
    const err = next.mock.calls[0][0] as AppError
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Invalid token')
  })

  it('calls next(AppError 401) with "Token expired" for an expired token', () => {
    const token = signToken({ id: 'u1', role: 'user' }, -1)
    const req = makeReq(`Bearer ${token}`)
    const next = makeNext()

    authenticateToken(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.any(AppError))
    const err = next.mock.calls[0][0] as AppError
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Token expired')
  })

  it('calls next(AppError 401) when header does not start with Bearer', () => {
    const token = signToken({ id: 'u1', role: 'user' })
    const req = makeReq(`Token ${token}`)
    const next = makeNext()

    authenticateToken(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.any(AppError))
    const err = next.mock.calls[0][0] as AppError
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Access token required')
  })

  it('calls next(AppError 401) when Bearer token is empty', () => {
    const req = makeReq('Bearer ')
    const next = makeNext()

    authenticateToken(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.any(AppError))
    const err = next.mock.calls[0][0] as AppError
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Access token required')
  })
})

// ─── requireRole ─────────────────────────────────────────────────────────────

describe('requireRole', () => {
  it('calls next() when user has the required role', () => {
    const req = { user: { userId: 'u1', role: 'admin' } } as AuthenticatedRequest
    const next = makeNext()

    requireRole('admin')(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith()
  })

  it('calls next() when user role is in the allowed list', () => {
    const req = { user: { userId: 'u1', role: 'user' } } as AuthenticatedRequest
    const next = makeNext()

    requireRole('user', 'admin')(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith()
  })

  it('calls next(AppError 403) when user role does not match', () => {
    const req = { user: { userId: 'u1', role: 'user' } } as AuthenticatedRequest
    const next = makeNext()

    requireRole('admin')(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.any(AppError))
    const err = next.mock.calls[0][0] as AppError
    expect(err.statusCode).toBe(403)
    expect(err.message).toBe('Insufficient permissions')
  })

  it('calls next(AppError 401) when req.user is not set', () => {
    const req = {} as AuthenticatedRequest
    const next = makeNext()

    requireRole('admin')(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.any(AppError))
    const err = next.mock.calls[0][0] as AppError
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Authentication required')
  })
})

// ─── optionalAuth ─────────────────────────────────────────────────────────────

describe('optionalAuth', () => {
  it('attaches user when a valid token is provided', () => {
    const token = signToken({ id: 'u2', role: 'user' })
    const req = makeReq(`Bearer ${token}`)
    const next = makeNext()

    optionalAuth(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith()
    expect(req.user).toMatchObject({ userId: 'u2', role: 'user' })
  })

  it('calls next() without error when no token is provided', () => {
    const req = makeReq()
    const next = makeNext()

    optionalAuth(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith()
    expect(req.user).toBeUndefined()
  })

  it('calls next() without error when token is invalid (silently ignores)', () => {
    const req = makeReq('Bearer bad.token.here')
    const next = makeNext()

    optionalAuth(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith()
    expect(req.user).toBeUndefined()
  })
})
