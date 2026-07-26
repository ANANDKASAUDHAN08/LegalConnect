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
}