import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap, catchError, of, map, Observable, timer } from 'rxjs';
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

  private httpOptions = {
    withCredentials: true
  };

  constructor(
    private http: HttpClient,
    private router: Router,
    private tokenStorage: TokenStorageService,
    private userProfileService: UserProfileService
  ) {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === 'lc_token') {
          const newToken = event.newValue;
          if (newToken) {
            this.checkSession().subscribe();
          } else {
            this.handleSessionExpired();
          }
        }
      });
    }
  }

  getToken(): string | null {
    return this.tokenStorage.getToken();
  }

  register(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, data, this.httpOptions);
  }

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

  login(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, data, this.httpOptions).pipe(
      tap(res => this.handleLoginSuccess(res))
    );
  }

  loginWithGoogle(credential: string, role?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/google`, { credential, role: role || 'Client' }, this.httpOptions).pipe(
      tap(res => this.handleLoginSuccess(res))
    );
  }

  completeLogin(): Observable<boolean> {
    if (this._isLoggedIn.value && this._currentUser.value) {
      return of(true);
    }
    return this.checkSession();
  }

  logout(): Observable<any> {
    // 0ms Optimistic UI Logout: Immediately clear session state & navigate to /login
    this.clearSessionState();
    this.router.navigate(['/login']);

    // Dispatch backend logout & cookie clearance request in background
    return this.http.post<any>(`${this.apiUrl}/logout`, {}, this.httpOptions).pipe(
      catchError(() => of(null))
    );
  }

  checkSession(): Observable<boolean> {
    return this.userProfileService.getProfile().pipe(
      map((res: any) => {
        this._isSessionLoaded.next(true);
        if (res && res.isAuthenticated) {
          if (res.token) {
            this.tokenStorage.setToken(res.token);
            this.scheduleProactiveRefresh(res.token);
          }
          this._currentUser.next(res);
          this.tokenStorage.setCachedUser(res);
          this._isLoggedIn.next(true);
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

  private clearSessionState(): void {
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

      // Dynamic refresh calculation:
      // If token duration > 5 mins (standard 15m/1h production token), refresh 2 mins before expiry.
      // If short testing token (e.g. 30s), refresh at 80% of total lifetime.
      const bufferMs = totalDurationMs > 300000 ? (2 * 60 * 1000) : (totalDurationMs * 0.2);
      const delayMs = Math.max(1000, (expiresAtMs - bufferMs) - nowMs);

      this._logoutTimerId = setTimeout(() => {
        this.executeProactiveRefresh();
      }, delayMs);
    } catch (e) {
      // Ignore token parse error
    }
  }

  private executeProactiveRefresh(): void {
    this.refreshToken().pipe(
      catchError(err => {
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