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

  private getInitialToken(): string | null {
    try {
      return typeof window !== 'undefined' ? sessionStorage.getItem('lc_admin_token') : null;
    } catch {
      return null;
    }
  }

  /**
   * Stored in-memory with sessionStorage per-tab persistence to maintain
   * valid Authorization headers for cross-domain services (Node.js API) across refreshes.
   */
  private tokenSubject = new BehaviorSubject<string | null>(this.getInitialToken());
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

  private purgeAllLegacyStorage(): void {
    try {
      sessionStorage.removeItem('lc_admin_token');
      sessionStorage.removeItem('lc_admin_user');
      localStorage.removeItem('lc_admin_token');
      localStorage.removeItem('lc_admin_user');
    } catch {
      // Ignore storage access errors
    }
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

  /**
   * Cookie-authenticated session restoration.
   * On page load/refresh, calls /me with HttpOnly cookies to validate the session.
   * No tokens are read from storage — only from HttpOnly cookies sent by the browser.
   */
  private restoreSession(): void {
    this.http.get<any>(`${this.API_URL}/me`, { withCredentials: true }).subscribe({
      next: (res: any) => {
        if (res && res.id && (res.role === 'Admin' || res.role === 'SuperAdmin')) {
          this.userSubject.next(res);
          // Extract token from response if server provides it for Authorization header usage
          if (res.token) {
            this.tokenSubject.next(res.token);
            try { sessionStorage.setItem('lc_admin_token', res.token); } catch {}
          }
          this.loadedSubject.next(true);
        } else {
          // User is not admin or no valid session
          this.clearSession(false);
          this.loadedSubject.next(true);
        }
      },
      error: (_err: HttpErrorResponse) => {
        // No active session — normal for unauthenticated page loads
        this.clearSession(false);
        this.loadedSubject.next(true);
      }
    });
  }

  login(email: string, password: string, twoFactorCode?: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/login`, {
      email,
      password,
      twoFactorCode
    }, { withCredentials: true }).pipe(
      tap((res: any) => {
        if (res.token) {
          this.tokenSubject.next(res.token);
          try { sessionStorage.setItem('lc_admin_token', res.token); } catch {}

          if (res.user) {
            // M-06: Enforce admin role check — reject non-admin logins at client level
            if (res.user.role !== 'Admin' && res.user.role !== 'SuperAdmin') {
              this.clearSession(false);
              throw new Error('Access denied. This portal is restricted to administrators.');
            }
            this.userSubject.next(res.user);
          }
          this.loadedSubject.next(true);
          this.broadcastAuthEvent('LOGIN');
        }
      })
    );
  }

  /**
   * Refreshes the active in-memory credentials when a new JWT is issued
   * (e.g. following mandatory password rotation).
   */
  updateSessionToken(newToken: string): void {
    if (!newToken) return;
    this.tokenSubject.next(newToken);
    try { sessionStorage.setItem('lc_admin_token', newToken); } catch {}
    if (this.user) {
      const updatedUser: AdminUser = { ...this.user, mustChangePassword: false };
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
   * Enterprise Cookie-Only Security Strategy:
   * 1. Primary: HttpOnly cookie (lc_token / __session) managed by the backend — NOT accessible to JS.
   * 2. Supplementary: In-memory JWT in BehaviorSubject for Authorization header (never persisted).
   * 3. Session termination clears in-memory state + server revokes cookies.
   *
   * This eliminates XSS token exfiltration since JS cannot access HttpOnly cookies.
   */
  private clearSession(shouldBroadcast = true): void {
    if (shouldBroadcast) {
      this.broadcastAuthEvent('LOGOUT');
    }
    // Purge any legacy storage remnants
    this.purgeAllLegacyStorage();

    // Clear client-accessible non-HttpOnly cookie remnants (defense-in-depth)
    if (typeof document !== 'undefined') {
      document.cookie = 'lc_admin_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Strict';
      document.cookie = 'lc_admin_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Lax';
    }
    this.tokenSubject.next(null);
    this.userSubject.next(null);
  }
}