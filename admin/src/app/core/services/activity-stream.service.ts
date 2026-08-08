import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import * as XLSX from 'xlsx';
import { environment } from '../../../environments/environment';

export interface ActivityEvent {
  id: string;
  backendId?: number;
  type: 'lawyer_reg' | 'verification_req' | 'urgent_ticket' | 'security_alert' | 'announcement' | 'consultation_alert';
  severity?: 'critical' | 'warning' | 'info' | 'success';
  category?: 'security' | 'verification' | 'support' | 'consultation' | 'announcement';
  title: string;
  message: string;
  detailsMarkdown?: string;
  timestamp: Date;
  read: boolean;
  archived?: boolean;
  starred?: boolean;
  link?: string;
  actionLabel?: string;
  source?: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
  targetRole?: string;
}

export interface BroadcastPayload {
  targetCohort: 'all' | 'lawyers' | 'citizens' | 'admins';
  title: string;
  summary: string;
  detailsMarkdown?: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  category: 'security' | 'verification' | 'support' | 'consultation' | 'announcement';
  isModalTrigger: boolean;
}

export interface NotificationQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  severity?: string;
  category?: string;
  tab?: string;
  sortBy?: 'newest' | 'oldest' | 'severity';
  targetRole?: string;
  startDate?: string;
  endDate?: string;
}

export interface NotificationPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface NotificationStats {
  totalEvents: number;
  unreadCount: number;
  criticalCount: number;
  starredCount: number;
}

export interface SeverityStats {
  critical: number;
  warning: number;
  info: number;
  success: number;
  criticalPct: number;
  warningPct: number;
  infoPct: number;
  successPct: number;
}

export interface SecurityHealth {
  totalSecurityEvents: number;
  lastEventAt: string | null;
}

export interface QuickActionPayload {
  actionType: 'approve_lawyer' | 'reject_lawyer' | 'resolve_ticket';
  remarks?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ActivityStreamService {
  private http = inject(HttpClient);
  private readonly API = environment.apiUrl.endsWith('/admin')
    ? `${environment.apiUrl}/notification`
    : `${environment.apiUrl}/admin/notification`;

  // Signals
  events = signal<ActivityEvent[]>([]);
  pagination = signal<NotificationPagination>({ page: 1, limit: 10, total: 0, pages: 1 });
  stats = signal<NotificationStats>({ totalEvents: 0, unreadCount: 0, criticalCount: 0, starredCount: 0 });
  severityStats = signal<SeverityStats>({ critical: 0, warning: 0, info: 0, success: 0, criticalPct: 0, warningPct: 0, infoPct: 0, successPct: 0 });
  securityHealth = signal<SecurityHealth>({ totalSecurityEvents: 0, lastEventAt: null });
  isLoading = signal<boolean>(false);
  apiLatencyMs = signal<number>(0);

  // SignalR Connection State
  signalRConnected = signal<boolean>(false);
  private hubConnection: signalR.HubConnection | null = null;

  constructor() {
    this.loadFromBackend({ page: 1, limit: 10 }).subscribe({
      error: (err) => console.warn('⚠️ Initial notification load failed:', err?.message)
    });
    this.initSignalR();
  }

  get unreadCount(): number {
    return this.stats().unreadCount;
  }

  get criticalCount(): number {
    return this.stats().criticalCount;
  }

  get totalCount(): number {
    return this.stats().totalEvents;
  }

  /** Initialize SignalR WebSocket connection for real-time notifications */
  initSignalR(): void {
    try {
      const baseUrl = environment.apiUrl.replace(/\/api\/admin\/?$/, '').replace(/\/api\/?$/, '');
      const hubUrl = `${baseUrl}/hubs/admin/notifications`;

      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl)
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .build();

      this.hubConnection.on('ReceiveNotification', (notification: any) => {
        const newEvent: ActivityEvent = {
          id: notification.id || `notif-${Date.now()}`,
          backendId: notification.backendId,
          type: notification.type || 'announcement',
          severity: notification.severity || 'info',
          category: notification.category || 'announcement',
          title: notification.title || 'System Notification',
          message: notification.message || '',
          detailsMarkdown: notification.detailsMarkdown,
          timestamp: notification.timestamp ? new Date(notification.timestamp) : new Date(),
          read: false,
          archived: false,
          starred: false,
          link: notification.link || notification.actionUrl,
          actionLabel: notification.actionLabel || 'View Details',
          source: notification.source || 'Real-Time Push',
          relatedEntityType: notification.relatedEntityType,
          relatedEntityId: notification.relatedEntityId,
          targetRole: notification.targetRole
        };

        // Prepend to events list
        this.events.update(list => [newEvent, ...list]);
        this.stats.update(s => ({
          ...s,
          totalEvents: s.totalEvents + 1,
          unreadCount: s.unreadCount + 1
        }));
      });

      this.hubConnection.onclose(() => {
        this.signalRConnected.set(false);
      });

      this.hubConnection.onreconnected(() => {
        this.signalRConnected.set(true);
      });

      this.hubConnection.start()
        .then(() => {
          this.signalRConnected.set(true);
        })
        .catch((err: any) => {
          this.signalRConnected.set(false);
          console.warn('⚠️ SignalR connection failed, falling back to polling:', err?.message);
        });
    } catch (err: any) {
      console.warn('⚠️ SignalR init error, using polling fallback:', err?.message);
      this.signalRConnected.set(false);
    }
  }

