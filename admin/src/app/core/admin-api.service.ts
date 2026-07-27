import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AdminStatsService } from './services/admin-stats.service';
import { AdminUserService } from './services/admin-user.service';
import { AdminContentService } from './services/admin-content.service';

/**
 * AdminApiService - Master Facade Service:
 * Delegates to domain sub-services and maintains 100% backward compatibility across all admin pages!
 */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  constructor(
    public stats: AdminStatsService,
    public user: AdminUserService,
    public content: AdminContentService
  ) { }

  // ── Dashboard & Analytics Delegates ──
  getOverview(): Observable<any> { return this.stats.getOverview(); }
  getHealth(): Observable<any> { return this.stats.getHealth(); }
  getRegistrationTrends(): Observable<any> { return this.stats.getRegistrationTrends(); }
  getLoginTrends(): Observable<any> { return this.stats.getLoginTrends(); }
  getConsultationTrends(): Observable<any> { return this.stats.getConsultationTrends(); }
  getReviewStats(): Observable<any> { return this.stats.getReviewStats(); }
  getCityStats(): Observable<any> { return this.stats.getCityStats(); }
  getSpecializationStats(): Observable<any> { return this.stats.getSpecializationStats(); }
  getConsentStats(): Observable<any> { return this.stats.getConsentStats(); }
  getTemplateStats(): Observable<any> { return this.stats.getTemplateStats(); }
  getBookmarkStats(): Observable<any> { return this.stats.getBookmarkStats(); }

  // ── User & Lawyer Management Delegates ──
  getUsers(params: any = {}): Observable<any> { return this.user.getUsers(params); }
  getUser(id: number): Observable<any> { return this.user.getUser(id); }
  updateUser(id: number, data: any): Observable<any> { return this.user.updateUser(id, data); }
  deleteUser(id: number): Observable<any> { return this.user.deleteUser(id); }
  resetUserPassword(id: number): Observable<any> { return this.user.resetUserPassword(id); }
  getLawyers(params: any = {}): Observable<any> { return this.user.getLawyers(params); }
  getLawyer(id: number): Observable<any> { return this.user.getLawyer(id); }
  verifyLawyer(id: number, statusData: { isVerified: boolean; remarks?: string }): Observable<any> { return this.user.verifyLawyer(id, statusData); }
  updateLawyerProfile(id: number, data: any): Observable<any> { return this.user.updateLawyerProfile(id, data); }
  getActiveSessions(page = 1): Observable<any> { return this.user.getActiveSessions(page); }
  forceLogout(sessionId: number): Observable<any> { return this.user.forceLogout(sessionId); }
  getLoginHistory(params: any = {}): Observable<any> { return this.user.getLoginHistory(params); }

  // ── Reviews & Consultations Delegates ──
  getReviews(params: any = {}): Observable<any> { return this.user.getReviews(params); }
  deleteReview(id: number): Observable<any> { return this.user.deleteReview(id); }
  getConsultations(params: any = {}): Observable<any> { return this.user.getConsultations(params); }
  updateConsultationStatus(id: number, status: string): Observable<any> { return this.user.updateConsultationStatus(id, status); }

  // ── Announcements Delegates ──
  getAnnouncements(params: any = {}): Observable<any> { return this.user.getAnnouncements(); }
  createAnnouncement(data: any): Observable<any> { return this.user.createAnnouncement(data); }
  updateAnnouncement(id: number, data: any): Observable<any> { return this.user.updateAnnouncement(id, data); }
  deleteAnnouncement(id: number): Observable<any> { return this.user.deleteAnnouncement(id); }

  // ── Contacts / Support Delegates ──
  getContacts(params: any = {}): Observable<any> { return this.user.getContacts(params); }
  updateContactStatus(id: number, status: string): Observable<any> { return this.user.updateContactStatus(id, status); }

  // ── Bare Acts Delegates ──
  getActs(): Observable<any> { return this.content.getActs(); }
  getActDetail(shortName: string): Observable<any> { return this.content.getActDetail(shortName); }
  updateSection(shortName: string, sectionId: string, data: any): Observable<any> { return this.content.updateSection(shortName, sectionId, data); }

  // ── Resources Delegates ──
  getResources(params: any = {}): Observable<any> { return this.content.getResources(params); }
  createResource(data: any): Observable<any> { return this.content.createResource(data); }
  updateResource(id: any, data: any): Observable<any> { return this.content.updateResource(String(id), data); }
  deleteResource(id: any): Observable<any> { return this.content.deleteResource(String(id)); }

  // ── Helplines Delegates ──
  getHelplines(params: any = {}): Observable<any> { return this.content.getHelplines(); }
  createHelpline(data: any): Observable<any> { return this.content.createHelpline(data); }
  updateHelpline(id: any, data: any): Observable<any> { return this.content.updateHelpline(String(id), data); }
  deleteHelpline(id: any): Observable<any> { return this.content.deleteHelpline(String(id)); }

  // ── Templates Delegates ──
  getTemplates(params: any = {}): Observable<any> { return this.content.getTemplates(params); }
  deleteTemplate(id: string): Observable<any> { return this.content.deleteTemplate(id); }
}