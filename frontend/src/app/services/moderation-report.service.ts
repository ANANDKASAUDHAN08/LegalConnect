import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  // ── Dynamic Reason Taxonomy ──
  readonly REASON_TAXONOMY: Record<string, ReportReason[]> = {
    'Review': [
      { key: 'SPAM', label: 'Spam or Fake Review', icon: 'shield-alert', severity: 'High' },
      { key: 'ABUSIVE_LANGUAGE', label: 'Abusive or Hateful Language', icon: 'message-circle-warning', severity: 'High' },
      { key: 'PII_LEAK', label: 'Contains Personal Information (Aadhaar, Phone, etc.)', icon: 'eye-off', severity: 'Critical' },
      { key: 'FAKE_REVIEW', label: 'Fake or Misleading Review', icon: 'user-x', severity: 'High' },
      { key: 'IRRELEVANT', label: 'Irrelevant or Off-Topic', icon: 'x-circle', severity: 'Low' },
    ],
    'LegalResource': [
      { key: 'CLOSED_PERMANENTLY', label: 'Permanently Closed or Shifted', icon: 'building-x', severity: 'High' },
      { key: 'WRONG_ADDRESS', label: 'Incorrect Address or Coordinates', icon: 'map-pin-off', severity: 'Medium' },
      { key: 'WRONG_PHONE', label: 'Wrong or Disconnected Phone Number', icon: 'phone-off', severity: 'Medium' },
      { key: 'BRIBERY_ALLEGATION', label: 'Corruption / Bribery Demand', icon: 'alert-triangle', severity: 'Critical' },
      { key: 'FACILITIES_CHANGED', label: 'Facilities Information Outdated', icon: 'refresh-cw', severity: 'Low' },
    ],
    'Lawyer': [
      { key: 'FAKE_REGISTRATION', label: 'Fake Bar Council Registration', icon: 'user-x', severity: 'Critical' },
      { key: 'NOT_PRACTICING', label: 'No Longer Practicing', icon: 'briefcase', severity: 'Medium' },
      { key: 'MISCONDUCT', label: 'Professional Misconduct', icon: 'gavel', severity: 'High' },
      { key: 'WRONG_SPECIALIZATION', label: 'Incorrect Specialization Listed', icon: 'file-warning', severity: 'Medium' },
    ],
    'BareActSection': [
      { key: 'INCORRECT_TEXT', label: 'Incorrect Section Text', icon: 'file-warning', severity: 'High' },
      { key: 'OUTDATED_AMENDMENT', label: 'Outdated — New Amendment Exists', icon: 'calendar-x', severity: 'Medium' },
      { key: 'WRONG_SECTION_NUMBER', label: 'Wrong Section Number', icon: 'hash', severity: 'Medium' },
    ],
    'Helpline': [
      { key: 'WRONG_PHONE', label: 'Number Not Working or Changed', icon: 'phone-off', severity: 'High' },
      { key: 'WRONG_CATEGORY', label: 'Wrong Category Assignment', icon: 'tag', severity: 'Low' },
      { key: 'CLOSED_PERMANENTLY', label: 'Service Discontinued', icon: 'building-x', severity: 'High' },
    ],
    'Template': [
      { key: 'INCORRECT_TEXT', label: 'Contains Legal Errors', icon: 'file-warning', severity: 'High' },
      { key: 'OUTDATED_AMENDMENT', label: 'Uses Outdated Law References', icon: 'calendar-x', severity: 'Medium' },
    ]
  };

  // ── Public API ──

  /**
   * Get reasons for a specific entity type.
   */
  getReasonsForType(targetType: string): ReportReason[] {
    return this.REASON_TAXONOMY[targetType] || [];
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
  submitReport(submission: ReportSubmission): Promise<ReportResponse> {
    return new Promise((resolve, reject) => {
      // Auto-populate reporter info if authenticated
      this.auth.isLoggedIn$.subscribe(loggedIn => {
        const payload = { ...submission };

        this.http.post<ReportResponse>(this.apiUrl, payload, {
          withCredentials: loggedIn
        }).subscribe({
          next: (res) => {
            resolve(res);
          },
          error: (err) => {
            const message = err?.error?.message || 'Failed to submit report.';
            reject(new Error(message));
          }
        });
      }).unsubscribe(); // Take one value and unsubscribe
    });
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