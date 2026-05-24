import { Router } from 'express'
import express from 'express'
import Joi from 'joi'
import passport from 'passport'
import { register, login, refreshToken, logout, googleCallback, googleFailure } from './auth.controller'
import { validateBody } from '../../middleware/validate'
import { commonSchemas } from '../../middleware/validate'
import { authenticateToken } from '../../middleware/auth'

const router = Router()

/**
 * Joi schema for POST /api/auth/register
 *
 * Validates:
 * - name: required, 2–100 chars
 * - email: required, RFC 5322 format
 * - password: required, ≥8 chars, uppercase + lowercase + digit + special char (Requirement 1.10)
 */
const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name must not exceed 100 characters',
    'any.required': 'Name is required',
  }),
  email: commonSchemas.email,
  password: commonSchemas.password,
})

/**
 * Joi schema for POST /api/auth/login
 *
 * Validates:
 * - email: required, RFC 5322 format (Requirement 1.9)
 * - password: required (Requirement 1.4)
 */
const loginSchema = Joi.object({
  email: commonSchemas.email,
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
    'string.empty': 'Password is required',
  }),
})

/**
 * Joi schema for POST /api/auth/refresh
 *
 * Validates:
 * - refreshToken: required string (Requirement 1.7)
 */
const refreshSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token is required',
    'string.empty': 'Refresh token is required',
  }),
})

/**
 * Joi schema for POST /api/auth/logout
 *
 * Validates:
 * - refreshToken: required string (Requirement 1.8)
 */
const logoutSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token is required',
    'string.empty': 'Refresh token is required',
  }),
})

/**
 * POST /api/auth/register
 * Public endpoint — no authentication required.
 */
router.post('/register', validateBody(registerSchema), register)

/**
 * POST /api/auth/login
 * Public endpoint — no authentication required.
 * Requirements: 1.2, 1.4, 1.5, 1.6, 1.8
 */
router.post('/login', validateBody(loginSchema), login)

/**
 * POST /api/auth/refresh
 * Public endpoint — no authentication required.
 * Requirements: 1.7
 */
router.post('/refresh', validateBody(refreshSchema), refreshToken)

/**
 * POST /api/auth/logout
 * Protected endpoint — requires valid access token.
 * Requirements: 1.8
 */
router.post('/logout', authenticateToken as express.RequestHandler, validateBody(logoutSchema), logout)

/**
 * GET /api/auth/google
 * Public endpoint — no authentication required.
 * Initiates Google OAuth 2.0 flow by redirecting the user to the Google
 * OAuth consent screen requesting profile and email scopes.
 * Requirement 2.1: WHEN a Guest initiates Google login, THE Platform SHALL
 * redirect to Google OAuth consent screen.
 */
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }) as express.RequestHandler
)

/**
 * GET /api/auth/google/callback
 * Public endpoint — called by Google after the user grants/denies consent.
 * Passport verifies the authorization code, creates/retrieves the user
 * (handled in passport.ts strategy), then calls googleCallback to issue tokens
 * and redirect to the frontend.
 *
 * On authentication failure, Passport redirects to /api/auth/google/failure.
 *
 * Requirements: 2.2, 2.3, 2.4
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/api/auth/google/failure',
    session: false,
  }) as express.RequestHandler,
  googleCallback as express.RequestHandler
)

/**
 * GET /api/auth/google/failure
 * Public endpoint — reached when Google OAuth authentication fails
 * (e.g. user denies consent, invalid state, etc.).
 * Returns 401 with a JSON error message.
 */
router.get('/google/failure', googleFailure as express.RequestHandler)

export default router
