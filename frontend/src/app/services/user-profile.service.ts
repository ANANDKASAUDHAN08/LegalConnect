import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { UserProfile } from './auth.service';
import { normalizeObjectMediaUrls } from '../core/utils/url-utils';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private apiUrl = '/api/profile';

  private httpOptions = {
    withCredentials: true
  };

  constructor(private http: HttpClient) {}

  private normalizeProfile(profile: UserProfile): UserProfile {
    return normalizeObjectMediaUrls(profile, ['avatarUrl', 'identityDocumentUrl']);
  }

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/me`, this.httpOptions).pipe(
      map(profile => this.normalizeProfile(profile))
    );
  }

  updateProfile(data: Partial<UserProfile>): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/me`, data, this.httpOptions);
  }

  deleteAccount(): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/me`, this.httpOptions);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/change-password`, { currentPassword, newPassword }, this.httpOptions);
  }

  getSettings(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/settings`, this.httpOptions);
  }

  updateSettings(data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/settings`, data, this.httpOptions);
  }

  get2FASetup(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/2fa/setup`, this.httpOptions);
  }

  toggle2FA(enable: boolean, code: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/2fa/toggle`, { enable, code }, this.httpOptions);
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

  downloadDataDossier(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export-data`, {
      ...this.httpOptions,
      responseType: 'blob'
    });
  }
}