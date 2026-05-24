import { Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { logger } from '../utils/logger'
import { v4 as uuidv4 } from 'uuid'

export class AppError extends Error {
  public statusCode: number
  public isOperational: boolean

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = uuidv4()

  logger.error({
    requestId,
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: (req as Request & { user?: { id: string } }).user?.id,
  })

  if (err instanceof AppError && err.isOperational) {
    const response: Record<string, unknown> = {
      error: getErrorTitle(err.statusCode),
      message: err.message,
      requestId,
    }

    // Include validation details if present
    if ('details' in err && Array.isArray(err.details)) {
      response.details = err.details
    }

    res.status(err.statusCode).json(response)
    return
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid input data',
      details: Object.values((err as unknown as { errors: Record<string, { message: string }> }).errors).map((e) => ({
        message: e.message,
      })),
      requestId,
    })
    return
  }

  // Handle Mongoose duplicate key errors
  if ((err as NodeJS.ErrnoException).code === '11000') {
    const field = Object.keys((err as unknown as { keyValue: Record<string, unknown> }).keyValue || {})[0]
    res.status(409).json({
      error: 'Conflict',
      message: `${field || 'Field'} already exists`,
      requestId,
    })
    return
  }

  // Handle Multer errors (file upload validation)
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Image size must not exceed 5MB'
      : `File upload error: ${err.message}`
    res.status(400).json({ error: 'Bad Request', message, requestId })
    return
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({ error: 'Authentication Error', message: 'Invalid token', requestId })
    return
  }
  if (err.name === 'TokenExpiredError') {
    res.status(401).json({ error: 'Authentication Error', message: 'Token expired', requestId })
    return
  }

  // Generic server error
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred. Please try again later.',
    requestId,
  })
}

function getErrorTitle(statusCode: number): string {
  const titles: Record<number, string> = {
    400: 'Bad Request',
    401: 'Authentication Error',
    403: 'Authorization Error',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Validation Error',
    429: 'Rate Limit Exceeded',
    500: 'Internal Server Error',
  }
  return titles[statusCode] || 'Error'
}
