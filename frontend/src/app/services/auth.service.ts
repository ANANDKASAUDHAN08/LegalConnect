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
    // Check initial session state on load
    this.checkSession().subscribe();

    // Sync auth state across multiple tabs
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
        this._currentUser.next(user);
        this._isLoggedIn.next(true);
        this._isSessionLoaded.next(true);
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

  login(data: { email: string; password: string }): Observable<boolean> {
    return this.http.post<any>(`${this.apiUrl}/login`, data, this.httpOptions).pipe(
      tap((res) => {
        this.token = res.token;
        localStorage.setItem('lc_token', res.token);
      }),
      switchMap(() => this.checkSession())
    );
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
    return this.http.get<UserProfile>(`${this.apiUrl}/me`, this.httpOptions);
  }

  updateProfile(fullName: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/me`, { fullName }, this.httpOptions);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/change-password`, { currentPassword, newPassword }, this.httpOptions);
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
        // Fallback cleanup in case of request issue
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
