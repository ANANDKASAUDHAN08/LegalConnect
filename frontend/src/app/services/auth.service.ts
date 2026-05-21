import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, tap } from 'rxjs';
import { Router } from '@angular/router';

export interface AuthUser {
  token: string;
}

export interface UserProfile {
  id: number;
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'http://localhost:5001/api/auth';
  private tokenKey = 'lc_token';

  private _isLoggedIn = new BehaviorSubject<boolean>(this.hasToken());
  isLoggedIn$ = this._isLoggedIn.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  private hasToken(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.getToken()}` });
  }

  register(data: { fullName: string; email: string; password: string; role: string }) {
    return this.http.post(`${this.apiUrl}/register`, data);
  }

  login(data: { email: string; password: string }) {
    return this.http.post<AuthUser>(`${this.apiUrl}/login`, data).pipe(
      tap(res => {
        localStorage.setItem(this.tokenKey, res.token);
        this._isLoggedIn.next(true);
      })
    );
  }

  getProfile() {
    return this.http.get<UserProfile>(`${this.apiUrl}/me`, { headers: this.authHeaders() });
  }

  updateProfile(fullName: string) {
    return this.http.put<{ message: string; fullName: string }>(`${this.apiUrl}/me`, { fullName }, { headers: this.authHeaders() });
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http.put<{ message: string }>(`${this.apiUrl}/change-password`, { currentPassword, newPassword }, { headers: this.authHeaders() });
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    this._isLoggedIn.next(false);
    this.router.navigate(['/login']);
  }
}
