import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpEvent, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, filter, switchMap, take, throwError, BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;
// null = refresh in progress, string = success, undefined = failed
const refreshTokenSubject = new BehaviorSubject<string | null | undefined>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Don't attach token or attempt refresh for endpoints that authenticate/rotate sessions
  const isAuthEndpoint = req.url.includes('/auth/refresh') ||
    req.url.includes('/auth/login');

  let clonedReq = req;
  if (token && !isAuthEndpoint) {
    clonedReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
  }

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only attempt refresh on 401 errors for non-auth endpoints
      if (error.status === 401 && !isAuthEndpoint) {
        return handle401Error(authService, req, next);
      }
      return throwError(() => error);
    })
  );
};

function handle401Error(authService: AuthService, req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null); // Mark as refresh in progress

    return authService.refreshToken().pipe(
      switchMap((res: any) => {
        isRefreshing = false;
        refreshTokenSubject.next(res.token); // Emit new token to waiting requests

        // Retry original request with new token
        const retryReq = req.clone({
          headers: req.headers.set('Authorization', `Bearer ${res.token}`)
        });
        return next(retryReq);
      }),
      catchError((refreshError) => {
        isRefreshing = false;
        refreshTokenSubject.next(undefined); // Notify waiting requests of the failure
        authService.handleRefreshFailure();
        return throwError(() => refreshError);
      })
    );
  } else {
    // Another request is already refreshing — wait for it
    return refreshTokenSubject.pipe(
      filter((token) => token !== null), // Wait until token is not null (either string or undefined)
      take(1),
      switchMap((token) => {
        if (token === undefined) {
          // If refresh failed, return unauthorized error
          return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }));
        }
        const retryReq = req.clone({
          headers: req.headers.set('Authorization', `Bearer ${token}`)
        });
        return next(retryReq);
      })
    );
  }
}