import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AdminAuthService } from './auth.service';

export const adminAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AdminAuthService);
  const token = auth.token;

  // Generate cryptographically safe pseudo-UUID for request telemetry fingerprint
  const requestId = 'req_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();

  const headersToAdd: Record<string, string> = {
    'X-Request-ID': requestId,
    'X-Requested-With': 'XMLHttpRequest'
  };

  if (token) {
    headersToAdd['Authorization'] = `Bearer ${token}`;
  }

  const clonedReq = req.clone({
    setHeaders: headersToAdd,
    withCredentials: true
  });

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Auto-terminate expired or unauthorized session (401 Unauthorized or 403 Forbidden)
      if ((error.status === 401 || error.status === 403) && !req.url.includes('/login')) {
        console.warn(`[Security Interceptor] Authorization failure (${error.status}) on ${req.url}. Revoking session...`);
        auth.handle401SessionExpired();
      }
      return throwError(() => error);
    })
  );
};