  /** Disconnect SignalR on destroy */
  disconnectSignalR(): void {
    if (this.hubConnection) {
      this.hubConnection.stop();
      this.hubConnection = null;
      this.signalRConnected.set(false);
    }
  }

  loadFromBackend(paramsObj: NotificationQueryParams = {}): Observable<any> {
    this.isLoading.set(true);
    let params = new HttpParams();

    if (paramsObj.page) params = params.set('page', paramsObj.page.toString());
    if (paramsObj.limit) params = params.set('limit', paramsObj.limit.toString());
    if (paramsObj.search) params = params.set('search', paramsObj.search);
    if (paramsObj.severity) params = params.set('severity', paramsObj.severity);
    if (paramsObj.category) params = params.set('category', paramsObj.category);
    if (paramsObj.tab) params = params.set('tab', paramsObj.tab);
    if (paramsObj.sortBy) params = params.set('sortBy', paramsObj.sortBy);
    if (paramsObj.targetRole) params = params.set('targetRole', paramsObj.targetRole);
    if (paramsObj.startDate) params = params.set('startDate', paramsObj.startDate);
    if (paramsObj.endDate) params = params.set('endDate', paramsObj.endDate);

    const startTime = performance.now();

    return this.http.get<any>(`${this.API}/stream`, { params }).pipe(
      tap((res) => {
        const endTime = performance.now();
        this.apiLatencyMs.set(Math.round(endTime - startTime));

        if (res && res.success) {
          const backendEvents: ActivityEvent[] = (res.events || []).map((ev: any) => ({
            id: ev.id || `notif-${Date.now()}`,
            backendId: ev.backendId,
            type: ev.type || 'announcement',
            severity: ev.severity || 'info',
            category: ev.category || 'announcement',
            title: ev.title || 'System Notification',
            message: ev.message || 'No detail description provided.',
            detailsMarkdown: ev.detailsMarkdown,
            timestamp: ev.timestamp ? new Date(ev.timestamp) : new Date(),
            read: !!ev.read,
            archived: !!ev.archived,
            starred: !!ev.starred,
            link: ev.link,
            actionLabel: ev.actionLabel || 'View Details',
            source: ev.source || 'Backend System',
            relatedEntityType: ev.relatedEntityType,
            relatedEntityId: ev.relatedEntityId,
            targetRole: ev.targetRole
          }));

          this.events.set(backendEvents);

          if (res.pagination) {
            this.pagination.set(res.pagination);
          }
          if (res.stats) {
            this.stats.set(res.stats);
          }
          if (res.severityStats) {
            this.severityStats.set(res.severityStats);
          }
          if (res.securityHealth) {
            this.securityHealth.set(res.securityHealth);
          }
        }
        this.isLoading.set(false);
      }),
      catchError((err) => {
        console.error('Failed fetching notification stream:', err);
        this.isLoading.set(false);
        return of({ success: false, events: [], pagination: this.pagination(), stats: this.stats() });
      })
    );
  }

  markAsRead(id: string): void {
    this.events.update(list => list.map(e => e.id === id ? { ...e, read: true } : e));
    this.stats.update(s => ({ ...s, unreadCount: Math.max(0, s.unreadCount - 1) }));
    this.http.post(`${this.API}/mark-read/${id}`, {}).subscribe({ error: () => { } });
  }

  markAsUnread(id: string): void {
    this.events.update(list => list.map(e => e.id === id ? { ...e, read: false } : e));
    this.stats.update(s => ({ ...s, unreadCount: s.unreadCount + 1 }));
    this.http.post(`${this.API}/bulk-action`, { ids: [id], action: 'mark_unread' }).subscribe({ error: () => { } });
  }

