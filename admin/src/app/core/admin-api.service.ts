import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AdminStatsService } from './services/admin-stats.service';
import { AdminUserService } from './services/admin-user.service';
import { AdminContentService } from './services/admin-content.service';
import {
  DashboardOverview,
  UserListResponse,
  AdminUser,
  LawyerListResponse,
  LawyerProfile,
  HelplineItem,
  ResourceItem,
  AnnouncementItem,
  SupportTicketItem,
  ReviewItem,
  ConsultationItem
} from './models/admin-models';

/**
 * AdminApiService - Master Facade Service:
 * Decomposes master API responsibilities into 3 clean domain sub-services:
 * 1. AdminStatsService (KPIs, Telemetry, Trends)
 * 2. AdminUserService (Users, Lawyers, Sessions, Reviews, Support Contacts)
 * 3. AdminContentService (Acts, Resources, Helplines, Templates)
 * Maintains 100% backward compatibility for all Angular components!
 */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  constructor(
    public stats: AdminStatsService,
    public user: AdminUserService,
    public content: AdminContentService
  ) { }

  // ── Dashboard & Analytics Delegates ──
  getOverview(): Observable<DashboardOverview | any> { return this.stats.getOverview(); }
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
  getUsers(params: any = {}): Observable<UserListResponse | any> { return this.user.getUsers(params); }
  getUser(id: number): Observable<AdminUser | any> { return this.user.getUser(id); }
  updateUser(id: number, data: Partial<AdminUser> | any): Observable<any> { return this.user.updateUser(id, data); }
  deleteUser(id: number): Observable<any> { return this.user.deleteUser(id); }
  resetUserPassword(id: number): Observable<any> { return this.user.resetUserPassword(id); }
  getLawyers(params: any = {}): Observable<LawyerListResponse | any> { return this.user.getLawyers(params); }
  getLawyer(id: number): Observable<LawyerProfile | any> { return this.user.getLawyer(id); }
  verifyLawyer(id: number, statusData: { isVerified: boolean; remarks?: string }): Observable<any> { return this.user.verifyLawyer(id, statusData); }
  updateLawyerProfile(id: number, data: Partial<LawyerProfile> | any): Observable<any> { return this.user.updateLawyerProfile(id, data); }
  getActiveSessions(page = 1): Observable<any> { return this.user.getActiveSessions(page); }
  forceLogout(sessionId: number): Observable<any> { return this.user.forceLogout(sessionId); }
  getLoginHistory(params: any = {}): Observable<any> { return this.user.getLoginHistory(params); }
  getReviews(params: any = {}): Observable<ReviewItem[] | any> { return this.user.getReviews(params); }
  deleteReview(id: number): Observable<any> { return this.user.deleteReview(id); }
  getConsultations(params: any = {}): Observable<ConsultationItem[] | any> { return this.user.getConsultations(params); }
  updateConsultationStatus(id: number, status: string): Observable<any> { return this.user.updateConsultationStatus(id, status); }
  getAnnouncements(): Observable<AnnouncementItem[] | any> { return this.user.getAnnouncements(); }
  createAnnouncement(data: Partial<AnnouncementItem> | any): Observable<any> { return this.user.createAnnouncement(data); }
  updateAnnouncement(id: number, data: Partial<AnnouncementItem> | any): Observable<any> { return this.user.updateAnnouncement(id, data); }
  deleteAnnouncement(id: number): Observable<any> { return this.user.deleteAnnouncement(id); }
  getContacts(params: any = {}): Observable<SupportTicketItem[] | any> { return this.user.getContacts(params); }
  updateContactStatus(id: number, status: string): Observable<any> { return this.user.updateContactStatus(id, status); }

  // ── Legal Content & Catalog Delegates ──
  getActs(): Observable<any> { return this.content.getActs(); }
  getActDetail(shortName: string): Observable<any> { return this.content.getActDetail(shortName); }
  updateSection(shortName: string, sectionId: string, data: any): Observable<any> { return this.content.updateSection(shortName, sectionId, data); }
  getResources(params: any = {}): Observable<ResourceItem[] | any> { return this.content.getResources(params); }
  createResource(data: Partial<ResourceItem> | any): Observable<any> { return this.content.createResource(data); }
  updateResource(id: string, data: Partial<ResourceItem> | any): Observable<any> { return this.content.updateResource(id, data); }
  deleteResource(id: string): Observable<any> { return this.content.deleteResource(id); }
  getHelplines(): Observable<HelplineItem[] | any> { return this.content.getHelplines(); }
  createHelpline(data: Partial<HelplineItem> | any): Observable<any> { return this.content.createHelpline(data); }
  updateHelpline(id: string, data: Partial<HelplineItem> | any): Observable<any> { return this.content.updateHelpline(id, data); }
  deleteHelpline(id: string): Observable<any> { return this.content.deleteHelpline(id); }
  getTemplates(params: any = {}): Observable<any> { return this.content.getTemplates(params); }
  deleteTemplate(id: string): Observable<any> {
    this.stats.clearTemplateStatsCache();
    return this.content.deleteTemplate(id);
  }
}