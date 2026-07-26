/**
 * Custom Operational Error Class for LegalConnect Node Backend.
 * Allows throwing HTTP errors with explicit status codes, error codes, and operational flags.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode?: string;

  constructor(message: string, statusCode: number = 500, errorCode?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errorCode = errorCode || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');

    Error.captureStackTrace(this, this.constructor);
  }

  public static badRequest(message: string, errorCode: string = 'BAD_REQUEST'): AppError {
    return new AppError(message, 400, errorCode);
  }

  public static unauthorized(message: string = 'Unauthorized access.', errorCode: string = 'UNAUTHORIZED'): AppError {
    return new AppError(message, 401, errorCode);
  }

  public static forbidden(message: string = 'Forbidden access.', errorCode: string = 'FORBIDDEN'): AppError {
    return new AppError(message, 403, errorCode);
  }

  public static notFound(message: string = 'Resource not found.', errorCode: string = 'NOT_FOUND'): AppError {
    return new AppError(message, 404, errorCode);
  }

  public static internal(message: string = 'Internal server error.', errorCode: string = 'INTERNAL_ERROR'): AppError {
    return new AppError(message, 500, errorCode);
  }
}