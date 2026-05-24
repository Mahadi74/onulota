import { Request, Response, NextFunction } from 'express'
import * as jwt from 'jsonwebtoken'
import { verifyToken, TokenPayload } from '../utils/jwt'
import { AppError } from './errorHandler'

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string
    role: string
  }
}

/**
 * Authentication middleware that verifies JWT tokens and attaches user information to the request.
 * 
 * Requirements:
 * - Extract JWT from Authorization header (Bearer token format)
 * - Return 401 for missing tokens
 * - Return 401 with "Token expired" for expired tokens  
 * - Return 401 with "Invalid token" for invalid tokens
 * - Attach user info to req.user for valid tokens
 */
export function authenticateToken(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization

  // Check if Authorization header exists and has Bearer format
  if (!authHeader) {
    return next(new AppError('Access token required', 401))
  }

  if (!authHeader.startsWith('Bearer ')) {
    return next(new AppError('Access token required', 401))
  }

  // Extract token from "Bearer <token>"
  const token = authHeader.slice(7)

  if (!token) {
    return next(new AppError('Access token required', 401))
  }

  try {
    // Use the JWT utility from task 7.1 to verify the token
    const decoded: TokenPayload = verifyToken(token)
    
    // Attach user information to request object
    req.user = {
      userId: decoded.id,
      role: decoded.role
    }
    
    next()
  } catch (err) {
    // Handle specific JWT errors with appropriate messages
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AppError('Token expired', 401))
    }
    
    // All other JWT errors (invalid signature, malformed token, etc.)
    return next(new AppError('Invalid token', 401))
  }
}

/**
 * Optional authentication middleware that attaches user info if a valid token is provided,
 * but doesn't fail if no token is present.
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null

  if (token) {
    try {
      const decoded: TokenPayload = verifyToken(token)
      req.user = {
        userId: decoded.id,
        role: decoded.role
      }
    } catch {
      // Silently ignore invalid tokens for optional auth
    }
  }
  next()
}

/**
 * Authorization middleware that requires specific roles.
 * Must be used after authenticateToken middleware.
 */
export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401))
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403))
    }
    next()
  }
}