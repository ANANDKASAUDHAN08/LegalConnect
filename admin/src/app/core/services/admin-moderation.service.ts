import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

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
  reasonCategory: string;
  description: string;
  evidenceUrl?: string;
  status: 'Pending' | 'UnderReview' | 'Resolved' | 'Dismissed';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  duplicateCount: number;
  assignedAdminId?: number;
  moderatorNotes?: string;
  resolutionAction?: string;
  createdAt: string;
  reviewedAt?: string;
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

export interface ModerationFilterParams {
  status?: string;
  targetType?: string;
  severity?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminModerationService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/moderation`;

  // Reactive signals for admin dashboard
  pendingCount = signal(0);
  criticalCount = signal(0);
  latestStats = signal<ModerationStats | null>(null);

  /**
   * Get paginated moderation queue with filters
   */
  getQueue(params: ModerationFilterParams = {}): Observable<{
    success: boolean;
    data: ModerationReport[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  }> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.targetType) httpParams = httpParams.set('targetType', params.targetType);
    if (params.severity) httpParams = httpParams.set('severity', params.severity);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize.toString());
    if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);

    return this.http.get<any>(`${this.baseUrl}/queue`, { params: httpParams, withCredentials: true });
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
   * Resolve a report with specific action (ContentRemoved, WarningIssued, UserBanned, etc.)
   */
  resolveReport(reportId: number, action: string, notes: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/resolve`, { reportId, action, notes }, { withCredentials: true });
  }

  /**
   * Dismiss a report as false positive or invalid
   */
  dismissReport(reportId: number, notes: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/dismiss`, { reportId, notes }, { withCredentials: true });
  }

  /**
   * Bulk resolve multiple reports
   */
  bulkResolve(reportIds: number[], action: string, notes: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/bulk-resolve`, { reportIds, action, notes }, { withCredentials: true });
  }

  /**
   * Bulk dismiss multiple reports
   */
  bulkDismiss(reportIds: number[], notes: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/bulk-dismiss`, { reportIds, notes }, { withCredentials: true });
  }

  /**
   * Get audit trail for a report
   */
  getAuditTrail(reportId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/audit-trail/${reportId}`, { withCredentials: true });
  }
}