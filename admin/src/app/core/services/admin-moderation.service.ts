import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

import { SwrCacheService } from './admin-swr-cache.service';
import { ActivityStreamService } from './activity-stream.service';

export interface ReportNote {
  id: number;
  reportId: number;
  note: string;
  userId?: number;
  authorEmail: string;
  authorName: string;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════
//  DOMAIN MODEL DEFINITIONS & DATA CONTRACTS
// ═══════════════════════════════════════════════════════════════

export interface ModerationReport {
  id: number;
  reportRef: string;
  targetType: string;
  targetId: string;
  targetTitle: string;
  reporterUserId?: number;
  reporterName?: string;
  reporterEmail?: string;
  reporterIp?: string;
  clientFingerprint?: string;
  reasonCategory: string;
  description: string;
  evidenceUrl?: string;
  status: 'Pending' | 'UnderReview' | 'Investigating' | 'Resolved' | 'Dismissed';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  duplicateCount: number;
  assignedAdminId?: number;
  assignedAdminEmail?: string;
  moderatorNotes?: string;
  resolutionAction?: string;
  resolvedByAdminEmail?: string;
  createdAt: string;
  reviewedAt?: string;
  resolvedAt?: string;
  targetSnapshot?: Record<string, unknown> | null;
}

export interface ModerationStats {
  pendingCount: number;
  underReviewCount: number;
  resolvedTodayCount: number;
  criticalPendingCount: number;
  averageResolutionMinutes: number;
  reportsByType: Record<string, number>;
  reportsByReason: Record<string, number>;
}

export interface DailyVolumeTrend {
  date: string;
  label: string;
  incoming: number;
  resolved: number;
  dismissed: number;
}

export interface ModeratorThroughput {
  adminEmail: string;
  resolvedCount: number;
  dismissedCount: number;
  totalHandled: number;
  avgResolutionMinutes: number;
}

export interface ActionBreakdown {
  resolved: number;
  dismissed: number;
  reopened: number;
  escalated: number;
  claimed: number;
  notes: number;
}

export interface ModerationAnalyticsData {
  periodDays: number;
  totalIncoming: number;
  totalResolved: number;
  totalDismissed: number;
  complianceRatePercent: number;
  breachedCount: number;
  averageTriageLatencyMinutes: number;
  dailyTrends: DailyVolumeTrend[];
  actionBreakdown: ActionBreakdown;
  moderatorThroughput: ModeratorThroughput[];
  breachesBySeverity: Record<string, number>;
}

export interface ModerationQueueResponse {
  success: boolean;
  data: ModerationReport[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ModerationActionResponse {
  success: boolean;
  message: string;
  reportId?: number;
  action?: string;
  status?: string;
  resolvedAt?: string;
}

export interface ModerationClaimResponse {
  success: boolean;
  message: string;
  reportId: number;
  assignedAdminEmail?: string;
  assignedEmail?: string;
  assignedAt?: string;
}

export interface ModerationEscalateResponse {
  success: boolean;
  message: string;
  reportId: number;
  severity: string;
  escalatedAt: string;
}

export interface BulkActionResponse {
  success: boolean;
  message: string;
  affectedCount?: number;
  count?: number;
  reportIds?: number[];
}

export interface ModerationReopenResponse {
  success: boolean;
  message: string;
  reportId: number;
  status: string;
  reopenedAt: string;
}

export interface ModerationFilterParams {
  status?: string;
  targetType?: string;
  severity?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
}

/** Security audit log entry capturing forensic metadata, administrative actions, and actor attribution. */
export interface AuditLogEntry {
  id: number;
  userId?: number;
  eventType: string;
  severity: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: string;
  relatedReportId?: number;
  createdAt: string;
}

/** Discriminated union enabling compile-time type narrowing across heterogeneous moderated entity types. */
export interface ReviewPreview {
  targetType: 'Review';
  id: number;
  targetName: string;
  authorName: string;
  rating: number;
  content: string;
  moderationStatus: string;
  flagReason?: string;
  isVerifiedClient: boolean;
  advocateReply?: string;
  advocateReplyStatus?: string;
  createdAt: string;
}

export interface LawyerPreview {
  targetType: 'Lawyer';
  id: number;
  fullName: string;
  email: string;
  phone?: string;
  barCouncilNumber?: string;
  specialization?: string;
  city?: string;
  officeAddress?: string;
  experienceYears: number;
  isVerified: boolean;
  consultationFee?: number;
  casesCompleted?: number;
  successRate?: number;
  isActive: boolean;
}

export interface HelplinePreview {
  targetType: 'Helpline';
  id: number;
  name: string;
  number: string;
  categories: string;
  description?: string;
  isActive: boolean;
}

export interface LegalResourcePreview {
  targetType: 'LegalResource';
  id: string;
  name: string;
  resourceType: string;
  city: string;
  state: string;
  address: string;
  contactNumber?: string;
  website?: string;
  operatingHours?: string;
  operatingDays?: string;
  status: string;
  viewsCount: number;
  isVerified: boolean;
  categories: string[];
}

export interface GenericPreview {
  targetType: 'Generic' | 'BareActSection' | 'BareAct' | 'bareactsection' | 'Other' | 'Unknown';
  id?: string | number;
  message?: string;
  targetId?: string;
  name?: string;
  resourceType?: string;
  city?: string;
  state?: string;
  address?: string;
  contactNumber?: string;
  website?: string;
  operatingHours?: string;
  operatingDays?: string;
  status?: string;
  viewsCount?: number;
  isVerified?: boolean;
  categories?: string[];
  [key: string]: unknown;
}

export type TargetPreviewData = ReviewPreview | LawyerPreview | HelplinePreview | LegalResourcePreview | GenericPreview;

/** Protocol security validator preventing execution of malicious URI schemes (e.g. javascript:, vbscript:) in evidence previews. */
export function isValidEvidenceUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ['https:', 'http:', 'data:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

@Injectable({ providedIn: 'root' })
export class AdminModerationService {
  private http = inject(HttpClient);
  private swrCache = inject(SwrCacheService);
  private activityStream = inject(ActivityStreamService);
  private baseUrl = `${environment.apiUrl}/moderation`;

  /** Real-time moderation sync stream subscribed from centralized SignalR connection */
  readonly moderationUpdates$ = this.activityStream.moderationUpdate$.asObservable();

  // Reactive signals for admin dashboard
  pendingCount = signal(0);
  criticalCount = signal(0);
  latestStats = signal<ModerationStats | null>(null);

  getCachedQueue(params: ModerationFilterParams = {}): ModerationQueueResponse | null {
    return this.swrCache.get<ModerationQueueResponse>('moderation_queue', params);
  }

  clearQueueCache(): void {
    this.swrCache.invalidate('moderation_queue');
  }

  /**
   * Get paginated moderation queue with filters
   */
  getQueue(params: ModerationFilterParams = {}): Observable<ModerationQueueResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.targetType) httpParams = httpParams.set('targetType', params.targetType);
    if (params.severity) httpParams = httpParams.set('severity', params.severity);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.startDate) httpParams = httpParams.set('startDate', params.startDate);
    if (params.endDate) httpParams = httpParams.set('endDate', params.endDate);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize.toString());
    if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);

