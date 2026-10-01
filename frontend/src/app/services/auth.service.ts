import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, tap, catchError, of, map, Observable, firstValueFrom, retry, timer } from 'rxjs';
import { Router } from '@angular/router';
import { TokenStorageService } from './token-storage.service';
import { UserProfileService } from './user-profile.service';
import { normalizeMediaUrl } from '../core/utils/url-utils';

export interface UserProfile {
  id?: number;
  publicId?: string;
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
  clientState?: string;
  clientBio?: string;
  dateOfBirth?: string;
  gender?: string;
  avatarUrl?: string;
  isAuthenticated?: boolean;
  token?: string;
  notifyWhatsAppEnabled?: boolean;
  whatsAppPhone?: string;
  isSearchIndexable?: boolean;
}

/** Routes that do not require authentication. Used to avoid redirecting public pages to login. */
const PUBLIC_ROUTES = [
  '/home', '/about', '/privacy', '/terms', '/help', '/contact',
  '/laws', '/search', '/find-help', '/lawyers', '/reviews',
  '/specializations', '/cookie-preferences', '/login', '/register',
  '/forgot-password', '/reset-password'
];

/**
 * Safely decodes base64url JWT payload with padding support.
 * Prevents DOMException in standard browser atob() implementations.
 */
function decodeJwtPayload(token: string | null): any | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

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
 * ## Multi-Tab Synchronization
 * - `storage` event in {@link TokenStorageService} keeps in-memory token caches in sync.
 * - `BroadcastChannel` propagates LOGIN, LOGOUT, and TOKEN_REFRESHED events to all tabs.
 * - TOKEN_REFRESHED prevents the thundering-herd problem: only one tab performs the
 *   refresh HTTP call, and all other tabs adopt the new tokens immediately.
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

    // Synchronous session hydration from localStorage cache.
    // If a cached user profile exists (persisted by TokenStorageService on login/profile fetch),
    // emit it immediately so auth guards and route components resolve at t=0 without
    // waiting for the background checkSession() network call.
    const cachedUser = this.tokenStorage.getCachedUser();
    if (cachedUser && this.tokenStorage.getToken()) {
      this._currentUser.next({ ...cachedUser, isAuthenticated: true });
      this._isLoggedIn.next(true);
      this._isSessionLoaded.next(true);
    }
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

  /** Synchronous getter for current cached user profile. */
  get currentUser(): UserProfile | null {
    return this._currentUser.value;
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
      })
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

  /**
   * Updates local current user profile and caches the updated state.
   * Broadcasts to all subscribers of currentUser$ (including navbar and menus).
   */
  updateCurrentUser(partial: Partial<UserProfile>): void {
    const current = this._currentUser.value;
    if (current) {
      if (partial.avatarUrl !== undefined) {
        partial.avatarUrl = partial.avatarUrl ? normalizeMediaUrl(partial.avatarUrl) : '';
      }
      const updated = { ...current, ...partial };
      this._currentUser.next(updated);
      this.tokenStorage.setCachedUser(updated);
    }
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
   * 1. If an access token exists and is NOT expired, validates it by fetching the user profile.
   *    If the token is expired, the interceptor will transparently refresh it.
   * 2. If an access token exists but IS expired (e.g., returning the next day), performs
   *    a dedicated silent refresh BEFORE firing any profile/API requests — preventing a
   *    storm of 401s from components that mount in parallel.
   * 3. If no access token exists but a session hint flag is present (user was previously
   *    logged in), attempts a silent refresh using the stored refresh token or HttpOnly cookie.
   * 4. If no access token AND no session hint exist (first-time guest), resolves `false`
   *    immediately WITHOUT making any HTTP calls — eliminating the red 401 error in DevTools.
   *
   * @returns Observable that emits `true` if the session was successfully restored.
   */
  checkSession(): Observable<boolean> {
    const currentToken = this.getToken();

    if (currentToken) {
      // Check if token is already expired before using it
      const payload = decodeJwtPayload(currentToken);
      if (payload?.exp && (payload.exp * 1000) <= Date.now()) {
        // Token expired (e.g., user returns the next morning).
        // Refresh FIRST, then fetch profile — prevents 401 storms from parallel component mounts.
        return this.refreshThenFetchProfile();
      }
      // Token still valid — use it directly
      return this.fetchAndSetProfile();
    }

    // No token — only attempt refresh if a session hint exists (user was previously logged in)
    if (!this.tokenStorage.hasSessionHint()) {
      // Guest / first-time visitor — resolve immediately without any HTTP call
      this._isSessionLoaded.next(true);
      return of(false);
    }

    // Has session hint but no access token — attempt silent refresh via cookie/stored refresh token
    return this.refreshThenFetchProfile();
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
   * Includes Render cold-start resilience: retries on status 0/502/503/504
   * with exponential backoff calibrated to cover 30–50s container boot time
   * (3s → 8s → 20s cumulative ≈ 31s).
   *
   * @returns Promise resolving to the new access token, or rejecting on failure.
   */
  refreshTokenAsPromise(): Promise<string | null> {
    if (this._refreshPromise) {
      return this._refreshPromise;
    }

    const payload: { refreshToken?: string } = {};
    const storedRefreshToken = this.tokenStorage.getRefreshToken();
    if (storedRefreshToken) {
      payload.refreshToken = storedRefreshToken;
    }

    this._refreshPromise = firstValueFrom(
      this.http.post<any>(`${this.apiUrl}/refresh`, payload, this.httpOptions).pipe(
        retry({
          count: 3,
          delay: (error: HttpErrorResponse, retryCount: number) => {
            // Render cold-start resilience: 3s → 8s → 20s (covers 30-50s boot window)
            if (error?.status === 0 || (error?.status >= 502 && error?.status <= 504)) {
              const delayMs = Math.min(3000 * Math.pow(2.5, retryCount - 1), 25000);
              return timer(delayMs);
            }
            throw error;
          }
        })
      )
    )
      .then(res => {
        const newToken = res?.token || null;
        if (newToken) {
          this.tokenStorage.setToken(newToken);
          this._proactiveRefreshRetries = 0;
          this.scheduleProactiveRefresh(newToken);
        }
        if (res?.refreshToken) {
          this.tokenStorage.setRefreshToken(res.refreshToken);
        }
        // Notify other tabs — they adopt the new tokens without making their own refresh calls.
        // This prevents the multi-tab thundering-herd problem.
        this.broadcastTokenRefresh(newToken, res?.refreshToken);
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
      const payload = decodeJwtPayload(token);
      if (!payload?.exp) return;

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
   * Stores the access token, caches the user profile, schedules proactive refresh,
   * and sets the session hint flag for future startup recovery.
   * The refresh token cookie is set automatically by the browser from the `Set-Cookie` header.
   */
  private handleLoginSuccess(res: any): void {
    if (res.token) {
      this.tokenStorage.setToken(res.token);
      this.scheduleProactiveRefresh(res.token);
    }
    if (res.refreshToken) {
      this.tokenStorage.setRefreshToken(res.refreshToken);
    }
    // Set session hint so future page loads know to attempt recovery
    this.tokenStorage.setSessionHint();
    if (res.user) {
      if (res.user.avatarUrl) {
        res.user.avatarUrl = normalizeMediaUrl(res.user.avatarUrl);
      }
      const userObj = { ...res.user, isAuthenticated: true, token: res.token };
      this._currentUser.next(userObj);
      this.tokenStorage.setCachedUser(userObj);
      this._isLoggedIn.next(true);
    }
    // Always mark session as loaded — even if user object is missing — to prevent
    // auth guards from blocking navigation indefinitely (login stuck on spinner).
    this._isSessionLoaded.next(true);
  }

  /**
   * Fetches the user profile from the server and updates local authentication state.
   *
   * Includes Render cold-start resilience: retries on transient errors (status 0, 502–504)
   * with exponential backoff calibrated for 30–50s container boot time.
   * Transient failures do NOT clear the session — the user's refresh token is still valid.
   */
  private fetchAndSetProfile(): Observable<boolean> {
    return this.userProfileService.getProfile().pipe(
      // Render cold-start resilience: retry on transient infrastructure errors
      retry({
        count: 3,
        delay: (error: HttpErrorResponse, retryCount: number) => {
          if (error?.status === 0 || (error?.status >= 502 && error?.status <= 504)) {
            // 3s → 8s → 20s (covers 30-50s Render boot window)
            const delayMs = Math.min(3000 * Math.pow(2.5, retryCount - 1), 25000);
            return timer(delayMs);
          }
          throw error; // Non-transient error — don't retry
        }
      }),
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
      catchError((err: HttpErrorResponse) => {
        this._isSessionLoaded.next(true);
        // Do NOT clear session on transient/cold-start errors —
        // the user's refresh token is still valid and will work once Render boots.
        if (err?.status === 0 || (err?.status >= 502 && err?.status <= 504)) {
          return of(false);
        }
        this.softClear();
        return of(false);
      })
    );
  }

  /**
   * Performs a silent refresh followed by profile fetch.
   * Used when the access token is expired or missing but a session hint exists.
   * Centralizes the refresh-then-profile pattern to avoid code duplication.
   */
  private refreshThenFetchProfile(): Observable<boolean> {
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

  /**
   * Soft clear: removes the access token and resets in-memory state.
   * The HttpOnly refresh cookie is preserved for potential session recovery.
   * The session hint is NOT cleared — transient failures should not prevent future recovery.
   */
  private softClear(): void {
    this.cancelProactiveRefresh();
    this.tokenStorage.removeAccessTokenOnly();
    this._currentUser.next(null);
    this._isLoggedIn.next(false);
  }

  /**
   * Hard clear: removes all client-side authentication state including the session hint.
   * The HttpOnly cookie is cleared server-side via the `/auth/logout` endpoint.
   * Only called during: explicit logout, confirmed server-side token revocation (401/403 on refresh).
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
          const payload = decodeJwtPayload(token);
          if (payload?.exp) {
            const expMs = payload.exp * 1000;
            if (Date.now() + 120000 >= expMs) {
              this.ngZone.run(() => this.executeProactiveRefresh());
            }
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
   * - `TOKEN_REFRESHED` event: adopts the new tokens from the tab that performed
   *   the refresh — prevents the multi-tab thundering-herd problem where multiple
   *   tabs simultaneously attempt to refresh and cascade replay detections.
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
          } else if (event.data?.type === 'TOKEN_REFRESHED') {
            // Another tab already refreshed — adopt its tokens directly.
            // This prevents this tab from making its own refresh call (which would
            // rotate the token again and potentially trigger replay detection).
            if (event.data.accessToken) {
              this.tokenStorage.setToken(event.data.accessToken);
              this.scheduleProactiveRefresh(event.data.accessToken);
            }
            if (event.data.refreshToken) {
              this.tokenStorage.setRefreshToken(event.data.refreshToken);
            }
            // Re-hydrate profile if we're in a session-hint state but not yet logged in
            if (!this._currentUser.value && event.data.accessToken) {
              this.fetchAndSetProfile().subscribe();
            }
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

  /**
   * Broadcasts a TOKEN_REFRESHED event to all other tabs with the new token pair.
   * Other tabs adopt these tokens directly instead of making their own refresh calls.
   */
  private broadcastTokenRefresh(accessToken: string | null, refreshToken?: string): void {
    if (this.authChannel) {
      try {
        this.authChannel.postMessage({
          type: 'TOKEN_REFRESHED',
          accessToken,
          refreshToken
        });
      } catch {
        // Silently ignore broadcast failures
      }
    }
  }
}