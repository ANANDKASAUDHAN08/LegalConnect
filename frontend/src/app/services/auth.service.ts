import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, tap, catchError, of, map, Observable, firstValueFrom } from 'rxjs';
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

/** Routes that do not require authentication. Used to avoid redirecting public pages to login. */
const PUBLIC_ROUTES = [
  '/home', '/about', '/privacy', '/terms', '/help', '/contact',
  '/laws', '/search', '/find-help', '/lawyers', '/reviews',
  '/specializations', '/cookie-preferences', '/login', '/register',
  '/forgot-password', '/reset-password'
];

/**
 * Authentication Service
 *
 * Central authority for session lifecycle management including login, logout,
 * token refresh, session hydration, and cross-tab synchronization.
 *
 * ## Token Architecture
 * - **Access Token (JWT, 15 min):** Stored in `localStorage` via {@link TokenStorageService}.
 *   Attached to API requests by {@link authInterceptor}.
 * - **Refresh Token (opaque, 30 days):** Stored in an `HttpOnly` cookie (`__session`)
 *   managed entirely by the server. Never accessible to JavaScript.
 *
 * ## Refresh Strategy
 * Uses a singleton Promise pattern to deduplicate concurrent refresh attempts.
 * Both the proactive timer and the {@link authInterceptor}'s 401 handler converge
 * on the same Promise instance, eliminating race conditions.
 *
 * ## Proactive Refresh
 * A timer is scheduled to fire before the access token expires (2-minute buffer for
 * tokens > 5 min, 20% buffer for shorter tokens). On transient failures, the timer
 * retries with exponential backoff (2s → 4s → 8s) before expiring the session.
 *
 * ## Session Recovery
 * On app startup, page refresh, or tab focus, the service attempts to recover
 * the session by validating the existing access token or performing a silent
 * refresh using the HttpOnly cookie.
 *
 * @see {@link TokenStorageService} for token persistence.
 * @see {@link authInterceptor} for automatic token attachment and 401 recovery.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = '/api/auth';

  private _currentUser = new BehaviorSubject<UserProfile | null>(null);
  currentUser$ = this._currentUser.asObservable();

  private _isLoggedIn = new BehaviorSubject<boolean>(false);
  isLoggedIn$ = this._isLoggedIn.asObservable();

  private _isSessionLoaded = new BehaviorSubject<boolean>(false);
  isSessionLoaded$ = this._isSessionLoaded.asObservable();

  private _proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private _proactiveRefreshRetries = 0;
  private readonly MAX_REFRESH_RETRIES = 3;

  private authChannel: BroadcastChannel | null = null;

  /**
   * Singleton refresh Promise shared by both the proactive timer and the interceptor.
   * Ensures only one refresh HTTP call is in-flight at any given time.
   */
  private _refreshPromise: Promise<string | null> | null = null;

  private httpOptions = { withCredentials: true };

  private lastResumeCheckTime = 0;

  constructor(
    private http: HttpClient,
    private router: Router,
    private tokenStorage: TokenStorageService,
    private userProfileService: UserProfileService,
    private ngZone: NgZone
  ) {
    this.initMultiTabSync();
    this.initResumeListener();
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Returns the current access token, or `null` if not authenticated. */
  getToken(): string | null {
    return this.tokenStorage.getToken();
  }

  /** Synchronous check for current login state. */
  get isLoggedIn(): boolean {
    return this._isLoggedIn.value;
  }

  /** Registers a new user and establishes an authenticated session. */
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

  /** Authenticates a user with email and password credentials. */
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

  /** Authenticates a user via Google OAuth credential. */
  loginWithGoogle(credential: string, role?: string): Observable<boolean> {
    return this.http.post<any>(`${this.apiUrl}/google`, { credential, role: role || 'Client' }, this.httpOptions).pipe(
      tap(res => {
        this.handleLoginSuccess(res);
        this.broadcastAuthEvent('LOGIN');
      }),
      map(() => {
        if (this._isLoggedIn.value && this._currentUser.value) {
          return true;
        }
        return false;
      }),
      catchError(() => of(false))
    );
  }

  /** Ensures the user is fully authenticated, triggering session hydration if needed. */
  completeLogin(): Observable<boolean> {
    if (this._isLoggedIn.value && this._currentUser.value) {
      return of(true);
    }
    return this.checkSession();
  }

  /**
   * Terminates the authenticated session.
   * Clears client-side state immediately and calls the server to revoke
   * the session and clear the HttpOnly `__session` cookie.
   */
  logout(): Observable<any> {
    this.broadcastAuthEvent('LOGOUT');
    this.hardClear();
    this.router.navigate(['/login']);

    return this.http.post<any>(`${this.apiUrl}/logout`, {}, this.httpOptions).pipe(
      catchError(() => of(null))
    );
  }

  /** Initiates the password reset flow by sending a reset email. */
  forgotPassword(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/forgot-password`, { email }, this.httpOptions);
  }

  /** Completes the password reset flow with a new password and reset token. */
  resetPassword(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reset-password`, data, this.httpOptions);
  }

  // ─── Session Hydration ──────────────────────────────────────────────────────

  /**
   * Rehydrates the session on application startup or page refresh.
   *
   * Strategy:
   * 1. If an access token exists in `localStorage`, validates it by fetching the user profile.
   *    If the token is expired, the interceptor will transparently refresh it.
   * 2. If no access token exists, attempts a silent refresh using the HttpOnly cookie.
   *    Since JavaScript cannot inspect HttpOnly cookies, this is a "try and verify" approach —
   *    the server will accept or reject based on cookie presence.
   *
   * @returns Observable that emits `true` if the session was successfully restored.
   */
  checkSession(): Observable<boolean> {
    const currentToken = this.getToken();

    if (currentToken) {
      return this.fetchAndSetProfile();
    }

    return new Observable<boolean>(subscriber => {
      this.refreshTokenAsPromise()
        .then(newToken => {
          if (newToken) {
            this.fetchAndSetProfile().subscribe({
              next: result => {
                subscriber.next(result);
                subscriber.complete();
              },
              error: () => {
                this._isSessionLoaded.next(true);
                this.softClear();
                subscriber.next(false);
                subscriber.complete();
              }
            });
          } else {
            this._isSessionLoaded.next(true);
            this.softClear();
            subscriber.next(false);
            subscriber.complete();
          }
        })
        .catch(() => {
          this._isSessionLoaded.next(true);
          this.softClear();
          subscriber.next(false);
          subscriber.complete();
        });
    });
  }

  // ─── Token Refresh ──────────────────────────────────────────────────────────

  /**
   * Refreshes the access token using the HttpOnly `__session` cookie.
   *
   * The browser automatically includes the cookie via `withCredentials: true`.
   * No refresh token is sent in the request body.
   *
   * Uses a singleton Promise to deduplicate concurrent refresh attempts.
   * The Promise is cleared via `queueMicrotask` after resolution to ensure
   * all dependent `.then()` chains execute before the next cycle can begin.
   *
   * @returns Promise resolving to the new access token, or rejecting on failure.
   */
  refreshTokenAsPromise(): Promise<string | null> {
    if (this._refreshPromise) {
      return this._refreshPromise;
    }

    this._refreshPromise = firstValueFrom(
      this.http.post<any>(`${this.apiUrl}/refresh`, {}, this.httpOptions)
    )
      .then(res => {
        const newToken = res?.token || null;
        if (newToken) {
          this.tokenStorage.setToken(newToken);
          this._proactiveRefreshRetries = 0;
          this.scheduleProactiveRefresh(newToken);
        }
        return newToken;
      })
      .catch((err: HttpErrorResponse) => {
        if (err?.status === 401 || err?.status === 403) {
          this.hardClear();
        }
        throw err;
      })
      .finally(() => {
        queueMicrotask(() => {
          this._refreshPromise = null;
        });
      });

    return this._refreshPromise;
  }

  /** Invoked by the interceptor when all refresh attempts are exhausted. */
  handleRefreshFailure(): void {
    this.handleSessionExpired();
  }

  // ─── Proactive Refresh Timer ────────────────────────────────────────────────

  /**
   * Schedules a proactive token refresh before the access token expires.
   *
   * Buffer calculation:
   * - Tokens with > 5 min remaining: refreshes 2 minutes before expiry.
   * - Tokens with ≤ 5 min remaining: refreshes at 80% of remaining lifetime.
   *
   * Runs outside Angular zone to avoid triggering unnecessary change detection cycles.
   */
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

      this.ngZone.runOutsideAngular(() => {
        this._proactiveRefreshTimer = setTimeout(() => {
          this.ngZone.run(() => this.executeProactiveRefresh());
        }, delayMs);
      });
    } catch {
      // Malformed token — skip scheduling
    }
  }

  /**
   * Executes a proactive refresh with exponential backoff on transient failures.
   *
   * - Transient errors (network, 5xx): retries up to {@link MAX_REFRESH_RETRIES} times
   *   with exponential backoff (2s, 4s, 8s).
   * - Hard failures (401, 403): the server has revoked the refresh token.
   *   The session is expired immediately without retry.
   */
  private executeProactiveRefresh(): void {
    this.refreshTokenAsPromise()
      .then(() => {
        this._proactiveRefreshRetries = 0;
      })
      .catch((err: HttpErrorResponse) => {
        if (err?.status === 401 || err?.status === 403) {
          this._proactiveRefreshRetries = 0;
          this.handleSessionExpired();
          return;
        }

        if (this._proactiveRefreshRetries < this.MAX_REFRESH_RETRIES) {
          this._proactiveRefreshRetries++;
          const backoffMs = Math.pow(2, this._proactiveRefreshRetries) * 1000;
          this.ngZone.runOutsideAngular(() => {
            setTimeout(() => {
              this.ngZone.run(() => this.executeProactiveRefresh());
            }, backoffMs);
          });
        } else {
          this._proactiveRefreshRetries = 0;
          this.handleSessionExpired();
        }
      });
  }

  /** Cancels the proactive refresh timer and resets the retry counter. */
  private cancelProactiveRefresh(): void {
    if (this._proactiveRefreshTimer) {
      clearTimeout(this._proactiveRefreshTimer);
      this._proactiveRefreshTimer = null;
    }
    this._proactiveRefreshRetries = 0;
  }

  // ─── Session State Management ───────────────────────────────────────────────

  /**
   * Processes a successful authentication response.
   * Stores the access token, caches the user profile, and schedules proactive refresh.
   * The refresh token cookie is set automatically by the browser from the `Set-Cookie` header.
   */
  private handleLoginSuccess(res: any): void {
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

  /** Fetches the user profile from the server and updates local authentication state. */
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
          this.softClear();
          return false;
        }
      }),
      catchError(() => {
        this._isSessionLoaded.next(true);
        this.softClear();
        return of(false);
      })
    );
  }

  /**
   * Soft clear: removes the access token and resets in-memory state.
   * The HttpOnly refresh cookie is preserved for potential session recovery.
   */
  private softClear(): void {
    this.cancelProactiveRefresh();
    this.tokenStorage.removeAccessTokenOnly();
    this._currentUser.next(null);
    this._isLoggedIn.next(false);
  }

  /**
   * Hard clear: removes all client-side authentication state.
   * The HttpOnly cookie is cleared server-side via the `/auth/logout` endpoint.
   */
  private hardClear(): void {
    this.cancelProactiveRefresh();
    this.tokenStorage.removeAllTokens();
    this._currentUser.next(null);
    this._isLoggedIn.next(false);
  }

  /**
   * Handles confirmed session expiration.
   * Clears all state and redirects to the login page with a return URL
   * (unless the user is already on a public route).
   */
  private handleSessionExpired(): void {
    this.ngZone.run(() => {
      this.hardClear();
      const currentUrl = this.router.url.split('?')[0];
      const isPublic = PUBLIC_ROUTES.some(route => currentUrl.startsWith(route));
      if (!isPublic) {
        this.router.navigate(['/login'], { queryParams: { sessionExpired: 'true', returnUrl: currentUrl } });
      }
    });
  }

  // ─── Cross-Tab Synchronization & Resume Detection ───────────────────────────

  /**
   * Monitors tab focus and visibility changes to detect device resume events
   * (laptop wake, mobile app foreground, tab switch).
   *
   * When the tab becomes visible, checks if the access token is near expiry
   * (within 2 minutes) and proactively refreshes if necessary.
   * Debounced to prevent rapid-fire checks on frequent focus/blur cycles.
   */
  private initResumeListener(): void {
    if (typeof window !== 'undefined') {
      const checkResumeSession = () => {
        const now = Date.now();
        if (now - this.lastResumeCheckTime < 2000) return;
        this.lastResumeCheckTime = now;

        if (!this._isLoggedIn.value) return;

        const token = this.getToken();
        if (token) {
          try {
            const parts = token.split('.');
            if (parts.length >= 2) {
              const payload = JSON.parse(atob(parts[1]));
              const expMs = payload.exp * 1000;
              if (Date.now() + 120000 >= expMs) {
                this.ngZone.run(() => this.executeProactiveRefresh());
              }
            }
          } catch {
            this.ngZone.run(() => this.executeProactiveRefresh());
          }
        } else {
          this.ngZone.run(() => this.executeProactiveRefresh());
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
   * Synchronizes authentication state across browser tabs using `BroadcastChannel`.
   *
   * - `LOGOUT` event: immediately clears state and redirects to login in all tabs.
   * - `LOGIN` event: triggers a silent refresh to synchronize the new session.
   */
  private initMultiTabSync(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.authChannel = new BroadcastChannel('lc_public_auth_sync');
        this.authChannel.onmessage = (event) => {
          if (event.data?.type === 'LOGOUT') {
            this.hardClear();
            this.router.navigate(['/login']);
          } else if (event.data?.type === 'LOGIN') {
            this.refreshTokenAsPromise()
              .then(() => {
                this.fetchAndSetProfile().subscribe();
              })
              .catch(() => { });
          }
        };
      } catch {
        // BroadcastChannel unavailable in restricted environments (e.g., some WebViews)
      }
    }
  }

  /** Broadcasts an authentication event to all open tabs. */
  private broadcastAuthEvent(type: 'LOGIN' | 'LOGOUT'): void {
    if (this.authChannel) {
      try {
        this.authChannel.postMessage({ type });
      } catch {
        // Silently ignore broadcast failures
      }
    }
  }
}