    return this.http.get<ModerationQueueResponse>(`${this.baseUrl}/queue`, { params: httpParams, withCredentials: true }).pipe(
      tap(res => {
        if (res && res.success) {
          this.swrCache.set('moderation_queue', params, res);
        }
      })
    );
  }

  /**
   * Get real-time moderation stats & telemetry
   */
  getStats(): Observable<{ success: boolean; data: ModerationStats }> {
    return this.http.get<{ success: boolean; data: ModerationStats }>(`${this.baseUrl}/stats`, { withCredentials: true })
      .pipe(
        tap(res => {
          if (res?.data) {
            this.latestStats.set(res.data);
            this.pendingCount.set(res.data.pendingCount || 0);
            this.criticalCount.set(res.data.criticalPendingCount || 0);
          }
        })
      );
  }

  /**
   * Fetch live record of the reported target entity (Review, Lawyer, Helpline, Resource)
   */
  getTargetPreview(targetType: string, targetId: string): Observable<{ success: boolean; data: TargetPreviewData }> {
    return this.http.get<{ success: boolean; data: TargetPreviewData }>(`${this.baseUrl}/target-preview/${targetType}/${targetId}`, { withCredentials: true });
  }

  /**
   * Resolve a report with specific action, notes, and cascading database enforcement
   */
  resolveReport(reportId: number, action: string, notes: string, cascadeEnforcement: boolean = true): Observable<ModerationActionResponse> {
    return this.http.post<ModerationActionResponse>(`${this.baseUrl}/resolve`, { reportId, action, notes, cascadeEnforcement }, { withCredentials: true }).pipe(
      tap(() => this.clearQueueCache())
    );
  }

  /**
   * Dismiss a report as false positive or invalid
   */
  dismissReport(reportId: number, notes: string, restoreTargetIfFlagged: boolean = true): Observable<ModerationActionResponse> {
    return this.http.post<ModerationActionResponse>(`${this.baseUrl}/dismiss`, { reportId, notes, restoreTargetIfFlagged }, { withCredentials: true }).pipe(
      tap(() => this.clearQueueCache())
    );
  }

  /**
   * Concurrency claim of report ticket
   */
  claimReport(reportId: number): Observable<ModerationClaimResponse> {
    return this.http.post<ModerationClaimResponse>(`${this.baseUrl}/${reportId}/claim`, {}, { withCredentials: true }).pipe(
      tap(() => this.clearQueueCache())
    );
  }

  /**
   * Escalate severity tier (e.g. to Critical)
   */
  escalateSeverity(reportId: number, severity: string, notes?: string): Observable<ModerationEscalateResponse> {
    return this.http.post<ModerationEscalateResponse>(`${this.baseUrl}/${reportId}/escalate`, { severity, notes }, { withCredentials: true }).pipe(
      tap(() => this.clearQueueCache())
    );
  }

  /**
   * Bulk resolve multiple reports
   */
  bulkResolve(reportIds: number[], action: string, notes: string, cascadeEnforcement: boolean = true): Observable<BulkActionResponse> {
    return this.http.post<BulkActionResponse>(`${this.baseUrl}/bulk-resolve`, { reportIds, action, notes, cascadeEnforcement }, { withCredentials: true }).pipe(
      tap(() => this.clearQueueCache())
    );
  }

  /**
   * Bulk dismiss multiple reports
   */
  bulkDismiss(reportIds: number[], notes: string, restoreTargetIfFlagged: boolean = true): Observable<BulkActionResponse> {
    return this.http.post<BulkActionResponse>(`${this.baseUrl}/bulk-dismiss`, { reportIds, notes, restoreTargetIfFlagged }, { withCredentials: true }).pipe(
      tap(() => this.clearQueueCache())
    );
  }

  /**
   * Retrieves the forensic compliance audit trail for a specific content report.
   */
  getAuditTrail(reportId: number): Observable<{ success: boolean; data: AuditLogEntry[] }> {
    return this.http.get<{ success: boolean; data: AuditLogEntry[] }>(`${this.baseUrl}/audit-trail/${reportId}`, { withCredentials: true });
  }

  /**
   * Streams the complete filtered moderation report dataset from the server (supports CSV and JSON formats).
   */
  exportQueue(params: ModerationFilterParams = {}, format: 'csv' | 'json' = 'csv'): Observable<Blob | { success: boolean; data: ModerationReport[] }> {
    let httpParams = new HttpParams().set('format', format);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.targetType) httpParams = httpParams.set('targetType', params.targetType);
    if (params.severity) httpParams = httpParams.set('severity', params.severity);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.startDate) httpParams = httpParams.set('startDate', params.startDate);
    if (params.endDate) httpParams = httpParams.set('endDate', params.endDate);

    if (format === 'csv') {
      return this.http.get(`${this.baseUrl}/export`, {
        params: httpParams,
        withCredentials: true,
        responseType: 'blob'
      });
    }
    return this.http.get<{ success: boolean; data: ModerationReport[] }>(`${this.baseUrl}/export`, { params: httpParams, withCredentials: true });
  }

  /**
   * Re-open a resolved or dismissed report ticket for forensic re-evaluation
   */
  reopenReport(reportId: number, reason: string, restoreTargetVisibility: boolean = false): Observable<ModerationReopenResponse> {
    return this.http.post<ModerationReopenResponse>(`${this.baseUrl}/${reportId}/reopen`, { reason, restoreTargetVisibility }, { withCredentials: true }).pipe(
      tap(() => this.clearQueueCache())
    );
  }

  /**
   * Retrieves internal moderator discussion thread for a ticket
   */
  getReportNotes(reportId: number): Observable<{ success: boolean; data: ReportNote[] }> {
    return this.http.get<{ success: boolean; data: ReportNote[] }>(`${this.baseUrl}/${reportId}/notes`, { withCredentials: true });
  }

  /**
   * Adds a private internal note to a ticket discussion thread
   */
  addReportNote(reportId: number, note: string): Observable<{ success: boolean; message: string; data: ReportNote }> {
    return this.http.post<{ success: boolean; message: string; data: ReportNote }>(`${this.baseUrl}/${reportId}/notes`, { note }, { withCredentials: true });
  }

  /**
   * Retrieves operational analytics, historical volume trends, and SLA metrics
   */
  getAnalytics(days: number = 7): Observable<{ success: boolean; data: ModerationAnalyticsData }> {
    return this.http.get<{ success: boolean; data: ModerationAnalyticsData }>(
      `${this.baseUrl}/analytics`,
      { params: { days: days.toString() }, withCredentials: true }
    );
  }

  /**
   * Triggers automated server-side scan to escalate breached tickets to Critical
   */
  triggerAutoEscalate(): Observable<{ success: boolean; escalatedCount: number; message: string }> {
    return this.http.post<{ success: boolean; escalatedCount: number; message: string }>(
      `${this.baseUrl}/auto-escalate`,
      {},
      { withCredentials: true }
    ).pipe(
      tap(() => this.clearQueueCache())
    );
  }
}