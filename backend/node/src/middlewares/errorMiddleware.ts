import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

/**
 * Universal Enterprise-Grade Error Sanitizer.
 * Intercepts all classes of backend errors (Auth, Database, Network, File/Payload, AI, Third-Party, Runtime)
 * and formats them into secure, polished, human-readable messages while logging full developer context internally.
 */
export function sanitizeErrorMessage(rawMessage: string, statusCode: number, errName?: string): string {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return 'An unexpected error occurred. Please try again.';
  }

  const lower = rawMessage.toLowerCase();
  const name = (errName || '').toLowerCase();

  // 1. Authentication & JWT Tokens
  if (name.includes('tokenexpirederror') || lower.includes('jwt expired') || lower.includes('token expired')) {
    return 'Your session has expired. Please sign in again to continue.';
  }
  if (name.includes('jsonwebtokenerror') || lower.includes('jwt malformed') || lower.includes('invalid signature') || lower.includes('invalid token')) {
    return 'Your authentication token is invalid. Please sign in again.';
  }
  if (statusCode === 401 || lower.includes('unauthorized') || lower.includes('no token provided') || lower.includes('access token is missing')) {
    return 'Authentication required. Please sign in to access this resource.';
  }
  if (statusCode === 403 || lower.includes('forbidden') || lower.includes('insufficient permissions') || lower.includes('access denied')) {
    return 'You do not have permission to perform this action.';
  }

  // 2. Database (MongoDB / Mongoose) Errors
  if (name.includes('casterror') || lower.includes('cast to objectid failed') || lower.includes('invalid objectid') || lower.includes('bsontypeerror')) {
    return 'The requested record identifier has an invalid format.';
  }
  if (name.includes('mongonetworkerror') || name.includes('mongooseserverselectionerror') || lower.includes('connection refused') && lower.includes('27017')) {
    return 'Database connection is temporarily unavailable. Please try again shortly.';
  }
  if (name.includes('versionerror') || lower.includes('versionerror') || lower.includes('concurrency')) {
    return 'This record was modified by another request. Please refresh the page and try again.';
  }

  // 3. Payload & File Upload Size Limits
  if (name.includes('payloadtoolargeerror') || lower.includes('entity too large') || lower.includes('maxfilesize') || lower.includes('request entity too large')) {
    return 'The uploaded file or request data exceeds the maximum allowed size limit.';
  }

  // 4. Upstream AI Providers (OpenRouter, Gemini, OpenAI, Claude)
  if (lower.includes('402') || lower.includes('requires more credits') || lower.includes('can only afford')) {
    return 'AI provider requires account credits or a free model. Please configure a free model (e.g. google/gemini-2.0-flash-exp:free) or add credits in your AI settings.';
  }
  if (lower.includes('invalid api key') || lower.includes('api_key_invalid') || lower.includes('incorrect api key')) {
    return 'AI API key is invalid or unauthorized. Please verify your OPENROUTER_API_KEY or GEMINI_API_KEY in backend/.env.';
  }
  if (statusCode === 429 || lower.includes('429') || lower.includes('rate limit') || lower.includes('quota exceeded') || lower.includes('resource_exhausted')) {
    return 'The service is currently experiencing high demand. Please wait a few moments and try again.';
  }

  // 5. Network & Connection Failures
  if (lower.includes('econnrefused') || lower.includes('etimedout') || lower.includes('enotfound') || lower.includes('fetch failed') || lower.includes('socket hang up')) {
    return 'Unable to reach external service. Please check your network connection or try again later.';
  }
  if (statusCode === 502 || statusCode === 503 || statusCode === 504 || lower.includes('bad gateway') || lower.includes('gateway timeout')) {
    return 'The server or external provider is temporarily unavailable. Please try again in a moment.';
  }

  // 6. 404 Not Found
  if (statusCode === 404 || lower.includes('not found') || lower.includes('cannot find')) {
    return 'The requested resource or endpoint could not be found.';
  }

  // 7. Extract Nested JSON Error Object if Present
  try {
    const jsonMatch = rawMessage.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const extracted = parsed.error?.message || parsed.message;
      if (extracted && typeof extracted === 'string' && extracted !== rawMessage) {
        return sanitizeErrorMessage(extracted, statusCode, errName);
      }
    }
  } catch {}

  // 8. Clean Formatting Noise
  let cleaned = rawMessage
    .replace(/^Error:\s*/i, '')
    .replace(/^Failed to [^:]+:\s*/i, '')
    .replace(/^OpenRouter Error\s*\(\d+\):\s*/i, '')
    .replace(/at\s+.+\(.*:\d+:\d+\)/g, '')
    .replace(/C:\\[^\s]+/g, '')
    .replace(/\/[\w\.-]+\/[\w\.-]+/g, '')
    .trim();

  // 9. Protect against internal code/syntax dumps on 500 errors
  if (statusCode >= 500) {
    if (
      cleaned.includes('Cannot read properties') ||
      cleaned.includes('is not a function') ||
      cleaned.includes('Unexpected token') ||
      cleaned.includes('SyntaxError') ||
      cleaned.length > 200
    ) {
      return 'An internal server error occurred while processing your request. Please try again later.';
    }
  }

  return cleaned || 'An unexpected error occurred. Please try again.';
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err.statusCode || (typeof err.status === 'number' ? err.status : 500);
  let message = err.message || 'An unexpected internal error occurred.';
  let errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';

  // Handle Mongoose CastError (invalid ObjectId format)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for field '${err.path}'.`;
    errorCode = 'INVALID_ID_FORMAT';
  }

  // Handle Mongoose ValidationError
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors || {}).map((e: any) => e.message).join(', ') || 'Validation failed for input data.';
    errorCode = 'VALIDATION_ERROR';
  }

  // Handle Mongoose Duplicate Key Error (E11000)
  else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'record';
    message = `A record with this ${field} already exists. Please use a unique value.`;
    errorCode = 'DUPLICATE_KEY_ERROR';
  }

  // Handle JWT specific errors
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
  }

  // Log FULL debugging info in the backend terminal for developers
  if (statusCode >= 500) {
    console.error(`❌ [SERVER ERROR 500] ${req.method} ${req.originalUrl}:`, err);
  } else {
    console.warn(`⚠️ [CLIENT ERROR ${statusCode}] ${req.method} ${req.originalUrl}: ${message}`);
  }

  // Sanitize message for the frontend / API consumers
  const clientMessage = sanitizeErrorMessage(message, statusCode, err.name);

  res.status(statusCode).json({
    success: false,
    statusCode,
    errorCode,
    message: clientMessage,
    ...(process.env.NODE_ENV !== 'production' && { debugStack: err.stack })
  });
};

/**
 * Catch-All 404 Not Found Middleware for unmatched routes.
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  next(AppError.notFound(`Endpoint ${req.method} ${req.originalUrl} does not exist.`));
};