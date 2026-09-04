import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService, UserProfile } from './auth.service';

/**
 * Moderation Report Service
 *
 * Manages content report submission with:
 * - Dynamic reason taxonomy per entity type
 * - Auto-populated reporter info for authenticated users
 * - Guest/anonymous submission support
 * - SLA-aware response with ticket reference IDs
 */

export interface ReportReason {
  key: string;
  label: string;
  icon: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface UserReportRecord {
  targetType: string;
  targetId: string;
  targetTitle: string;
  reasonCategory: string;
  referenceId: string;
  status: 'submitted' | 'under_review' | 'resolved' | 'dismissed';
  createdAt: number;
  severity?: string;
  estimatedReviewTime?: string;
  description?: string;
}

export interface ReportSubmission {
  targetType: string;
  targetId: string;
  targetTitle: string;
  reasonCategory: string;
  description: string;
  evidenceUrl?: string;
  reporterName?: string;
  reporterEmail?: string;
  clientFingerprint?: string;
}

export interface ReportResponse {
  success: boolean;
  message: string;
  referenceId: string;
  severity?: string;
  estimatedReviewTime?: string;
  isDuplicate?: boolean;
}

const LOCAL_STORAGE_KEY = 'lc_user_reports';
const MAX_STORED_REPORTS = 50;
const REPORT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 Days

@Injectable({ providedIn: 'root' })
export class ModerationReportService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private apiUrl = '/api/contentreport';

  // ── Modal State ──
  isModalOpen = signal(false);
  currentTarget = signal<{
    targetType: string;
    targetId: string;
    targetTitle: string;
  } | null>(null);

  // ── User Submitted Reports Signal Store ──
  private reportsStore = signal<Map<string, UserReportRecord>>(new Map());

  // ── In-Memory Taxonomy Cache ──
  private taxonomyCache = new Map<string, ReportReason[]>();

  constructor() {
    this.loadReportsFromStorage();

    // Hybrid Sync: Sync real backend reports whenever user logs in
    this.auth.isLoggedIn$.subscribe(isLoggedIn => {
      if (isLoggedIn) {
        this.syncServerReports();
      }
    });
  }

  private getReportKey(targetType: string, targetId: string): string {
    return `${targetType}:${targetId}`;
  }

  private loadReportsFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as UserReportRecord[];
        const map = new Map<string, UserReportRecord>();
        const now = Date.now();

        // Filter expired records (> 30 days) and cap
        const valid = arr
          .filter(item => now - item.createdAt < REPORT_TTL_MS)
          .slice(-MAX_STORED_REPORTS);

