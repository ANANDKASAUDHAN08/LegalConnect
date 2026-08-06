import { HttpInterceptorFn } from '@angular/common/http';
import { sanitizeSearchInput } from './utils/security-utils';

/**
 * Enterprise Security Interceptor
 * Sanitizes outgoing query parameters to block script injection / XSS,
 * propagates CSRF protection tokens, and enforces JSON headers.
 */
export const adminSecurityInterceptor: HttpInterceptorFn = (req, next) => {
  let modifiedReq = req;

  // 1. Sanitize outgoing search query params if present
  if (req.params && req.params.has('search')) {
    const rawSearch = req.params.get('search');
    if (rawSearch) {
      const sanitized = sanitizeSearchInput(rawSearch);
      if (sanitized !== rawSearch) {
        modifiedReq = modifiedReq.clone({
          params: modifiedReq.params.set('search', sanitized)
        });
      }
    }
  }

  // 2. Attach XSRF-TOKEN CSRF protection header if token cookie exists
  const xsrfMatch = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  if (xsrfMatch && xsrfMatch[1]) {
    const xsrfToken = decodeURIComponent(xsrfMatch[1]);
    modifiedReq = modifiedReq.clone({
      setHeaders: {
        'X-XSRF-TOKEN': xsrfToken
      }
    });
  }

  // 3. Enforce Content-Type header for JSON payload requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase()) && !req.headers.has('Content-Type') && !(req.body instanceof FormData)) {
    modifiedReq = modifiedReq.clone({
      setHeaders: {
        'Content-Type': 'application/json'
      }
    });
  }

  return next(modifiedReq);
};