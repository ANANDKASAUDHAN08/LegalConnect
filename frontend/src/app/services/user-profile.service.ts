import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, tap } from 'rxjs';
import { UserProfile } from './auth.service';
import { normalizeObjectMediaUrls } from '../core/utils/url-utils';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private apiUrl = '/api/profile';

  private httpOptions = {
    withCredentials: true
  };

  // In-memory cache for pending setup data (dies on page refresh, safe)
  private pendingSetupData: any = null;

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

  get2FASetup(forceRefresh = false): Observable<any> {
    if (this.pendingSetupData && !forceRefresh) {
      return of(this.pendingSetupData);
    }
    const url = forceRefresh ? `${this.apiUrl}/2fa/setup?force=true` : `${this.apiUrl}/2fa/setup`;
    return this.http.get<any>(url, this.httpOptions).pipe(
      tap(data => { this.pendingSetupData = data; })
    );
  }

  clearPendingSetupCache(): void {
    this.pendingSetupData = null;
  }

  reconfigure2FA(password: string): Observable<any> {
    this.pendingSetupData = null;
    return this.http.post<any>(`${this.apiUrl}/2fa/reconfigure`, { password }, this.httpOptions);
  }

  cancelReconfigure2FA(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/2fa/reconfigure/cancel`, {}, this.httpOptions);
  }

  getBackupCodes(password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/2fa/backup-codes`, { password }, this.httpOptions);
  }

  regenerateBackupCodes(password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/2fa/backup-codes/regenerate`, { password }, this.httpOptions);
  }

  toggle2FA(enable: boolean, code: string, password?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/2fa/toggle`, { enable, code, password }, this.httpOptions);
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