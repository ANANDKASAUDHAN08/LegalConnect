import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AdminStatsService } from './services/admin-stats.service';
import { AdminUserService } from './services/admin-user.service';
import { AdminContentService } from './services/admin-content.service';
import { BareAct, CreateActPayload, EditMetaPayload } from '../pages/legal-content/legal-content.models';

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

  // -- Telemetry SSE Stream Delegate --
  getTelemetryStream(): Observable<any> { return this.stats.getTelemetryStream(); }

  // -- Dashboard & Analytics Delegates --
  getOverview(): Observable<any> { return this.stats.getOverview(); }
  getHealth(): Observable<any> { return this.stats.getHealth(); }
  getNodeHealth(): Observable<any> { return this.stats.getNodeHealth(); }
  getRegistrationTrends(): Observable<any> { return this.stats.getRegistrationTrends(); }
  getLoginTrends(): Observable<any> { return this.stats.getLoginTrends(); }
  getConsultationTrends(): Observable<any> { return this.stats.getConsultationTrends(); }
  getReviewStats(): Observable<any> { return this.stats.getReviewStats(); }
  getCityStats(): Observable<any> { return this.stats.getCityStats(); }
  getSpecializationStats(): Observable<any> { return this.stats.getSpecializationStats(); }
  getConsentStats(): Observable<any> { return this.stats.getConsentStats(); }
  getTemplateStats(): Observable<any> { return this.stats.getTemplateStats(); }
  getBookmarkStats(): Observable<any> { return this.stats.getBookmarkStats(); }

  // -- User & Lawyer Management Delegates --
  getUsers(params: any = {}): Observable<any> { return this.user.getUsers(params); }
  getUser(id: number): Observable<any> { return this.user.getUser(id); }
  updateUser(id: number, data: any): Observable<any> { return this.user.updateUser(id, data); }
  deleteUser(id: number): Observable<any> { return this.user.deleteUser(id); }
  resetUserPassword(id: number): Observable<any> { return this.user.resetUserPassword(id); }
  bulkUpdateUserStatus(userIds: number[], isActive: boolean): Observable<any> { return this.user.bulkUpdateUserStatus(userIds, isActive); }
  revokeUserSessions(userId: number): Observable<any> { return this.user.revokeUserSessions(userId); }
  verifyUserEmail(userId: number): Observable<any> { return this.user.verifyUserEmail(userId); }
  updateUserRole(userId: number, role: string): Observable<any> { return this.user.updateUserRole(userId, role); }
  getUserAuditLog(id: number): Observable<any> { return this.user.getUserAuditLog(id); }
  impersonateUser(id: number): Observable<any> { return this.user.impersonateUser(id); }
  getLawyers(params: any = {}): Observable<any> { return this.user.getLawyers(params); }
  getLawyer(id: number): Observable<any> { return this.user.getLawyer(id); }
  verifyLawyer(id: number, statusData: { isVerified: boolean; remarks?: string }): Observable<any> { return this.user.verifyLawyer(id, statusData); }
  bulkVerifyLawyers(lawyerIds: number[], isVerified: boolean): Observable<any> { return this.user.bulkVerifyLawyers(lawyerIds, isVerified); }
  verifyBarRegistry(id: number): Observable<any> { return this.user.verifyBarRegistry(id); }
  getLawyerAuditLogs(id: number): Observable<any> { return this.user.getLawyerAuditLogs(id); }
  dispatchCopRenewalNotice(id: number): Observable<any> { return this.user.dispatchCopRenewalNotice(id); }
  updateLawyerProfile(id: number, data: any): Observable<any> { return this.user.updateLawyerProfile(id, data); }
  getActiveSessions(page = 1): Observable<any> { return this.user.getActiveSessions(page); }
  forceLogout(sessionId: number): Observable<any> { return this.user.forceLogout(sessionId); }
  getLoginHistory(params: any = {}): Observable<any> { return this.user.getLoginHistory(params); }

  // -- Reviews & Consultations Delegates --
  getReviews(params: any = {}): Observable<any> { return this.user.getReviews(params); }
  updateReviewModeration(id: number, data: any): Observable<any> { return this.user.updateReviewModeration(id, data); }
  getReviewAuditHistory(id: number): Observable<any> { return this.user.getReviewAuditHistory(id); }
  redactReviewContent(id: number, data: any): Observable<any> { return this.user.redactReviewContent(id, data); }
  autoSanitizeReviewContent(content: string): Observable<any> { return this.user.autoSanitizeReviewContent(content); }
  resolveReviewDispute(id: number, data: any): Observable<any> { return this.user.resolveReviewDispute(id, data); }
  deleteReview(id: number): Observable<any> { return this.user.deleteReview(id); }
  getConsultations(params: any = {}): Observable<any> { return this.user.getConsultations(params); }
  updateConsultationStatus(id: number, status: string): Observable<any> { return this.user.updateConsultationStatus(id, status); }
  bulkUpdateConsultationStatus(ids: number[], status: string): Observable<any> { return this.user.bulkUpdateConsultationStatus(ids, status); }
  updateConsultationNotes(id: number, adminRemark: string): Observable<any> { return this.user.updateConsultationNotes(id, adminRemark); }
  dispatchConsultationEmail(id: number, data: any): Observable<any> { return this.user.dispatchConsultationEmail(id, data); }

  // -- Announcements Delegates --
  getAnnouncements(params: any = {}): Observable<any> { return this.user.getAnnouncements(); }
  createAnnouncement(data: any): Observable<any> { return this.user.createAnnouncement(data); }
  updateAnnouncement(id: number, data: any): Observable<any> { return this.user.updateAnnouncement(id, data); }
  deleteAnnouncement(id: number): Observable<any> { return this.user.deleteAnnouncement(id); }

  // -- Contacts / Support Delegates --
  getContacts(params: any = {}): Observable<any> { return this.user.getContacts(params); }
  updateContactStatus(id: number | string, status: string): Observable<any> { return this.user.updateContactStatus(id, status); }
  updateContactTicket(id: number | string, data: any): Observable<any> { return this.user.updateContactTicket(id, data); }

  // -- Bare Acts Delegates --
  getActs(): Observable<any> { return this.content.getActs(); }
  createAct(data: CreateActPayload | any): Observable<BareAct> { return this.content.createAct(data); }
  getActDetail(shortName: string): Observable<BareAct> { return this.content.getActDetail(shortName); }
  updateSection(shortName: string, sectionId: string, data: any): Observable<any> { return this.content.updateSection(shortName, sectionId, data); }
  translateSectionWithAi(data: any): Observable<any> { return this.content.translateSectionWithAi(data); }
  enhanceSectionWithAi(data: any): Observable<any> { return this.content.enhanceSectionWithAi(data); }
  patchActMetadata(shortName: string, data: EditMetaPayload): Observable<any> { return this.content.patchActMetadata(shortName, data); }
  deleteAct(shortName: string): Observable<any> { return this.content.deleteAct(shortName); }
  getFavorites(): Observable<any> { return this.content.getFavorites(); }
  toggleFavorite(shortName: string): Observable<any> { return this.content.toggleFavorite(shortName); }
  getPinnedSections(shortName: string): Observable<{ success: boolean; data: string[] }> { return this.content.getPinnedSections(shortName); }
  togglePinnedSection(shortName: string, sectionId: string): Observable<any> { return this.content.togglePinnedSection(shortName, sectionId); }
  syncPinnedSections(shortName: string, sectionIds: string[]): Observable<any> { return this.content.syncPinnedSections(shortName, sectionIds); }

  // -- Resources Delegates --
  getResources(params: any = {}): Observable<any> { return this.content.getResources(params); }
  createResource(data: any): Observable<any> { return this.content.createResource(data); }
  updateResource(id: any, data: any): Observable<any> { return this.content.updateResource(String(id), data); }
  deleteResource(id: any): Observable<any> { return this.content.deleteResource(String(id)); }
  validateResourceBatch(items: any[]): Observable<any> { return this.content.validateResourceBatch(items); }
  importResourceBatch(items: any[], duplicateStrategy: string = 'skip'): Observable<any> { return this.content.importResourceBatch(items, duplicateStrategy); }
  verifyResourceCycle(id: any, data: any = {}): Observable<any> { return this.content.verifyResourceCycle(String(id), data); }
  bulkUpdateResourceStatus(ids: string[], status: string): Observable<any> { return this.content.bulkUpdateResourceStatus(ids, status); }
  bulkVerifyResourceCycles(ids: string[], notes?: string): Observable<any> { return this.content.bulkVerifyResourceCycles(ids, notes); }
  bulkDeleteResources(ids: string[]): Observable<any> { return this.content.bulkDeleteResources(ids); }

  // -- Helplines Delegates --
  getHelplines(params: any = {}): Observable<any> { return this.content.getHelplines(params); }
  createHelpline(data: any): Observable<any> { return this.content.createHelpline(data); }
  updateHelpline(id: any, data: any): Observable<any> { return this.content.updateHelpline(String(id), data); }
  deleteHelpline(id: any): Observable<any> { return this.content.deleteHelpline(String(id)); }
  verifyHelplinePing(id: any, data: any = {}): Observable<any> { return this.content.verifyHelplinePing(String(id), data); }
  bulkUpdateHelplineStatus(ids: string[], isActive: boolean): Observable<any> { return this.content.bulkUpdateHelplineStatus(ids, isActive); }

  // -- Templates Delegates --
  getTemplates(params: any = {}): Observable<any> { return this.content.getTemplates(params); }
  deleteTemplate(id: string): Observable<any> { return this.content.deleteTemplate(id); }

  // -- Admin Account Self-Service Delegates --
  changeOwnPassword(data: { currentPassword: string; newPassword: string }): Observable<any> { return this.user.changeOwnPassword(data); }
  setup2FA(): Observable<any> { return this.user.setup2FA(); }
  verify2FA(code: string): Observable<any> { return this.user.verify2FA(code); }
  disable2FA(password: string): Observable<any> { return this.user.disable2FA(password); }
  getOwnSessions(): Observable<any> { return this.user.getOwnSessions(); }
  revokeOwnSession(sessionId: number): Observable<any> { return this.user.revokeOwnSession(sessionId); }
  revokeAllOtherSessions(): Observable<any> { return this.user.revokeAllOtherSessions(); }
  updateOwnProfile(data: any): Observable<any> { return this.user.updateOwnProfile(data); }
  getAccountAuditLog(): Observable<any> { return this.user.getAccountAuditLog(); }

  // -- Saved Views Cloud Persistence Delegates --
  getSavedViews(pageKey: string): Observable<any> { return this.user.getSavedViews(pageKey); }
  saveSavedView(dto: { pageKey: string; name: string; paramsJson: string }): Observable<any> { return this.user.saveSavedView(dto); }
  deleteSavedView(id: string): Observable<any> { return this.user.deleteSavedView(id); }
}