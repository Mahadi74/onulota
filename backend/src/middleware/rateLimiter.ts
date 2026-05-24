import rateLimit from 'express-rate-limit'
import { Request, Response, NextFunction } from 'express'

/**
 * Extended request interface that includes user information from authentication middleware
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string
    role: string
  }
}

/**
 * Rate limiter for unauthenticated requests
 * Limits to 100 requests per IP address per 15-minute window
 * 
 * **Validates: Requirements 21.1, 21.3, 21.4, 21.5**
 */
export const unauthenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true, // Include rate limit info in headers
  legacyHeaders: false, // Disable legacy X-RateLimit-* headers
  keyGenerator: (req) => req.ip || 'unknown', // Use IP address as key
  message: {
    error: 'Rate Limit Exceeded',
    message: 'Too many requests, please try again later',
  },
  // Skip this limiter if user is authenticated (will use authenticated limiter instead)
  skip: (req) => !!((req as AuthenticatedRequest).user),
})

/**
 * Rate limiter for authenticated requests
 * Limits to 1000 requests per user per 15-minute window
 * 
 * **Validates: Requirements 21.2, 21.3, 21.4, 21.5**
 */
export const authenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  standardHeaders: true, // Include rate limit info in headers
  legacyHeaders: false, // Disable legacy X-RateLimit-* headers
  // Use userId as key for authenticated users, fallback to IP
  keyGenerator: (req) => {
    const authReq = req as AuthenticatedRequest
    return authReq.user?.userId || req.ip || 'unknown'
  },
  message: {
    error: 'Rate Limit Exceeded',
    message: 'Too many requests, please try again later',
  },
  // Only apply to authenticated requests
  skip: (req) => !((req as AuthenticatedRequest).user),
})

/**
 * Special rate limiter for authentication endpoints (login, register)
 * Limits to 20 attempts per IP per 15-minute window to prevent brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  message: {
    error: 'Rate Limit Exceeded',
    message: 'Too many login attempts, please try again later',
  },
})

/**
 * Combined rate limiting middleware that applies appropriate limits based on authentication status
 * 
 * This middleware should be used after optional authentication middleware to ensure
 * user information is available if the request is authenticated.
 * 
 * **Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5**
 * 
 * @param req - Express request object (potentially with user info)
 * @param res - Express response object
 * @param next - Express next function
 */
export function rateLimiter(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Skip rate limiting in test environment
  if (process.env.NODE_ENV === 'test') {
    return next()
  }

  // Apply authenticated limiter if user is present, otherwise unauthenticated limiter
  if (req.user) {
    authenticatedLimiter(req, res, next)
  } else {
    unauthenticatedLimiter(req, res, next)
  }
}
