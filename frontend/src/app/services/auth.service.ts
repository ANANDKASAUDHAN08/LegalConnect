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

  private httpOptions = {
    withCredentials: true
  };

  getToken(): string | null {
    return this.token;
  }

  constructor(private http: HttpClient, private router: Router) {
    // Session is initialized via APP_INITIALIZER in app.config.ts.
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
  }

  checkSession(): Observable<boolean> {
    if (!this.token) {
      this._currentUser.next(null);
      this._isLoggedIn.next(false);
      this._isSessionLoaded.next(true);
      return of(false);
    }

    return this.http.get<UserProfile>(`${this.apiUrl}/me`, this.httpOptions).pipe(
      tap(user => {
        if (user && user.avatarUrl && user.avatarUrl.startsWith('/')) {
          user.avatarUrl = `http://localhost:8888${user.avatarUrl}`;
        }
        this._currentUser.next(user);
        this._isLoggedIn.next(true);
        this._isSessionLoaded.next(true);
        if (user && user.role) {
          localStorage.setItem('lc_preferred_role', user.role);
        }
      }),
      map(() => true),
      catchError(() => {
        this.token = null;
        localStorage.removeItem('lc_token');
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

  getLoginHistory(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/login-history`, this.httpOptions);
  }

  getExportData(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/export-data`, this.httpOptions);
  }

  logout() {
    return this.http.post<any>(`${this.apiUrl}/logout`, {}, this.httpOptions).pipe(
      tap(() => {
        this.token = null;
        localStorage.removeItem('lc_token');
        this._currentUser.next(null);
        this._isLoggedIn.next(false);
        this.router.navigate(['/login']);
      }),
      catchError(() => {
        this.token = null;
        localStorage.removeItem('lc_token');
        this._currentUser.next(null);
        this._isLoggedIn.next(false);
        this.router.navigate(['/login']);
        return of(null);
      })
    );
  }
}
