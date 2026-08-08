import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap, catchError, of, map, Observable, timer, switchMap, share, finalize } from 'rxjs';
import { Router } from '@angular/router';
import { TokenStorageService } from './token-storage.service';
import { UserProfileService } from './user-profile.service';
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
  private refreshObservable$: Observable<any> | null = null;

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
    this.initResumeListener();
  }

  /**
   * Device Resume & Tab Focus Listener:
   * Proactively checks and refreshes tokens when waking from laptop sleep or returning to PWA.
   */
  private initResumeListener(): void {
    if (typeof window !== 'undefined') {
      const checkResumeSession = () => {
        if (this._isLoggedIn.value) {
          const token = this.getToken();
          if (token) {
            try {
              const parts = token.split('.');
              if (parts.length >= 2) {
                const payload = JSON.parse(atob(parts[1]));
                const expMs = payload.exp * 1000;
                // If token expires within 2 minutes or has already expired, refresh proactively
                if (Date.now() + 120000 >= expMs) {
                  this.executeProactiveRefresh();
                }
              }
            } catch {
              this.executeProactiveRefresh();
            }
          } else {
            // Logged in but no token — try to refresh
            this.executeProactiveRefresh();
          }
        }
      };

      window.addEventListener('focus', checkResumeSession);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkResumeSession();
        }
      });
    }
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
              switchMap(() => this.fetchAndSetProfile()),
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

  getToken(): string | null {
    return this.tokenStorage.getToken();
  }

  private handleLoginSuccess(res: any): void {
    if (res.token) {
      this.tokenStorage.setToken(res.token);
      this.scheduleProactiveRefresh(res.token);
    }
    if (res.refreshToken) {
      this.tokenStorage.setFallbackRefreshToken(res.refreshToken);
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
   * Session Hydration on App Startup:
   *
   * Flow:
   * 1. Check if we have an access token in localStorage (survives page refresh)
   * 2. If yes → validate it by fetching /api/profile/me
   *    - If 200 → we're authenticated, set up state
   *    - If 401 → the auth interceptor will attempt token refresh automatically
   * 3. If no token → check for a refresh token in localStorage
   *    - If yes → try to refresh and get a new access token
   *    - If no → user is genuinely not logged in
   *
   * This eliminates the fragile lc_has_session hint system entirely.
   */
  checkSession(): Observable<boolean> {
    const currentToken = this.getToken();

    if (currentToken) {
      // We have a token — validate it by fetching profile
      // If it's expired, the auth interceptor will handle the 401 → refresh → retry automatically
      return this.fetchAndSetProfile();
    }

    // No access token — check if we have a refresh token to try
    const refreshToken = this.tokenStorage.getFallbackRefreshToken();
    if (!refreshToken) {
      // No tokens at all — user is not logged in
      this._isSessionLoaded.next(true);
      this.clearSessionState(false);
      return of(false);
    }

    // Have a refresh token — try to get a new access token
    return this.refreshToken().pipe(
      switchMap(() => this.fetchAndSetProfile()),
      catchError(() => {
        this._isSessionLoaded.next(true);
        this.clearSessionState(false);
        return of(false);
      })
    );
  }

  /**
   * Fetches user profile and sets auth state.
   * Used by checkSession and multi-tab sync.
   */
  private fetchAndSetProfile(): Observable<boolean> {
    return this.userProfileService.getProfile().pipe(
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
          return true;
        } else {
          this.clearSessionState(false);
          return false;
        }
      }),
      catchError(() => {
        this._isSessionLoaded.next(true);
        this.clearSessionState(false);
        return of(false);
      })
    );
  }

  /**
   * RxJS Deduplication Mutex for Token Refresh:
   * Shares a single in-flight HTTP request across concurrent callers.
   * Always sends the refresh token in the request body as the primary mechanism.
   * The __session cookie is a secondary/bonus channel.
   */
  refreshToken(): Observable<any> {
    if (this.refreshObservable$) {
      return this.refreshObservable$;
    }

    const fallbackToken = this.tokenStorage.getFallbackRefreshToken();
    const payload = fallbackToken ? { refreshToken: fallbackToken } : {};

    this.refreshObservable$ = this.http.post<any>(`${this.apiUrl}/refresh`, payload, this.httpOptions).pipe(
      tap((res) => {
        if (res.token) {
          this.tokenStorage.setToken(res.token);
          this._proactiveRefreshRetries = 0;
          this.scheduleProactiveRefresh(res.token);
        }
        if (res.refreshToken) {
          this.tokenStorage.setFallbackRefreshToken(res.refreshToken);
        }
      }),
      share(),
      finalize(() => {
        this.refreshObservable$ = null;
      })
    );

    return this.refreshObservable$;
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