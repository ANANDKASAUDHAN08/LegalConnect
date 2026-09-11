import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, of } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface AdminUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string;
  isTwoFactorEnabled?: boolean;
  lastLoginAt?: string;
  lastIpAddress?: string;
  createdAt?: string;
  backupCodeCount?: number;
  mustChangePassword?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly API_URL = environment.apiUrl;

  private tokenSubject = new BehaviorSubject<string | null>(null);
  private userSubject = new BehaviorSubject<AdminUser | null>(null);
  private loadedSubject = new BehaviorSubject<boolean>(false);

  token$ = this.tokenSubject.asObservable();
  user$ = this.userSubject.asObservable();
  isLoaded$ = this.loadedSubject.asObservable();

  get token(): string | null { return this.tokenSubject.value; }
  get user(): AdminUser | null { return this.userSubject.value; }
  get isAuthenticated(): boolean { return !!this.token && !!this.user; }

  private adminChannel: BroadcastChannel | null = null;

  constructor(private http: HttpClient, private router: Router) {
    this.initMultiTabSync();
    this.restoreSession();
  }

  private initMultiTabSync(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.adminChannel = new BroadcastChannel('lc_admin_auth_sync');
        this.adminChannel.onmessage = (event) => {
          if (event.data?.type === 'LOGOUT') {
            this.clearSession(false);
            this.router.navigate(['/login']);
          } else if (event.data?.type === 'LOGIN') {
            this.restoreSession();
          }
        };
      } catch {
        // Fallback
      }
    }
  }

  private broadcastAuthEvent(type: 'LOGIN' | 'LOGOUT'): void {
    if (this.adminChannel) {
      try {
        this.adminChannel.postMessage({ type });
      } catch {
        // Ignore
      }
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return false;
      const decodedJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(decodedJson);
      if (payload && payload.exp) {
        const nowSec = Math.floor(Date.now() / 1000);
        return payload.exp < nowSec;
      }
      return false;
    } catch {
      return false;
    }
  }

  private restoreSession(): void {
    // Purge legacy localStorage entries to ensure security hardening
    localStorage.removeItem('lc_admin_token');
    localStorage.removeItem('lc_admin_user');

    const token = sessionStorage.getItem('lc_admin_token');
    const savedUser = sessionStorage.getItem('lc_admin_user');

    if (token && savedUser) {
      if (this.isTokenExpired(token)) {
        console.warn('[AdminAuthService] Stored admin JWT token is expired. Clearing session...');
        this.clearSession();
        this.loadedSubject.next(true);
        return;
      }

      try {
        const userObj = JSON.parse(savedUser);
        this.tokenSubject.next(token);
        this.userSubject.next(userObj);
        // Mark as loaded SYNCHRONOUSLY so Angular Router permits instant page access
        this.loadedSubject.next(true);

        // Perform background verification without blocking the route
        this.http.get<any>(`${this.API_URL}/me`).subscribe({
          next: (res: any) => {
            this.userSubject.next(res);
            sessionStorage.setItem('lc_admin_user', JSON.stringify(res));
          },
          error: (err: HttpErrorResponse) => {
            // ONLY log out if the backend explicitly returned a 401 Unauthorized status
            if (err.status === 401 || err.status === 403) {
              console.warn('Admin token expired or invalid (401/403). Clearing session...');
              this.clearSession();
              this.router.navigate(['/login']);
            }
          }
        });
        return;
      } catch {
        this.clearSession();
      }
    }

    this.loadedSubject.next(true);
  }

  login(email: string, password: string, twoFactorCode?: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/login`, {
      email,
      password,
      twoFactorCode
    }, { withCredentials: true }).pipe(
      tap((res: any) => {
        if (res.token) {
          sessionStorage.setItem('lc_admin_token', res.token);
          if (res.user) {
            sessionStorage.setItem('lc_admin_user', JSON.stringify(res.user));
            this.userSubject.next(res.user);
          }
          this.tokenSubject.next(res.token);
          this.loadedSubject.next(true);
          this.broadcastAuthEvent('LOGIN');
        }
      })
    );
  }

  /**
   * Refreshes the active in-memory and session storage credentials when a new
   * JWT is issued (e.g. following mandatory password rotation).
   */
  updateSessionToken(newToken: string): void {
    if (!newToken) return;
    sessionStorage.setItem('lc_admin_token', newToken);
    this.tokenSubject.next(newToken);
    if (this.user) {
      const updatedUser: AdminUser = { ...this.user, mustChangePassword: false };
      sessionStorage.setItem('lc_admin_user', JSON.stringify(updatedUser));
      this.userSubject.next(updatedUser);
    }
  }

  logout(): void {
    this.http.post(`${this.API_URL}/logout`, {}, {
      withCredentials: true,
      headers: { Authorization: `Bearer ${this.token}` }
    }).pipe(catchError(() => of(null))).subscribe(() => {
      this.clearSession();
      this.router.navigate(['/login']);
    });
  }

  handle401SessionExpired(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  /**
   * Dual-Transport Security Strategy:
   * 1. Primary: JWT Bearer Token stored in sessionStorage (tab-scoped) and attached to
   *    every API request via adminAuthInterceptor in the Authorization header.
   * 2. Secondary: HttpOnly lc_admin_token cookie managed by the backend for SSR / direct navigation.
   * 3. Terminating session revokes both localStorage/sessionStorage memory and cookie states.
   */
  private clearSession(shouldBroadcast = true): void {
    if (shouldBroadcast) {
      this.broadcastAuthEvent('LOGOUT');
    }
    sessionStorage.removeItem('lc_admin_token');
    sessionStorage.removeItem('lc_admin_user');
    localStorage.removeItem('lc_admin_token');
    localStorage.removeItem('lc_admin_user');
    if (typeof document !== 'undefined') {
      document.cookie = 'lc_admin_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Strict';
      document.cookie = 'lc_admin_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Lax';
    }
    this.tokenSubject.next(null);
    this.userSubject.next(null);
  }
}