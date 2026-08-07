import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap, catchError, of, map, Observable, timer, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { TokenStorageService } from './token-storage.service';
import { UserProfileService } from './user-profile.service';
import { GoogleAuthService } from './google-auth.service';
import { normalizeMediaUrl } from '../core/utils/url-utils';

export interface UserProfile {
  id: number;
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
  phone?: string;
  isPhoneVerified?: boolean;
  isEmailVerified?: boolean;
  isTwoFactorEnabled?: boolean;
  clientLanguage?: string;
  clientCity?: string;
  clientInterest?: string;
  dateOfBirth?: string;
  gender?: string;
  addressLine1?: string;
  clientState?: string;
  clientZip?: string;
  clientBio?: string;
  avatarUrl?: string;
  identityStatus?: string;
  identityDocumentUrl?: string;
  isAuthenticated?: boolean;
  token?: string;
}

const PUBLIC_ROUTES = [
  '/home', '/about', '/privacy', '/terms', '/help', '/contact',
  '/laws', '/search', '/find-help', '/lawyers', '/reviews',
  '/specializations', '/cookie-preferences', '/login', '/register',
  '/forgot-password', '/reset-password'
];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = '/api/auth';

  private _currentUser = new BehaviorSubject<UserProfile | null>(null);
  currentUser$ = this._currentUser.asObservable();

  private _isLoggedIn = new BehaviorSubject<boolean>(false);
  isLoggedIn$ = this._isLoggedIn.asObservable();

  private _isSessionLoaded = new BehaviorSubject<boolean>(false);
  isSessionLoaded$ = this._isSessionLoaded.asObservable();

  private _logoutTimerId: ReturnType<typeof setTimeout> | null = null;
  private _proactiveRefreshRetries = 0;
  private readonly MAX_REFRESH_RETRIES = 2;
  private readonly RETRY_DELAY_MS = 3000;
  private authChannel: BroadcastChannel | null = null;

  private httpOptions = {
    withCredentials: true
  };

  constructor(
    private http: HttpClient,
    private router: Router,
    private tokenStorage: TokenStorageService,
    private userProfileService: UserProfileService
  ) {
    this.initMultiTabSync();
  }

  /**
   * Initializes Web BroadcastChannel to synchronize authentication state
   * (Logins, Logouts) across all open browser tabs in real time.
   */
  private initMultiTabSync(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.authChannel = new BroadcastChannel('lc_public_auth_sync');
        this.authChannel.onmessage = (event) => {
          if (event.data?.type === 'LOGOUT') {
            this.clearSessionState(false);
            this.router.navigate(['/login']);
          } else if (event.data?.type === 'LOGIN') {
            this.refreshToken().pipe(
              switchMap(() => this.checkSession()),
              catchError(() => of(false))
            ).subscribe();
          }
        };
      } catch {
        // Fallback for restricted environments
      }
    }
  }

  private broadcastAuthEvent(type: 'LOGIN' | 'LOGOUT'): void {
    if (this.authChannel) {
      try {
        this.authChannel.postMessage({ type });
      } catch {
        // Ignore broadcast failure
      }
    }
  }

  /**
   * Global listener for Google OAuth mobile/PWA redirects.
   * Runs on app startup to catch returning OAuth credentials regardless of the current URL.
   */
  initGlobalOAuthRedirectListener(googleAuth: GoogleAuthService): void {
    googleAuth.handleRedirectResult().subscribe((res) => {
      if (res?.idToken) {
        this.loginWithGoogle(res.idToken, res.role).subscribe({
          next: (isLoggedIn) => {
            if (isLoggedIn) {
              const currentUrl = this.router.url.split('?')[0];
              if (currentUrl === '/login' || currentUrl === '/register') {
                this.router.navigateByUrl('/dashboard');
              }
            }
          }
        });
      }
    });
  }

  getToken(): string | null {
    return this.tokenStorage.getToken();
  }

  private handleLoginSuccess(res: any): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lc_has_session', 'true');
    }
    if (res.token) {
      this.tokenStorage.setToken(res.token);
      this.scheduleProactiveRefresh(res.token);
    }
    if (res.user) {
      if (res.user.avatarUrl) {
        res.user.avatarUrl = normalizeMediaUrl(res.user.avatarUrl);
      }
      const userObj = { ...res.user, isAuthenticated: true, token: res.token };
      this._currentUser.next(userObj);
      this.tokenStorage.setCachedUser(userObj);
      this._isLoggedIn.next(true);
      this._isSessionLoaded.next(true);
    }
  }

  register(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, data, this.httpOptions).pipe(
      tap(res => {
        if (res?.token || res?.user) {
          this.handleLoginSuccess(res);
          this.broadcastAuthEvent('LOGIN');
        }
      })
    );
  }

  login(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, data, this.httpOptions).pipe(
      tap(res => {
        if (res?.token || res?.user) {
          this.handleLoginSuccess(res);
          this.broadcastAuthEvent('LOGIN');
        }
      })
    );
  }

  loginWithGoogle(credential: string, role?: string): Observable<boolean> {
    return this.http.post<any>(`${this.apiUrl}/google`, { credential, role: role || 'Client' }, this.httpOptions).pipe(
      tap(res => {
        this.handleLoginSuccess(res);
        this.broadcastAuthEvent('LOGIN');
      }),
      switchMap(() => this.completeLogin())
    );
  }

  completeLogin(): Observable<boolean> {
    if (this._isLoggedIn.value && this._currentUser.value) {
      return of(true);
    }
    return this.checkSession();
  }

  logout(): Observable<any> {
    this.broadcastAuthEvent('LOGOUT');
    this.clearSessionState();
    this.router.navigate(['/login']);

    return this.http.post<any>(`${this.apiUrl}/logout`, {}, this.httpOptions).pipe(
      catchError(() => of(null))
    );
  }

  /**
   * Enterprise Session Hydration:
   * Uses an un-sensitive session indicator hint (lc_has_session) to skip network requests
   * for guest users, avoiding unnecessary 401 console errors. If a session is expected,
   * silently recovers the access token via HttpOnly __session refresh cookie.
   */
  checkSession(): Observable<boolean> {
    const currentToken = this.getToken();

    if (currentToken) {
      return this.userProfileService.getProfile().pipe(
        map((res: any) => {
          this._isSessionLoaded.next(true);
          if (res && res.isAuthenticated) {
            const userObj = { ...res, isAuthenticated: true };
            this._currentUser.next(userObj);
            this.tokenStorage.setCachedUser(userObj);
            this._isLoggedIn.next(true);
            if (typeof window !== 'undefined') localStorage.setItem('lc_has_session', 'true');
            return true;
          } else {
            this.clearSessionState();
            return false;
          }
        }),
        catchError(() => {
          this._isSessionLoaded.next(true);
          this.clearSessionState();
          return of(false);
        })
      );
    }

    const hasSessionHint = typeof window !== 'undefined' && localStorage.getItem('lc_has_session') === 'true';

    if (!hasSessionHint) {
      this._isSessionLoaded.next(true);
      this.clearSessionState(false);
      return of(false);
    }

    return this.refreshToken().pipe(
      switchMap(() => this.userProfileService.getProfile()),
      map((res: any) => {
        this._isSessionLoaded.next(true);
        if (res && res.isAuthenticated) {
          if (res.token) {
            this.tokenStorage.setToken(res.token);
            this.scheduleProactiveRefresh(res.token);
          }
          const userObj = { ...res, isAuthenticated: true };
          this._currentUser.next(userObj);
          this.tokenStorage.setCachedUser(userObj);
          this._isLoggedIn.next(true);
          if (typeof window !== 'undefined') localStorage.setItem('lc_has_session', 'true');
          return true;
        } else {
          this.clearSessionState();
          return false;
        }
      }),
      catchError(() => {
        this._isSessionLoaded.next(true);
        this.clearSessionState();
        return of(false);
      })
    );
  }

  refreshToken(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/refresh`, {}, this.httpOptions).pipe(
      tap((res) => {
        if (res.token) {
          this.tokenStorage.setToken(res.token);
          this._proactiveRefreshRetries = 0;
          this.scheduleProactiveRefresh(res.token);
          if (typeof window !== 'undefined') localStorage.setItem('lc_has_session', 'true');
        }
      })
    );
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/forgot-password`, { email }, this.httpOptions);
  }

  resetPassword(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reset-password`, data, this.httpOptions);
  }

  handleRefreshFailure(): void {
    this.handleSessionExpired();
  }

  private handleSessionExpired(): void {
    this.clearSessionState();
    const currentUrl = this.router.url.split('?')[0];
    const isPublic = PUBLIC_ROUTES.some(route => currentUrl.startsWith(route));
    if (!isPublic) {
      this.router.navigate(['/login'], { queryParams: { sessionExpired: 'true', returnUrl: currentUrl } });
    }
  }

  private clearSessionState(shouldBroadcast = true): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lc_has_session');
    }
    if (shouldBroadcast) {
      this.broadcastAuthEvent('LOGOUT');
    }
    this.cancelProactiveRefresh();
    this.tokenStorage.removeToken();
    this._currentUser.next(null);
    this._isLoggedIn.next(false);
  }

  private scheduleProactiveRefresh(token: string): void {
    this.cancelProactiveRefresh();
    try {
      const parts = token.split('.');
      if (parts.length < 2) return;
      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return;

      const expiresAtMs = payload.exp * 1000;
      const nowMs = Date.now();
      const totalDurationMs = expiresAtMs - nowMs;

      if (totalDurationMs <= 0) {
        this.executeProactiveRefresh();
        return;
      }

      const bufferMs = totalDurationMs > 300000 ? (2 * 60 * 1000) : (totalDurationMs * 0.2);
      const delayMs = Math.max(1000, (expiresAtMs - bufferMs) - nowMs);

      this._logoutTimerId = setTimeout(() => {
        this.executeProactiveRefresh();
      }, delayMs);
    } catch {
      // Ignore token parse error
    }
  }

  private executeProactiveRefresh(): void {
    this.refreshToken().pipe(
      catchError(() => {
        if (this._proactiveRefreshRetries < this.MAX_REFRESH_RETRIES) {
          this._proactiveRefreshRetries++;
          timer(this.RETRY_DELAY_MS).subscribe(() => this.executeProactiveRefresh());
        } else {
          this._proactiveRefreshRetries = 0;
          this.handleSessionExpired();
        }
        return of(null);
      })
    ).subscribe();
  }

  private cancelProactiveRefresh(): void {
    if (this._logoutTimerId) {
      clearTimeout(this._logoutTimerId);
      this._logoutTimerId = null;
    }
    this._proactiveRefreshRetries = 0;
  }
}