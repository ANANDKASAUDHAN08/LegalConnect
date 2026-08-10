import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpEvent, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, from, throwError, switchMap, catchError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * HTTP Authentication Interceptor
 *
 * Intercepts all outgoing HTTP requests to attach the access token and
 * transparently handle 401 (Unauthorized) responses via token refresh.
 *
 * ## Token Attachment
 * Attaches the current access token as a `Bearer` token in the `Authorization`
 * header for all non-auth API requests. Auth endpoints are excluded to prevent
 * circular dependencies during login, registration, and token refresh flows.
 *
 * ## 401 Recovery (Promise-Based Mutex)
 * When a 401 response is received, the interceptor initiates a token refresh
 * using a module-level singleton Promise. This guarantees that:
 *   - Only one refresh HTTP call is made, regardless of how many requests fail concurrently.
 *   - All queued requests automatically retry with the new token once the refresh resolves.
 *   - Late-arriving 401s join the existing Promise rather than triggering duplicate refreshes.
 *
 * @see {@link AuthService.refreshTokenAsPromise} for the refresh implementation.
 */

/** Module-level singleton: the single in-flight refresh Promise, or `null` when idle. */
let refreshPromise: Promise<string | null> | null = null;

/** Auth API endpoints excluded from token attachment and 401 retry logic. */
const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/google',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password'
];

/** Returns `true` if the given URL matches any excluded auth endpoint. */
function isAuthEndpoint(url: string): boolean {
  return AUTH_ENDPOINTS.some(endpoint => url.includes(endpoint));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  if (isAuthEndpoint(req.url)) {
    return next(req);
  }

  const token = authService.getToken();
  const authedReq = token
    ? req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) })
    : req;

  return next(authedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        return handle401(authService, req, next);
      }
      return throwError(() => error);
    })
  );
};

/**
 * Handles a 401 response by refreshing the access token and retrying the original request.
 *
 * Uses a Promise-based mutex to deduplicate concurrent refresh attempts:
 *   1. First 401 creates the refresh Promise and initiates the HTTP call.
 *   2. Subsequent 401s attach to the same Promise — no duplicate requests.
 *   3. On resolution, each caller retries its original request with the new token.
 *   4. On rejection, each caller propagates the error and the session is expired.
 *
 * The Promise singleton is cleared via `queueMicrotask` after resolution to ensure
 * all `.then()` chains execute before the next refresh cycle can begin.
 */
function handle401(
  authService: AuthService,
  originalReq: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> {
  if (!refreshPromise) {
    refreshPromise = authService.refreshTokenAsPromise()
      .finally(() => {
        queueMicrotask(() => {
          refreshPromise = null;
        });
      });
  }

  return from(refreshPromise).pipe(
    switchMap((newToken) => {
      if (!newToken) {
        return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }));
      }
      const retryReq = originalReq.clone({
        headers: originalReq.headers.set('Authorization', `Bearer ${newToken}`)
      });
      return next(retryReq);
    }),
    catchError((refreshError) => {
      authService.handleRefreshFailure();
      return throwError(() => refreshError);
    })
  );
}