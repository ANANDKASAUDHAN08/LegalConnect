import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SwrCacheService } from './admin-swr-cache.service';

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private readonly API = environment.apiUrl;

  constructor(
    private http: HttpClient,
    public swrCache: SwrCacheService
  ) { }

  getCachedUsers(params: any = {}): any | null {
    return this.swrCache.get('users', params);
  }

  clearUsersCache(): void {
    this.swrCache.invalidate('users');
  }

  getCachedConsultations(params: any = {}): any | null {
    return this.swrCache.get('consultations', params);
  }

  clearConsultationsCache(): void {
    this.swrCache.invalidate('consultations');
  }

  // -- User Management --
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
          this.swrCache.set('users', params, res);
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

  // -- Lawyer Management & Verification Queue --
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

  verifyBarRegistry(id: number): Observable<any> {
    return this.http.post(`${this.API}/lawyers/${id}/verify-bar-registry`, {});
  }

  getLawyerAuditLogs(id: number): Observable<any> {
    return this.http.get(`${this.API}/lawyers/${id}/audit-logs`);
  }

  dispatchCopRenewalNotice(id: number): Observable<any> {
    return this.http.post(`${this.API}/lawyers/${id}/dispatch-cop-renewal`, {});
  }

  // -- Sessions --
  getActiveSessions(page = 1): Observable<any> {
    return this.http.get(`${this.API}/sessions`, { params: { page, limit: 20 } });
  }

  forceLogout(sessionId: number): Observable<any> {
    return this.http.delete(`${this.API}/sessions/${sessionId}`);
  }

  // -- Login History --
  getLoginHistory(params: any = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get(`${this.API}/login-history`, { params: httpParams });
  }

  // -- Reviews --
  getReviews(params: any = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get(`${this.API}/reviews`, { params: httpParams });
  }

  updateReviewModeration(id: number, data: { moderationStatus?: string; flagReason?: string; advocateReply?: string; advocateReplyStatus?: string; reasonCode?: string; notes?: string }): Observable<any> {
    return this.http.put(`${this.API}/reviews/${id}/moderation`, data);
  }

  getReviewAuditHistory(id: number): Observable<any> {
    return this.http.get(`${this.API}/reviews/${id}/history`);
  }

  redactReviewContent(id: number, data: { redactedContent: string; reasonCode?: string; notes?: string }): Observable<any> {
    return this.http.put(`${this.API}/reviews/${id}/redact`, data);
  }

  resolveReviewDispute(id: number, data: { decision: 'Upheld' | 'Rejected'; rationale?: string }): Observable<any> {
    return this.http.put(`${this.API}/reviews/${id}/dispute`, data);
  }

  deleteReview(id: number): Observable<any> {
    return this.http.delete(`${this.API}/reviews/${id}`);
  }

  // -- Consultations --
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
          this.swrCache.set('consultations', params, res);
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

  // -- Announcements --
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

  // -- Contacts --
  getContacts(params: any = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get(`${this.API}/contacts`, { params: httpParams });
  }

  updateContactStatus(id: number | string, status: string): Observable<any> {
    return this.http.put(`${this.API}/contacts/${id}/status`, { status });
  }

  updateContactTicket(id: number | string, data: { status?: string; priority?: string; category?: string; assignedAgent?: string; resolutionNote?: string; internalNotesJson?: string }): Observable<any> {
    return this.http.put(`${this.API}/contacts/${id}/status`, data);
  }

  // -- Admin Account Self-Service --
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

  // -- Saved Views Cloud Persistence --
  getSavedViews(pageKey: string): Observable<any> {
    return this.http.get(`${this.API}/AdminSavedViews`, { params: { pageKey } });
  }

  saveSavedView(dto: { pageKey: string; name: string; paramsJson: string }): Observable<any> {
    return this.http.post(`${this.API}/AdminSavedViews`, dto);
  }

  deleteSavedView(id: string): Observable<any> {
    return this.http.delete(`${this.API}/AdminSavedViews/${id}`);
  }
}