        for (const item of valid) {
          map.set(this.getReportKey(item.targetType, item.targetId), item);
        }
        this.reportsStore.set(map);
      }
    } catch {
      // Storage unavailable or corrupted
    }
  }

  private saveReportsToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const arr = Array.from(this.reportsStore().values()).slice(-MAX_STORED_REPORTS);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(arr));
    } catch {
      // Storage unavailable
    }
  }

  /**
   * Sync active reports from backend database for authenticated users (MNC standard).
   * Updates real-time moderation status (Pending -> UnderReview -> Resolved) and syncs across devices.
   */
  /**
   * Sync active reports from backend database for authenticated users (MNC standard).
   * Updates real-time moderation status (Pending -> UnderReview -> Resolved) and syncs across devices.
   */
  async syncServerReports(): Promise<void> {
    try {
      const res = await firstValueFrom(this.getMyReports(1, 50));
      if (res?.data && Array.isArray(res.data)) {
        this.reportsStore.update(map => {
          // Re-build active user reports from authoritative server truth
          const next = new Map(map);

          // Track which server keys are currently active
          const activeServerKeys = new Set<string>();

          for (const serverReport of res.data) {
            const statusRaw = (serverReport.status || '').toLowerCase();
            // If report is dismissed or resolved, do not treat as an active blocker
            if (statusRaw === 'dismissed' || statusRaw === 'resolved') {
              continue;
            }

            const key = this.getReportKey(serverReport.targetType, serverReport.targetId);
            activeServerKeys.add(key);

            next.set(key, {
              targetType: serverReport.targetType,
              targetId: serverReport.targetId,
              targetTitle: serverReport.targetTitle,
              reasonCategory: serverReport.reasonCategory,
              referenceId: serverReport.referenceId || `LC-REP-${serverReport.id}`,
              status: 'under_review',
              createdAt: serverReport.createdAt ? new Date(serverReport.createdAt).getTime() : Date.now(),
              severity: serverReport.severity,
              description: serverReport.description
            });
          }

          // If user is authenticated, remove any stale reports that no longer exist on server
          for (const [k, v] of next.entries()) {
            if (!activeServerKeys.has(k)) {
              next.delete(k);
            }
          }

          return next;
        });
        this.saveReportsToStorage();
      }
    } catch {
      // Offline or network error - gracefully rely on local cache
    }
  }

  /**
   * Check if the current user/device has already reported this target (O(1) Signal check).
   */
  hasReported(targetType: string, targetId: string): boolean {
    return this.reportsStore().has(this.getReportKey(targetType, targetId));
  }

  /**
   * Get active report record for this target.
   */
  getReport(targetType: string, targetId: string): UserReportRecord | null {
    return this.reportsStore().get(this.getReportKey(targetType, targetId)) || null;
  }

  /**
   * Save a local report record.
   */
  saveLocalReport(record: UserReportRecord): void {
    this.reportsStore.update(map => {
      const next = new Map(map);
      next.set(this.getReportKey(record.targetType, record.targetId), record);
      return next;
    });
    this.saveReportsToStorage();
  }

  /**
   * Withdraw / dismiss an active report record on both client and backend database.
   */
  async withdrawReport(targetType: string, targetId: string): Promise<any> {
    // 1. Instantly delete from local reactive signal store & localStorage
    this.reportsStore.update(map => {
      const next = new Map(map);
      next.delete(this.getReportKey(targetType, targetId));
      return next;
    });
    this.saveReportsToStorage();

    // 2. Call backend withdraw endpoint to permanently mark report as Dismissed
    try {
      return await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/withdraw`, {
          targetType,
          targetId,
          clientFingerprint: this.generateFingerprint()
        }, { withCredentials: true })
      );
    } catch {
      // Optimistic offline mode - local withdrawal persists
      return { success: true };
    }
  }

  // ── Fallback Reason Taxonomy (Resilience for Offline / Error state) ──
  private readonly FALLBACK_TAXONOMY: Record<string, ReportReason[]> = {
    'Review': [
      { key: 'SPAM', label: 'Spam or Fake Review', icon: 'shield-alert', severity: 'High' },
      { key: 'ABUSIVE_LANGUAGE', label: 'Abusive or Hateful Language', icon: 'message-circle-warning', severity: 'High' },
      { key: 'PII_LEAK', label: 'Contains Personal Information (Aadhaar, Phone, etc.)', icon: 'eye-off', severity: 'Critical' },
      { key: 'FAKE_REVIEW', label: 'Fake or Misleading Review', icon: 'user-x', severity: 'High' },
      { key: 'IRRELEVANT', label: 'Irrelevant or Off-Topic', icon: 'x-circle', severity: 'Low' },
    ],
    'LegalResource': [
      { key: 'CLOSED_PERMANENTLY', label: 'Permanently Closed or Shifted', icon: 'building', severity: 'High' },
      { key: 'WRONG_ADDRESS', label: 'Incorrect Address or Coordinates', icon: 'map-pin', severity: 'Medium' },
      { key: 'WRONG_PHONE', label: 'Wrong or Disconnected Phone Number', icon: 'phone', severity: 'Medium' },
      { key: 'BRIBERY_ALLEGATION', label: 'Corruption / Bribery Demand', icon: 'alert-triangle', severity: 'Critical' },
      { key: 'FACILITIES_CHANGED', label: 'Facilities Information Outdated', icon: 'refresh-cw', severity: 'Low' },
    ],
    'Lawyer': [
      { key: 'FAKE_REGISTRATION', label: 'Fake Bar Council Registration', icon: 'user-x', severity: 'Critical' },
      { key: 'NOT_PRACTICING', label: 'No Longer Practicing', icon: 'briefcase', severity: 'Medium' },
      { key: 'MISCONDUCT', label: 'Professional Misconduct', icon: 'gavel', severity: 'High' },
      { key: 'WRONG_SPECIALIZATION', label: 'Incorrect Specialization Listed', icon: 'file-text', severity: 'Medium' },
    ],
    'BareActSection': [
      { key: 'INCORRECT_TEXT', label: 'Incorrect Section Text', icon: 'file-text', severity: 'High' },
      { key: 'OUTDATED_AMENDMENT', label: 'Outdated — New Amendment Exists', icon: 'calendar', severity: 'Medium' },
      { key: 'WRONG_SECTION_NUMBER', label: 'Wrong Section Number', icon: 'hash', severity: 'Medium' },
    ],
    'Helpline': [
      { key: 'WRONG_PHONE', label: 'Number Not Working or Changed', icon: 'phone', severity: 'High' },
      { key: 'WRONG_CATEGORY', label: 'Wrong Category Assignment', icon: 'tag', severity: 'Low' },
      { key: 'CLOSED_PERMANENTLY', label: 'Service Discontinued', icon: 'building', severity: 'High' },
    ],
    'Template': [
      { key: 'INCORRECT_TEXT', label: 'Contains Legal Errors', icon: 'file-text', severity: 'High' },
      { key: 'OUTDATED_AMENDMENT', label: 'Uses Outdated Law References', icon: 'calendar', severity: 'Medium' },
    ]
  };

  // ── Public API ──

  /**
   * Get reasons for a specific entity type from the backend single source of truth.
   * Caches response in-memory to prevent repeated network hops.
   */
  async getReasonsForType(targetType: string): Promise<ReportReason[]> {
    if (!targetType) return [];

    // Return cached if available
    if (this.taxonomyCache.has(targetType)) {
      return this.taxonomyCache.get(targetType)!;
    }

    try {
      const reasons = await firstValueFrom(
        this.http.get<ReportReason[]>(`${this.apiUrl}/reasons`, {
          params: { targetType },
          withCredentials: true
        })
      );

      if (reasons && Array.isArray(reasons) && reasons.length > 0) {
        this.taxonomyCache.set(targetType, reasons);
        return reasons;
      }
    } catch {
      // Fallback gracefully on network error (MNC Standard: Resilient Degradation)
    }

    const fallback = this.FALLBACK_TAXONOMY[targetType] || [];
    this.taxonomyCache.set(targetType, fallback);
    return fallback;
  }

  /**
   * Synchronous fallback for immediate render before async fetch finishes.
   */
  getFallbackReasonsForType(targetType: string): ReportReason[] {
    return this.taxonomyCache.get(targetType) || this.FALLBACK_TAXONOMY[targetType] || [];
  }

  /**
   * Open the report modal for a specific target.
   */
  openReport(targetType: string, targetId: string, targetTitle: string): void {
    this.currentTarget.set({ targetType, targetId, targetTitle });
    this.isModalOpen.set(true);
  }

  /**
   * Close the report modal.
   */
  closeReport(): void {
    this.isModalOpen.set(false);
    this.currentTarget.set(null);
  }

  /**
   * Submit a content report. Works for both authenticated and guest users.
   */
  async submitReport(submission: ReportSubmission): Promise<ReportResponse> {
    const payload = { ...submission };
    try {
      const res = await firstValueFrom(
        this.http.post<ReportResponse>(this.apiUrl, payload, { withCredentials: true })
      );
      if (res && res.success) {
        this.saveLocalReport({
          targetType: submission.targetType,
          targetId: submission.targetId,
          targetTitle: submission.targetTitle,
          reasonCategory: submission.reasonCategory,
          referenceId: res.referenceId,
          status: 'under_review',
          createdAt: Date.now(),
          severity: res.severity,
          estimatedReviewTime: res.estimatedReviewTime,
          description: submission.description
        });
      }
      return res;
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Failed to submit report.';
      throw new Error(message);
    }
  }

  /**
   * Get my submitted reports (authenticated only).
   */
  getMyReports(page = 1, limit = 20) {
    return this.http.get<any>(`${this.apiUrl}/my`, {
      params: { page: page.toString(), limit: limit.toString() },
      withCredentials: true
    });
  }

  /**
   * Appeal or request re-review for a closed ticket with additional explanation.
   */
  async appealReport(referenceId: string, appealReason: string, evidenceUrl?: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.apiUrl}/appeal`, { referenceId, appealReason, evidenceUrl }, { withCredentials: true })
    );
  }

  /**
   * Generate a simple browser fingerprint for anti-brigading.
   * This is a lightweight hash, not a tracking fingerprint.
   */
  generateFingerprint(): string {
    if (typeof window === 'undefined') return '';

    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth?.toString(),
      new Date().getTimezoneOffset().toString(),
      navigator.hardwareConcurrency?.toString(),
    ].filter(Boolean);

    // Simple hash
    let hash = 0;
    const str = components.join('|');
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32-bit int
    }
    return 'fp_' + Math.abs(hash).toString(36);
  }
}