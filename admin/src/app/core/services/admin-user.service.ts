import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private readonly API = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // ── User Management ──
  getUsers(params: any = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get(`${this.API}/users`, { params: httpParams });
  }

  getUser(id: number): Observable<any> {
    return this.http.get(`${this.API}/users/${id}`);
  }

  updateUser(id: number, data: any): Observable<any> {
    return this.http.put(`${this.API}/users/${id}`, data);
  }

  deleteUser(id: number): Observable<any> {
    return this.http.delete(`${this.API}/users/${id}`);
  }

  resetUserPassword(id: number): Observable<any> {
    return this.http.post(`${this.API}/users/${id}/reset-password`, {});
  }

  bulkUpdateUserStatus(userIds: number[], isActive: boolean): Observable<any> {
    return this.http.post(`${this.API}/users/bulk-status`, { userIds, isActive });
  }

  revokeUserSessions(id: number): Observable<any> {
    return this.http.post(`${this.API}/users/${id}/revoke-sessions`, {});
  }

  verifyUserEmail(id: number): Observable<any> {
    return this.http.post(`${this.API}/users/${id}/verify-email`, {});
  }

  updateUserRole(id: number, role: string): Observable<any> {
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
    return this.http.get(`${this.API}/consultations`, { params: httpParams });
  }

  updateConsultationStatus(id: number, status: string): Observable<any> {
    return this.http.put(`${this.API}/consultations/${id}/status`, { status });
  }

  bulkUpdateConsultationStatus(consultationIds: number[], status: string): Observable<any> {
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