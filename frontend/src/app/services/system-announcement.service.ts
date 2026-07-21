import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface SystemAnnouncement {
  id: number;
  version: string;
  title: string;
  summary: string;
  detailsMarkdown?: string;
  typeName: string;
  typeValue: number;
  isModalTrigger: boolean;
  isRead: boolean;
  isDismissedModal: boolean;
  publishedAt: string;
}

export interface VersionCheckResponse {
  currentVersion: string;
  hasMajorUpdate: boolean;
  latestAnnouncementId: number;
  latestTitle: string;
}

@Injectable({ providedIn: 'root' })
export class SystemAnnouncementService {
  readonly CLIENT_VERSION = '1.2.0';
  private apiUrl = '/api/announcement';

  announcements = signal<SystemAnnouncement[]>([]);
  unreadCount = signal<number>(0);
  activeModalAnnouncement = signal<SystemAnnouncement | null>(null);
  versionMismatch = signal<boolean>(false);
  serverVersion = signal<string>('1.2.0');

  constructor(private http: HttpClient) {
    this.checkSystemVersion();
    this.fetchLatestAnnouncements();
  }

  checkSystemVersion() {
    this.http.get<VersionCheckResponse>(`${this.apiUrl}/system-version`).subscribe({
      next: (res) => {
        if (res && res.currentVersion) {
          this.serverVersion.set(res.currentVersion);
          if (this.compareVersions(res.currentVersion, this.CLIENT_VERSION) > 0) {
            this.versionMismatch.set(true);
          }
        }
      },
      error: () => {
        // Fallback silently if offline or backend unavailable
      }
    });
  }

  private dismissedKey = 'lc_dismissed_announcements';

  private getDismissedFromStorage(): number[] {
    if (typeof window === 'undefined') return [];
    try {
      const val = localStorage.getItem(this.dismissedKey);
      return val ? JSON.parse(val) : [];
    } catch {
      return [];
    }
  }

  private saveDismissedToStorage(id: number) {
    if (typeof window === 'undefined') return;
    try {
      const dismissed = this.getDismissedFromStorage();
      if (!dismissed.includes(id)) {
        dismissed.push(id);
        localStorage.setItem(this.dismissedKey, JSON.stringify(dismissed));
      }
    } catch {}
  }

  fetchLatestAnnouncements() {
    this.http.get<SystemAnnouncement[]>(`${this.apiUrl}/latest`).subscribe({
      next: (data) => {
        if (Array.isArray(data)) {
          this.announcements.set(data);
          const unread = data.filter(a => !a.isRead).length;
          this.unreadCount.set(unread);

          // Check if there is an un-dismissed modal trigger announcement
          const dismissedInStorage = this.getDismissedFromStorage();
          const modalCandidate = data.find(
            a => a.isModalTrigger && !a.isDismissedModal && !dismissedInStorage.includes(a.id)
          );
          if (modalCandidate) {
            this.activeModalAnnouncement.set(modalCandidate);
          }
        }
      },
      error: () => { }
    });
  }

  markAsRead(announcementId: number) {
    this.saveDismissedToStorage(announcementId);
    this.announcements.update(list =>
      list.map(a => a.id === announcementId ? { ...a, isRead: true } : a)
    );
    this.unreadCount.update(count => Math.max(0, count - 1));

    this.http.post(`${this.apiUrl}/mark-read/${announcementId}`, {}).subscribe({
      error: () => { }
    });
  }

  dismissModal(announcementId: number) {
    this.activeModalAnnouncement.set(null);
    this.saveDismissedToStorage(announcementId);
    this.http.post(`${this.apiUrl}/dismiss-modal/${announcementId}`, {}).subscribe({
      error: () => { }
    });
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const val1 = parts1[i] || 0;
      const val2 = parts2[i] || 0;
      if (val1 > val2) return 1;
      if (val1 < val2) return -1;
    }
    return 0;
  }
}