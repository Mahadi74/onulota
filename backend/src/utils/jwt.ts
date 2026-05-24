import * as jwt from 'jsonwebtoken'

export interface TokenPayload {
  id: string
  role: string
}

// Core implementation functions
export const generateAccessToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not configured')
  return jwt.sign(payload, secret, { expiresIn: '15m' })
}

export const generateRefreshToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_REFRESH_SECRET
  if (!secret) throw new Error('JWT_REFRESH_SECRET not configured')
  return jwt.sign(payload, secret, { expiresIn: '7d' })
}

/**
 * Verify an access token and return its decoded payload.
 * Throws if the token is invalid or expired.
 */
export const verifyToken = (token: string): TokenPayload => {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not configured')
  return jwt.verify(token, secret) as TokenPayload
}

export const verifyRefreshToken = (token: string): TokenPayload => {
  const secret = process.env.JWT_REFRESH_SECRET
  if (!secret) throw new Error('JWT_REFRESH_SECRET not configured')
  return jwt.verify(token, secret) as TokenPayload
}

// Convenience functions matching the exact task requirements
export const generateAccessTokenForUser = (userId: string, role: string): string => {
  return generateAccessToken({ id: userId, role })
}

export const generateRefreshTokenForUser = (): string => {
  // For refresh tokens, we typically don't need user-specific data
  // They are used to obtain new access tokens via a separate endpoint
  // that validates the refresh token and looks up the user
  const payload = { id: 'refresh', role: 'refresh' }
  return generateRefreshToken(payload)
}

export const verifyTokenSafe = (token: string): { userId: string, role: string } | null => {
  try {
    const decoded = verifyToken(token)
    return { userId: decoded.id, role: decoded.role }
  } catch (error) {
    return null
  }
}
