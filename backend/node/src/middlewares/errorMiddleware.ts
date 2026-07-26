import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

/**
 * Global Centralized Error Handling Middleware.
 * Catches all errors passed down the Express middleware chain, formats a unified JSON response,
 * and hides raw internal stack traces when running in production.
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected internal error occurred.';
  let errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';

  // Handle Mongoose CastError (invalid ObjectId format)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for field '${err.path}': ${err.value}`;
    errorCode = 'INVALID_ID_FORMAT';
  }

  // Handle Mongoose ValidationError
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e: any) => e.message).join(', ');
    errorCode = 'VALIDATION_ERROR';
  }

  // Handle Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A record with this ${field} already exists.`;
    errorCode = 'DUPLICATE_KEY_ERROR';
  }

  // Log error internally for debugging
  if (statusCode >= 500) {
    console.error(`❌ [SERVER ERROR] ${req.method} ${req.originalUrl}:`, err);
  } else {
    console.warn(`⚠️ [CLIENT ERROR] ${req.method} ${req.originalUrl}: ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    errorCode,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

/**
 * Catch-All 404 Not Found Middleware for unmatched routes.
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  next(AppError.notFound(`Cannot ${req.method} ${req.originalUrl} — Route not found.`));
};