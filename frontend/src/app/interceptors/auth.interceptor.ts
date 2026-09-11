import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpEvent, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, from, throwError, switchMap, catchError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

/** Resolves relative /api paths to Render backend URLs when running in production. */
function resolveUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('assets/')) {
    return url;
  }

  // Node.js Legal Microservice paths
  if (url.startsWith('/api/legal') || url.startsWith('/api/lawyers') || url.startsWith('/api/info')) {
    const nodeBase = (environment as any).nodeApiUrl || '';
    return nodeBase ? `${nodeBase}${url}` : url;
  }

  // .NET 8 Auth & Core Microservice paths
  if (url.startsWith('/api') || url.startsWith('/uploads') || url.startsWith('/hubs')) {
    const authBase = (environment as any).authApiUrl || '';
    return authBase ? `${authBase}${url}` : url;
  }

  return url;
}

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

  const resolvedUrl = resolveUrl(req.url);
  const isCrossOrigin = resolvedUrl.startsWith('http');

  const baseReq = req.clone({
    url: resolvedUrl,
    withCredentials: isCrossOrigin ? true : req.withCredentials
  });

  if (isAuthEndpoint(req.url)) {
    return next(baseReq);
  }

  const token = authService.getToken();
  const authedReq = token
    ? baseReq.clone({ headers: baseReq.headers.set('Authorization', `Bearer ${token}`) })
    : baseReq;

  return next(authedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        return handle401(authService, authedReq, next);
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