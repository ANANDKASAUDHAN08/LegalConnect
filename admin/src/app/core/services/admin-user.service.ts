import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private readonly API = environment.apiUrl;

  private usersCache = new Map<string, any>();
  private consultationsCache = new Map<string, any>();
  private lastUsersCacheKey: string | null = null;
  private lastConsultationsCacheKey: string | null = null;

  constructor(private http: HttpClient) { }

  private getParamKey(params: any): string {
    return JSON.stringify(params || {});
  }

  getCachedUsers(params: any = {}): any | null {
    const key = this.getParamKey(params);
    return this.usersCache.get(key) || (this.lastUsersCacheKey ? this.usersCache.get(this.lastUsersCacheKey) : null);
  }

  clearUsersCache(): void {
    this.usersCache.clear();
    this.lastUsersCacheKey = null;
  }

  getCachedConsultations(params: any = {}): any | null {
    const key = this.getParamKey(params);
    return this.consultationsCache.get(key) || (this.lastConsultationsCacheKey ? this.consultationsCache.get(this.lastConsultationsCacheKey) : null);
  }

  clearConsultationsCache(): void {
    this.consultationsCache.clear();
    this.lastConsultationsCacheKey = null;
  }

  // ── User Management ──
  getUsers(params: any = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get<any>(`${this.API}/users`, { params: httpParams }).pipe(
      tap((res: any) => {
        if (res && res.success) {
          const key = this.getParamKey(params);
          this.usersCache.set(key, res);
          this.lastUsersCacheKey = key;
        }
      })
    );
  }

  getUser(id: number): Observable<any> {
    return this.http.get(`${this.API}/users/${id}`);
  }

  updateUser(id: number, data: any): Observable<any> {
    this.clearUsersCache();
    return this.http.put(`${this.API}/users/${id}`, data);
  }

  deleteUser(id: number): Observable<any> {
    this.clearUsersCache();
    return this.http.delete(`${this.API}/users/${id}`);
  }

  resetUserPassword(id: number): Observable<any> {
    return this.http.post(`${this.API}/users/${id}/reset-password`, {});
  }

  bulkUpdateUserStatus(userIds: number[], isActive: boolean): Observable<any> {
    this.clearUsersCache();
    return this.http.post(`${this.API}/users/bulk-status`, { userIds, isActive });
  }

  revokeUserSessions(id: number): Observable<any> {
    return this.http.post(`${this.API}/users/${id}/revoke-sessions`, {});
  }

  verifyUserEmail(id: number): Observable<any> {
    return this.http.post(`${this.API}/users/${id}/verify-email`, {});
  }

  updateUserRole(id: number, role: string): Observable<any> {
    this.clearUsersCache();
    return this.http.put(`${this.API}/users/${id}/role`, { role });
  }

  getUserAuditLog(id: number): Observable<any> {
    return this.http.get(`${this.API}/users/${id}/audit-log`);
  }

  impersonateUser(id: number): Observable<any> {
    return this.http.post(`${this.API}/users/${id}/impersonate`, {});
  }

  // ── Lawyer Management & Verification Queue ──
  getLawyers(params: any = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get(`${this.API}/lawyers`, { params: httpParams });
  }

  getLawyer(id: number): Observable<any> {
    return this.http.get(`${this.API}/lawyers/${id}`);
  }

  verifyLawyer(id: number, statusData: { isVerified: boolean; remarks?: string }): Observable<any> {
    return this.http.put(`${this.API}/lawyers/${id}/verify`, statusData);
  }

  updateLawyerProfile(id: number, data: any): Observable<any> {
    return this.http.put(`${this.API}/lawyers/${id}/profile`, data);
  }

  bulkVerifyLawyers(lawyerIds: number[], isVerified: boolean): Observable<any> {
    return this.http.post(`${this.API}/lawyers/bulk-verify`, { lawyerIds, isVerified });
  }

  // ── Sessions ──
  getActiveSessions(page = 1): Observable<any> {
    return this.http.get(`${this.API}/sessions`, { params: { page, limit: 20 } });
  }

  forceLogout(sessionId: number): Observable<any> {
    return this.http.delete(`${this.API}/sessions/${sessionId}`);
  }

  // ── Login History ──
  getLoginHistory(params: any = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get(`${this.API}/login-history`, { params: httpParams });
  }

  // ── Reviews ──
  getReviews(params: any = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get(`${this.API}/reviews`, { params: httpParams });
  }

  deleteReview(id: number): Observable<any> {
    return this.http.delete(`${this.API}/reviews/${id}`);
  }

  // ── Consultations ──
  getConsultations(params: any = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get<any>(`${this.API}/consultations`, { params: httpParams }).pipe(
      tap((res: any) => {
        if (res && res.success) {
          const key = this.getParamKey(params);
          this.consultationsCache.set(key, res);
          this.lastConsultationsCacheKey = key;
        }
      })
    );
  }

  updateConsultationStatus(id: number, status: string): Observable<any> {
    this.clearConsultationsCache();
    return this.http.put(`${this.API}/consultations/${id}/status`, { status });
  }

  bulkUpdateConsultationStatus(consultationIds: number[], status: string): Observable<any> {
    this.clearConsultationsCache();
    return this.http.post(`${this.API}/consultations/bulk-status`, { consultationIds, status });
  }

  updateConsultationNotes(id: number, adminRemark: string): Observable<any> {
    return this.http.put(`${this.API}/consultations/${id}/notes`, { adminRemark });
  }

  dispatchConsultationEmail(id: number, data: { template: string; recipient: string; customMessage?: string }): Observable<any> {
    return this.http.post(`${this.API}/consultations/${id}/dispatch-email`, data);
  }

  // ── Announcements ──
  getAnnouncements(): Observable<any> {
    return this.http.get(`${this.API}/announcements`);
  }

  createAnnouncement(data: any): Observable<any> {
    return this.http.post(`${this.API}/announcements`, data);
  }

  updateAnnouncement(id: number, data: any): Observable<any> {
    return this.http.put(`${this.API}/announcements/${id}`, data);
  }

  deleteAnnouncement(id: number): Observable<any> {
    return this.http.delete(`${this.API}/announcements/${id}`);
  }

  // ── Contacts ──
  getContacts(params: any = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get(`${this.API}/contacts`, { params: httpParams });
  }

  updateContactStatus(id: number, status: string): Observable<any> {
    return this.http.put(`${this.API}/contacts/${id}/status`, { status });
  }

  // ── Admin Account Self-Service ──
  changeOwnPassword(data: { currentPassword: string; newPassword: string }): Observable<any> {
    return this.http.put(`${this.API}/account/password`, data);
  }

  setup2FA(): Observable<any> {
    return this.http.post(`${this.API}/account/2fa/setup`, {});
  }

  verify2FA(code: string): Observable<any> {
    return this.http.post(`${this.API}/account/2fa/verify`, { code });
  }

  disable2FA(password: string): Observable<any> {
    return this.http.post(`${this.API}/account/2fa/disable`, { password });
  }

  getOwnSessions(): Observable<any> {
    return this.http.get(`${this.API}/account/sessions`);
  }

  revokeOwnSession(sessionId: number): Observable<any> {
    return this.http.delete(`${this.API}/account/sessions/${sessionId}`);
  }

  revokeAllOtherSessions(): Observable<any> {
    return this.http.delete(`${this.API}/account/sessions/revoke-others`);
  }

  updateOwnProfile(data: any): Observable<any> {
    return this.http.put(`${this.API}/account/profile`, data);
  }

  getAccountAuditLog(): Observable<any> {
    return this.http.get(`${this.API}/account/audit-log`);
  }
}