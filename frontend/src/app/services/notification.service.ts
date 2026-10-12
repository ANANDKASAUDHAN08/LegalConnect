import { Injectable, inject, signal, computed, NgZone, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SnackbarService } from './snackbar.service';
import { AuthService } from './auth.service';
import { catchError, tap } from 'rxjs/operators';
import { of, Subscription, throwError } from 'rxjs';
import { isCurrentTimeInWindow } from '../utils/time.util';

export interface FollowedAct {
  shortName: string;
  actName: string;
  followedAt: Date;
}

export type NotificationType =
  | 'system'
  | 'legal'
  | 'case'
  | 'lawyer'
  | 'review'
  | 'profile'
  | 'security'
  | 'verification'
  | 'hearing'
  | 'document'
  | 'payment';

export function getCategoryTypes(type?: string): string[] | null {
  if (!type || type === 'all') return null;
  switch (type.toLowerCase()) {
    case 'legal':
      return ['legal', 'hearing'];
    case 'cases':
      return ['case', 'lawyer', 'review'];
    case 'security':
      return ['security', 'profile', 'verification'];
    case 'system':
      return ['system', 'payment', 'document'];
    default:
      return null;
  }
}

export interface EnterpriseNotification {
  id: string;
  type: NotificationType;
  title: string;
  summary: string;
  details?: string;
  icon: string;
  actionUrl: string;
  actionLabel?: string;
  isRead: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: string;
  source?: string;
  recipientUserId?: string;
  metadata?: Record<string, any>;
}

export interface ChannelDeliveryConfig {
  inApp: boolean;
  email: boolean;
  push: boolean;
  whatsapp?: boolean;
}

export interface QuietHoursConfig {
  enabled: boolean;
  startTime: string;
  endTime: string;
  allowUrgent: boolean;
}

export type SoundProfile = 'default' | 'gavel' | 'crystal' | 'bell' | 'pulse' | 'silent';

