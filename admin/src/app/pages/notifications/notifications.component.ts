import {
  Component, OnInit, OnDestroy, inject, signal, computed,
  ChangeDetectionStrategy, ChangeDetectorRef, HostListener, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';

import { ActivityStreamService, ActivityEvent, NotificationQueryParams } from '../../core/services/activity-stream.service';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { formatDateRange } from '../../shared/components/export-modal/export-modal.component';

// Shared enterprise components
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { AdminSearchInputComponent, AdminEmptyStateComponent } from '../../shared/components/data-table/data-table-helpers.component';
import { ExportModalComponent, ExportConfig } from '../../shared/components/export-modal/export-modal.component';
import { DateRangePickerComponent, DateRangeEvent } from '../../shared/components/date-range-picker/date-range-picker.component';
import { ActionMenuComponent } from '../../shared/components/action-menu/action-menu.component';

export interface NotificationGroup {
  label: string;
  items: ActivityEvent[];
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TooltipDirective,
    RelativeTimePipe,
    PaginationComponent,
    SelectComponent,
    AdminSearchInputComponent,
    AdminEmptyStateComponent,
    ExportModalComponent,
    DateRangePickerComponent,
    ActionMenuComponent
  ],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationsComponent implements OnInit, OnDestroy {
  protected activityService = inject(ActivityStreamService);
  protected toastService = inject(ToastService);
  protected dialogService = inject(DialogService);
  protected route = inject(ActivatedRoute);
  protected router = inject(Router);
  protected cdr = inject(ChangeDetectorRef);

  // Flag to prevent double-fetch loop during router navigation
  private isNavigatingUrl = false;

  // Subscriptions
  private routeSub?: Subscription;
  private pollSub?: Subscription;

  // Filter State Signals
  page = signal<number>(1);
  limit = signal<number>(10);
  searchQuery = signal<string>('');
  selectedSeverity = signal<string>('');
  selectedCategory = signal<string>('');
  selectedTab = signal<string>('all'); // all, unread, starred, archived
  selectedRole = signal<string>(''); // all, SuperAdmin, VerificationOfficer, SupportDesk
  sortBy = signal<string>('');
  startDate = signal<string>('');
  endDate = signal<string>('');

  // Focused Card Index for Keyboard Navigation (j/k)
  focusedIndex = signal<number>(-1);

  // Expanded Card Details State
  expandedId = signal<string | null>(null);

  // Bulk Operations State
  selectedIds = signal<Set<string>>(new Set<string>());

  // Controls State
  viewMode = signal<'inbox' | 'telemetry' | 'all'>('inbox');
  isSidebarCollapsed = signal<boolean>(false);
  isLiveStreaming = signal<boolean>(true);
  soundEnabled = signal<boolean>(false);

  // Export Modal State
  isExportModalOpen = signal<boolean>(false);
  isExporting = signal<boolean>(false);

  // Kebab Menu Action Menu State
  openActionMenuId = signal<string | null>(null);
  activeMenuEvent = signal<ActivityEvent | null>(null);
  @ViewChild('actionMenu') actionMenuRef!: ActionMenuComponent;

  // Quick Action Loading State
  quickActionLoading = signal<string | null>(null);

  // Dropdown Select Options
  severitySelectOptions: SelectOption[] = [
    { label: 'All Severities', value: '', icon: 'shield' },
    { label: 'Critical Threat', value: 'critical', icon: 'warning', color: '#f43f5e' },
    { label: 'Warning / Audit', value: 'warning', icon: 'warning', color: '#f59e0b' },
    { label: 'Informational', value: 'info', icon: 'info', color: '#6366f1' },
    { label: 'Release / Success', value: 'success', icon: 'check', color: '#10b981' }
  ];

  categorySelectOptions: SelectOption[] = [
    { label: 'All Domains', value: '' },
    { label: 'Security & Audit', value: 'security', color: '#f43f5e' },
    { label: 'Lawyer Verification', value: 'verification', color: '#818cf8' },
    { label: 'Support Desk', value: 'support', color: '#f59e0b' },
    { label: 'Consultations', value: 'consultation', color: '#38bdf8' },
    { label: 'Announcements', value: 'announcement', color: '#a855f7' }
  ];

  roleSelectOptions: SelectOption[] = [
    { label: 'All Roles', value: '' },
    { label: 'Super Admin / DevOps', value: 'SuperAdmin', color: '#f43f5e' },
    { label: 'Verification Officer', value: 'VerificationOfficer', color: '#818cf8' },
    { label: 'Support Desk', value: 'SupportDesk', color: '#f59e0b' }
  ];

  sortSelectOptions: SelectOption[] = [
    { label: 'Sort: Newest First', value: '', icon: 'clock' },
    { label: 'Sort: Oldest First', value: 'oldest', icon: 'clock' },
    { label: 'Sort: Highest Severity', value: 'severity', icon: 'warning' }
  ];

  exportColumnDefs = [
    { key: 'id', label: 'Event ID' },
    { key: 'severity', label: 'Severity Tier' },
    { key: 'category', label: 'Domain Category' },
    { key: 'title', label: 'Title' },
    { key: 'message', label: 'Summary Message' },
    { key: 'source', label: 'Telemetry Source' },
    { key: 'timestamp', label: 'Timestamp' },
    { key: 'read', label: 'Read Status' },
    { key: 'detailsMarkdown', label: 'Details (Markdown)' },
    { key: 'relatedEntityType', label: 'Related Entity Type' },
    { key: 'relatedEntityId', label: 'Related Entity ID' },
    { key: 'targetRole', label: 'Target Admin Role' }
  ];

  // Computed Values from ActivityStreamService Signals
  events = computed(() => this.activityService.events());
  pagination = computed(() => this.activityService.pagination());
  stats = computed(() => this.activityService.stats());
  severityStats = computed(() => this.activityService.severityStats());
  securityHealth = computed(() => this.activityService.securityHealth());
  isLoading = computed(() => this.activityService.isLoading());
  apiLatency = computed(() => this.activityService.apiLatencyMs());
  signalRConnected = computed(() => this.activityService.signalRConnected());

  // Active Filter Computed Details for Chip Bar & Badges
  activeFilterCount = computed(() => {
    let count = 0;
    if (this.selectedSeverity()) count++;
    if (this.selectedCategory()) count++;
    if (this.selectedRole()) count++;
    if (this.startDate() || this.endDate()) count++;
    if (this.searchQuery()) count++;
    return count;
  });

  selectedSeverityLabel = computed(() => {
    const val = this.selectedSeverity();
    if (!val) return '';
    const found = this.severitySelectOptions.find(o => o.value === val);
    return found ? found.label : val;
  });

  selectedCategoryLabel = computed(() => {
    const val = this.selectedCategory();
    if (!val) return '';
    const found = this.categorySelectOptions.find(o => o.value === val);
    return found ? found.label : val;
  });

  selectedRoleLabel = computed(() => {
    const val = this.selectedRole();
    if (!val) return '';
    const found = this.roleSelectOptions.find(o => o.value === val);
    return found ? found.label : val;
  });

  dateRangeLabel = computed(() => {
    return formatDateRange(this.startDate(), this.endDate());
  });

  // Grouped Notification Events (by Date: Today, Yesterday, Earlier)
  groupedEvents = computed<NotificationGroup[]>(() => {
    let list = this.events();
    if (!list || list.length === 0) return [];

    const mode = this.viewMode();
    if (mode === 'inbox') {
      list = list.filter(ev =>
        ev.category === 'verification' ||
        ev.category === 'support' ||
        ev.category === 'consultation' ||
        ev.type === 'verification_req' ||
        ev.type === 'urgent_ticket' ||
        ev.type === 'lawyer_reg' ||
        !!ev.actionLabel ||
        !ev.read
      );
    } else if (mode === 'telemetry') {
      list = list.filter(ev =>
        ev.category === 'security' ||
        ev.category === 'announcement' ||
        ev.severity === 'critical' ||
        (ev.source && (ev.source.includes('Monitor') || ev.source.includes('System')))
      );
    }

    const now = new Date();
    const todayStr = now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const todayItems: ActivityEvent[] = [];
    const yesterdayItems: ActivityEvent[] = [];
    const earlierItems: ActivityEvent[] = [];

    for (const ev of list) {
      const d = new Date(ev.timestamp);
      const dStr = d.toDateString();
      if (dStr === todayStr) {
        todayItems.push(ev);
      } else if (dStr === yesterdayStr) {
        yesterdayItems.push(ev);
      } else {
        earlierItems.push(ev);
      }
    }

    const groups: NotificationGroup[] = [];
    if (todayItems.length > 0) groups.push({ label: 'Today', items: todayItems });
    if (yesterdayItems.length > 0) groups.push({ label: 'Yesterday', items: yesterdayItems });
    if (earlierItems.length > 0) groups.push({ label: 'Earlier Telemetry Logs', items: earlierItems });

    return groups;
  });

  setViewMode(mode: 'inbox' | 'telemetry' | 'all'): void {
    this.viewMode.set(mode);
    this.cdr.markForCheck();
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed.update(v => !v);
    this.cdr.markForCheck();
  }

  isAllSelected = computed(() => {
    const list = this.events();
    if (list.length === 0) return false;
    const selected = this.selectedIds();
    return list.every(e => selected.has(e.id));
  });

  ngOnInit(): void {
    // Initialize SignalR real-time connection
    this.activityService.initSignalR();

    // Sync state from URL query parameters
    this.routeSub = this.route.queryParams.subscribe(params => {
      if (this.isNavigatingUrl) {
        this.isNavigatingUrl = false;
        return;
      }

      this.page.set(parseInt(params['page'], 10) || 1);
      this.limit.set(parseInt(params['limit'], 10) || 10);
      this.searchQuery.set(params['search'] || '');
      this.selectedSeverity.set(params['severity'] || '');
      this.selectedCategory.set(params['category'] || '');
      this.selectedTab.set(params['tab'] || 'all');
      this.selectedRole.set(params['targetRole'] || '');
      this.sortBy.set(params['sortBy'] || '');
      this.startDate.set(params['startDate'] || '');
      this.endDate.set(params['endDate'] || '');

      this.fetchData();
    });

    // Fallback polling (15s) — only active when SignalR is disconnected
    this.pollSub = interval(15000).subscribe(() => {
      if (this.isLiveStreaming() && !this.signalRConnected()) {
        this.fetchData(true);
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.pollSub?.unsubscribe();
    if (this.undoTimer) clearInterval(this.undoTimer);
    this.activityService.disconnectSignalR();
  }

  // --- Keyboard Shortcuts (Vim / MNC Style: j, k, r, s, a, Esc) ---
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    // Ignore keypresses if user is typing inside an input/textarea
    const target = event.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      return;
    }

    const currentEvents = this.events();
    if (!currentEvents.length) return;

    if (event.key === 'j' || event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIdx = Math.min(this.focusedIndex() + 1, currentEvents.length - 1);
      this.focusedIndex.set(nextIdx);
      this.scrollToFocusedCard();
    } else if (event.key === 'k' || event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIdx = Math.max(this.focusedIndex() - 1, 0);
      this.focusedIndex.set(prevIdx);
      this.scrollToFocusedCard();
    } else if (event.key === 'r') {
      const idx = this.focusedIndex();
      if (idx >= 0 && idx < currentEvents.length) {
        event.preventDefault();
        this.toggleRead(currentEvents[idx]);
      }
    } else if (event.key === 's') {
      const idx = this.focusedIndex();
      if (idx >= 0 && idx < currentEvents.length) {
        event.preventDefault();
        this.toggleStar(currentEvents[idx]);
      }
    } else if (event.key === 'a') {
      const idx = this.focusedIndex();
      if (idx >= 0 && idx < currentEvents.length) {
        event.preventDefault();
        this.archiveSingle(currentEvents[idx]);
      }
    } else if (event.key === 'Escape') {
      if (this.isExportModalOpen()) {
        this.isExportModalOpen.set(false);
      } else if (this.selectedIds().size > 0) {
        this.clearSelection();
      }
    }
  }

  private scrollToFocusedCard(): void {
    const idx = this.focusedIndex();
    if (idx < 0) return;
    const cardEl = document.getElementById(`notif-card-${idx}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // --- Fetching Data & Updating URL ---
  fetchData(isBackgroundPoll = false): void {
    const query: NotificationQueryParams = {
      page: this.page(),
      limit: this.limit(),
      search: this.searchQuery(),
      severity: this.selectedSeverity() || 'all',
      category: this.selectedCategory() || 'all',
      tab: this.selectedTab(),
      sortBy: (this.sortBy() as any) || 'newest',
      targetRole: this.selectedRole() || 'all',
      startDate: this.startDate(),
      endDate: this.endDate()
    };

    if (!isBackgroundPoll) {
      this.updateUrlParams();
    }

    this.activityService.loadFromBackend(query).subscribe();
  }

  private updateUrlParams(): void {
    const queryParams: any = {};

    if (this.page() > 1) queryParams.page = this.page();
    if (this.limit() !== 10) queryParams.limit = this.limit();
    if (this.searchQuery()) queryParams.search = this.searchQuery();
    if (this.selectedSeverity()) queryParams.severity = this.selectedSeverity();
    if (this.selectedCategory()) queryParams.category = this.selectedCategory();
    if (this.selectedTab() !== 'all') queryParams.tab = this.selectedTab();
    if (this.selectedRole()) queryParams.targetRole = this.selectedRole();
    if (this.sortBy()) queryParams.sortBy = this.sortBy();
    if (this.startDate()) queryParams.startDate = this.startDate();
    if (this.endDate()) queryParams.endDate = this.endDate();

    this.isNavigatingUrl = true;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: ''
    });
  }

  // --- Filter Event Handlers ---
  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.page.set(1);
    this.fetchData();
  }

  setTab(tab: string): void {
    this.selectedTab.set(tab);
    // Reset sub-filters when switching tabs so user sees all items in the selected tab
    this.selectedCategory.set('');
    this.selectedSeverity.set('');
    this.selectedRole.set('');
    this.page.set(1);
    this.clearSelection();
    this.fetchData();
  }

  setSeverity(sev: any): void {
    this.selectedSeverity.set(sev);
    this.page.set(1);
    this.clearSelection();
    this.fetchData();
  }

  setCategory(cat: any): void {
    this.selectedCategory.set(cat);
    this.page.set(1);
    this.clearSelection();
    this.fetchData();
  }

  setRole(role: any): void {
    this.selectedRole.set(role);
    this.page.set(1);
    this.clearSelection();
    this.fetchData();
  }

  onSortChange(val: any): void {
    this.sortBy.set(val);
    this.fetchData();
  }

  onDateRangeChange(evt: DateRangeEvent): void {
    this.startDate.set(evt.startDate);
    this.endDate.set(evt.endDate);
    this.page.set(1);
    this.fetchData();
  }

  onPageChange(newPage: number): void {
    this.page.set(newPage);
    this.fetchData();
  }

  onLimitChange(newLimit: number): void {
    this.limit.set(newLimit);
    this.page.set(1);
    this.fetchData();
  }

  resetAllFilters(): void {
    this.searchQuery.set('');
    this.selectedSeverity.set('');
    this.selectedCategory.set('');
    this.selectedRole.set('');
    this.sortBy.set('');
    this.startDate.set('');
    this.endDate.set('');
    this.page.set(1);
    this.clearSelection();
    this.fetchData();
    this.toastService.info('All active filters reset to default view', 'Notification Stream');
  }

  clearSeverity(): void {
    this.selectedSeverity.set('');
    this.page.set(1);
    this.fetchData();
  }

  clearCategory(): void {
    this.selectedCategory.set('');
    this.page.set(1);
    this.fetchData();
  }

  clearRole(): void {
    this.selectedRole.set('');
    this.page.set(1);
    this.fetchData();
  }

  clearDateRange(): void {
    this.startDate.set('');
    this.endDate.set('');
    this.page.set(1);
    this.fetchData();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.page.set(1);
    this.fetchData();
  }

  toggleLiveStream(): void {
    this.isLiveStreaming.update(v => !v);
    this.toastService.info(
      this.isLiveStreaming() ? 'Real-time telemetry live stream RESUMED' : 'Real-time telemetry live stream PAUSED',
      'Telemetry Control'
    );
    this.cdr.markForCheck();
  }

  toggleSound(): void {
    this.soundEnabled.update(v => !v);
    this.toastService.info(
      this.soundEnabled() ? 'Audio security alert chime ENABLED' : 'Audio alert chime MUTED',
      'Telemetry Control'
    );
    this.cdr.markForCheck();
  }

  toggleExpand(id: string, e?: MouseEvent): void {
    if (e) e.stopPropagation();
    this.expandedId.update(curr => curr === id ? null : id);
    this.cdr.markForCheck();
  }

  // --- Navigate to Broadcaster on Announcements Page ---
  navigateToBroadcaster(): void {
    this.router.navigate(['/announcements'], { queryParams: { action: 'new' } });
  }

  // --- Single Item Actions ---
  toggleRead(event: ActivityEvent): void {
    if (event.read) {
      this.activityService.markAsUnread(event.id);
      this.toastService.info('Marked as unread', 'Notifications');
    } else {
      this.activityService.markAsRead(event.id);
      this.toastService.success('Marked as read', 'Notifications');
    }
    this.cdr.markForCheck();
  }

  toggleStar(event: ActivityEvent, e?: MouseEvent): void {
    if (e) e.stopPropagation();
    this.activityService.toggleStar(event.id);
    this.toastService.info(event.starred ? 'Removed bookmark' : 'Starred notification', 'Bookmarks');
    this.cdr.markForCheck();
  }

  archiveSingle(event: ActivityEvent, e?: MouseEvent): void {
    if (e) e.stopPropagation();
    if (event.archived || this.selectedTab() === 'archived') {
      this.activityService.unarchiveNotification(event.id);
      this.toastService.info('Notification unarchived', 'Notifications');
    } else {
      this.activityService.archiveNotification(event.id);
      this.toastService.info('Notification archived', 'Notifications');
    }
    this.cdr.markForCheck();
  }

  async deleteSingle(event: ActivityEvent, e?: MouseEvent): Promise<void> {
    if (e) e.stopPropagation();

    const confirmed = await this.dialogService.danger(
      'Delete Telemetry Event',
      `Are you sure you want to permanently delete event "${event.title}"?`,
      'Delete Permanently',
      'Cancel'
    );

    if (confirmed) {
      this.activityService.deleteNotification(event.id);
      this.toastService.success('Telemetry notification deleted', 'Notifications');
      this.cdr.markForCheck();
    }
  }

  // Undo Mark All Read State
  lastMarkedReadIds = signal<string[]>([]);
  undoTimer: any = null;
  undoCountdown = signal<number>(0);

  markAllAsRead(): void {
    if (this.stats().unreadCount === 0) {
      this.toastService.info('All notifications are already marked as read', 'Notifications');
      return;
    }

    const localUnreadIds = this.activityService.events().filter(e => !e.read).map(e => e.id);

    this.activityService.markAllAsRead().subscribe((res: any) => {
      const idsToSave = (res && res.unreadIds && res.unreadIds.length > 0) ? res.unreadIds : localUnreadIds;
      const count = (res && res.count) ? res.count : idsToSave.length;

      this.lastMarkedReadIds.set(idsToSave);

      // Start 8-second countdown timer for button swap & undo capability
      this.undoCountdown.set(8);
      if (this.undoTimer) clearInterval(this.undoTimer);

      this.undoTimer = setInterval(() => {
        const remaining = this.undoCountdown() - 1;
        if (remaining <= 0) {
          clearInterval(this.undoTimer);
          this.undoCountdown.set(0);
          this.lastMarkedReadIds.set([]);
        } else {
          this.undoCountdown.set(remaining);
        }
        this.cdr.markForCheck();
      }, 1000);

      // Trigger Floating Toast Snackbar with interactive [Undo] Action Button
      this.toastService.success(
        `Marked ${count || 1} notification${(count || 1) > 1 ? 's' : ''} as read`,
        'Notifications',
        'Undo',
        () => this.undoMarkAllAsRead()
      );

      this.cdr.markForCheck();
    });
  }

  undoMarkAllAsRead(): void {
    const idsToRestore = this.lastMarkedReadIds();
    if (!idsToRestore.length) return;

    if (this.undoTimer) clearInterval(this.undoTimer);
    this.undoCountdown.set(0);

    // Restore unread state in activity service
    this.activityService.bulkMarkUnread(idsToRestore);
    this.lastMarkedReadIds.set([]);

    this.toastService.info(
      `Restored ${idsToRestore.length} notification${idsToRestore.length > 1 ? 's' : ''} to unread`,
      'Undo Successful'
    );

    this.cdr.markForCheck();
  }

  // --- Consolidated Inline Quick Action Helper ---
  private async executeInlineAction(
    event: ActivityEvent,
    actionType: 'approve_lawyer' | 'reject_lawyer' | 'resolve_ticket',
    confirmTitle?: string,
    confirmMsg?: string,
    e?: MouseEvent
  ): Promise<void> {
    if (e) e.stopPropagation();

    if (confirmTitle && confirmMsg) {
      const confirmed = await this.dialogService.danger(confirmTitle, confirmMsg, 'Confirm Action', 'Cancel');
      if (!confirmed) return;
    }

    this.quickActionLoading.set(event.id);
    this.activityService.executeQuickAction(event.id, { actionType }).subscribe({
      next: (res) => {
        this.quickActionLoading.set(null);
        this.toastService.success(res?.message || 'Quick action completed successfully', 'Quick Action');
      },
      error: () => {
        this.quickActionLoading.set(null);
        this.toastService.error('Failed to execute quick action', 'Quick Action');
      }
    });
  }

  approveLawyer(event: ActivityEvent, e?: MouseEvent): Promise<void> {
    return this.executeInlineAction(event, 'approve_lawyer', undefined, undefined, e);
  }

  rejectLawyer(event: ActivityEvent, e?: MouseEvent): Promise<void> {
    return this.executeInlineAction(
      event,
      'reject_lawyer',
      'Reject Lawyer Verification',
      'Are you sure you want to reject this lawyer\'s bar license verification?',
      e
    );
  }

  resolveTicket(event: ActivityEvent, e?: MouseEvent): Promise<void> {
    return this.executeInlineAction(event, 'resolve_ticket', undefined, undefined, e);
  }

  // --- Kebab Action Menu Handler ---
  openActionMenu(event: ActivityEvent, triggerEl: HTMLElement, e: MouseEvent): void {
    e.stopPropagation();
    this.activeMenuEvent.set(event);
    this.openActionMenuId.set(event.id);
    if (this.actionMenuRef) {
      this.actionMenuRef.openAt(triggerEl);
    }
    this.cdr.markForCheck();
  }

  closeActionMenu(): void {
    this.openActionMenuId.set(null);
    this.activeMenuEvent.set(null);
    this.cdr.markForCheck();
  }

  // --- Bulk Operations ---
  toggleSelectAll(): void {
    const list = this.events();
    if (this.isAllSelected()) {
      this.clearSelection();
    } else {
      const newSet = new Set<string>();
      list.forEach(e => newSet.add(e.id));
      this.selectedIds.set(newSet);
    }
    this.cdr.markForCheck();
  }

  toggleSelectItem(id: string, e: MouseEvent): void {
    e.stopPropagation();
    const set = new Set(this.selectedIds());
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    this.selectedIds.set(set);
    this.cdr.markForCheck();
  }

  clearSelection(): void {
    this.selectedIds.set(new Set<string>());
    this.cdr.markForCheck();
  }

  bulkMarkRead(): void {
    const ids = Array.from(this.selectedIds());
    if (!ids.length) return;
    this.activityService.bulkMarkRead(ids);
    this.toastService.success(`${ids.length} notifications marked as read`, 'Bulk Action');
    this.clearSelection();
  }

  bulkArchive(): void {
    const ids = Array.from(this.selectedIds());
    if (!ids.length) return;
    this.activityService.bulkArchive(ids);
    this.toastService.info(`${ids.length} notifications archived`, 'Bulk Action');
    this.clearSelection();
  }

  async bulkDelete(): Promise<void> {
    const ids = Array.from(this.selectedIds());
    if (!ids.length) return;

    const confirmed = await this.dialogService.danger(
      'Bulk Delete Telemetry Logs',
      `Are you sure you want to delete ${ids.length} selected telemetry notifications? This action cannot be undone.`,
      `Delete ${ids.length} Items`,
      'Cancel'
    );

    if (confirmed) {
      this.activityService.bulkDelete(ids);
      this.toastService.success(`${ids.length} notifications deleted`, 'Bulk Action');
      this.clearSelection();
    }
  }

  // --- Export Modal Handlers ---
  openExportModal(): void {
    this.isExportModalOpen.set(true);
    this.cdr.markForCheck();
  }

  closeExportModal(): void {
    this.isExportModalOpen.set(false);
    this.cdr.markForCheck();
  }

  onExportRequest(config: ExportConfig): void {
    this.isExporting.set(true);
    let itemsToExport = this.events();

    if (config.scope === 'selected' && this.selectedIds().size > 0) {
      itemsToExport = itemsToExport.filter(e => this.selectedIds().has(e.id));
    }

    setTimeout(() => {
      this.activityService.exportLogs(config.format, itemsToExport);
      this.isExporting.set(false);
      this.closeExportModal();
      this.toastService.success(`Exported ${itemsToExport.length} telemetry logs as ${config.format.toUpperCase()}`, 'Export Complete');
      this.cdr.markForCheck();
    }, 400);
  }
}