import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  NotificationService,
  EnterpriseNotification,
  NotificationType,
  FollowedAct,
  NotificationPreferences,
  ChannelDeliveryConfig,
  QuietHoursConfig,
  SoundProfile
} from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { SystemAnnouncementService } from '../../services/system-announcement.service';
import { SnackbarService } from '../../services/snackbar.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { IconComponent } from '../../components/icon/icon.component';
import { IconName } from '../../components/icon/icon.types';
import { NotificationSkeletonComponent } from './components/notification-skeleton/notification-skeleton.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { CustomSelectComponent } from '../../components/custom-select/custom-select.component';
import { SelectOption } from '../../components/custom-select/custom-select.types';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export interface GroupedNotifications {
  label: string;
  items: EnterpriseNotification[];
}

export interface CategoryConfig {
  key: keyof NotificationPreferences;
  label: string;
  desc: string;
  clientLabel?: string;
  clientDesc?: string;
  applicableRoles: Array<'Lawyer' | 'Client' | 'Corporate' | 'All'>;
  icon: IconName;
  badgeClass: string;
  iconColor: string;
  tag: string;
}

export const PREFERENCES_CATEGORIES: CategoryConfig[] = [
  {
    key: 'legal',
    label: 'Bare Act Amendments & Gazette Notices',
    desc: 'Statute revisions, Parliamentary bills & central gazette notifications',
    clientLabel: 'Legal Rights & Statutory Bare Acts',
    clientDesc: 'Updates on consumer protection, cyber safety & basic rights',
    applicableRoles: ['Lawyer', 'Corporate', 'All', 'Client'],
    icon: 'scale',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    iconColor: '#6366f1',
    tag: 'Statutory'
  },
  {
    key: 'case',
    label: 'Court Dockets & Hearing Cause Lists',
    desc: 'Court hearings, courtroom listings & client consultation milestones',
    clientLabel: 'Court Hearing Dates & Case Status',
    clientDesc: 'Real-time alerts for your active court hearing dates and docket progress',
    applicableRoles: ['Lawyer', 'Client', 'Corporate', 'All'],
    icon: 'calendar',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    iconColor: '#3b82f6',
    tag: 'Hearings'
  },
  {
    key: 'lawyer',
    label: 'Direct Messages & Client Consultations',
    desc: 'Confidential client legal inquiries, consultation chats & case files',
    clientLabel: 'Advocate Direct Chat & Advice Notes',
    clientDesc: 'Confidential direct messages and case advice from your verified advocate',
    applicableRoles: ['Lawyer', 'Client', 'Corporate', 'All'],
    icon: 'message-square',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    iconColor: '#a855f7',
    tag: 'Messages'
  },
  {
    key: 'security',
    label: 'Security & Device Login Audits',
    desc: 'New IP logins, 2FA credentials & account security audit alerts',
    applicableRoles: ['Lawyer', 'Client', 'Corporate', 'All'],
    icon: 'shield',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    iconColor: '#f43f5e',
    tag: 'Security'
  },
  {
    key: 'verification',
    label: 'Bar Council Credential Approvals',
    desc: 'State Bar Council verification, COP checks & advocate badge updates',
    applicableRoles: ['Lawyer'], // Advocate ONLY
    icon: 'badge-check',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    iconColor: '#10b981',
    tag: 'BCI Audit'
  },
  {
    key: 'review',
    label: 'Client Reviews & Practice Ratings',
    desc: 'Verified client reviews, ratings approval & feedback notifications',
    applicableRoles: ['Lawyer'], // Advocate ONLY
    icon: 'star',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    iconColor: '#f59e0b',
    tag: 'Reviews'
  },
  {
    key: 'profile',
    label: 'Identity Verification & e-KYC Audits',
    desc: 'Aadhaar/PAN compliance, KYC validation & court filing identity verification',
    clientLabel: 'Account Identity & e-KYC Verification',
    clientDesc: 'Validation status of your identity and documents for court submissions',
    applicableRoles: ['Client', 'Corporate'], // Client/Corporate ONLY
    icon: 'user',
    badgeClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    iconColor: '#14b8a6',
    tag: 'e-KYC'
  },
  {
    key: 'system',
    label: 'Platform Engine Releases & Uptime',
    desc: 'Platform feature updates, database sync & legal intelligence upgrades',
    applicableRoles: ['Lawyer', 'Client', 'Corporate', 'All'],
    icon: 'zap',
    badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    iconColor: '#0ea5e9',
    tag: 'Platform'
  }
];

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
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
  hapticFeedback: true,
  targetRole: 'All'
};

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TooltipDirective,
    IconComponent,
    NotificationSkeletonComponent,
    ConfirmDialogComponent,
    ScrollingModule,
    CustomSelectComponent
  ],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notificationService = inject(NotificationService);
  systemAnnouncementService = inject(SystemAnnouncementService);
  snackbar = inject(SnackbarService);

  // Active filter state
  activeTab = signal<'all' | 'unread' | 'urgent' | 'legal' | 'cases' | 'security' | 'system' | 'statutes'>('all');
  searchQuery = signal<string>('');
  isRefreshing = signal<boolean>(false);
  isVirtualScrollMode = signal<boolean>(false);
  isMobileSearchOpen = signal<boolean>(false);
  isInsightsSheetOpen = signal<boolean>(false);

  // Category Dropdown Filter State
  isCategoryTabActive = computed(() =>
    ['legal', 'cases', 'security', 'system', 'statutes'].includes(this.activeTab())
  );

  selectedCategoryValue = computed<string>(() => {
    const tab = this.activeTab();
    if (['legal', 'cases', 'security', 'system', 'statutes'].includes(tab)) {
      return tab;
    }
    return '';
  });

  categoryOptions = computed<SelectOption[]>(() => {
    const options: SelectOption[] = [
      {
        value: 'all',
        label: 'All Categories',
        icon: 'layers',
        iconColor: '#3b82f6',
        sublabel: 'View all notifications across domains'
      }
    ];

    const legalCount = this.getCategoryCount('legal');
    if (legalCount > 0) {
      options.push({
        value: 'legal',
        label: 'Legal & Bare Acts',
        icon: 'scale',
        iconColor: '#818cf8',
        count: legalCount,
        sublabel: 'Gazette amendments & Bare Act revisions'
      });
    }

    const casesCount = this.getCategoryCount('cases');
    if (casesCount > 0) {
      options.push({
        value: 'cases',
        label: 'Cases & Messages',
        icon: 'message-square',
        iconColor: '#c084fc',
        count: casesCount,
        sublabel: 'Docket hearings & advocate chat messages'
      });
    }

    const securityCount = this.getCategoryCount('security');
    if (securityCount > 0) {
      options.push({
        value: 'security',
        label: 'Security & Profile',
        icon: 'shield',
        iconColor: '#34d399',
        count: securityCount,
        sublabel: 'Login sessions, BCI badges, compliance audits'
      });
    }

    const systemCount = this.getCategoryCount('system');
    if (systemCount > 0) {
      options.push({
        value: 'system',
        label: 'Platform Releases',
        icon: 'zap',
        iconColor: '#38bdf8',
        count: systemCount,
        sublabel: 'Platform upgrades & system broadcasts'
      });
    }

    const statutesCount = this.followedActs().length;
    if (statutesCount > 0) {
      options.push({
        value: 'statutes',
        label: 'Monitored Bare Acts',
        icon: 'book-open',
        iconColor: '#fbbf24',
        count: statutesCount,
        sublabel: 'Tracked Indian central and state acts'
      });
    }

    return options;
  });

  // Selection & Bulk Actions
  selectedIds = signal<string[]>([]);
  isSelectionMode = computed(() => this.selectedIds().length > 0);

  // Preferences Drawer / Modal
  isPreferencesOpen = signal<boolean>(false);
  isSavingPreferences = signal<boolean>(false);
  prefSearchQuery = signal<string>('');
  preferencesCategories = PREFERENCES_CATEGORIES;

  authService = inject(AuthService);
  currentUser = toSignal(this.authService.currentUser$, { initialValue: null });

  // Automatic Role Determination based directly on authenticated user credentials
  effectiveRole = computed<'Lawyer' | 'Client'>(() => {
    const user = this.currentUser();
    const r = (user?.role || '').toLowerCase();
    if (r === 'lawyer' || r === 'advocate') return 'Lawyer';
    return 'Client';
  });

  // Active view tab within Preferences modal: 'categories' | 'quiet-hours' | 'sound' | 'whatsapp'
  preferencesSection = signal<'categories' | 'quiet-hours' | 'sound' | 'whatsapp'>('categories');

  tempPreferences = signal<NotificationPreferences>({
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
    hapticFeedback: true,
    targetRole: 'All'
  });

  filteredPreferenceCategories = computed(() => {
    const role = this.effectiveRole();
    const q = this.prefSearchQuery().toLowerCase().trim();

    // 1. Filter by role (hide advocate-only categories for clients, hide client-only for lawyers)
    let list = this.preferencesCategories.filter(cat =>
      cat.applicableRoles.includes(role) || cat.applicableRoles.includes('All')
    );

    // 2. Filter by search query if any
    if (q) {
      list = list.filter(cat => {
        const label = (role === 'Client' && cat.clientLabel ? cat.clientLabel : cat.label).toLowerCase();
        const desc = (role === 'Client' && cat.clientDesc ? cat.clientDesc : cat.desc).toLowerCase();
        return label.includes(q) || desc.includes(q) || cat.tag.toLowerCase().includes(q);
      });
    }

    return list;
  });

  activePreset = computed<'all' | 'essential' | 'quiet' | 'default' | 'custom'>(() => {
    const prefs = this.tempPreferences() as any;
    const cats = this.filteredPreferenceCategories();

    let allOn = true;
    let allQuiet = true;
    for (const cat of cats) {
      const c = prefs[cat.key] as ChannelDeliveryConfig | undefined;
      if (!c || !c.inApp || !c.email || !c.push || !c.whatsapp) allOn = false;
      if (!c || !c.inApp || c.email || c.push || c.whatsapp) allQuiet = false;
    }
    if (allOn) return 'all';
    if (allQuiet) return 'quiet';

    let isDefault = true;
    const def = DEFAULT_NOTIFICATION_PREFERENCES as any;
    for (const cat of cats) {
      const c = prefs[cat.key] as ChannelDeliveryConfig | undefined;
      const d = def[cat.key] as ChannelDeliveryConfig | undefined;
      if (!c || !d || c.inApp !== d.inApp || c.email !== d.email || c.push !== d.push || (c.whatsapp !== d.whatsapp)) {
        isDefault = false;
        break;
      }
    }
    if (isDefault) return 'default';

    return 'custom';
  });

  // Confirm Modal state
  isConfirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmType: 'danger' | 'warning' | 'info' = 'warning';
  onConfirmAction: (() => void) | null = null;

  // Search debouncing
  private searchSubject = new Subject<string>();
  private searchSub!: Subscription;

  // Followed Bare Acts (Client local storage)
  followedActs = signal<FollowedAct[]>([]);

  // Filtered notifications computed signal
  filteredNotifications = computed(() => {
    let list = this.notificationService.notifications();
    const tab = this.activeTab();
    const query = this.searchQuery().toLowerCase().trim();

    // Filter by tab
    if (tab === 'unread') {
      list = list.filter(n => !n.isRead);
    } else if (tab === 'urgent') {
      list = list.filter(n => n.priority === 'urgent' && !n.isRead);
    } else if (tab === 'legal') {
      list = list.filter(n => n.type === 'legal' || n.type === 'hearing');
    } else if (tab === 'cases') {
      list = list.filter(n => n.type === 'case' || n.type === 'lawyer');
    } else if (tab === 'security') {
      list = list.filter(n => n.type === 'security' || n.type === 'profile' || n.type === 'verification');
    } else if (tab === 'system') {
      list = list.filter(n => n.type === 'system' || n.type === 'payment' || n.type === 'document');
    }

    // Filter by search query across fields
    if (query) {
      list = list.filter(n =>
        n.title.toLowerCase().includes(query) ||
        n.summary.toLowerCase().includes(query) ||
        (n.details && n.details.toLowerCase().includes(query)) ||
        n.type.toLowerCase().includes(query)
      );
    }

    return list;
  });

  // Computed grouped notifications
  groupedNotifications = computed(() => {
    const list = this.filteredNotifications();
    const today: EnterpriseNotification[] = [];
    const yesterday: EnterpriseNotification[] = [];
    const earlier: EnterpriseNotification[] = [];

    const now = new Date();
    const todayStr = now.toDateString();
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterdayStr = yesterdayDate.toDateString();

    list.forEach(item => {
      const d = new Date(item.createdAt);
      const dStr = d.toDateString();

      if (dStr === todayStr) {
        today.push(item);
      } else if (dStr === yesterdayStr) {
        yesterday.push(item);
      } else {
        earlier.push(item);
      }
    });

    const groups: GroupedNotifications[] = [];
    if (today.length > 0) groups.push({ label: 'Today', items: today });
    if (yesterday.length > 0) groups.push({ label: 'Yesterday', items: yesterday });
    if (earlier.length > 0) groups.push({ label: 'Earlier', items: earlier });

    return groups;
  });

  // Sidebar metrics computed signals
  unreadFilteredCount = computed(() =>
    this.filteredNotifications().filter(n => !n.isRead).length
  );

  urgentFilteredCount = computed(() =>
    this.filteredNotifications().filter(n => n.priority === 'urgent' && !n.isRead).length
  );

  ngOnInit() {
    this.searchSub = this.searchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged()
    ).subscribe(val => {
      this.searchQuery.set(val);
    });

    this.refreshAll();
  }

  ngOnDestroy() {
    if (this.searchSub) {
      this.searchSub.unsubscribe();
    }
    if (typeof document !== 'undefined') {
      document.body.classList.remove('mobile-drawer-open', 'overflow-hidden');
    }
  }

  refreshAll() {
    this.isRefreshing.set(true);
    this.followedActs.set(this.notificationService.getFollowedActs());

    this.notificationService.fetchNotifications().subscribe({
      next: () => {
        setTimeout(() => this.isRefreshing.set(false), 300);
      },
      error: () => {
        this.isRefreshing.set(false);
      }
    });

    this.systemAnnouncementService.fetchLatestAnnouncements();
    this.notificationService.fetchPreferences().subscribe(res => {
      if (res && res.data) {
        this.tempPreferences.set(res.data);
      }
    });
  }

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchSubject.next(input.value);
  }

  clearSearch() {
    this.searchQuery.set('');
    this.searchSubject.next('');
    this.snackbar.show('Search filter cleared.', 'info');
  }

  toggleMobileSearch(): void {
    this.isMobileSearchOpen.update(v => !v);
  }

  private updateBodyDrawerClass(): void {
    if (typeof document !== 'undefined') {
      if (this.isInsightsSheetOpen() || this.isPreferencesOpen()) {
        document.body.classList.add('mobile-drawer-open', 'overflow-hidden');
      } else {
        document.body.classList.remove('mobile-drawer-open', 'overflow-hidden');
      }
    }
  }

  toggleInsightsSheet(): void {
    this.isInsightsSheetOpen.update(v => !v);
    this.updateBodyDrawerClass();
  }

  closeInsightsSheet(): void {
    this.isInsightsSheetOpen.set(false);
    this.updateBodyDrawerClass();
  }

  filterByMetric(tab: 'all' | 'unread' | 'urgent' | 'statutes'): void {
    this.setTab(tab);
  }

  setTab(tab: 'all' | 'unread' | 'urgent' | 'legal' | 'cases' | 'security' | 'system' | 'statutes') {
    this.activeTab.set(tab);
    this.selectedIds.set([]); // Reset selections on tab change
  }

  onCategorySelect(val: any): void {
    if (!val || val === 'all') {
      this.setTab('all');
    } else {
      this.setTab(val);
    }
  }

  getCategoryCount(cat: 'legal' | 'cases' | 'security' | 'system' | 'statutes'): number {
    const list = this.notificationService.notifications();
    switch (cat) {
      case 'legal': return list.filter(n => n.type === 'legal' || n.type === 'hearing').length;
      case 'cases': return list.filter(n => n.type === 'case' || n.type === 'lawyer').length;
      case 'security': return list.filter(n => n.type === 'security' || n.type === 'profile' || n.type === 'verification').length;
      case 'system': return list.filter(n => n.type === 'system' || n.type === 'payment' || n.type === 'document').length;
      case 'statutes': return this.followedActs().length;
      default: return 0;
    }
  }

  // ==================== SINGLE ACTIONS ====================

  markRead(id: string) {
    this.notificationService.markAsRead(id).subscribe();
    this.snackbar.show('Notification marked as read.', 'success');
  }

  markAllRead() {
    const unread = this.filteredNotifications().filter(n => !n.isRead);
    if (unread.length === 0) {
      this.snackbar.show('No unread notifications to mark.', 'info');
      return;
    }

    const currentTab = this.activeTab();
    const typeParam = (currentTab === 'all' || currentTab === 'unread' || currentTab === 'urgent') ? 'all' : currentTab;
    this.notificationService.markAllAsRead(typeParam).subscribe();
  }

  deleteNotification(id: string, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.notificationService.deleteNotification(id).subscribe();
  }

  // ==================== BULK ACTIONS ====================

  toggleSelect(id: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    const current = this.selectedIds();
    if (current.includes(id)) {
      this.selectedIds.set(current.filter(item => item !== id));
    } else {
      this.selectedIds.set([...current, id]);
    }
  }

  toggleSelectAll() {
    const current = this.selectedIds();
    const visible = this.filteredNotifications().map(n => n.id);

    if (current.length === visible.length) {
      this.selectedIds.set([]);
    } else {
      this.selectedIds.set(visible);
    }
  }

  bulkMarkRead() {
    const ids = this.selectedIds();
    if (ids.length === 0) return;
    this.notificationService.bulkAction('markRead', ids).subscribe();
    this.selectedIds.set([]);
  }

  bulkDelete() {
    const ids = this.selectedIds();
    if (ids.length === 0) return;

    this.triggerConfirm(
      'Delete Selected Notifications',
      `Are you sure you want to permanently dismiss ${ids.length} notifications? This action cannot be reversed.`,
      'danger',
      () => {
        this.notificationService.bulkAction('delete', ids).subscribe();
        this.selectedIds.set([]);
      }
    );
  }

  cancelSelection() {
    this.selectedIds.set([]);
    this.snackbar.show('Selection mode cancelled.', 'info');
  }

  // ==================== FOLLOWED STATUTES ====================

  unfollowAct(shortName: string, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.notificationService.toggleFollow(shortName, '');
    this.followedActs.set(this.notificationService.getFollowedActs());
  }

  clearAllFollowed() {
    this.triggerConfirm(
      'Unfollow All Bare Acts',
      'Are you sure you want to stop monitoring all followed legislative Bare Acts? This will clear your statutory alerts.',
      'danger',
      () => {
        this.notificationService.clearAll();
        this.followedActs.set([]);
      }
    );
  }

  // ==================== PREFERENCES MODAL & DRAWER ====================

  openPreferences() {
    this.prefSearchQuery.set('');
    this.tempPreferences.set({ ...this.notificationService.preferences() });
    this.isPreferencesOpen.set(true);
    this.updateBodyDrawerClass();
  }

  closePreferences() {
    this.isPreferencesOpen.set(false);
    this.updateBodyDrawerClass();
  }

  // Outside click dismiss
  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closePreferences();
    }
  }

  // Keyboard shortcut listener for escape key
  @HostListener('document:keydown.escape')
  handleEscape() {
    if (this.isPreferencesOpen()) {
      this.closePreferences();
    } else if (this.isInsightsSheetOpen()) {
      this.closeInsightsSheet();
    }
  }

  // Mobile bottom-sheet touch swipe down to close
  private touchStartY = 0;
  private touchCurrentY = 0;
  private isDraggingSheet = false;

  onTouchStart(event: TouchEvent) {
    if (event.touches.length > 0) {
      this.touchStartY = event.touches[0].clientY;
      this.touchCurrentY = this.touchStartY;
      this.isDraggingSheet = true;
    }
  }

  onTouchMove(event: TouchEvent) {
    if (!this.isDraggingSheet || event.touches.length === 0) return;
    this.touchCurrentY = event.touches[0].clientY;
  }

  onTouchEnd() {
    if (!this.isDraggingSheet) return;
    const deltaY = this.touchCurrentY - this.touchStartY;
    this.isDraggingSheet = false;
    if (deltaY > 60) {
      this.closePreferences();
    }
  }

  // Master channel counters and toggles (App, Email, Push, WhatsApp)
  getChannelActiveCount(channel: 'inApp' | 'email' | 'push' | 'whatsapp'): number {
    const prefs = this.tempPreferences() as any;
    const cats = this.filteredPreferenceCategories();
    let count = 0;
    for (const cat of cats) {
      if (prefs[cat.key] && prefs[cat.key][channel]) {
        count++;
      }
    }
    return count;
  }

  isMasterChannelActive(channel: 'inApp' | 'email' | 'push' | 'whatsapp'): boolean {
    const cats = this.filteredPreferenceCategories();
    if (cats.length === 0) return false;
    return this.getChannelActiveCount(channel) === cats.length;
  }

  toggleMasterChannel(channel: 'inApp' | 'email' | 'push' | 'whatsapp') {
    const shouldEnable = !this.isMasterChannelActive(channel);
    const current = this.tempPreferences() as any;
    const updated = { ...current };
    const cats = this.filteredPreferenceCategories();
    for (const cat of cats) {
      updated[cat.key] = {
        ...(updated[cat.key] || {}),
        [channel]: shouldEnable
      };
    }
    this.tempPreferences.set(updated);

    if (channel === 'push' && shouldEnable) {
      this.notificationService.requestPushPermission();
    }
  }

  // Quiet Hours (Do Not Disturb) Logic
  toggleQuietHours(enabled?: boolean) {
    const current = this.tempPreferences();
    const qh = current.quietHours || { enabled: false, startTime: '22:00', endTime: '07:30', allowUrgent: true };
    const updated = enabled !== undefined ? enabled : !qh.enabled;
    this.tempPreferences.set({
      ...current,
      quietHours: {
        ...qh,
        enabled: updated
      }
    });
  }

  updateQuietHoursTime(field: 'startTime' | 'endTime', value: string) {
    const current = this.tempPreferences();
    const qh = current.quietHours || { enabled: false, startTime: '22:00', endTime: '07:30', allowUrgent: true };
    this.tempPreferences.set({
      ...current,
      quietHours: {
        ...qh,
        [field]: value
      }
    });
  }

  toggleQuietHoursUrgent(allow: boolean) {
    const current = this.tempPreferences();
    const qh = current.quietHours || { enabled: false, startTime: '22:00', endTime: '07:30', allowUrgent: true };
    this.tempPreferences.set({
      ...current,
      quietHours: {
        ...qh,
        allowUrgent: allow
      }
    });
  }

  isQuietHoursActiveNow(): boolean {
    const qh = this.tempPreferences().quietHours;
    if (!qh || !qh.enabled) return false;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = (qh.startTime || '22:00').split(':').map(Number);
    const [endH, endM] = (qh.endTime || '07:30').split(':').map(Number);
    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 0) * 60 + (endM || 0);

    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  // Sound Profile & Mobile Haptics
  setSoundProfile(sound: SoundProfile) {
    const current = this.tempPreferences();
    this.tempPreferences.set({
      ...current,
      soundProfile: sound
    });
    this.playSound(sound);
  }

  toggleHaptic(enabled?: boolean) {
    const current = this.tempPreferences();
    const val = enabled !== undefined ? enabled : !current.hapticFeedback;
    this.tempPreferences.set({
      ...current,
      hapticFeedback: val
    });
    if (val && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
  }

  playSound(sound: SoundProfile = this.tempPreferences().soundProfile || 'gavel') {
    if (sound === 'silent' || typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      if (sound === 'gavel') {
        // Courtroom wooden gavel strike
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);
        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);

        setTimeout(() => {
          try {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(95, ctx.currentTime);
            osc2.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.12);
            gain2.gain.setValueAtTime(0.4, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(ctx.currentTime);
            osc2.stop(ctx.currentTime + 0.16);
          } catch { }
        }, 110);

      } else if (sound === 'crystal') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now);
        gain.gain.setValueAtTime(0.4, now);
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
        gain.gain.setValueAtTime(0.35, now);
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
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      }

      if (this.tempPreferences().hapticFeedback && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 60, 40]);
      }
    } catch (err) {
      console.warn('Audio playback error', err);
    }
  }

  // WhatsApp Dispatch Gateway
  getWhatsAppRecipientPhone(): string {
    const user = this.currentUser();
    return user?.whatsAppPhone || user?.phone || '+91 98765 43210';
  }

  sendWhatsAppTestSimulation() {
    const phone = this.getWhatsAppRecipientPhone();
    this.snackbar.show(`WhatsApp alert dispatched to ${phone}: "LegalConnect: Urgent hearing listing on tomorrow's Cause List."`, 'success');
    this.sendTestNotification();
  }

  // Role Intelligent Defaults
  applyRoleDefaults(role: 'Lawyer' | 'Client' = this.effectiveRole()) {
    const current = this.tempPreferences();
    if (role === 'Lawyer') {
      this.tempPreferences.set({
        ...current,
        legal: { inApp: true, email: true, push: true, whatsapp: true },
        case: { inApp: true, email: true, push: true, whatsapp: true },
        lawyer: { inApp: true, email: true, push: true, whatsapp: true },
        security: { inApp: true, email: true, push: true, whatsapp: true },
        verification: { inApp: true, email: true, push: true, whatsapp: false },
        review: { inApp: true, email: false, push: false, whatsapp: false },
        profile: { inApp: true, email: true, push: false, whatsapp: false },
        system: { inApp: true, email: false, push: false, whatsapp: false },
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '07:30',
          allowUrgent: true
        },
        soundProfile: 'gavel',
        hapticFeedback: true,
        targetRole: 'Lawyer'
      });
      this.snackbar.show('Advocate Workstation intelligent defaults applied.', 'success');
    } else {
      this.tempPreferences.set({
        ...current,
        case: { inApp: true, email: true, push: true, whatsapp: true },
        lawyer: { inApp: true, email: true, push: true, whatsapp: true },
        security: { inApp: true, email: true, push: true, whatsapp: true },
        profile: { inApp: true, email: true, push: false, whatsapp: false },
        legal: { inApp: true, email: false, push: false, whatsapp: false },
        review: { inApp: false, email: false, push: false, whatsapp: false },
        verification: { inApp: false, email: false, push: false, whatsapp: false },
        system: { inApp: true, email: false, push: false, whatsapp: false },
        quietHours: {
          enabled: true,
          startTime: '21:30',
          endTime: '08:00',
          allowUrgent: true
        },
        soundProfile: 'crystal',
        hapticFeedback: true,
        targetRole: 'Client'
      });
      this.snackbar.show('Client / Litigant intelligent defaults applied.', 'success');
    }
  }

  // Preset management
  applyPreset(preset: 'all' | 'essential' | 'quiet' | 'default' | 'role-default') {
    const role = this.effectiveRole();
    if (preset === 'role-default') {
      this.applyRoleDefaults(role);
      return;
    }

    if (preset === 'default') {
      this.tempPreferences.set({ ...DEFAULT_NOTIFICATION_PREFERENCES });
      this.snackbar.show('Preferences reset to platform defaults.', 'info');
      return;
    }

    if (preset === 'all') {
      const current = this.tempPreferences() as any;
      const updated = { ...current };
      for (const cat of this.preferencesCategories) {
        updated[cat.key] = { inApp: true, email: true, push: true, whatsapp: true };
      }
      this.tempPreferences.set(updated);
      this.notificationService.requestPushPermission();
      this.snackbar.show('All delivery channels enabled (In-App, Email, Push, WhatsApp).', 'info');
      return;
    }

    if (preset === 'quiet') {
      const current = this.tempPreferences() as any;
      const updated = { ...current };
      for (const cat of this.preferencesCategories) {
        updated[cat.key] = { inApp: true, email: false, push: false, whatsapp: false };
      }
      updated.quietHours = {
        ...(updated.quietHours || { startTime: '22:00', endTime: '07:30', allowUrgent: true }),
        enabled: true
      };
      this.tempPreferences.set(updated);
      this.snackbar.show('Quiet mode enabled: External channels muted & Quiet Hours enabled.', 'info');
      return;
    }

    if (preset === 'essential') {
      if (role === 'Lawyer') {
        this.tempPreferences.set({
          ...this.tempPreferences(),
          legal: { inApp: true, email: true, push: true, whatsapp: true },
          case: { inApp: true, email: true, push: true, whatsapp: true },
          lawyer: { inApp: true, email: true, push: true, whatsapp: true },
          security: { inApp: true, email: true, push: true, whatsapp: true },
          verification: { inApp: true, email: true, push: false, whatsapp: false },
          review: { inApp: true, email: false, push: false, whatsapp: false },
          profile: { inApp: true, email: true, push: false, whatsapp: false },
          system: { inApp: true, email: false, push: false, whatsapp: false }
        });
      } else {
        this.tempPreferences.set({
          ...this.tempPreferences(),
          case: { inApp: true, email: true, push: true, whatsapp: true },
          lawyer: { inApp: true, email: true, push: true, whatsapp: true },
          security: { inApp: true, email: true, push: true, whatsapp: true },
          profile: { inApp: true, email: true, push: false, whatsapp: false },
          legal: { inApp: true, email: false, push: false, whatsapp: false },
          review: { inApp: false, email: false, push: false, whatsapp: false },
          verification: { inApp: false, email: false, push: false, whatsapp: false },
          system: { inApp: true, email: false, push: false, whatsapp: false }
        });
      }
      this.notificationService.requestPushPermission();
      this.snackbar.show(`Essential alerts activated for ${role === 'Lawyer' ? 'Advocate' : 'Client'}.`, 'info');
    }
  }

  savePreferences() {
    this.isSavingPreferences.set(true);
    this.notificationService.updatePreferences(this.tempPreferences()).subscribe({
      next: () => {
        this.isSavingPreferences.set(false);
        this.isPreferencesOpen.set(false);
        this.updateBodyDrawerClass();
      },
      error: () => {
        this.isSavingPreferences.set(false);
        this.isPreferencesOpen.set(false);
        this.updateBodyDrawerClass();
      }
    });
  }

  getPref(category: string, channel: 'inApp' | 'email' | 'push' | 'whatsapp'): boolean {
    const prefs = this.tempPreferences() as any;
    return prefs && prefs[category] ? !!prefs[category][channel] : false;
  }

  togglePref(category: keyof NotificationPreferences, channel: 'inApp' | 'email' | 'push' | 'whatsapp') {
    const current = this.tempPreferences();
    const catObj = (current[category] as any) || {};
    const willEnable = !catObj[channel];
    const updated = {
      ...current,
      [category]: {
        ...catObj,
        [channel]: willEnable
      }
    };
    this.tempPreferences.set(updated);

    if (channel === 'push' && willEnable) {
      this.notificationService.requestPushPermission();
    }
  }

  toggleVirtualScrollMode(): void {
    this.isVirtualScrollMode.update(v => !v);
  }

  enableWebPush(): void {
    this.notificationService.requestPushPermission();
  }

  sendTestNotification() {
    this.notificationService.dispatchLocalNotification({
      type: 'legal',
      title: 'Statutory Gazette Test: IT Rules Amendment 2026',
      summary: 'Active notification delivery test verified across your configured channels.',
      details: 'This test validates in-app delivery routing, SSE streaming, and alert preferences synchronization.',
      icon: 'scale',
      actionUrl: '/notifications',
      actionLabel: 'View Alert Hub',
      priority: 'normal'
    });
    this.snackbar.show('Live test alert delivered to notification feed!', 'success');
  }

  trackCategoryKey(_index: number, cat: CategoryConfig): string {
    return cat.key;
  }

  // ==================== HELPERS & EXTENSIBILITY ====================

  getIconForType(type: NotificationType): IconName {
    switch (type) {
      case 'legal': return 'scale';
      case 'case': return 'calendar';
      case 'lawyer': return 'message-square';
      case 'review': return 'star';
      case 'profile': return 'user';
      case 'security': return 'shield';
      case 'verification': return 'badge-check';
      case 'system': return 'zap';
      case 'hearing': return 'gavel';
      case 'document': return 'file-text';
      case 'payment': return 'wallet';
      default: return 'bell';
    }
  }

  getTypeBadgeClass(type: NotificationType): string {
    switch (type) {
      case 'legal':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
      case 'case':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'lawyer':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'review':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'profile':
        return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
      case 'security':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      case 'verification':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'hearing':
        return 'bg-amber-600/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
      case 'document':
        return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
      case 'payment':
        return 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border-emerald-600/20';
      case 'system':
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
    }
  }

  getTypeLabel(type: NotificationType): string {
    switch (type) {
      case 'legal': return 'Statute Alert';
      case 'case': return 'Case Update';
      case 'lawyer': return 'Advocate Message';
      case 'review': return 'Review Feedback';
      case 'profile': return 'Profile Audit';
      case 'security': return 'Security Notice';
      case 'verification': return 'BCI Verification';
      case 'hearing': return 'Court Hearing';
      case 'document': return 'Legal Dossier';
      case 'payment': return 'Escrow Billing';
      case 'system': return 'Platform Update';
      default: return 'Notification';
    }
  }

  getRelativeTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  formatDate(dateStr: string | Date): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getObjectKeys(obj?: Record<string, any>): string[] {
    return obj ? Object.keys(obj) : [];
  }

  copyActionLink(url: string, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      const fullUrl = window.location.origin + url;
      navigator.clipboard.writeText(fullUrl).then(() => {
        this.snackbar.show('Deep link copied to clipboard.', 'success');
      });
    }
  }

  trackById(_index: number, item: EnterpriseNotification): string {
    return item.id;
  }

  trackByGroup(_index: number, group: GroupedNotifications): string {
    return group.label;
  }

  // Modal Dialog helpers
  triggerConfirm(title: string, message: string, type: 'danger' | 'warning' | 'info', action: () => void) {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.confirmType = type;
    this.onConfirmAction = action;
    this.isConfirmOpen = true;
  }

  onConfirmDialog() {
    this.isConfirmOpen = false;
    if (this.onConfirmAction) {
      this.onConfirmAction();
    }
  }

  onCancelDialog() {
    this.isConfirmOpen = false;
    this.onConfirmAction = null;
  }
}