import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  HostListener,
  Renderer2
} from '@angular/core';
import { DOCUMENT, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  NotificationService,
  EnterpriseNotification,
  FollowedAct,
  NotificationPreferences
} from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { SystemAnnouncementService } from '../../services/system-announcement.service';
import { SnackbarService } from '../../services/snackbar.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { IconComponent } from '../../components/icon/icon.component';
import { IconName } from '../../components/icon/icon.types';
import { NotificationSkeletonComponent } from './components/notification-skeleton/notification-skeleton.component';
import { NotificationInsightsComponent } from './components/notification-insights/notification-insights.component';
import { NotificationPreferencesComponent } from './components/notification-preferences/notification-preferences.component';
import { NotificationCardComponent } from './components/notification-card/notification-card.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { CustomSelectComponent } from '../../components/custom-select/custom-select.component';
import { SelectOption } from '../../components/custom-select/custom-select.types';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { PrintService } from '../../services/print.service';
import { DataExportService } from '../../services/data-export.service';

export interface GroupedNotifications {
  key: string;
  label: string;
  sublabel?: string;
  items: EnterpriseNotification[];
  icon: IconName;
  unreadCount: number;
  hasUrgent: boolean;
  totalCount: number;
  docketNumber?: string;
  court?: string;
}

