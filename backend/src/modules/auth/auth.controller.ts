import { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import { asyncHandler } from '../../middleware/errorHandler'
import { registerUser, loginUser, refreshAccessToken, logoutUser } from './auth.service'
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt'
import { RefreshToken } from '../../models/RefreshToken'
import { IUser } from '../../models/User'
import { logger } from '../../utils/logger'

/**
 * POST /api/auth/register
 *
 * Validates input (via Joi middleware in routes), then delegates to auth.service
 * to hash password, create user, store hashed refresh token, and return tokens.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.9, 1.10
 */
export const register = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { name, email, password } = req.body as { name: string; email: string; password: string }

  const result = await registerUser({ name, email, password })

  res.status(201).json(result)
})

/**
 * POST /api/auth/login
 *
 * Validates input (via Joi middleware in routes), then delegates to auth.service
 * to verify credentials, compare bcrypt hash, and return tokens.
 *
 * Requirements: 1.2, 1.4, 1.5, 1.6, 1.8
 */
export const login = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { email, password } = req.body as { email: string; password: string }

  const result = await loginUser({ email, password })

  res.status(200).json(result)
})

/**
 * POST /api/auth/refresh
 *
 * Validates input (via Joi middleware in routes), then delegates to auth.service
 * to verify the refresh token and return a new access token.
 *
 * Requirements: 1.7
 */
export const refreshToken = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { refreshToken: token } = req.body as { refreshToken: string }

  const result = await refreshAccessToken(token)

  res.status(200).json(result)
})

/**
 * POST /api/auth/logout
 *
 * Requires authentication via authenticateToken middleware.
 * Validates input (via Joi middleware in routes), then delegates to auth.service
 * to invalidate the refresh token in the database.
 *
 * Requirements: 1.8
 */
export const logout = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { refreshToken: token } = req.body as { refreshToken: string }

  const result = await logoutUser(token)

  res.status(200).json(result)
})

/**
 * GET /api/auth/google/callback
 *
 * Called after passport.authenticate('google') succeeds. The authenticated
 * user is available on req.user (set by the Passport Google strategy).
 *
 * Steps:
 * 1. Read the authenticated user from req.user
 * 2. Generate JWT access token (15 min) and refresh token (7 days)
 * 3. Store hashed refresh token in RefreshToken collection
 * 4. Redirect to FRONTEND_URL/auth/callback?accessToken=...&refreshToken=...
 *
 * On any failure, redirects to FRONTEND_URL/login?error=oauth_failed
 *
 * Requirements: 2.2, 2.3
 */
export const googleCallback = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'

  try {
    const user = req.user as IUser | undefined

    if (!user) {
      logger.warn('Google OAuth callback: no user on request')
      return res.redirect(`${frontendUrl}/login?error=oauth_failed`)
    }

    // Generate tokens (Requirements 2.3, 1.5, 1.6)
    const tokenPayload = { id: user._id.toString(), role: user.role }
    const accessToken = generateAccessToken(tokenPayload)
    const refreshToken = generateRefreshToken(tokenPayload)

    // Hash and store the refresh token (Requirement 1.6)
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10)
    const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    await RefreshToken.create({
      user: user._id,
      token: hashedRefreshToken,
      expiresAt: refreshTokenExpiry,
    })

    logger.info(`Google OAuth callback: tokens issued for user ${user.email}`)

    // Redirect to frontend with tokens as query params
    const params = new URLSearchParams({ accessToken, refreshToken })
    return res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`)
  } catch (error) {
    logger.error('Google OAuth callback error', { error })
    return res.redirect(`${frontendUrl}/login?error=oauth_failed`)
  }
})

/**
 * GET /api/auth/google/failure
 *
 * Called when passport.authenticate('google') fails (e.g. user denies consent).
 * Returns 401 with a JSON error message.
 *
 * Requirements: 2.1
 */
export const googleFailure = (_req: Request, res: Response): void => {
  res.status(401).json({ message: 'Google authentication failed' })
}
