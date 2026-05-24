/**
 * Async handler wrapper for Express route handlers.
 * 
 * Wraps async functions to catch errors and pass them to the error handler middleware.
 */

import { Request, Response, NextFunction } from 'express'

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
