import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpEvent, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, filter, switchMap, take, throwError, BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Don't attach token to the refresh endpoint itself
  const isRefreshRequest = req.url.includes('/auth/refresh');

  let clonedReq = req;
  if (token && !isRefreshRequest) {
    clonedReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
  }

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only attempt refresh on 401 errors for non-refresh, non-login requests
      if (error.status === 401 && !isRefreshRequest && !req.url.includes('/auth/login')) {
        return handle401Error(authService, req, next);
      }
      return throwError(() => error);
    })
  );
};

function handle401Error(authService: AuthService, req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refreshToken().pipe(
      switchMap((res: any) => {
        isRefreshing = false;
        refreshTokenSubject.next(res.token);

        // Retry original request with new token
        const retryReq = req.clone({
          headers: req.headers.set('Authorization', `Bearer ${res.token}`)
        });
        return next(retryReq);
      }),
      catchError((refreshError) => {
        isRefreshing = false;
        authService.handleRefreshFailure();
        return throwError(() => refreshError);
      })
    );
  } else {
    // Another request is already refreshing — wait for it
    return refreshTokenSubject.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap((token: string) => {
        const retryReq = req.clone({
          headers: req.headers.set('Authorization', `Bearer ${token}`)
        });
        return next(retryReq);
      })
    );
  }
}