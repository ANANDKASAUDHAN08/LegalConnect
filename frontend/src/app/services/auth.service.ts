import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap, catchError, of, map, Observable, switchMap, timer } from 'rxjs';
import { Router } from '@angular/router';

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
  // Extended profile fields
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

/** Routes that don't require authentication — no redirect to /login from these */
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
  private token: string | null = localStorage.getItem('lc_token');

  private _isSessionLoaded = new BehaviorSubject<boolean>(false);
  isSessionLoaded$ = this._isSessionLoaded.asObservable();

  private _logoutTimerId: ReturnType<typeof setTimeout> | null = null;
  private _proactiveRefreshRetries = 0;
  private readonly MAX_REFRESH_RETRIES = 2;
  private readonly RETRY_DELAY_MS = 3000;

  private httpOptions = {
    withCredentials: true
  };

  getToken(): string | null {
    return this.token;
  }

  constructor(private http: HttpClient, private router: Router) {
    // Session is initialized via APP_INITIALIZER in app.config.ts.
    if (typeof window !== 'undefined') {
      // This listener handles cross-tab login/logout events.
      window.addEventListener('storage', (event) => {
        if (event.key === 'lc_token') {
          const newToken = event.newValue;
          if (newToken) {
            this.token = newToken;
            this.checkSession().subscribe();
          } else {
            this.token = null;
            this._currentUser.next(null);
            this._isLoggedIn.next(false);
            this._isSessionLoaded.next(true);
            this.router.navigate(['/login']);
          }
        }
      });

      // Re-validate session when browser transitions from offline to online
      window.addEventListener('online', () => {
        if (this.token) {
          this.checkSession().subscribe();
        }
      });
    }
  }

  checkSession(): Observable<boolean> {
    return this.http.get<UserProfile>(`${this.apiUrl}/me`, this.httpOptions).pipe(
      tap(user => {
        if (user && user.isAuthenticated !== false) {
          if (user.avatarUrl && user.avatarUrl.startsWith('/')) {
            // Keep it relative so it works via proxy in local dev and rewrites in prod
            user.avatarUrl = user.avatarUrl;
          }
          if (user.token) {
            this.token = user.token;
            localStorage.setItem('lc_token', user.token);
            this.scheduleProactiveRefresh(user.token);
          } else if (this.token) {
            this.scheduleProactiveRefresh(this.token);
          }
          this._currentUser.next(user);
          this._isLoggedIn.next(true);
          this._isSessionLoaded.next(true);
          if (user.role) {
            localStorage.setItem('lc_preferred_role', user.role);
          }
          try {
            // Sanitize user profile to avoid caching sensitive PII locally in plaintext
            const sanitizedUser: Partial<UserProfile> = {
              id: user.id,
              fullName: user.fullName,
              role: user.role,
              avatarUrl: user.avatarUrl,
              isAuthenticated: user.isAuthenticated
            };
            localStorage.setItem('lc_user_profile', JSON.stringify(sanitizedUser));
          } catch (e) { }
        } else {
          this.clearAuthState();
          this._isSessionLoaded.next(true);
        }
      }),
      map(user => user && user.isAuthenticated !== false),
      catchError((error) => {
        // TRANSIENT FAILURE RESILIENCE:
        // If backend is temporarily unreachable (status 0) — whether truly offline
        // or just a dev-server restart / brief network blip — preserve cached auth
        // state instead of logging the user out. This is the industry-standard
        // "offline-first" pattern used by apps like Gmail, Slack, and Notion.
        const isTransient = error.status === 0;
        if (isTransient) {
          const cached = localStorage.getItem('lc_user_profile');
          const token = localStorage.getItem('lc_token');
          if (cached && token) {
            try {
              const user = JSON.parse(cached);
              this._currentUser.next(user);
              this._isLoggedIn.next(true);
              this._isSessionLoaded.next(true);
              this.token = token;
              console.warn('[AuthService] Backend unreachable — using cached session. Will re-validate when connectivity resumes.');
              return of(true);
            } catch (e) { }
          }
          console.error('[AuthService] Backend unreachable and no cached session available.');
        }

        // DEFINITIVE AUTH FAILURE (401, 403, or no cached fallback):
        // Only now do we clear auth state.
        this.clearAuthState();
        this._isSessionLoaded.next(true);
        return of(false);
      })
    );
  }

  register(data: { fullName: string; email: string; password: string; role: string }) {
    return this.http.post<any>(`${this.apiUrl}/register`, data, this.httpOptions);
  }

  login(data: { email: string; password: string; twoFactorCode?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, data, this.httpOptions).pipe(
      tap((res) => {
        if (res.token) {
          this.token = res.token;
          localStorage.setItem('lc_token', res.token);
          this.scheduleProactiveRefresh(res.token);
        }
      })
    );
  }

  completeLogin(): Observable<boolean> {
    return this.checkSession();
  }

  forgotPassword(email: string) {
    return this.http.post<any>(`${this.apiUrl}/forgot-password`, { email }, this.httpOptions);
  }

  resetPassword(data: any) {
    return this.http.post<any>(`${this.apiUrl}/reset-password`, data, this.httpOptions);
  }

  verifyEmail(token: string, email: string) {
    return this.http.get<any>(`${this.apiUrl}/verify-email?token=${token}&email=${email}`, this.httpOptions);
  }

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/me`, this.httpOptions).pipe(
      map(user => {
        if (user && user.avatarUrl && user.avatarUrl.startsWith('/')) {
          user.avatarUrl = user.avatarUrl;
        }
        return user;
      })
    );
  }

  updateProfile(data: Partial<UserProfile>): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/me`, data, this.httpOptions);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/change-password`, { currentPassword, newPassword }, this.httpOptions);
  }

  deleteAccount(): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/me`, this.httpOptions).pipe(
      tap(() => {
        this.token = null;
        localStorage.removeItem('lc_token');
        localStorage.removeItem('lc_user_profile');
        this._currentUser.next(null);
        this._isLoggedIn.next(false);
      })
    );
  }

  get2FASetup(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/2fa/setup`, this.httpOptions);
  }

  toggle2FA(enable: boolean, code: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/2fa/toggle`, { enable, code }, this.httpOptions);
  }

  verifyPhone(code: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/phone/verify`, { code }, this.httpOptions);
  }

  resendEmailVerification(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/email/resend-verification`, {}, this.httpOptions);
  }

  verifyIdentity(documentType: string, documentFile: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/verify-identity`, { documentType, documentFile }, this.httpOptions);
  }

  getActiveSessions(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/sessions`, this.httpOptions);
  }

  revokeSession(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/sessions/${id}`, this.httpOptions);
  }

  revokeAllOtherSessions(): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/sessions/all`, this.httpOptions);
  }

  getLoginHistory(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/login-history`, this.httpOptions);
  }

  getExportData(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/export-data`, this.httpOptions);
  }

  downloadDataDossier(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export-data`, {
      ...this.httpOptions,
      responseType: 'blob'
    });
  }

  refreshToken(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/refresh`, {}, this.httpOptions).pipe(
      tap((res) => {
        if (res.token) {
          this.token = res.token;
          localStorage.setItem('lc_token', res.token);
          this._proactiveRefreshRetries = 0; // Reset retry counter on success
          this.scheduleProactiveRefresh(res.token);
        }
      })
    );
  }

  /**
   * Called by the HTTP interceptor when a 401 refresh attempt fails.
   * Uses smart redirect — only navigates to /login from protected routes.
   */
  handleRefreshFailure(): void {
    this.handleSessionExpired();
  }

  /**
   * INDUSTRY-STANDARD PROACTIVE REFRESH WITH RETRY:
   * Schedules a token refresh ~2 minutes before JWT expiry.
   * On failure, retries up to MAX_REFRESH_RETRIES times with exponential backoff
   * before giving up. This prevents logout on transient failures (dev HMR restarts,
   * brief network blips, backend deploys).
   */
  private scheduleProactiveRefresh(token: string): void {
    this.clearAutoLogout();
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp) {
        const expiresAt = payload.exp * 1000; // convert to ms
        const now = Date.now();
        const msUntilExpiry = expiresAt - now;
        if (msUntilExpiry > 0) {
          // Refresh 2 minutes before the token expires
          const refreshAt = Math.max(msUntilExpiry - 120000, 0);
          this._logoutTimerId = setTimeout(() => {
            this._proactiveRefreshRetries = 0;
            this.attemptProactiveRefresh();
          }, refreshAt);
        } else {
          // Token already expired — try refresh immediately
          this._proactiveRefreshRetries = 0;
          this.attemptProactiveRefresh();
        }
      }
    } catch (e) {
      console.error('[AuthService] Error parsing token payload:', e);
      // Malformed token — don't schedule anything
    }
  }

  /**
   * Attempts a proactive refresh with retry logic.
   * On transient failure (status 0), retries after a delay.
   * On definitive failure (401/403), triggers session expiry.
   */
  private attemptProactiveRefresh(): void {
    this.refreshToken().subscribe({
      error: (err) => {
        const isTransient = err.status === 0 || err.status === 504 || err.status === 503;

        if (isTransient && this._proactiveRefreshRetries < this.MAX_REFRESH_RETRIES) {
          this._proactiveRefreshRetries++;
          const delay = this.RETRY_DELAY_MS * this._proactiveRefreshRetries;
          console.warn(`[AuthService] Proactive refresh failed (transient). Retry ${this._proactiveRefreshRetries}/${this.MAX_REFRESH_RETRIES} in ${delay}ms.`);
          this._logoutTimerId = setTimeout(() => this.attemptProactiveRefresh(), delay);
        } else {
          console.error('[AuthService] Proactive refresh failed permanently:', err.status || err.message);
          this.handleSessionExpired();
        }
      }
    });
  }

  private clearAutoLogout(): void {
    if (this._logoutTimerId) {
      clearTimeout(this._logoutTimerId);
      this._logoutTimerId = null;
    }
  }

  /**
   * SMART SESSION EXPIRY HANDLER:
   * Clears local auth state and navigates to /login ONLY if the user is
   * currently on a protected route. If they're on a public page (e.g. /terms,
   * /privacy, /laws), auth state is cleared silently without a jarring redirect.
   * This is how production apps like GitHub, Stripe, and Linear handle it.
   */
  private handleSessionExpired(): void {
    this.clearAutoLogout();
    this.clearAuthState();

    // Only redirect if the user is on a protected route
    const currentPath = this.router.url.split('?')[0].split('#')[0];
    const isOnPublicRoute = PUBLIC_ROUTES.some(route => currentPath === route || currentPath.startsWith(route + '/'));

    if (!isOnPublicRoute) {
      this.router.navigate(['/login']);
    }
  }

  /**
   * Centralized auth state cleanup (DRY helper).
   * Clears token, cached profile, and BehaviorSubjects.
   * Does NOT navigate — callers decide whether to redirect.
   */
  private clearAuthState(): void {
    this.token = null;
    localStorage.removeItem('lc_token');
    localStorage.removeItem('lc_user_profile');
    this._currentUser.next(null);
    this._isLoggedIn.next(false);
  }

  logout() {
    return this.http.post<any>(`${this.apiUrl}/logout`, {}, this.httpOptions).pipe(
      tap(() => {
        this.clearAutoLogout();
        this.clearAuthState();
        this.router.navigate(['/login']);
      }),
      catchError(() => {
        this.clearAutoLogout();
        this.clearAuthState();
        this.router.navigate(['/login']);
        return of(null);
      })
    );
  }
}