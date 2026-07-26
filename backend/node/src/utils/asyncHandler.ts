import { Request, Response, NextFunction } from 'express';

/**
 * Async Handler Wrapper for Express Routes.
 * Eliminates repetitive try/catch blocks by forwarding any unhandled promise rejections
 * directly to the Express global error handling middleware via next(error).
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};