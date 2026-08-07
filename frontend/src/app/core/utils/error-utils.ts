/**
 * Enterprise HTTP Error Message Extractor
 * Converts HTTP status codes and error payloads into clear, human-friendly messages,
 * preventing misleading messages (e.g. showing "Invalid password" on 429 Rate Limit or 500 Server Error).
 */
export function extractErrorMessage(
  err: any,
  fallbackMessage = 'An unexpected error occurred. Please try again.'
): string {
  if (!err) return fallbackMessage;

  // 1. Network / Server Unreachable (Status 0)
  if (err.status === 0) {
    return 'Unable to reach the server. Please check your internet connection and try again.';
  }

  // 2. Rate Limiting (Status 429)
  if (err.status === 429) {
    return 'Too many requests in a short time. Please wait a minute before trying again.';
  }

  // 3. Server-side Error (500-599)
  if (err.status >= 500) {
    return 'The server encountered an error while processing your request. Please try again in a few moments.';
  }

  // 4. Access Control (Status 403)
  if (err.status === 403) {
    if (typeof err.error === 'string' && err.error.trim() && !err.error.startsWith('<!DOCTYPE')) {
      return err.error;
    }
    if (err.error?.message && typeof err.error.message === 'string') {
      return err.error.message;
    }
    return 'Access denied. Your account does not have permission to perform this action.';
  }

  // 5. Explicit error payload string from backend API (e.g. 400 Bad Request, 401 Unauthorized)
  if (typeof err.error === 'string' && err.error.trim() && !err.error.startsWith('<!DOCTYPE')) {
    return err.error;
  }

  // 6. Object payload containing message or title
  if (err.error?.message && typeof err.error.message === 'string') {
    return err.error.message;
  }

  if (err.error?.title && typeof err.error.title === 'string') {
    return err.error.title;
  }

  // 7. Status 401 default fallback
  if (err.status === 401) {
    return fallbackMessage;
  }

  return fallbackMessage;
}