  markAllAsRead(): Observable<any> {
    const loadedUnreadIds = this.events().filter(e => !e.read).map(e => e.id);
    this.events.update(list => list.map(e => ({ ...e, read: true })));
    this.stats.update(s => ({ ...s, unreadCount: 0 }));
    return this.http.post<any>(`${this.API}/mark-all-read`, {}).pipe(
      catchError(() => of({ success: true, count: loadedUnreadIds.length, unreadIds: loadedUnreadIds }))
    );
  }

  bulkMarkUnread(ids: string[]): void {
    const set = new Set(ids);
    this.events.update(list => list.map(e => set.has(e.id) ? { ...e, read: false } : e));
    this.stats.update(s => ({ ...s, unreadCount: s.unreadCount + ids.length }));
    if (ids.length) {
      this.http.post(`${this.API}/bulk-action`, { ids, action: 'mark_unread' }).subscribe({ error: () => { } });
    }
  }

  toggleStar(id: string): void {
    this.events.update(list => list.map(e => {
      if (e.id === id) {
        const nextStarred = !e.starred;
        this.stats.update(s => ({ ...s, starredCount: nextStarred ? s.starredCount + 1 : Math.max(0, s.starredCount - 1) }));
        return { ...e, starred: nextStarred };
      }
      return e;
    }));
    this.http.post(`${this.API}/toggle-star/${id}`, {}).subscribe({ error: () => { } });
  }

  archiveNotification(id: string): void {
    const target = this.events().find(e => e.id === id);
    this.events.update(list => list.filter(e => e.id !== id));
    if (target) {
      this.stats.update(s => ({
        ...s,
        totalEvents: Math.max(0, s.totalEvents - 1),
        unreadCount: !target.read ? Math.max(0, s.unreadCount - 1) : s.unreadCount
      }));
    }
    this.http.post(`${this.API}/bulk-action`, { ids: [id], action: 'archive' }).subscribe({ error: () => { } });
  }

  unarchiveNotification(id: string): void {
    const target = this.events().find(e => e.id === id);
    this.events.update(list => list.filter(e => e.id !== id));
    if (target) {
      this.stats.update(s => ({
        ...s,
        totalEvents: s.totalEvents + 1,
        unreadCount: !target.read ? s.unreadCount + 1 : s.unreadCount
      }));
    }
    this.http.post(`${this.API}/bulk-action`, { ids: [id], action: 'unarchive' }).subscribe({ error: () => { } });
  }

  deleteNotification(id: string): void {
    const target = this.events().find(e => e.id === id);
    this.events.update(list => list.filter(e => e.id !== id));
    if (target) {
      this.stats.update(s => ({
        ...s,
        totalEvents: Math.max(0, s.totalEvents - 1),
        unreadCount: !target.read ? Math.max(0, s.unreadCount - 1) : s.unreadCount
      }));
    }
    this.http.post(`${this.API}/bulk-action`, { ids: [id], action: 'delete' }).subscribe({ error: () => { } });
  }

  bulkMarkRead(ids: string[]): void {
    const set = new Set(ids);
    let newlyReadCount = 0;
    this.events.update(list => list.map(e => {
      if (set.has(e.id)) {
        if (!e.read) newlyReadCount++;
        return { ...e, read: true };
      }
      return e;
    }));
    if (newlyReadCount > 0) {
      this.stats.update(s => ({ ...s, unreadCount: Math.max(0, s.unreadCount - newlyReadCount) }));
    }
    if (ids.length) {
      this.http.post(`${this.API}/bulk-action`, { ids, action: 'mark_read' }).subscribe({ error: () => { } });
    }
  }

  bulkArchive(ids: string[]): void {
    const set = new Set(ids);
    const removed = this.events().filter(e => set.has(e.id));
    const unreadRemoved = removed.filter(e => !e.read).length;
    this.events.update(list => list.filter(e => !set.has(e.id)));
    this.stats.update(s => ({
      ...s,
      totalEvents: Math.max(0, s.totalEvents - removed.length),
      unreadCount: Math.max(0, s.unreadCount - unreadRemoved)
    }));
    if (ids.length) {
      this.http.post(`${this.API}/bulk-action`, { ids, action: 'archive' }).subscribe({ error: () => { } });
    }
  }

  bulkDelete(ids: string[]): void {
    const set = new Set(ids);
    const removed = this.events().filter(e => set.has(e.id));
    const unreadRemoved = removed.filter(e => !e.read).length;
    this.events.update(list => list.filter(e => !set.has(e.id)));
    this.stats.update(s => ({
      ...s,
      totalEvents: Math.max(0, s.totalEvents - removed.length),
      unreadCount: Math.max(0, s.unreadCount - unreadRemoved)
    }));
    if (ids.length) {
      this.http.post(`${this.API}/bulk-action`, { ids, action: 'delete' }).subscribe({ error: () => { } });
    }
  }

