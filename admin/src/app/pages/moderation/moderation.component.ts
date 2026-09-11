import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  HostListener,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  AdminModerationService,
  ModerationReport,
  ModerationStats,
  ModerationFilterParams,
  isValidEvidenceUrl
} from '../../core/services/admin-moderation.service';
import {
  ModerationAnalyticsModalComponent,
  ModerationActionModalComponent,
  ActionModalSubmitEvent,
  ModerationEvidenceLightboxComponent,
  ModerationReopenModalComponent,
  ReopenModalSubmitEvent,
  ModerationTicketDossierComponent
} from './components';
import {
  calculateSlaStatus,
  isCriticalReport,
  isWarningReport,
  getSeverityBadgeClass,
  getStatusBadgeClass,
  getStatusDotClass,
  getTypeBadgeClass,
  calculateDistributionPercent,
  formatMaskedIp,
  serializeSelectedModerationExport,
  downloadFileBlob
} from './utils';
import { ModerationStateService, FilterPill } from './services/moderation-state.service';
import { AdminAuthService } from '../../core/auth.service';
import { PiiMaskState, maskIp } from '../../core/utils/security-utils';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import {
  AdminSearchInputComponent,
  AdminEmptyStateComponent,
  AdminSortHeaderComponent
} from '../../shared/components/data-table/data-table-helpers.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { ColumnDef, ColumnCustomizerComponent } from '../../shared/components/column-customizer/column-customizer.component';
import { ExportConfig, ExportModalComponent } from '../../shared/components/export-modal/export-modal.component';
import { DateRangePickerComponent } from '../../shared/components/date-range-picker/date-range-picker.component';
import { ActionMenuComponent } from '../../shared/components/action-menu/action-menu.component';
import { AdminSavedViewsComponent } from '../../shared/components/saved-views/saved-views.component';
import { AdminIconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'admin-moderation',
  standalone: true,
  providers: [ModerationStateService],
  imports: [
    CommonModule,
    FormsModule,
    TooltipDirective,
    PaginationComponent,
    AdminSearchInputComponent,
    AdminEmptyStateComponent,
    AdminSortHeaderComponent,
    SelectComponent,
    SkeletonComponent,
    ColumnCustomizerComponent,
    ExportModalComponent,
    DateRangePickerComponent,
    ActionMenuComponent,
    AdminSavedViewsComponent,
    AdminIconComponent,
    ModerationAnalyticsModalComponent,
    ModerationActionModalComponent,
    ModerationEvidenceLightboxComponent,
    ModerationReopenModalComponent,
    ModerationTicketDossierComponent
  ],
  templateUrl: './moderation.component.html',
  styleUrls: ['./moderation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModerationComponent implements OnInit, OnDestroy {
  private moderationService = inject(AdminModerationService);
  private toast = inject(ToastService);
  private dialog = inject(DialogService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private authService = inject(AdminAuthService);
  readonly stateService = inject(ModerationStateService);

  @ViewChild('actionMenu') actionMenuRef?: ActionMenuComponent;

  // Queue Data & Operational State
  reports: ModerationReport[] = [];
  stats: ModerationStats | null = null;
  isLoading = false;
  isInitialLoad = true;
  activeReport: ModerationReport | null = null;
  drawerReport: ModerationReport | null = null;

  // Filter & Table State Delegated to ModerationStateService
  get selectedStatus(): string { return this.stateService.selectedStatus; }
  set selectedStatus(v: string) { this.stateService.selectedStatus = v; }
  get selectedType(): string { return this.stateService.selectedType; }
  set selectedType(v: string) { this.stateService.selectedType = v; }
  get selectedSeverity(): string { return this.stateService.selectedSeverity; }
  set selectedSeverity(v: string) { this.stateService.selectedSeverity = v; }
  get searchQuery(): string { return this.stateService.searchQuery; }
  set searchQuery(v: string) { this.stateService.searchQuery = v; }
  get startDate(): string { return this.stateService.startDate; }
  set startDate(v: string) { this.stateService.startDate = v; }
  get endDate(): string { return this.stateService.endDate; }
  set endDate(v: string) { this.stateService.endDate = v; }
  get sortBy(): string { return this.stateService.sortBy; }
  set sortBy(v: string) { this.stateService.sortBy = v; }
  get sortOrder(): 'asc' | 'desc' { return this.stateService.sortOrder; }
  set sortOrder(v: 'asc' | 'desc') { this.stateService.sortOrder = v; }
  get viewMode(): 'table' | 'split' { return this.stateService.viewMode; }
  set viewMode(v: 'table' | 'split') { this.stateService.viewMode = v; }
  get pagination() { return this.stateService.pagination; }
  get columnDefs(): ColumnDef[] { return this.stateService.columnDefs; }
  get columnVisibility(): Record<string, boolean> { return this.stateService.columnVisibility; }
  get selection() { return this.stateService.selection; }
  get selectedReportIds(): Set<number> { return this.selection.selectedIds; }
  get isCustomSortActive(): boolean { return this.stateService.isCustomSortActive; }
  get isNoColumnsVisible(): boolean { return this.stateService.isNoColumnsVisible; }
  get hasQueryFilter(): boolean { return this.stateService.hasQueryFilter; }
  get activeFilterPills(): FilterPill[] { return this.stateService.getActiveFilterPills(this.typeOptions); }
  get activeQueryParamsObj(): Record<string, any> { return this.buildCleanUrlParams(); }

  // Modals & Action Menus
  openActionMenuId: number | null = null;
  openActionReport: ModerationReport | null = null;
  showActionModal = false;
  actionModalMode: 'resolve' | 'dismiss' = 'resolve';
  actionTargetReport: ModerationReport | null = null;
  isProcessingAction = false;
  showReopenModal = false;
  reopenTargetReport: ModerationReport | null = null;
  isProcessingReopen = false;
  lightboxOpen = false;
  lightboxUrl: string | null = null;
  isExportModalOpen = false;
  isExporting = false;
  isAnalyticsModalOpen = false;

  // DPDP IP Masking & Helpers
  ipMask = new PiiMaskState<number>();
  isValidEvidenceUrl = isValidEvidenceUrl;
  maskIp = maskIp;
  isCritical = isCriticalReport;
  isWarning = isWarningReport;
  getSeverityBadgeClass = getSeverityBadgeClass;
  getStatusBadgeClass = getStatusBadgeClass;
  getStatusDotClass = getStatusDotClass;
  getTypeBadgeClass = getTypeBadgeClass;
  getSlaStatus = calculateSlaStatus;

  private destroy$ = new Subject<void>();
  private rowClickTimeout: ReturnType<typeof setTimeout> | null = null;
  private statsRefreshPending = false;
  private statsRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  get currentAdminEmail(): string { return this.authService.user?.email || ''; }

  isAssignedToCurrentAdmin(email?: string): boolean {
    if (!email || !this.currentAdminEmail) return false;
    return email.trim().toLowerCase() === this.currentAdminEmail.trim().toLowerCase();
  }

  get totalReportsCount(): number {
    if (this.stats?.reportsByType) {
      const sum = Object.values(this.stats.reportsByType).reduce((acc, curr) => acc + curr, 0);
      if (sum > 0) return sum;
    }
    return this.pagination.total || 0;
  }

  get typeOptions(): SelectOption[] {
    const total = this.totalReportsCount;
    const rByType = this.stats?.reportsByType || {};
    return [
      { label: `All Types (${total})`, value: '', icon: 'info', color: '#38bdf8' },
      { label: `Reviews & Feedback (${rByType['Review'] || 0})`, value: 'Review', icon: 'star', color: '#fbbf24' },
      { label: `Lawyer Profiles (${rByType['Lawyer'] || 0})`, value: 'Lawyer', icon: 'briefcase', color: '#818cf8' },
      { label: `Legal Resources (${rByType['LegalResource'] || 0})`, value: 'LegalResource', icon: 'award', color: '#34d399' },
      { label: `Citizen Helplines (${rByType['Helpline'] || 0})`, value: 'Helpline', icon: 'shield', color: '#f43f5e' },
      { label: `Statutory Bare Acts (${rByType['BareActSection'] || 0})`, value: 'BareActSection', icon: 'file-text', color: '#22d3ee' }
    ];
  }

  get severityOptions(): SelectOption[] {
    const crit = this.stats?.criticalPendingCount || 0;
    return [
      { label: 'All Severities', value: '', icon: 'shield', color: '#94a3b8' },
      { label: `Critical / PII (${crit})`, value: 'Critical', icon: 'warning', color: '#f43f5e' },
      { label: 'High Priority', value: 'High', icon: 'warning', color: '#fb923c' },
      { label: 'Medium Risk', value: 'Medium', icon: 'info', color: '#fbbf24' },
      { label: 'Low / Minor', value: 'Low', icon: 'check', color: '#34d399' }
    ];
  }

  getSelectedTypeLabel(): string {
    const opt = this.typeOptions.find(o => o.value === this.selectedType);
    return opt ? opt.label : 'All Types';
  }

  getDistributionPercent(type: string): number {
    return calculateDistributionPercent(type, this.stats);
  }

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParams;
    this.stateService.hydrateFromParams(qp, true);

    const pendingInspectId = qp['inspect'] ? parseInt(qp['inspect'], 10) : null;
    this.loadStats();
    this.loadQueue(pendingInspectId);
    this.initRealtimeSubscription();

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (this.stateService.isInternalUrlSync) return;
      const currentClean = this.buildCleanUrlParams();
      if (!this.stateService.areParamObjectsEqual(currentClean, params)) {
        this.stateService.hydrateFromParams(params, false);
        const newInspectId = params['inspect'] ? parseInt(params['inspect'], 10) : null;
        this.loadQueue(newInspectId);
        this.cdr.markForCheck();
      }
    });
  }

  buildCleanUrlParams(): Record<string, string | number> {
    const activeInspectId = (this.viewMode === 'split' ? this.activeReport?.id : this.drawerReport?.id) || null;
    return this.stateService.getCleanParams(activeInspectId);
  }

  updateUrlParams(): void {
    const activeInspectId = (this.viewMode === 'split' ? this.activeReport?.id : this.drawerReport?.id) || null;
    this.stateService.syncToUrl({
      searchQuery: this.searchQuery.trim(),
      selectedStatus: this.selectedStatus,
      selectedType: this.selectedType,
      selectedSeverity: this.selectedSeverity,
      startDate: this.startDate,
      endDate: this.endDate,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder,
      page: this.pagination.page,
      limit: this.pagination.limit,
      viewMode: this.viewMode
    }, activeInspectId);
  }

  copyShareableLink(event?: Event): void {
    if (event) event.stopPropagation();
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      this.toast.success('Direct URL copied to clipboard');
    }).catch(() => this.toast.info(`URL: ${url}`));
  }

  setViewMode(mode: 'table' | 'split'): void {
    this.viewMode = mode;
    localStorage.setItem('lc_mod_view_mode', mode);
    if (mode === 'split' && !this.activeReport && this.reports.length > 0) {
      this.selectReport(this.reports[0]);
    }
    this.updateUrlParams();
    this.cdr.markForCheck();
  }

  loadStats(): void {
    this.moderationService.getStats().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res?.data) { this.stats = res.data; this.cdr.markForCheck(); }
      },
      error: () => this.toast.error('Failed to load moderation statistics')
    });
  }

  loadQueue(pendingInspectId?: number | null): void {
    const params: ModerationFilterParams = {
      status: this.selectedStatus || undefined,
      targetType: this.selectedType || undefined,
      severity: this.selectedSeverity || undefined,
      search: this.searchQuery.trim() || undefined,
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined,
      page: this.pagination.page,
      pageSize: this.pagination.limit,
      sortBy: `${this.sortBy}_${this.sortOrder}`
    };

    const cached = this.moderationService.getCachedQueue(params);
    if (cached?.data) {
      this.reports = cached.data;
      if (cached.pagination) {
        this.pagination.total = cached.pagination.totalItems;
        this.pagination.pages = cached.pagination.totalPages;
      }
      this.isLoading = false;
      this.isInitialLoad = false;
      this.cdr.markForCheck();
    } else {
      this.isLoading = true;
      this.cdr.markForCheck();
    }

    this.moderationService.getQueue(params).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.isInitialLoad = false;
        if (res?.data) {
          this.reports = res.data;
          if (res.pagination) {
            this.pagination.total = res.pagination.totalItems;
            this.pagination.pages = res.pagination.totalPages;
          }
          if (pendingInspectId) {
            const found = this.reports.find(r => r.id === pendingInspectId);
            if (found) { this.viewMode === 'table' ? this.openDrawer(found) : this.selectReport(found); }
          } else if (this.viewMode === 'split') {
            const currentStillExists = this.reports.find(r => r.id === this.activeReport?.id);
            this.activeReport = currentStillExists || this.reports[0] || null;
          }
        }
        this.selection.clear();
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        this.isInitialLoad = false;
        this.toast.error(err?.error?.message || 'Failed to load moderation queue');
        this.cdr.markForCheck();
      }
    });
  }

  // Filter & Sorting Events
  onFilterChange(): void { this.pagination.page = 1; this.updateUrlParams(); this.loadQueue(); }
  onDateRangeChange(range: { startDate?: string; endDate?: string }): void {
    this.startDate = range.startDate || '';
    this.endDate = range.endDate || '';
    this.pagination.page = 1;
    this.updateUrlParams();
    this.loadQueue();
  }
  onSearch(query: string): void { this.searchQuery = query; this.pagination.page = 1; this.updateUrlParams(); this.loadQueue(); }
  toggleSort(column: string): void { this.stateService.toggleSort(column); this.updateUrlParams(); this.loadQueue(); }
  clearSort(): void { this.stateService.clearSort(); this.updateUrlParams(); this.loadQueue(); this.toast.info('Sort cleared'); }
  getColumnSortLabel(column: string): string { return this.stateService.getColumnSortLabel(column); }
  getSortTooltip(column: string, label: string): string { return this.stateService.getSortTooltip(column, label); }
  getFilterPillTooltip(pill: FilterPill): string { return pill.key === 'sort' ? 'Reset sort' : `Remove filter: ${pill.label}`; }
  removeFilter(key: FilterPill['key']): void { this.stateService.removeFilter(key); this.updateUrlParams(); this.loadQueue(); }
  resetAllFilters(): void { this.stateService.resetAllFilters(); this.updateUrlParams(); this.loadQueue(); this.toast.info('Filters reset to default'); }
  onPageChange(page: number): void { this.pagination.page = page; this.updateUrlParams(); this.loadQueue(); }
  onLimitChange(limit: number): void { this.pagination.limit = limit; this.pagination.page = 1; this.updateUrlParams(); this.loadQueue(); }
  onColumnVisibilityChange(visibility: Record<string, boolean>): void { this.stateService.columnVisibility = visibility; this.cdr.markForCheck(); }
  resetColumnVisibility(): void { this.stateService.resetColumnVisibility(); this.toast.success('All columns restored'); this.cdr.markForCheck(); }
  onSavedViewApply(savedParams: any): void { this.stateService.hydrateFromParams(savedParams || {}, false); this.pagination.page = 1; this.updateUrlParams(); this.loadQueue(); this.toast.info('Saved filter view applied'); }
  refreshData(): void { this.toast.info('Refreshing queue...'); this.loadQueue(); this.loadStats(); }

  // Selection & Row Click
  onRowClick(id: number): void {
    if (this.rowClickTimeout) clearTimeout(this.rowClickTimeout);
    this.rowClickTimeout = setTimeout(() => { this.toggleSelect(id); this.rowClickTimeout = null; this.cdr.markForCheck(); }, 250);
  }
  onRowDblClick(report: ModerationReport): void {
    if (this.rowClickTimeout) { clearTimeout(this.rowClickTimeout); this.rowClickTimeout = null; }
    this.openDrawer(report);
  }
  toggleSelectAll(): void { this.stateService.toggleSelectAll(this.reports); this.cdr.markForCheck(); }
  toggleSelect(id: number, event?: Event): void { if (event) event.stopPropagation(); this.stateService.toggleSelect(id); this.cdr.markForCheck(); }
  isAllSelected(): boolean { return this.stateService.isAllSelected(this.reports); }
  clearSelection(): void { this.stateService.clearSelection(); this.cdr.markForCheck(); }
  trackByReportId = (_index: number, report: ModerationReport): number => report.id;
  trackByReportRef = (_index: number, report: ModerationReport): string => report.reportRef;
  trackById = (_index: number, item: { id: number }): number => item.id;
  trackByIndex = (index: number): number => index;

  // DPDP Masking & Inspection
  toggleIpMask(id: number, event?: Event): void { if (event) event.stopPropagation(); this.ipMask.toggle(id, 'ip', event); this.cdr.markForCheck(); }
  isIpUnmasked(id: number): boolean { return this.ipMask.isUnmasked(id, 'ip'); }
  getDisplayIp(report: ModerationReport | null | undefined): string {
    if (!report?.reporterIp) return 'IP Hidden';
    return formatMaskedIp(report.reporterIp, this.isIpUnmasked(report.id));
  }
  selectReport(report: ModerationReport): void { this.activeReport = report; if (this.drawerReport) this.drawerReport = report; if (this.viewMode === 'split') this.updateUrlParams(); this.cdr.markForCheck(); }
  openDrawer(report: ModerationReport, event?: Event): void { if (event) event.stopPropagation(); this.drawerReport = report; this.activeReport = report; this.updateUrlParams(); this.cdr.markForCheck(); }
  closeDrawer(): void { this.drawerReport = null; this.updateUrlParams(); this.cdr.markForCheck(); }

  // Ticket Workflow Actions
  claimTicket(report: ModerationReport, event?: Event): void {
    if (event) event.stopPropagation();
    this.moderationService.claimReport(report.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.toast.success(res?.message || 'Report ticket claimed');
        report.status = 'Investigating';
        report.assignedAdminEmail = res?.assignedEmail || this.currentAdminEmail;
        this.loadStats();
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(err?.status === 409 ? 'Ticket already claimed by another moderator' : 'Failed to claim ticket');
        this.cdr.markForCheck();
      }
    });
  }

  escalateReport(report: ModerationReport, severity: 'Critical' | 'High', event?: Event): void {
    if (event) event.stopPropagation();
    this.moderationService.escalateSeverity(report.id, severity, 'Escalated by administrator').pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { report.severity = severity; report.status = 'Investigating'; this.toast.success(`Escalated to ${severity} ✓`); this.loadStats(); this.cdr.markForCheck(); },
      error: (err: HttpErrorResponse) => { this.toast.error(err?.error?.message || 'Failed to escalate report'); this.cdr.markForCheck(); }
    });
  }

  toggleActionMenu(id: number, target: HTMLElement, event: Event): void {
    event.stopPropagation();
    if (this.openActionMenuId === id) { this.closeActionMenu(); }
    else { this.openActionMenuId = id; this.openActionReport = this.reports.find(r => r.id === id) || null; if (this.actionMenuRef) this.actionMenuRef.openAt(target); }
  }
  closeActionMenu(): void { this.openActionMenuId = null; this.openActionReport = null; this.cdr.markForCheck(); }
  getOpenActionReport(): ModerationReport | null { return this.openActionReport; }
  copyToClipboard(text: string, label: string = 'Text', event?: Event): void {
    if (event) event.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => this.toast.success(`${label} copied`)).catch(() => this.toast.info(`${label}: ${text}`));
  }

  openResolveModal(report: ModerationReport, event?: Event): void { if (event) event.stopPropagation(); this.actionTargetReport = report; this.actionModalMode = 'resolve'; this.showActionModal = true; this.cdr.markForCheck(); }
  openDismissModal(report: ModerationReport, event?: Event): void { if (event) event.stopPropagation(); this.actionTargetReport = report; this.actionModalMode = 'dismiss'; this.showActionModal = true; this.cdr.markForCheck(); }
  closeActionModal(): void { this.showActionModal = false; this.actionTargetReport = null; this.isProcessingAction = false; this.cdr.markForCheck(); }
  onActionModalConfirmed(event: ActionModalSubmitEvent): void {
    const { report, mode, action, notes, cascade } = event;
    this.isProcessingAction = true;
    this.cdr.markForCheck();
    const op$ = mode === 'resolve' ? this.moderationService.resolveReport(report.id, action, notes, cascade) : this.moderationService.dismissReport(report.id, notes, cascade);
    op$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toast.success(mode === 'resolve' ? `Report #${report.reportRef} resolved ✓` : `Report #${report.reportRef} dismissed`);
        this.closeActionModal(); this.closeDrawer(); this.loadQueue(); this.loadStats();
      },
      error: (err: HttpErrorResponse) => { this.toast.error(err?.error?.message || `Failed to ${mode} report`); this.isProcessingAction = false; this.cdr.markForCheck(); }
    });
  }

  bulkResolve(): void {
    const ids = this.selection.toArray();
    if (!ids.length) return;
    this.dialog.confirm({ title: `Resolve ${ids.length} Selected Reports?`, message: 'Selected reports will be marked resolved and flagged records hidden.', confirmText: 'Resolve All', cancelText: 'Cancel' }).then(confirmed => {
      if (!confirmed) return;
      this.moderationService.bulkResolve(ids, 'ContentRemoved', 'Bulk resolved by administrator', true).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => { this.toast.success(`${res?.count || ids.length} reports resolved ✓`); this.selection.clear(); this.loadQueue(); this.loadStats(); },
        error: (err: HttpErrorResponse) => this.toast.error(err?.error?.message || 'Bulk resolve failed')
      });
    });
  }

  bulkDismiss(): void {
    const ids = this.selection.toArray();
    if (!ids.length) return;
    this.dialog.confirm({ title: `Dismiss ${ids.length} Selected Reports?`, message: 'Selected reports will be dismissed as false positives.', confirmText: 'Dismiss All', cancelText: 'Cancel' }).then(confirmed => {
      if (!confirmed) return;
      this.moderationService.bulkDismiss(ids, 'Bulk dismissed by administrator', true).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => { this.toast.success(`${res?.count || ids.length} reports dismissed`); this.selection.clear(); this.loadQueue(); this.loadStats(); },
        error: (err: HttpErrorResponse) => this.toast.error(err?.error?.message || 'Bulk dismiss failed')
      });
    });
  }

  openLightbox(url: string, event?: Event): void { if (event) event.stopPropagation(); this.lightboxUrl = url; this.lightboxOpen = true; this.cdr.markForCheck(); }
  closeLightbox(): void { this.lightboxOpen = false; this.lightboxUrl = null; this.cdr.markForCheck(); }
  openExportModal(): void { this.isExportModalOpen = true; this.cdr.markForCheck(); }
  closeExportModal(): void { this.isExportModalOpen = false; this.cdr.markForCheck(); }
  onExportConfirm(config: ExportConfig): void {
    this.isExporting = true;
    this.cdr.markForCheck();
    if (config.scope !== 'selected') {
      const filterParams: ModerationFilterParams = { status: this.selectedStatus || undefined, targetType: this.selectedType || undefined, severity: this.selectedSeverity || undefined, search: this.searchQuery.trim() || undefined, startDate: this.startDate || undefined, endDate: this.endDate || undefined };
      const format = config.format === 'json' ? 'json' : 'csv';
      this.moderationService.exportQueue(filterParams, format).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          if (format === 'csv' && res instanceof Blob) downloadFileBlob(res, `moderation-export-${Date.now()}.csv`);
          else if (!(res instanceof Blob) && (res as any)?.data) downloadFileBlob(new Blob([JSON.stringify((res as any).data, null, 2)], { type: 'application/json' }), `moderation-export-${Date.now()}.json`);
          this.toast.success('Queue exported ✓');
          this.isExporting = false; this.closeExportModal(); this.cdr.markForCheck();
        },
        error: () => { this.toast.error('Export failed'); this.isExporting = false; this.cdr.markForCheck(); }
      });
      return;
    }
    requestAnimationFrame(() => {
      try {
        const { blob, filename, count } = serializeSelectedModerationExport(this.reports, this.selectedReportIds, config);
        downloadFileBlob(blob, filename);
        this.toast.success(`Exported ${count} selected records ✓`);
      } catch { this.toast.error('Failed to export selected records'); }
      finally { this.isExporting = false; this.closeExportModal(); this.cdr.markForCheck(); }
    });
  }

  openReopenModal(report: ModerationReport, event?: Event): void { if (event) event.stopPropagation(); this.reopenTargetReport = report; this.showReopenModal = true; this.cdr.markForCheck(); }
  closeReopenModal(): void { this.showReopenModal = false; this.reopenTargetReport = null; this.isProcessingReopen = false; this.cdr.markForCheck(); }
  onReopenModalConfirmed(event: ReopenModalSubmitEvent): void {
    const { report, reason, restoreTarget } = event;
    this.isProcessingReopen = true;
    this.cdr.markForCheck();
    this.moderationService.reopenReport(report.id, reason, restoreTarget).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.toast.success(res?.message || `Report #${report.reportRef} re-opened`);
        report.status = 'Investigating'; report.assignedAdminEmail = this.currentAdminEmail;
        this.closeReopenModal(); this.loadStats(); this.cdr.markForCheck();
      },
      error: () => { this.isProcessingReopen = false; this.toast.error('Failed to re-open report'); this.cdr.markForCheck(); }
    });
  }

  openAnalyticsModal(): void { this.isAnalyticsModalOpen = true; this.cdr.markForCheck(); }
  closeAnalyticsModal(): void { this.isAnalyticsModalOpen = false; this.cdr.markForCheck(); }
  onAnalyticsReloadQueue(): void { this.loadQueue(); this.loadStats(); }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (event.key === 'Escape') {
      if (this.openActionMenuId !== null) { this.closeActionMenu(); return; }
      if (this.lightboxOpen) { this.closeLightbox(); return; }
      if (this.showActionModal) { this.closeActionModal(); return; }
      if (this.drawerReport) { this.closeDrawer(); return; }
      return;
    }
    if (this.showActionModal || this.lightboxOpen || this.showReopenModal || this.isAnalyticsModalOpen) return;
    const currentReport = this.activeReport || this.reports[0];
    const currentIndex = this.reports.findIndex(r => r.id === currentReport?.id);
    if (event.key === 'j' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (currentIndex >= 0 && currentIndex < this.reports.length - 1) this.selectReport(this.reports[currentIndex + 1]);
    } else if (event.key === 'k' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (currentIndex > 0) this.selectReport(this.reports[currentIndex - 1]);
    } else if (event.key === 'r') {
      if (currentReport && ['Pending', 'Investigating', 'UnderReview'].includes(currentReport.status)) { event.preventDefault(); this.openResolveModal(currentReport); }
    } else if (event.key === 'd') {
      if (currentReport && ['Pending', 'Investigating', 'UnderReview'].includes(currentReport.status)) { event.preventDefault(); this.openDismissModal(currentReport); }
    } else if (event.key === 'x') {
      if (currentReport) { event.preventDefault(); this.toggleSelect(currentReport.id); }
    } else if (event.key === 'e') {
      if (currentReport && currentReport.severity !== 'Critical') { event.preventDefault(); this.escalateReport(currentReport, 'Critical'); }
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void { if (this.openActionMenuId !== null) this.closeActionMenu(); }

  private initRealtimeSubscription(): void {
    this.moderationService.moderationUpdates$.pipe(takeUntil(this.destroy$)).subscribe(event => {
      if (!event) return;
      this.handleRealtimeEvent(event);
    });
  }

  private handleRealtimeEvent(event: any): void {
    const { eventType, reportId, reportIds, status, severity, assignedAdminEmail, resolvedByAdminEmail, extra } = event;
    if (reportId) {
      const match = this.reports.find(r => r.id === reportId);
      if (match) {
        if (status) match.status = status;
        if (severity) match.severity = severity;
        if (assignedAdminEmail !== undefined) match.assignedAdminEmail = assignedAdminEmail;
        if (resolvedByAdminEmail !== undefined) match.resolvedByAdminEmail = resolvedByAdminEmail;
      }
      if (this.drawerReport && this.drawerReport.id === reportId) {
        if (status) this.drawerReport.status = status;
        if (severity) this.drawerReport.severity = severity;
      }
      if (this.activeReport && this.activeReport.id === reportId) {
        if (status) this.activeReport.status = status;
        if (severity) this.activeReport.severity = severity;
      }
      if (eventType === 'REPORT_CLAIMED' && assignedAdminEmail && assignedAdminEmail !== this.currentAdminEmail) {
        this.toast.info(`Ticket #${match?.reportRef || reportId} claimed by ${assignedAdminEmail}`);
      } else if (eventType === 'REPORT_REOPENED') {
        this.toast.info(`Ticket #${match?.reportRef || reportId} re-opened by ${extra?.reopenedBy || 'moderator'}`);
      } else if (eventType === 'REPORT_ESCALATED') {
        this.toast.warning(`Ticket #${match?.reportRef || reportId} escalated to Critical`);
      }
    }
    if (reportIds && Array.isArray(reportIds)) {
      if (eventType === 'REPORTS_BULK_RESOLVED') this.reports.forEach(r => { if (reportIds.includes(r.id)) r.status = 'Resolved'; });
      else if (eventType === 'REPORTS_BULK_DISMISSED') this.reports.forEach(r => { if (reportIds.includes(r.id)) r.status = 'Dismissed'; });
    }
    if (!this.statsRefreshPending) {
      this.statsRefreshPending = true;
      this.statsRefreshTimer = setTimeout(() => {
        this.moderationService.getStats().pipe(takeUntil(this.destroy$)).subscribe(res => {
          if (res?.data) { this.stats = res.data; this.cdr.markForCheck(); }
        });
        this.statsRefreshPending = false;
        this.statsRefreshTimer = null;
      }, 2000);
    }
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.lightboxOpen = false;
    this.showActionModal = false;
    this.showReopenModal = false;
    this.isAnalyticsModalOpen = false;
    if (this.rowClickTimeout) { clearTimeout(this.rowClickTimeout); this.rowClickTimeout = null; }
    if (this.statsRefreshTimer) { clearTimeout(this.statsRefreshTimer); this.statsRefreshTimer = null; }
  }
}