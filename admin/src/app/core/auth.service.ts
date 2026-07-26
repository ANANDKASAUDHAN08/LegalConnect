import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, of } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface AdminUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string;
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

  constructor(private http: HttpClient, private router: Router) {
    this.restoreSession();
  }

  private restoreSession(): void {
    const token = localStorage.getItem('lc_admin_token');
    const savedUser = localStorage.getItem('lc_admin_user');

    if (token && savedUser) {
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
            localStorage.setItem('lc_admin_user', JSON.stringify(res));
          },
          error: (err: any) => {
            // ONLY log out if the backend explicitly returned a 401 Unauthorized status
            if (err.status === 401) {
              console.warn('Admin token expired or invalid (401). Clearing session...');
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
          localStorage.setItem('lc_admin_token', res.token);
          if (res.user) {
            localStorage.setItem('lc_admin_user', JSON.stringify(res.user));
            this.userSubject.next(res.user);
          }
          this.tokenSubject.next(res.token);
          this.loadedSubject.next(true);
        }
      })
    );
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

  private clearSession(): void {
    localStorage.removeItem('lc_admin_token');
    localStorage.removeItem('lc_admin_user');
    this.tokenSubject.next(null);
    this.userSubject.next(null);
  }
}