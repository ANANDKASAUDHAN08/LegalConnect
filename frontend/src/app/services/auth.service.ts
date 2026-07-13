import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap, catchError, of, map, Observable, switchMap } from 'rxjs';
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


@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'http://localhost:8888/api/auth';

  private _currentUser = new BehaviorSubject<UserProfile | null>(null);
  currentUser$ = this._currentUser.asObservable();

  private _isLoggedIn = new BehaviorSubject<boolean>(false);
  isLoggedIn$ = this._isLoggedIn.asObservable();
  private token: string | null = localStorage.getItem('lc_token');

  private _isSessionLoaded = new BehaviorSubject<boolean>(false);
  isSessionLoaded$ = this._isSessionLoaded.asObservable();

  private _logoutTimerId: ReturnType<typeof setTimeout> | null = null;

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
            user.avatarUrl = `http://localhost:8888${user.avatarUrl}`;
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
          } catch (e) {}
        } else {
          this.token = null;
          localStorage.removeItem('lc_token');
          localStorage.removeItem('lc_user_profile');
          this._currentUser.next(null);
          this._isLoggedIn.next(false);
          this._isSessionLoaded.next(true);
        }
      }),
      map(user => user && user.isAuthenticated !== false),
      catchError((error) => {
        // Differentiate true offline status from server-down / CORS misconfiguration
        const isOffline = error.status === 0 && (typeof navigator !== 'undefined' && !navigator.onLine);
        if (isOffline) {
          const cached = localStorage.getItem('lc_user_profile');
          const token = localStorage.getItem('lc_token');
          if (cached && token) {
            try {
              const user = JSON.parse(cached);
              this._currentUser.next(user);
              this._isLoggedIn.next(true);
              this._isSessionLoaded.next(true);
              return of(true);
            } catch (e) {}
          }
        } else if (error.status === 0) {
          console.error('API connection failed (status 0). This may indicate backend is offline or CORS is misconfigured.');
        }
        this.token = null;
        localStorage.removeItem('lc_token');
        localStorage.removeItem('lc_user_profile');
        this._currentUser.next(null);
        this._isLoggedIn.next(false);
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
          user.avatarUrl = `http://localhost:8888${user.avatarUrl}`;
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

  refreshToken(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/refresh`, {}, this.httpOptions).pipe(
      tap((res) => {
        if (res.token) {
          this.token = res.token;
          localStorage.setItem('lc_token', res.token);
          this.scheduleProactiveRefresh(res.token);
        }
      })
    );
  }

  handleRefreshFailure(): void {
    this.handleSessionExpired();
  }

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
            this.refreshToken().subscribe({
              error: (err) => {
                console.error('Proactive refresh failed:', err);
                this.handleSessionExpired();
              }
            });
          }, refreshAt);
        } else {
          // Token already expired — try refresh immediately
          this.refreshToken().subscribe({
            error: (err) => {
              console.error('Immediate refresh failed:', err);
              this.handleSessionExpired();
            }
          });
        }
      }
    } catch (e) {
      console.error('Error parsing token payload:', e);
      // Malformed token — don't schedule anything
    }
  }

  private clearAutoLogout(): void {
    if (this._logoutTimerId) {
      clearTimeout(this._logoutTimerId);
      this._logoutTimerId = null;
    }
  }

  /**
   * Called when the JWT token expires (by the timer) or when
   * a cross-tab logout is detected via the storage event.
   * Performs a local-only cleanup without making any HTTP call.
   */
  private handleSessionExpired(): void {
    this.clearAutoLogout();
    this.token = null;
    localStorage.removeItem('lc_token');
    localStorage.removeItem('lc_user_profile');
    this._currentUser.next(null);
    this._isLoggedIn.next(false);
    this.router.navigate(['/login']);
  }

  logout() {
    return this.http.post<any>(`${this.apiUrl}/logout`, {}, this.httpOptions).pipe(
      tap(() => {
        this.clearAutoLogout();
        this.token = null;
        localStorage.removeItem('lc_token');
        localStorage.removeItem('lc_user_profile');
        this._currentUser.next(null);
        this._isLoggedIn.next(false);
        this.router.navigate(['/login']);
      }),
      catchError(() => {
        this.clearAutoLogout();
        this.token = null;
        localStorage.removeItem('lc_token');
        localStorage.removeItem('lc_user_profile');
        this._currentUser.next(null);
        this._isLoggedIn.next(false);
        this.router.navigate(['/login']);
        return of(null);
      })
    );
  }
}