export interface NotificationPreferences {
  system: ChannelDeliveryConfig;
  legal: ChannelDeliveryConfig;
  case: ChannelDeliveryConfig;
  lawyer: ChannelDeliveryConfig;
  review: ChannelDeliveryConfig;
  profile: ChannelDeliveryConfig;
  security: ChannelDeliveryConfig;
  verification: ChannelDeliveryConfig;
  quietHours?: QuietHoursConfig;
  soundProfile?: SoundProfile;
  soundVolume?: number;
  hapticFeedback?: boolean;
  targetRole?: 'Lawyer' | 'Client' | 'All';
}

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private http = inject(HttpClient);
  private snackbar = inject(SnackbarService);
  private ngZone = inject(NgZone);
  private authService = inject(AuthService);
  private authSub: Subscription | null = null;

  private readonly followedKey = 'lc_followed_acts';
  private readonly apiUrl = '/api/info/notifications';

  private followedActs: FollowedAct[] = [];
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private visibilityListener: (() => void) | null = null;
  private sseReconnectDelay = 1000; // Exponential backoff starting at 1s
  private readonly SSE_MAX_BACKOFF = 30000; // Cap at 30s

  // Signals
  followedCount = signal<number>(0);
  notifications = signal<EnterpriseNotification[]>([]);
  unreadCount = signal<number>(0);
  countsByType = signal<Record<string, number>>({});
  isLoading = signal<boolean>(false);
  isSyncing = signal<boolean>(false);
  sseConnected = signal<boolean>(false);
  webPushPermission = signal<string>('default');

  private eventSource: EventSource | null = null;

  // Computed signals
  urgentCount = computed(() =>
    this.notifications().filter(n => n.priority === 'urgent' && !n.isRead).length
  );

  highPriorityCount = computed(() =>
    this.notifications().filter(n => (n.priority === 'high' || n.priority === 'urgent') && !n.isRead).length
  );

  preferences = signal<NotificationPreferences>({
    system: { inApp: true, email: true, push: false, whatsapp: false },
    legal: { inApp: true, email: true, push: true, whatsapp: true },
    case: { inApp: true, email: true, push: true, whatsapp: true },
    lawyer: { inApp: true, email: true, push: true, whatsapp: true },
    review: { inApp: true, email: false, push: false, whatsapp: false },
    profile: { inApp: true, email: true, push: false, whatsapp: false },
    security: { inApp: true, email: true, push: true, whatsapp: true },
    verification: { inApp: true, email: true, push: true, whatsapp: false },
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '07:30',
      allowUrgent: true
    },
    soundProfile: 'gavel',
    soundVolume: 80,
    hapticFeedback: true,
    targetRole: 'All'
  });

  constructor() {
    this.loadFromStorage();
    this.loadPreferencesFromStorage();
    this.initPushSupport();
    this.initAutoSync();

    // Re-sync preferences and notifications whenever the user logs in, logs out, or switches roles
    let isFirstAuthEmission = true;
    this.authSub = this.authService.currentUser$.subscribe(() => {
      this.loadPreferencesFromStorage();
      if (!isFirstAuthEmission) {
        this.fetchPreferences().subscribe();
        this.fetchNotifications('all', 'all', '', true).subscribe();
      }
      isFirstAuthEmission = false;
      this.initSSEStream();
    });
  }

  // ==================== BACKGROUND SYNC & RESILIENCE ====================

  private initAutoSync(): void {
    if (typeof window === 'undefined') return;

    // Initial background fetch of notifications & preferences
    this.fetchNotifications().subscribe();
    this.fetchPreferences().subscribe();

    // Run polling timer outside Angular zone to eliminate change detection churn
    this.ngZone.runOutsideAngular(() => {
      // Periodic background heartbeat sync every 60s
      this.syncTimer = setInterval(() => {
        this.fetchNotifications('all', 'all', '', true).subscribe();
      }, 60000);

      // Tab visibility listener (MNC pattern: sync whenever user resumes active tab)
      this.visibilityListener = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          this.ngZone.run(() => {
            this.fetchNotifications('all', 'all', '', true).subscribe();
            this.fetchPreferences().subscribe();
          });
        }
      };
      document.addEventListener('visibilitychange', this.visibilityListener);
    });
  }

  // ==================== REAL-TIME SSE STREAM (<50ms LATENCY) ====================

  private initSSEStream(): void {
    if (typeof window === 'undefined' || !('EventSource' in window)) return;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    try {
      const currentUserId = this.authService.currentUser?.id;
      const streamUrl = currentUserId
        ? `${this.apiUrl}/stream?userId=${encodeURIComponent(currentUserId)}`
        : `${this.apiUrl}/stream`;

      this.eventSource = new EventSource(streamUrl);

      this.eventSource.onopen = () => {
        this.ngZone.run(() => {
          this.sseConnected.set(true);
          // Reset exponential backoff on successful connection
          this.sseReconnectDelay = 1000;
        });
      };

      this.eventSource.addEventListener('notification_created', (event: MessageEvent) => {
        this.ngZone.run(() => {
          try {
            const payload = JSON.parse(event.data);
            if (payload && payload.notification) {
              const newItem: EnterpriseNotification = payload.notification;

              // Check recipient targeting: ignore if addressed to a different user
              const currentUserId = this.authService.currentUser?.id;
              if (newItem.recipientUserId && currentUserId && String(newItem.recipientUserId) !== String(currentUserId)) {
                return;
              }

              // Prevent duplicate insertion
              this.notifications.update(list => {
                if (list.some(n => n.id === newItem.id)) return list;
                return [newItem, ...list];
              });

              if (typeof payload.unreadCount === 'number') {
                this.unreadCount.set(payload.unreadCount);
              } else {
                this.unreadCount.update(c => c + 1);
              }

              // Respect user preferences for in-app alert snackbars & judicial chime
              const prefs = this.preferences() as any;
              const cat = newItem.type;
              const isInAppAllowed = prefs && prefs[cat] ? prefs[cat].inApp !== false : true;

              // Enforce Quiet Hours: suppress chimes & snackbar toasts during DND window
              if (isInAppAllowed && !this.isSuppressedByQuietHours(newItem)) {
                this.snackbar.show(`New Alert: ${newItem.title}`, 'info');
                this.playProceduralChime(prefs?.soundProfile || 'gavel');
                if (prefs?.hapticFeedback && typeof navigator !== 'undefined' && navigator.vibrate) {
                  navigator.vibrate([40, 60, 40]);
                }
              }

              // Respect user preferences for desktop push notifications
              this.pushDesktopAlert(newItem);
            }
          } catch (e) {
            console.warn('[SSE] Failed to parse notification_created:', e);
          }
        });
      });

      this.eventSource.addEventListener('notification_read', (event: MessageEvent) => {
        this.ngZone.run(() => {
          try {
            const payload = JSON.parse(event.data);
            if (payload && payload.id) {
              this.notifications.update(list =>
                list.map(n => n.id === payload.id ? { ...n, isRead: true } : n)
              );
              if (typeof payload.unreadCount === 'number') {
                this.unreadCount.set(payload.unreadCount);
              }
            }
          } catch {}
        });
      });

      this.eventSource.addEventListener('notification_all_read', (event: MessageEvent) => {
        this.ngZone.run(() => {
          try {
            const payload = JSON.parse(event.data);
            const type = payload?.type;
            const categoryTypes = getCategoryTypes(type);
            this.notifications.update(list =>
              list.map(n => (!type || type === 'all' || (categoryTypes ? categoryTypes.includes(n.type) : n.type === type)) ? { ...n, isRead: true } : n)
            );
            if (typeof payload?.unreadCount === 'number') {
              this.unreadCount.set(payload.unreadCount);
            } else {
              this.unreadCount.set(0);
            }
          } catch {}
        });
      });

      this.eventSource.addEventListener('notification_deleted', (event: MessageEvent) => {
        this.ngZone.run(() => {
          try {
            const payload = JSON.parse(event.data);
            if (payload && payload.id) {
              this.notifications.update(list => list.filter(n => n.id !== payload.id));
              if (typeof payload.unreadCount === 'number') {
                this.unreadCount.set(payload.unreadCount);
              }
            }
          } catch {}
        });
      });

      this.eventSource.addEventListener('notification_bulk', (event: MessageEvent) => {
        this.ngZone.run(() => {
          try {
            const payload = JSON.parse(event.data);
            if (payload && payload.ids && Array.isArray(payload.ids)) {
              const idSet = new Set(payload.ids);
              if (payload.action === 'markRead') {
                this.notifications.update(list =>
                  list.map(n => idSet.has(n.id) ? { ...n, isRead: true } : n)
                );
              } else if (payload.action === 'delete') {
                this.notifications.update(list => list.filter(n => !idSet.has(n.id)));
              }
              if (typeof payload.unreadCount === 'number') {
                this.unreadCount.set(payload.unreadCount);
              }
            }
          } catch {}
        });
      });

      this.eventSource.onerror = () => {
        this.ngZone.run(() => {
          this.sseConnected.set(false);
        });

        // Auto-reconnect with exponential backoff (MNC pattern: Slack, GitHub, Linear)
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        if (this.sseReconnectTimer) {
          clearTimeout(this.sseReconnectTimer);
        }

        console.warn(`[SSE] Connection lost. Reconnecting in ${this.sseReconnectDelay / 1000}s...`);
        this.sseReconnectTimer = setTimeout(() => {
          this.sseReconnectDelay = Math.min(this.sseReconnectDelay * 2, this.SSE_MAX_BACKOFF);
          this.initSSEStream();
        }, this.sseReconnectDelay);
      };
    } catch (err) {
      console.warn('[SSE] EventSource init failed:', err);
    }
  }

  // ==================== WEB PUSH API INTEGRATION ====================

  initPushSupport(): void {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.webPushPermission.set(Notification.permission);
    } else {
      this.webPushPermission.set('unsupported');
    }
  }

  async requestPushPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      this.snackbar.show('Browser does not support desktop push notifications.', 'info');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.webPushPermission.set(permission);

      if (permission === 'granted') {
        this.snackbar.show('Browser Web Push alerts enabled for critical legal notices!', 'success');
        try {
          new Notification('LegalConnect Legal Alerts', {
            body: 'Real-time case milestones, hearing alerts & security audits enabled.',
            icon: '/favicon.ico'
          });
        } catch {}
        return true;
      } else {
        this.snackbar.show('Desktop push permission was not granted by browser.', 'info');
        return false;
      }
    } catch (e) {
      console.warn('Error requesting notification permission:', e);
      return false;
    }
  }

  pushDesktopAlert(notification: EnterpriseNotification): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    // Check category preferences
    const prefs = this.preferences() as any;
    const cat = notification.type;
    const isPushAllowed = prefs && prefs[cat] ? prefs[cat].push : true;
    if (!isPushAllowed) return;

    // Quiet Hours (DND) also silence OS-level push, except urgent alerts when bypass is enabled
    if (this.isSuppressedByQuietHours(notification)) return;

    try {
      const n = new Notification(notification.title, {
        body: notification.summary,
        icon: '/favicon.ico',
        tag: notification.id,
        silent: notification.priority === 'low'
      });

      n.onclick = () => {
        window.focus();
        if (notification.actionUrl) {
          window.location.href = notification.actionUrl;
        }
      };
    } catch (err) {
      console.warn('Web push dispatch error:', err);
    }
  }

  /**
   * True when the user's Quiet Hours window is active right now and this alert
   * does not qualify for the urgent-hearing bypass.
   */
  isSuppressedByQuietHours(notification: Pick<EnterpriseNotification, 'priority'>): boolean {
    const qh = this.preferences()?.quietHours;
    if (!qh?.enabled) return false;
    const isQuietNow = isCurrentTimeInWindow(qh.startTime || '22:00', qh.endTime || '07:30');
    if (!isQuietNow) return false;
    const bypass = qh.allowUrgent !== false && notification.priority === 'urgent';
    return !bypass;
  }

  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  playProceduralChime(sound: SoundProfile = 'gavel'): void {
    if (sound === 'silent') return;
    const vol = this.preferences()?.soundVolume !== undefined ? this.preferences().soundVolume! : 80;
    if (vol <= 0) return;
    const volScale = Math.max(0.01, Math.min(1, vol / 100));

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      if (sound === 'gavel') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);
        gain.gain.setValueAtTime(0.8 * volScale, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (sound === 'crystal') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now);
        gain.gain.setValueAtTime(0.4 * volScale, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (sound === 'bell') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.frequency.setValueAtTime(1046.5, now);
        osc2.frequency.setValueAtTime(1567.98, now);
        gain.gain.setValueAtTime(0.35 * volScale, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.65);
        osc2.stop(now + 0.65);
      } else if (sound === 'pulse') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        gain.gain.setValueAtTime(0.5 * volScale, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      console.warn('Procedural chime synthesis skipped:', e);
    }
  }

  ngOnDestroy(): void {
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    if (this.authSub) {
      this.authSub.unsubscribe();
      this.authSub = null;
    }
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.sseReconnectTimer) {
      clearTimeout(this.sseReconnectTimer);
      this.sseReconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.visibilityListener && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }
  }

  // ==================== PREFERENCES PERSISTENCE ====================

  private loadPreferencesFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const userId = this.authService.currentUser?.id || 'guest';
      const key = `lc_notification_preferences_${userId}`;
      const saved = localStorage.getItem(key) || localStorage.getItem('lc_notification_preferences_default');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.preferences.set({ ...this.preferences(), ...parsed });
      }
    } catch {}
  }

  private savePreferencesToStorage(prefs: NotificationPreferences): void {
    if (typeof window === 'undefined') return;
    try {
      const userId = this.authService.currentUser?.id || 'guest';
      const key = `lc_notification_preferences_${userId}`;
      localStorage.setItem(key, JSON.stringify(prefs));
      localStorage.setItem('lc_notification_preferences_default', JSON.stringify(prefs));
    } catch {}
  }

  // ==================== FOLLOWED STATUTES ====================

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    const data = localStorage.getItem(this.followedKey);
    if (data) {
      try {
        this.followedActs = JSON.parse(data);
        this.followedCount.set(this.followedActs.length);
      } catch {
        this.followedActs = [];
        this.followedCount.set(0);
      }
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.followedKey, JSON.stringify(this.followedActs));
    this.followedCount.set(this.followedActs.length);
  }

  getFollowedActs(): FollowedAct[] {
    return [...this.followedActs].sort((a, b) =>
      new Date(b.followedAt).getTime() - new Date(a.followedAt).getTime()
    );
  }

  isFollowing(shortName: string): boolean {
    return this.followedActs.some(a => a.shortName === shortName);
  }

  toggleFollow(shortName: string, actName: string) {
    const index = this.followedActs.findIndex(a => a.shortName === shortName);
    if (index > -1) {
      this.followedActs.splice(index, 1);
      this.snackbar.show(`Unfollowed ${shortName}. Amendment alerts disabled.`, 'info');
    } else {
      this.followedActs.push({
        shortName,
        actName,
        followedAt: new Date()
      });
      this.snackbar.show(`Now monitoring ${shortName} for real-time gazette amendment alerts!`, 'success');
    }
    this.saveToStorage();
  }

  clearAll() {
    this.followedActs = [];
    this.saveToStorage();
    this.snackbar.show('All statute monitoring alerts cleared.', 'info');
  }

  // ==================== ENTERPRISE NOTIFICATIONS API ====================

  fetchNotifications(type: string = 'all', status: string = 'all', query: string = '', isSilent: boolean = false, limit: number = 100) {
    if (!isSilent) {
      this.isLoading.set(true);
    } else {
      this.isSyncing.set(true);
    }

    const currentUserId = this.authService.currentUser?.id;
    let url = `${this.apiUrl}?type=${encodeURIComponent(type)}&status=${encodeURIComponent(status)}&limit=${limit}`;
    if (currentUserId) {
      url += `&userId=${encodeURIComponent(currentUserId)}`;
    }
    if (query) {
      url += `&q=${encodeURIComponent(query)}`;
    }

    return this.http.get<{
      success: boolean;
      total: number;
      unreadCount: number;
      countsByType: Record<string, number>;
      notifications: EnterpriseNotification[];
    }>(url).pipe(
      tap(res => {
        if (res && res.success) {
          this.notifications.set(res.notifications || []);
          this.unreadCount.set(res.unreadCount || 0);
          if (res.countsByType) {
            this.countsByType.set(res.countsByType);
          }
        }
        this.isLoading.set(false);
        this.isSyncing.set(false);
      }),
      catchError(err => {
        console.warn('Unable to reach notifications API; maintaining cached local state.', err);
        this.isLoading.set(false);
        this.isSyncing.set(false);
        return of(null);
      })
    );
  }

  markAsRead(id: string) {
    // Optimistic UI update
    this.notifications.update(list =>
      list.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
    this.unreadCount.update(c => Math.max(0, c - 1));

    return this.http.post<{ success: boolean; unreadCount: number }>(`${this.apiUrl}/${id}/read`, {})
      .pipe(
        tap(res => {
          if (res && typeof res.unreadCount === 'number') {
            this.unreadCount.set(res.unreadCount);
          }
        }),
        catchError(() => of(null))
      );
  }

  markAllAsRead(type: string = 'all') {
    const categoryTypes = getCategoryTypes(type);
    // Optimistic UI update
    this.notifications.update(list =>
      list.map(n => (!type || type === 'all' || (categoryTypes ? categoryTypes.includes(n.type) : n.type === type)) ? { ...n, isRead: true } : n)
    );
    // Dynamically calculate remaining unread notifications across in-memory state
    const remainingUnread = this.notifications().filter(n => !n.isRead).length;
    this.unreadCount.set(remainingUnread);

    return this.http.post<{ success: boolean; unreadCount: number }>(`${this.apiUrl}/mark-all-read`, { type })
      .pipe(
        tap(res => {
          if (res && typeof res.unreadCount === 'number') {
            this.unreadCount.set(res.unreadCount);
          }
          this.snackbar.show('All active notifications marked as read.', 'success');
        }),
        catchError(() => {
          this.snackbar.show('Notifications marked as read.', 'success');
          return of(null);
        })
      );
  }

  deleteNotification(id: string) {
    const target = this.notifications().find(n => n.id === id);
    const wasUnread = target ? !target.isRead : false;

    // Optimistic UI update
    this.notifications.update(list => list.filter(n => n.id !== id));
    if (wasUnread) {
      this.unreadCount.update(c => Math.max(0, c - 1));
    }

    return this.http.delete<{ success: boolean; unreadCount: number }>(`${this.apiUrl}/${id}`)
      .pipe(
        tap(res => {
          if (res && typeof res.unreadCount === 'number') {
            this.unreadCount.set(res.unreadCount);
          }
          this.snackbar.show('Notification dismissed.', 'info');
        }),
        catchError(() => {
          this.snackbar.show('Notification dismissed.', 'info');
          return of(null);
        })
      );
  }

  bulkAction(action: 'markRead' | 'delete', ids: string[]) {
    if (!ids || ids.length === 0) return of(null);

    // Optimistic UI update
    if (action === 'markRead') {
      this.notifications.update(list =>
        list.map(n => ids.includes(n.id) ? { ...n, isRead: true } : n)
      );
      const remainingUnread = this.notifications().filter(n => !n.isRead).length;
      this.unreadCount.set(remainingUnread);
      this.snackbar.show(`${ids.length} notifications marked as read.`, 'success');
    } else if (action === 'delete') {
      this.notifications.update(list => list.filter(n => !ids.includes(n.id)));
      const remainingUnread = this.notifications().filter(n => !n.isRead).length;
      this.unreadCount.set(remainingUnread);
      this.snackbar.show(`${ids.length} notifications dismissed permanently.`, 'info');
    }

    return this.http.post<{ success: boolean; unreadCount: number }>(`${this.apiUrl}/bulk`, { action, ids })
      .pipe(
        tap(res => {
          if (res && typeof res.unreadCount === 'number') {
            this.unreadCount.set(res.unreadCount);
          }
        }),
        catchError(() => of(null))
      );
  }

  fetchPreferences() {
    return this.http.get<{ success: boolean; data: NotificationPreferences }>(`${this.apiUrl}/preferences`)
      .pipe(
        tap(res => {
          if (res && res.success && res.data) {
            this.preferences.set(res.data);
            this.savePreferencesToStorage(res.data);
          }
        }),
        catchError(() => of(null))
      );
  }

  updatePreferences(prefs: NotificationPreferences, showToast: boolean = true) {
    // Optimistic update with snapshot for rollback on failure
    const previous = this.preferences();
    this.preferences.set(prefs);
    this.savePreferencesToStorage(prefs);
    return this.http.put<{ success: boolean; message: string; data: NotificationPreferences }>(
      `${this.apiUrl}/preferences`,
      prefs
    ).pipe(
      tap(res => {
        if (res && res.success && res.data) {
          this.preferences.set(res.data);
          this.savePreferencesToStorage(res.data);
        }
        if (showToast) {
          this.snackbar.show('Notification preferences synchronized and saved.', 'success');
        }
      }),
      catchError(err => {
        this.preferences.set(previous);
        this.savePreferencesToStorage(previous);
        this.snackbar.show('Could not save preferences. Your changes were not applied \u2014 please try again.', 'error', 4500);
        return throwError(() => err);
      })
    );
  }

  /**
   * Futuristic Extensibility API:
   * Allows any page/component across LegalConnect to emit an in-app notification instantly.
   * E.g. Court hearing scheduled, Legal document compiled, Payment escrow completed.
   */
  dispatchLocalNotification(notif: Omit<EnterpriseNotification, 'id' | 'isRead' | 'createdAt'>) {
    const fullItem: EnterpriseNotification = {
      ...notif,
      id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      isRead: false,
      createdAt: new Date().toISOString()
    };

    this.notifications.update(list => [fullItem, ...list]);
    this.unreadCount.update(c => c + 1);
    this.playProceduralChime(this.preferences().soundProfile || 'gavel');
    this.snackbar.show(`Alert: ${fullItem.title}`, 'info');
  }
}