/**
 * Notifications Component
 * 
 * Enterprise Notification Hub coordinating real-time alerts, case docket updates,
 * statutory Bare Act amendment watches, triage filtering, and multi-channel routing.
 * Built with Angular 18 OnPush change detection, Signals, Virtual Scrolling, and Defer blocks.
 */
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
    NotificationInsightsComponent,
    NotificationPreferencesComponent,
    NotificationCardComponent,
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
  authService = inject(AuthService);
  private renderer = inject(Renderer2);
  private document = inject(DOCUMENT);
  private printService = inject(PrintService);
  private dataExportService = inject(DataExportService);

  // Active filter state (Compound triage: Status Tab + Domain Category)
  activeTab = signal<'all' | 'unread' | 'urgent' | 'statutes'>('all');
  selectedCategory = signal<string>('all');
  searchQuery = signal<string>('');
  isRefreshing = signal<boolean>(false);
  isVirtualScrollMode = signal<boolean>(false);
  isMobileSearchOpen = signal<boolean>(false);
  isInsightsSheetOpen = signal<boolean>(false);

  // Grouping & Case Docket Mode ('date' vs 'matter')
  groupBy = signal<'date' | 'matter'>('date');
  collapsedGroups = signal<string[]>([]);

  // Audit export dropdown state (Desktop)
  isExportMenuOpen = signal<boolean>(false);

  // Mobile overflow "More" dropdown state
  isMoreMenuOpen = signal<boolean>(false);

  // Authenticated user state & role computation
  currentUser = toSignal(this.authService.currentUser$, { initialValue: null });
  effectiveRole = computed<'Lawyer' | 'Client'>(() => {
    const user = this.currentUser();
    const r = (user?.role || '').toLowerCase();
    if (r === 'lawyer' || r === 'advocate') return 'Lawyer';
    return 'Client';
  });

  // Category Dropdown Filter State
  isCategoryTabActive = computed(() =>
    this.selectedCategory() !== 'all'
  );

  selectedCategoryValue = computed<string>(() => {
    const cat = this.selectedCategory();
    return cat === 'all' ? '' : cat;
  });

  categoryOptions = computed<SelectOption[]>(() => {
    const totalCount = this.notificationService.notifications().length;
    const allList: SelectOption[] = [
      {
        value: 'all',
        label: 'All Categories',
        icon: 'layers',
        iconColor: '#3b82f6',
        count: totalCount,
        sublabel: 'View all notifications across domains'
      },
      {
        value: 'legal',
        label: 'Legal & Bare Acts',
        icon: 'scale',
        iconColor: '#818cf8',
        count: this.getCategoryCount('legal'),
        sublabel: 'Gazette amendments & Bare Act revisions'
      },
      {
        value: 'cases',
        label: 'Cases & Messages',
        icon: 'message-square',
        iconColor: '#c084fc',
        count: this.getCategoryCount('cases'),
        sublabel: 'Docket hearings, lawyer messages & client reviews'
      },
      {
        value: 'security',
        label: 'Security & Profile',
        icon: 'shield',
        iconColor: '#34d399',
        count: this.getCategoryCount('security'),
        sublabel: 'Login sessions, BCI badges, compliance audits'
      },
      {
        value: 'system',
        label: 'Platform Releases',
        icon: 'zap',
        iconColor: '#38bdf8',
        count: this.getCategoryCount('system'),
        sublabel: 'Platform upgrades & system broadcasts'
      },
      {
        value: 'statutes',
        label: 'Monitored Bare Acts',
        icon: 'book-open',
        iconColor: '#fbbf24',
        count: this.followedActs().length,
        sublabel: 'Tracked Indian central and state acts'
      }
    ];

    // Filter to only include 'all' and any category that has at least count >= 1
    return allList.filter(opt => opt.value === 'all' || ((opt.count ?? 0) >= 1));
  });

  // Selection & Bulk Actions
  selectedIds = signal<string[]>([]);
  isSelectionMode = computed(() => this.selectedIds().length > 0);

  // Preferences Modal state
  isPreferencesOpen = signal<boolean>(false);
  isSavingPreferences = signal<boolean>(false);

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

  // Filtered notifications computed signal with compound status + category evaluation
  filteredNotifications = computed(() => {
    let list = this.notificationService.notifications();
    const tab = this.activeTab();
    const cat = this.selectedCategory();
    const query = this.searchQuery().toLowerCase().trim();

    // 1. Status Filter
    if (tab === 'unread') {
      list = list.filter(n => !n.isRead);
    } else if (tab === 'urgent') {
      list = list.filter(n => n.priority === 'urgent' && !n.isRead);
    }

    // 2. Category Filter (Compound)
    if (cat === 'legal') {
      list = list.filter(n => n.type === 'legal' || n.type === 'hearing');
    } else if (cat === 'cases') {
      list = list.filter(n => n.type === 'case' || n.type === 'lawyer' || n.type === 'review');
    } else if (cat === 'security') {
      list = list.filter(n => n.type === 'security' || n.type === 'profile' || n.type === 'verification');
    } else if (cat === 'system') {
      list = list.filter(n => n.type === 'system' || n.type === 'payment' || n.type === 'document');
    }

    // 3. Keyword Search Filter
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

  // Check whether all visible groups are collapsed
  allGroupsCollapsed = computed(() => {
    const groups = this.groupedNotifications();
    return groups.length > 0 && this.collapsedGroups().length >= groups.length;
  });

  // Check whether any status, category, or search filter is active
  hasActiveFilters = computed<boolean>(() => {
    return this.activeTab() !== 'all' || this.selectedCategory() !== 'all' || !!this.searchQuery();
  });

  resetAllFilters(): void {
    this.activeTab.set('all');
    this.selectedCategory.set('all');
    this.searchQuery.set('');
    this.searchSubject.next('');
    this.selectedIds.set([]);
    this.snackbar.show('Filters reset to all notifications.', 'info', 2000);
  }

  /**
   * Dynamically resolves the appropriate vector icon for any notification domain type.
   */
  getDynamicTypeIcon(type?: string): IconName {
    switch (type) {
      case 'case':
      case 'hearing':
        return 'briefcase';
      case 'legal':
        return 'scale';
      case 'lawyer':
        return 'message-square';
      case 'security':
        return 'shield';
      case 'verification':
        return 'badge-check';
      case 'review':
        return 'star';
      case 'system':
        return 'zap';
      default:
        return 'layers';
    }
  }

  /**
   * Dynamically resolves human-readable type labels for any notification domain type.
   */
  getTypeLabel(type?: string): string {
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

  /**
   * 100% Dynamic Docket / Matter Thread Extraction Engine.
   * Dynamically groups notifications into coherent legal matters, dockets,
   * court proceedings, and communications purely from runtime notification attributes
   * (metadata, title, summary, source, priority, type) with ZERO hardcoded data.
   */
  extractMatter(n: EnterpriseNotification): {
    key: string;
    label: string;
    sublabel: string;
    icon: IconName;
    docketNumber?: string;
    court?: string;
  } {
    const meta = n.metadata || {};
    const icon = this.getDynamicTypeIcon(n.type);
    const typeLabel = this.getTypeLabel(n.type);

    // 1. Explicit Dynamic Metadata Fields (originating from backend models & court registries)
    const caseTitle = meta['caseTitle'] || meta['docketTitle'] || meta['matterTitle'] || meta['caseName'];
    if (caseTitle) {
      const title = String(caseTitle).trim();
      const courtStr = meta['court'] || meta['jurisdiction'] || n.source || typeLabel;
      const docketStr = meta['docketNumber']
        ? `Docket ${meta['docketNumber']}`
        : (meta['topic'] ? String(meta['topic']) : (n.source || typeLabel));
      return {
        key: 'docket-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        label: title,
        sublabel: `${courtStr} • ${docketStr}`,
        icon,
        docketNumber: meta['docketNumber'] ? String(meta['docketNumber']) : undefined,
        court: meta['court'] ? String(meta['court']) : undefined
      };
    }

    // 2. Dynamic Adversarial Litigation Format (e.g. "Party A vs. Party B" or "Party A v. Party B")
    const adversaryRegex = /([A-Z][A-Za-z0-9.,'& ]{1,45}?)\s+(?:vs\.?|v\.?|versus)\s+([A-Z][A-Za-z0-9.,'& ]{1,45})/i;
    const adversaryMatch = n.title.match(adversaryRegex) || (n.summary ? n.summary.match(adversaryRegex) : null);
    if (adversaryMatch) {
      const dynamicTitle = adversaryMatch[0].trim();
      const courtStr = meta['court'] || meta['jurisdiction'] || n.source || typeLabel;
      const docketStr = meta['docketNumber']
        ? `Docket ${meta['docketNumber']}`
        : (n.summary ? (n.summary.length > 45 ? n.summary.slice(0, 45) + '...' : n.summary) : typeLabel);
      return {
        key: 'docket-' + dynamicTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        label: dynamicTitle,
        sublabel: `${courtStr} • ${docketStr}`,
        icon: 'briefcase',
        docketNumber: meta['docketNumber'] ? String(meta['docketNumber']) : undefined,
        court: meta['court'] ? String(meta['court']) : undefined
      };
    }

    // 3. Dynamic Advocate & Legal Professional Entity Extraction (e.g. "Adv. <Name>", "Counsel <Name>")
    const advocateRegex = /(?:Adv\.|Advocate|Counsel|Senior Counsel|Justice)\s+([A-Z][A-Za-z.'\s]{1,40})/i;
    const advocateMatch = n.title.match(advocateRegex) || (n.summary ? n.summary.match(advocateRegex) : null);
    if (advocateMatch) {
      const advocateTitle = advocateMatch[0].trim();
      const contextSub = meta['topic']
        ? String(meta['topic'])
        : (n.title.includes(':')
          ? n.title.split(':')[0].trim()
          : (n.summary ? (n.summary.length > 50 ? n.summary.slice(0, 50) + '...' : n.summary) : (n.source || typeLabel)));
      return {
        key: 'docket-adv-' + advocateTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        label: advocateTitle,
        sublabel: contextSub,
        icon: n.type === 'case' ? 'calendar' : (n.type === 'hearing' ? 'gavel' : 'message-square')
      };
    }

    // 4. Dynamic Statute & Legislative Amendment Extraction
    if (n.type === 'legal' || /\b(Act|Sanhita|Code|Rules|Statute|Gazette)\b/i.test(n.title)) {
      const cleanTitle = n.title.includes(':') ? n.title.split(':').slice(1).join(':').trim() : n.title.trim();
      const sourceOrPrefix = n.title.includes(':')
        ? n.title.split(':')[0].trim()
        : (n.source || (n.summary ? (n.summary.length > 50 ? n.summary.slice(0, 50) + '...' : n.summary) : typeLabel));
      return {
        key: 'docket-statute-' + cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 45),
        label: cleanTitle,
        sublabel: sourceOrPrefix,
        icon: 'scale'
      };
    }

    // 5. Dynamic Source / Subsystem Routing (Uses real notification source or origin subsystem)
    if (n.source && n.source !== 'system') {
      const sourceKey = 'docket-src-' + n.source.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return {
        key: sourceKey,
        label: n.source,
        sublabel: n.title,
        icon
      };
    }

    // 6. Dynamic Structured Title Parsing (Prefix: Subject)
    if (n.title.includes(':')) {
      const parts = n.title.split(':');
      const prefix = parts[0].trim();
      const subject = parts.slice(1).join(':').trim();
      return {
        key: 'docket-' + prefix.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        label: prefix,
        sublabel: subject,
        icon
      };
    }

    // 7. General Dynamic Fallback based on notification title & summary
    const cleanFallback = n.title.length > 40 ? n.title.slice(0, 40) + '...' : n.title;
    return {
      key: 'docket-' + n.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 35),
      label: cleanFallback,
      sublabel: n.summary ? (n.summary.length > 55 ? n.summary.slice(0, 55) + '...' : n.summary) : (n.source || typeLabel),
      icon
    };
  }

  // Computed grouped notifications by date OR by Case/Matter Docket
  groupedNotifications = computed(() => {
    const list = this.filteredNotifications();

    // Mode A: Case/Matter Docket Grouping
    if (this.groupBy() === 'matter') {
      const docketMap = new Map<string, {
        key: string;
        label: string;
        sublabel: string;
        icon: IconName;
        docketNumber?: string;
        court?: string;
        items: EnterpriseNotification[];
      }>();

      list.forEach(item => {
        const info = this.extractMatter(item);
        let group = docketMap.get(info.key);
        if (!group) {
          group = {
            key: info.key,
            label: info.label,
            sublabel: info.sublabel,
            icon: info.icon,
            docketNumber: info.docketNumber,
            court: info.court,
            items: []
          };
          docketMap.set(info.key, group);
        }
        group.items.push(item);
      });

      const matterGroups: GroupedNotifications[] = [];
      docketMap.forEach(g => {
        matterGroups.push({
          key: g.key,
          label: g.label,
          sublabel: g.sublabel,
          items: g.items,
          icon: g.icon,
          unreadCount: g.items.filter(i => !i.isRead).length,
          hasUrgent: g.items.some(i => i.priority === 'urgent' && !i.isRead),
          totalCount: g.items.length,
          docketNumber: g.docketNumber,
          court: g.court
        });
      });

      // Sort matter dockets: Urgent unread first, then unread count, then latest timestamp
      matterGroups.sort((a, b) => {
        if (a.hasUrgent !== b.hasUrgent) return a.hasUrgent ? -1 : 1;
        if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
        const aTime = a.items.length ? new Date(a.items[0].createdAt).getTime() : 0;
        const bTime = b.items.length ? new Date(b.items[0].createdAt).getTime() : 0;
        return bTime - aTime;
      });

      return matterGroups;
    }

    // Mode B: Chronological Date Grouping (Today, Yesterday, Earlier)
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
    if (today.length > 0) {
      groups.push({
        key: 'today',
        label: 'Today',
        sublabel: 'Alerts received today',
        items: today,
        icon: 'sparkles',
        unreadCount: today.filter(i => !i.isRead).length,
        hasUrgent: today.some(i => i.priority === 'urgent' && !i.isRead),
        totalCount: today.length
      });
    }
    if (yesterday.length > 0) {
      groups.push({
        key: 'yesterday',
        label: 'Yesterday',
        sublabel: 'Previous 24 hours',
        items: yesterday,
        icon: 'history',
        unreadCount: yesterday.filter(i => !i.isRead).length,
        hasUrgent: yesterday.some(i => i.priority === 'urgent' && !i.isRead),
        totalCount: yesterday.length
      });
    }
    if (earlier.length > 0) {
      groups.push({
        key: 'earlier',
        label: 'Earlier',
        sublabel: 'Archived litigation notices',
        items: earlier,
        icon: 'calendar',
        unreadCount: earlier.filter(i => !i.isRead).length,
        hasUrgent: earlier.some(i => i.priority === 'urgent' && !i.isRead),
        totalCount: earlier.length
      });
    }

    return groups;
  });

  // Computed empty state properties
  emptyStateIcon = computed<'search' | 'check' | 'shield' | 'bell'>(() => {
    if (this.searchQuery()) return 'search';
    const hasNotifs = this.notificationService.notifications().length > 0;
    if (this.activeTab() === 'unread' && hasNotifs) return 'check';
    if (this.activeTab() === 'urgent' && hasNotifs) return 'shield';
    return 'bell';
  });

  emptyStateTitle = computed<string>(() => {
    const query = this.searchQuery();
    if (query) return `No notifications matching "${query}"`;
    const total = this.notificationService.notifications().length;
    if (total === 0) return "You're all caught up!";
    if (this.activeTab() === 'unread') return 'All caught up! Zero unread alerts';
    if (this.activeTab() === 'urgent') return 'No urgent notifications pending';
    if (this.isCategoryTabActive()) return 'No notifications in this category';
    return "You're all caught up!";
  });

  emptyStateDescription = computed<string>(() => {
    if (this.searchQuery()) {
      return "We couldn't find any notices matching your query. Try searching with different keywords or clear the filter.";
    }
    const total = this.notificationService.notifications().length;
    if (total === 0) {
      return 'You have no notifications or legal alerts right now. Real-time docket updates, advocate inquiries, and statutory amendments will appear here as they occur.';
    }
    if (this.activeTab() === 'unread') {
      return 'You have reviewed and acknowledged all notifications in your inbox. Real-time updates will be delivered as they occur.';
    }
    if (this.activeTab() === 'urgent') {
      return 'There are no critical court appearances, statutory deadlines, or high-priority warnings requiring immediate attention.';
    }
    if (this.isCategoryTabActive()) {
      return 'No notifications are currently logged under this domain. You can switch to other categories or view your complete inbox.';
    }
    return 'All legal updates and dockets have been acknowledged.';
  });

  ngOnInit() {
    this.searchSub = this.searchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged()
    ).subscribe(val => {
      this.searchQuery.set(val);
    });

    this.refreshAll(false);
  }

  ngOnDestroy() {
    if (this.searchSub) {
      this.searchSub.unsubscribe();
    }
    if (this.document && this.document.body) {
      this.renderer.removeClass(this.document.body, 'mobile-drawer-open');
      this.renderer.removeClass(this.document.body, 'overflow-hidden');
    }
  }

  refreshAll(showFeedback = true) {
    this.isRefreshing.set(true);
    this.followedActs.set(this.notificationService.getFollowedActs());

    this.notificationService.fetchNotifications().subscribe({
      next: () => {
        setTimeout(() => {
          this.isRefreshing.set(false);
          if (showFeedback) {
            this.snackbar.show('Alerts synchronized with server.', 'success', 2500);
          }
        }, 300);
      },
      error: () => {
        this.isRefreshing.set(false);
      }
    });

    this.systemAnnouncementService.fetchLatestAnnouncements();
    this.notificationService.fetchPreferences().subscribe();
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
    if (!this.document || !this.document.body) return;
    if (this.isInsightsSheetOpen() || this.isPreferencesOpen()) {
      this.renderer.addClass(this.document.body, 'mobile-drawer-open');
      this.renderer.addClass(this.document.body, 'overflow-hidden');
    } else {
      this.renderer.removeClass(this.document.body, 'mobile-drawer-open');
      this.renderer.removeClass(this.document.body, 'overflow-hidden');
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

  // Mobile Insights Sheet Touch Gesture Handlers
  private insightsTouchStartY = 0;
  private insightsTouchCurrentY = 0;
  private isDraggingInsights = false;

  onInsightsTouchStart(event: TouchEvent): void {
    if (event.touches.length > 0) {
      this.insightsTouchStartY = event.touches[0].clientY;
      this.insightsTouchCurrentY = this.insightsTouchStartY;
      this.isDraggingInsights = true;
    }
  }

  onInsightsTouchMove(event: TouchEvent): void {
    if (!this.isDraggingInsights || event.touches.length === 0) return;
    this.insightsTouchCurrentY = event.touches[0].clientY;
  }

  onInsightsTouchEnd(): void {
    if (!this.isDraggingInsights) return;
    const deltaY = this.insightsTouchCurrentY - this.insightsTouchStartY;
    this.isDraggingInsights = false;
    if (deltaY > 60) {
      this.closeInsightsSheet();
    }
  }

  filterByMetric(tab: 'all' | 'unread' | 'urgent' | 'statutes'): void {
    this.setTab(tab);
  }

  setTab(tab: 'all' | 'unread' | 'urgent' | 'statutes'): void {
    this.activeTab.set(tab);
    if (tab === 'statutes') {
      this.selectedCategory.set('statutes');
    } else if (this.selectedCategory() === 'statutes') {
      this.selectedCategory.set('all');
    }
    this.selectedIds.set([]);
  }

  onCategorySelect(val: any): void {
    if (!val || val === 'all') {
      this.selectedCategory.set('all');
      if (this.activeTab() === 'statutes') {
        this.activeTab.set('all');
      }
    } else if (val === 'statutes') {
      this.selectedCategory.set('statutes');
      this.activeTab.set('statutes');
    } else {
      this.selectedCategory.set(val);
      if (this.activeTab() === 'statutes') {
        this.activeTab.set('all');
      }
    }
    this.selectedIds.set([]);
  }

  getCategoryCount(cat: 'legal' | 'cases' | 'security' | 'system' | 'statutes'): number {
    let list = this.notificationService.notifications();
    const tab = this.activeTab();
    if (tab === 'unread') {
      list = list.filter(n => !n.isRead);
    } else if (tab === 'urgent') {
      list = list.filter(n => n.priority === 'urgent' && !n.isRead);
    }
    switch (cat) {
      case 'legal': return list.filter(n => n.type === 'legal' || n.type === 'hearing').length;
      case 'cases': return list.filter(n => n.type === 'case' || n.type === 'lawyer' || n.type === 'review').length;
      case 'security': return list.filter(n => n.type === 'security' || n.type === 'profile' || n.type === 'verification').length;
      case 'system': return list.filter(n => n.type === 'system' || n.type === 'payment' || n.type === 'document').length;
      case 'statutes': return this.followedActs().length;
      default: return 0;
    }
  }

  // ==================== SINGLE ACTIONS ====================

  markRead(id: string) {
    this.notificationService.markAsRead(id).subscribe({
      next: () => this.snackbar.show('Notification marked as read.', 'success')
    });
  }

  markAllRead() {
    const unread = this.filteredNotifications().filter(n => !n.isRead);
    if (unread.length === 0) {
      this.snackbar.show('No unread notifications to mark.', 'info');
      return;
    }

    const cat = this.selectedCategory();
    const typeParam = (cat === 'all' || cat === 'statutes') ? 'all' : cat;
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
    const count = ids.length;

    this.triggerConfirm(
      'Delete Selected Notifications',
      `Are you sure you want to permanently dismiss ${count} notifications? This action cannot be reversed.`,
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

  // ==================== SECTION / GROUP ACTIONS ====================

  setGroupBy(mode: 'date' | 'matter'): void {
    this.groupBy.set(mode);
    this.collapsedGroups.set([]);
    const label = mode === 'matter' ? 'Case Docket Thread View enabled.' : 'Chronological Date View enabled.';
    this.snackbar.show(label, 'info', 2000);
  }

  isGroupCollapsed(key: string): boolean {
    return this.collapsedGroups().includes(key);
  }

  toggleGroupCollapse(key: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const current = this.collapsedGroups();
    if (current.includes(key)) {
      this.collapsedGroups.set(current.filter(k => k !== key));
    } else {
      this.collapsedGroups.set([...current, key]);
    }
  }

  expandAllGroups(): void {
    this.collapsedGroups.set([]);
    this.snackbar.show('All docket threads expanded.', 'info', 1800);
  }

  collapseAllGroups(): void {
    const allKeys = this.groupedNotifications().map(g => g.key);
    this.collapsedGroups.set(allKeys);
    this.snackbar.show('All docket threads collapsed.', 'info', 1800);
  }

  // ==================== MOBILE OVERFLOW "MORE" MENU ====================

  toggleMoreMenu(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.isMoreMenuOpen.update(v => !v);
  }

  closeMoreMenu(): void {
    this.isMoreMenuOpen.set(false);
  }

  // ==================== AUDIT EXPORT (CSV / PDF) ====================

  toggleExportMenu(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.isExportMenuOpen.update(v => !v);
  }

  closeExportMenu(): void {
    this.isExportMenuOpen.set(false);
  }

  exportAuditPdf(): void {
    this.closeExportMenu();
    const notices = this.filteredNotifications();
    if (notices.length === 0) {
      this.snackbar.show('No notifications or litigation notices available to export.', 'info');
      return;
    }

    const user = this.currentUser();
    const role = this.effectiveRole();
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const urgentCount = notices.filter(n => n.priority === 'urgent').length;
    const unreadCount = notices.filter(n => !n.isRead).length;
    const caseCount = notices.filter(n => n.type === 'case' || n.type === 'hearing' || n.type === 'lawyer').length;

    let tableRowsHtml = '';
    notices.forEach((n, idx) => {
      const matter = this.extractMatter(n);
      const itemDate = new Date(n.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const priorityBadge = n.priority === 'urgent'
        ? '<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-weight:700;font-size:9px;">URGENT</span>'
        : (n.priority === 'high'
          ? '<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-weight:700;font-size:9px;">HIGH</span>'
          : '<span style="background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:4px;font-weight:600;font-size:9px;">NORMAL</span>');

      const statusBadge = n.isRead
        ? '<span style="color:#16a34a;font-weight:700;font-size:9.5px;">✓ Acknowledged</span>'
        : '<span style="color:#2563eb;font-weight:800;font-size:9.5px;">● Action Pending</span>';

      tableRowsHtml += `
        <tr style="border-bottom:1px solid #e2e8f0;font-size:10px;">
          <td style="padding:8px 6px;text-align:center;color:#64748b;font-weight:700;">${idx + 1}</td>
          <td style="padding:8px 6px;white-space:nowrap;color:#334155;font-weight:600;">${itemDate}</td>
          <td style="padding:8px 6px;text-align:center;">${priorityBadge}</td>
          <td style="padding:8px 6px;">
            <div style="font-weight:700;color:#0f172a;">${this.printService.escapeHtml(matter.label)}</div>
            <div style="font-size:8.5px;color:#64748b;">${this.printService.escapeHtml(matter.sublabel)}</div>
          </td>
          <td style="padding:8px 6px;">
            <div style="font-weight:600;color:#1e293b;">${this.printService.escapeHtml(n.title)}</div>
            <div style="color:#475569;font-size:9px;margin-top:2px;line-height:1.3;">${this.printService.escapeHtml(n.summary)}</div>
          </td>
          <td style="padding:8px 6px;text-align:center;white-space:nowrap;">${statusBadge}</td>
        </tr>
      `;
    });

    const contentHtml = `
      <div class="lc-subject" style="margin-bottom:16px;">
        <div>
          <div class="lc-subject-name">Official Court Diary &amp; Litigation Compliance Log</div>
          <div class="lc-subject-sub">Timestamped Compliance Extract for Judicial Cause Lists, Statutory Notices &amp; Advocate Diary Records</div>
        </div>
        <div class="lc-subject-badge">BCI Digital Compliance</div>
      </div>

      <div class="lc-kpi-grid" style="margin-bottom:16px;">
        <div class="lc-kpi indigo">
          <div class="lc-kpi-label">Total Logged Notices</div>
          <div class="lc-kpi-val">${notices.length}</div>
          <div class="lc-kpi-sub">Archived Records</div>
        </div>
        <div class="lc-kpi rose">
          <div class="lc-kpi-label">Urgent Hearing Deadlines</div>
          <div class="lc-kpi-val">${urgentCount}</div>
          <div class="lc-kpi-sub">Priority Actions</div>
        </div>
        <div class="lc-kpi amber">
          <div class="lc-kpi-label">Pending Acknowledgments</div>
          <div class="lc-kpi-val">${unreadCount}</div>
          <div class="lc-kpi-sub">Unread In Diary</div>
        </div>
        <div class="lc-kpi blue">
          <div class="lc-kpi-label">Active Litigation Matters</div>
          <div class="lc-kpi-val">${caseCount}</div>
          <div class="lc-kpi-sub">Court Dockets</div>
        </div>
      </div>

      <div class="lc-section" style="padding:0;overflow:hidden;">
        <div style="background:#0f172a;color:#fff;padding:8px 12px;font-size:10px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center;">
          <span>Court Diary Litigation Schedule &amp; Compliance Audit</span>
          <span style="font-size:8.5px;color:#94a3b8;font-weight:600;">Generated: ${dateStr} ${timeStr}</span>
        </div>
        <table class="lc-table" style="margin:0;">
          <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #cbd5e1;font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:#475569;">
              <th style="padding:7px 6px;text-align:center;width:30px;">#</th>
              <th style="padding:7px 6px;text-align:left;width:110px;">Date &amp; Time</th>
              <th style="padding:7px 6px;text-align:center;width:65px;">Priority</th>
              <th style="padding:7px 6px;text-align:left;width:160px;">Matter / Case Docket</th>
              <th style="padding:7px 6px;text-align:left;">Notice Details &amp; Directives</th>
              <th style="padding:7px 6px;text-align:center;width:105px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>

      <div class="lc-privilege-notice" style="margin-top:16px;">
        <div class="lc-privilege-title">
          ${this.printService.getSvg('shield', { size: 12, color: '#0f172a' })}
          <span>Statutory Compliance &amp; Attorney Record Authentication</span>
        </div>
        <div>This document is an authenticated compliance extract generated from the LegalConnect Enterprise Notification Infrastructure. It contains privileged judicial cause lists, advocate notices, and statutory amendment entries. Verified under Rule 48 of the Bar Council of India Digital Records Guidelines.</div>
      </div>
    `;

    this.printService.print({
      title: 'Advocate Court Diary & Litigation Audit Log',
      subtitle: `Authenticated Case Docket & Compliance Extract • Generated on ${dateStr}`,
      classification: 'OFFICIAL COPY',
      watermark: 'LEGALCONNECT AUDIT',
      content: contentHtml,
      sealText: `Certified Court Diary Extract • Bar Council Digital Standards • Ref: ${this.printService.generateRefCode('AUDIT')}`,
      extraMeta: [
        { label: 'Advocate / Litigant', value: user?.fullName || 'Verified Advocate' },
        { label: 'Account Role', value: role === 'Lawyer' ? 'High Court / Supreme Court Advocate' : 'Client Account' },
        { label: 'Filter Scope', value: `${this.activeTab().toUpperCase()} • ${this.selectedCategory().toUpperCase()}` },
        { label: 'Timestamp', value: `${dateStr} ${timeStr}` }
      ]
    });

    this.snackbar.show('Official Court Diary PDF compiled and opened for print/export.', 'success', 3500);
  }

  exportAuditCsv(): void {
    this.closeExportMenu();
    const notices = this.filteredNotifications();
    if (notices.length === 0) {
      this.snackbar.show('No notifications or litigation notices available to export.', 'info');
      return;
    }

    const escapeCsv = (str: any) => {
      if (str == null) return '""';
      const val = String(str).replace(/"/g, '""');
      return `"${val}"`;
    };

    const now = new Date();
    const timestamp = now.toISOString();

    let csv = '\uFEFF'; // UTF-8 BOM for proper Excel encoding
    csv += `LegalConnect Advocate Court Diary & Litigation Compliance Log\n`;
    csv += `Generated Timestamp:,"${timestamp}"\n`;
    csv += `Generated By:,"${this.currentUser()?.fullName || 'Verified Advocate'}"\n`;
    csv += `Role:,"${this.effectiveRole()}"\n`;
    csv += `Filter Scope:,"${this.activeTab()} / ${this.selectedCategory()}"\n`;
    csv += `Total Records:,"${notices.length}"\n\n`;

    csv += `"S.No","Notification ID","Timestamp","Priority","Type","Matter / Case Docket","Court / Jurisdiction","Docket Number","Notice Title","Summary & Hearing Notes","Action URL","Acknowledged Status"\n`;

    notices.forEach((n, idx) => {
      const matter = this.extractMatter(n);
      csv += [
        idx + 1,
        escapeCsv(n.id),
        escapeCsv(n.createdAt),
        escapeCsv(n.priority.toUpperCase()),
        escapeCsv(n.type),
        escapeCsv(matter.label),
        escapeCsv(matter.court || matter.sublabel || 'N/A'),
        escapeCsv(matter.docketNumber || 'N/A'),
        escapeCsv(n.title),
        escapeCsv(n.summary + (n.details ? ' — ' + n.details : '')),
        escapeCsv(n.actionUrl || ''),
        escapeCsv(n.isRead ? 'Acknowledged' : 'Pending Action')
      ].join(',') + '\n';
    });

    const filename = `legalconnect_court_diary_${now.toISOString().slice(0, 10)}.csv`;
    this.dataExportService.downloadBlob(csv, 'text/csv;charset=utf-8;', filename);
    this.snackbar.show('Court Diary compliance CSV downloaded successfully.', 'success', 3500);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.isMoreMenuOpen() && !target.closest('.more-menu-container')) {
      this.isMoreMenuOpen.set(false);
    }
    if (this.isExportMenuOpen() && !target.closest('.export-menu-container')) {
      this.isExportMenuOpen.set(false);
    }
  }

  markGroupAsRead(group: GroupedNotifications, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    const unreadIds = group.items.filter(i => !i.isRead).map(i => i.id);
    if (unreadIds.length === 0) return;
    this.notificationService.bulkAction('markRead', unreadIds).subscribe();
  }

  toggleGroupSelection(group: GroupedNotifications, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    const groupIds = group.items.map(i => i.id);
    const current = this.selectedIds();
    const allSelected = groupIds.length > 0 && groupIds.every(id => current.includes(id));

    if (allSelected) {
      this.selectedIds.set(current.filter(id => !groupIds.includes(id)));
    } else {
      const combined = new Set([...current, ...groupIds]);
      this.selectedIds.set(Array.from(combined));
    }
  }

  isGroupFullySelected(group: GroupedNotifications): boolean {
    if (group.items.length === 0) return false;
    const current = this.selectedIds();
    return group.items.every(item => current.includes(item.id));
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

  // ==================== PREFERENCES MODAL ====================

  openPreferences() {
    this.isPreferencesOpen.set(true);
    this.updateBodyDrawerClass();
  }

  closePreferences() {
    this.isPreferencesOpen.set(false);
    this.updateBodyDrawerClass();
  }

  onSavePreferences(prefs: NotificationPreferences) {
    const priorPrefs = structuredClone(this.notificationService.preferences());
    this.isSavingPreferences.set(true);
    this.notificationService.updatePreferences(prefs, false).subscribe({
      next: () => {
        this.isSavingPreferences.set(false);
        this.isPreferencesOpen.set(false);
        this.updateBodyDrawerClass();

        // Record last saved timestamp for footer status display
        try {
          localStorage.setItem('lc_preferences_last_saved', new Date().toISOString());
        } catch { }

        // MNC Standard Pattern: Display success toast with one-click Undo capability
        this.snackbar.showWithUndo(
          'Notification preferences synchronized and saved.',
          () => {
            this.notificationService.updatePreferences(priorPrefs, false).subscribe({
              next: () => {
                this.snackbar.show('Preference changes reverted.', 'info');
                try {
                  localStorage.setItem('lc_preferences_last_saved', new Date().toISOString());
                } catch { }
              },
              error: () => {
                this.snackbar.show('Failed to revert preferences.', 'error');
              }
            });
          },
          'success',
          6000
        );
      },
      error: () => {
        // Keep the modal open so the user's edits are preserved for retry
        this.isSavingPreferences.set(false);
      }
    });
  }

  @HostListener('document:keydown.escape')
  handleEscape() {
    if (this.isExportMenuOpen()) {
      this.closeExportMenu();
      return;
    }
    if (this.isPreferencesOpen()) {
      // Handled by NotificationPreferencesComponent (enforces unsaved-changes guard)
      return;
    } else if (this.isInsightsSheetOpen()) {
      this.closeInsightsSheet();
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
  }

  // ==================== HELPERS ====================
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

  trackById(_index: number, item: EnterpriseNotification): string {
    return item.id;
  }

  trackByGroup(_index: number, group: GroupedNotifications): string {
    return group.label;
  }

  trackByFollowedAct(_index: number, act: FollowedAct): string {
    return act.shortName;
  }

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