  /** Inline 1-click quick action: approve/reject lawyer, resolve ticket */
  executeQuickAction(notificationId: string, payload: QuickActionPayload): Observable<any> {
    return this.http.post<any>(`${this.API}/${notificationId}/quick-action`, payload).pipe(
      tap((res) => {
        if (res?.success) {
          // Remove from events list (it gets archived server-side)
          this.events.update(list => list.filter(e => e.id !== notificationId));
          this.stats.update(s => ({
            ...s,
            totalEvents: Math.max(0, s.totalEvents - 1),
            unreadCount: Math.max(0, s.unreadCount - 1)
          }));
        }
      })
    );
  }

  dispatchBroadcast(payload: BroadcastPayload): Promise<ActivityEvent> {
    return new Promise((resolve, reject) => {
      this.http.post<any>(`${this.API}/broadcast`, payload).subscribe({
        next: (res) => {
          const freshEvent: ActivityEvent = {
            id: res?.data?.id || `notif-${res?.data?.backendId || Date.now()}`,
            backendId: res?.data?.backendId,
            type: 'announcement',
            severity: payload.severity,
            category: payload.category,
            title: payload.title,
            message: payload.summary,
            detailsMarkdown: payload.detailsMarkdown,
            timestamp: new Date(),
            read: false,
            archived: false,
            starred: true,
            link: '/announcements',
            actionLabel: 'View Broadcast Notes',
            source: `Broadcaster (${payload.targetCohort.toUpperCase()})`
          };
          this.events.update(list => [freshEvent, ...list]);
          this.stats.update(s => ({
            ...s,
            totalEvents: s.totalEvents + 1,
            unreadCount: s.unreadCount + 1
          }));
          resolve(freshEvent);
        },
        error: (err) => {
          reject(err);
        }
      });
    });
  }

  pushEvent(event: Omit<ActivityEvent, 'id' | 'timestamp' | 'read'>): void {
    const severity = event.severity || (event.type === 'security_alert' ? 'critical' : event.type === 'urgent_ticket' ? 'warning' : 'info');
    const category = event.category || (event.type === 'security_alert' ? 'security' : event.type === 'verification_req' ? 'verification' : event.type === 'urgent_ticket' ? 'support' : 'announcement');
    const newEvent: ActivityEvent = {
      ...event,
      severity,
      category,
      id: `notif-${Date.now()}`,
      timestamp: new Date(),
      read: false,
      archived: false,
      starred: false
    };
    this.events.update(list => [newEvent, ...list]);
    this.stats.update(s => ({
      ...s,
      totalEvents: s.totalEvents + 1,
      unreadCount: s.unreadCount + 1
    }));
  }

  exportLogs(format: 'csv' | 'json' | 'xlsx', itemsToExport?: ActivityEvent[]): void {
    const items = itemsToExport || this.events();
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `legalconnect_telemetry_export_${timestampStr}`;

    if (format === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(items, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `${baseFilename}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else if (format === 'xlsx') {
      const exportData = items.map(item => ({
        'Event ID': item.id,
        'Severity Tier': item.severity ? item.severity.toUpperCase() : 'INFO',
        'Domain Category': item.category ? item.category.toUpperCase() : 'GENERAL',
        'Title': item.title || '',
        'Summary Message': item.message || '',
        'Telemetry Source': item.source || 'N/A',
        'Timestamp': item.timestamp ? new Date(item.timestamp).toLocaleString() : '',
        'Status': item.read ? 'Read' : 'Unread'
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Telemetry Logs');

      // Auto-fit column widths
      const colWidths = Object.keys(exportData[0] || {}).map(key => ({
        wch: Math.max(key.length + 4, 15)
      }));
      worksheet['!cols'] = colWidths;

      XLSX.writeFile(workbook, `${baseFilename}.xlsx`);
    } else {
      const headers = ['ID', 'Severity', 'Category', 'Title', 'Message', 'Timestamp', 'Read', 'Source'];
      const csvRows = [headers.join(',')];
      for (const item of items) {
        const row = [
          `"${item.id}"`,
          `"${item.severity || 'N/A'}"`,
          `"${item.category || 'N/A'}"`,
          `"${(item.title || '').replace(/"/g, '""')}"`,
          `"${(item.message || '').replace(/"/g, '""')}"`,
          `"${new Date(item.timestamp).toISOString()}"`,
          `"${item.read ? 'Read' : 'Unread'}"`,
          `"${item.source || 'N/A'}"`
        ];
        csvRows.push(row.join(','));
      }
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${baseFilename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}