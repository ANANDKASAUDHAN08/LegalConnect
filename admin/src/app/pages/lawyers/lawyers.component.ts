import { Component, OnInit, HostListener, AfterViewInit, OnDestroy, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { smartLoading } from '../../core/utils/smart-loading.operator';
import { CsvExporter } from '../../core/utils/csv-exporter';
import { TwoFactorEnforcerService } from '../../shared/services/two-factor-enforcer.service';
import { AvatarService } from '../../shared/services/avatar.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { ActionMenuComponent } from '../../shared/components/action-menu/action-menu.component';
import { ColumnCustomizerComponent, ColumnDef } from '../../shared/components/column-customizer/column-customizer.component';
import { AdminSearchInputComponent, AdminSortHeaderComponent, AdminEmptyStateComponent } from '../../shared/components/data-table/data-table-helpers.component';
import { ExportModalComponent, ExportConfig } from '../../shared/components/export-modal/export-modal.component';
import { DateRangePickerComponent, DateRangeEvent } from '../../shared/components/date-range-picker/date-range-picker.component';
import { TableSelection } from '../../core/utils/table.utils';

@Component({
  selector: 'admin-lawyers',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent, TooltipDirective, SelectComponent, PaginationComponent, ActionMenuComponent, ColumnCustomizerComponent, AdminSearchInputComponent, AdminSortHeaderComponent, AdminEmptyStateComponent, ExportModalComponent, DateRangePickerComponent],
  templateUrl: './lawyers.component.html',
  styleUrl: './lawyers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LawyersComponent implements OnInit, AfterViewInit, OnDestroy {
  lawyers: any[] = [];
  isLoading = false;
  isInitialLoad = true;
  search = '';
  private searchSubject$ = new Subject<string>();
  verificationFilter = '';
  selectedCity = '';
  selectedCourtCategory = '';
  sortBy = 'createdAt';
  sortOrder: 'asc' | 'desc' = 'desc';

  // Column Visibility (managed by ColumnCustomizerComponent)
  columnDefs: ColumnDef[] = [
    { key: 'barCouncil', label: 'Bar Council #' },
    { key: 'profile', label: 'Lawyer Profile' },
    { key: 'specialization', label: 'Specializations' },
    { key: 'cityExp', label: 'City & Exp' },
    { key: 'performanceFee', label: 'Performance & Fee' },
    { key: 'status', label: 'Verification Status' }
  ];
  columnVisibility: any = {
    barCouncil: true,
    profile: true,
    specialization: true,
    cityExp: true,
    performanceFee: true,
    status: true
  };

  // Floating 3-Dots Action Dropdown Menu State
  openActionMenuId: number | null = null;
  @ViewChild('actionMenu') actionMenuRef!: ActionMenuComponent;

  // In-memory SWR cache map
  private swrCacheMap = new Map<string, { data: any[]; summary: any; pagination: any }>();

  verificationOptions: SelectOption[] = [
    { label: 'All Verification States', value: '' },
    { label: 'Pending Verification Queue', value: 'false', icon: 'warning' },
    { label: 'Verified Lawyers Only', value: 'true', icon: 'check' }
  ];

  cityOptions: SelectOption[] = [
    { label: 'All Cities', value: '' }
  ];

  private masterCitySet = new Set<string>([
    'Ahmedabad', 'Ayodhya', 'Bengaluru', 'Chandigarh', 'Chennai',
    'Delhi', 'Gurgaon', 'Hyderabad', 'Jaipur', 'Kolkata', 'Lucknow', 'Mumbai', 'Noida', 'Pune'
  ]);

  private cityCountMap = new Map<string, number>();
  private cityColorPalette = ['#f43f5e', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7', '#14b8a6', '#f97316'];

  private normalizeCityName(raw: string): string {
    const clean = raw.trim().toLowerCase();
    if (clean === 'bangalore' || clean === 'bengaluru') return 'Bengaluru';
    if (clean === 'delhi' || clean === 'new delhi') return 'Delhi';
    if (clean === 'gurgaon' || clean === 'gurugram') return 'Gurgaon';
    if (clean === 'mumbai' || clean === 'bombay') return 'Mumbai';
    return raw.trim();
  }

  private buildDynamicCityOptions(fetchedData?: any[], summaryMeta?: any): void {
    this.cityCountMap.clear();

    if (summaryMeta && summaryMeta.cityCounts && typeof summaryMeta.cityCounts === 'object') {
      for (const [cityName, cnt] of Object.entries(summaryMeta.cityCounts)) {
        if (cityName && typeof cityName === 'string' && cityName.trim()) {
          const canonicalCity = this.normalizeCityName(cityName);
          this.masterCitySet.add(canonicalCity);
          const currentCount = this.cityCountMap.get(canonicalCity) || 0;
          this.cityCountMap.set(canonicalCity, currentCount + (Number(cnt) || 0));
        }
      }
    } else if (fetchedData && Array.isArray(fetchedData)) {
      for (const lawyer of fetchedData) {
        const rawCity = lawyer.city || lawyer.profile?.city || lawyer.officeCity || lawyer.location;
        if (rawCity && typeof rawCity === 'string' && rawCity.trim()) {
          const canonicalCity = this.normalizeCityName(rawCity);
          this.masterCitySet.add(canonicalCity);
          const currentCount = this.cityCountMap.get(canonicalCity) || 0;
          this.cityCountMap.set(canonicalCity, currentCount + 1);
        }
      }
    }

    const sortedCities = Array.from(this.masterCitySet).sort();
    const totalCount = summaryMeta?.totalLawyers || (fetchedData ? fetchedData.length : undefined);

    const activeCitiesWithOptions = sortedCities
      .map((city, i) => ({
        label: city,
        value: city,
        icon: 'map-pin',
        color: this.cityColorPalette[i % this.cityColorPalette.length],
        count: this.cityCountMap.get(city) || 0
      }))
      .filter(opt => opt.count > 0);

    this.cityOptions = [
      { label: 'All Cities', value: '', count: totalCount },
      ...activeCitiesWithOptions
    ];
  }

  courtOptions: SelectOption[] = [
    { label: 'All Court Tiers', value: '' },
    { label: 'Supreme Court of India', value: 'Supreme Court', icon: 'award', color: '#f59e0b' },
    { label: 'High Court', value: 'High Court', icon: 'file-text', color: '#38bdf8' },
    { label: 'District & Sessions Court', value: 'District', icon: 'shield', color: '#818cf8' },
    { label: 'NCLT & Tribunals', value: 'NCLT', icon: 'briefcase', color: '#a855f7' }
  ];

  sortOptions: SelectOption[] = [
    { label: 'Newest First', value: 'createdAt', icon: 'clock' },
    { label: 'Oldest First', value: 'oldest', icon: 'clock' },
    { label: 'Name (A-Z)', value: 'name', icon: 'user' },
    { label: 'Name (Z-A)', value: 'name_desc', icon: 'user' }
  ];

  onSortDropdownChange(val: string): void {
    if (val === 'name') {
      this.sortBy = 'name';
      this.sortOrder = 'asc';
    } else if (val === 'name_desc') {
      this.sortBy = 'name';
      this.sortOrder = 'desc';
    } else if (val === 'oldest') {
      this.sortBy = 'oldest';
      this.sortOrder = 'asc';
    } else {
      this.sortBy = 'createdAt';
      this.sortOrder = 'desc';
    }
    this.pagination.page = 1;
    this.fetchLawyers();
  }

  pagination = {
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  };

  selectedLawyerDetail: any = null;

  // Document Verification Drawer State
  isPreviewDrawerOpen = false;
  selectedLawyerForReview: any = null;
  activeDocType: 'bar_card' | 'cop' | 'degree' | 'pan' | 'audit_trail' = 'bar_card';
  documentZoom = 100;
  documentRotation = 0;
  rejectionReason = 'Photo blurry / illegible Bar Council text';

  getDocUrl(type: string): string | null {
    if (!this.selectedLawyerForReview) return null;
    const p = this.selectedLawyerForReview.profile || {};
    if (type === 'bar_card') return p.barCardUrl || p.documentUrl || this.selectedLawyerForReview.documentUrl || null;
    if (type === 'cop') return p.copCertificateUrl || p.copUrl || null;
    if (type === 'degree') return p.degreeCertificateUrl || p.degreeUrl || null;
    return null;
  }

  // Enterprise Feature State
  isVerifyingRegistry = false;
  registryResult: any = null;
  lawyerAuditLogs: any[] = [];
  isLoadingAuditLogs = false;

  rejectionOptions = [
    'Photo blurry / illegible Bar Council text',
    'Expired Certificate of Practice (COP)',
    'Name mismatch with Bar Council registry',
    'Invalid or incomplete Bar Enrollment ID',
    'Document image missing or truncated'
  ];

  rejectionSelectOptions: SelectOption[] = [
    { label: 'Photo blurry / illegible Bar Council text', value: 'Photo blurry / illegible Bar Council text', icon: 'warning', color: '#f43f5e' },
    { label: 'Expired Certificate of Practice (COP)', value: 'Expired Certificate of Practice (COP)', icon: 'clock', color: '#f59e0b' },
    { label: 'Name mismatch with Bar Council registry', value: 'Name mismatch with Bar Council registry', icon: 'shield', color: '#ec4899' },
    { label: 'Invalid or incomplete Bar Enrollment ID', value: 'Invalid or incomplete Bar Enrollment ID', icon: 'award', color: '#8b5cf6' },
    { label: 'Document image missing or truncated', value: 'Document image missing or truncated', icon: 'file-text', color: '#ef4444' }
  ];

  editingLawyer: any = null;
  editForm: any = {};

  selection = new TableSelection<number>();

  get lawyerIds(): number[] {
    return this.lawyers.map(l => l.id);
  }

  isAllSelected(): boolean {
    return this.selection.isAllSelected(this.lawyerIds);
  }

  toggleSelectAll(): void {
    this.selection.toggleAll(this.lawyerIds);
  }

  // Export Modal State
  isExportModalOpen = false;
  exportColumns = [
    { key: 'id', label: 'ID' },
    { key: 'fullName', label: 'Full Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'barCouncil', label: 'Bar License Number' },
    { key: 'city', label: 'City' },
    { key: 'activeCourts', label: 'Active Courts' },
    { key: 'experienceYears', label: 'Experience Years' },
    { key: 'specialization', label: 'Specialization' },
    { key: 'verificationStatus', label: 'Verification Status' },
    { key: 'consultationFee', label: 'Consultation Fee' },
    { key: 'verificationRemarks', label: 'Verification Remarks' }
  ];

  get visibleColumnKeys(): string[] {
    return Object.entries(this.columnVisibility).filter(([, v]) => v).map(([k]) => k);
  }

  get isNoColumnsVisible(): boolean {
    return Object.values(this.columnVisibility).every(v => !v);
  }

  onColumnVisibilityChange(updated: Record<string, boolean>): void {
    this.columnVisibility = updated;
  }

  toggleSort(columnKey: string): void {
    if (this.sortBy === columnKey) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = columnKey;
      this.sortOrder = 'desc';
    }
    this.pagination.page = 1;
    this.swrCacheMap.clear();
    this.fetchLawyers();
  }

  toggleActionMenu(id: number, buttonEl: HTMLElement, event: Event): void {
    event.stopPropagation();
    if (this.openActionMenuId === id) {
      this.openActionMenuId = null;
      this.cdr.markForCheck();
      return;
    }
    this.openActionMenuId = id;
    if (this.actionMenuRef) {
      this.actionMenuRef.openAt(buttonEl);
    }
    this.cdr.markForCheck();
  }

  closeActionMenu(): void {
    this.openActionMenuId = null;
    this.cdr.markForCheck();
  }

  getOpenActionLawyer(): any | null {
    if (!this.openActionMenuId) return null;
    return this.lawyers.find(l => l.id === this.openActionMenuId) || null;
  }

  // Document click handling now managed by ActionMenuComponent and ColumnCustomizerComponent

  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    const activeEl = event.target as HTMLElement;
    const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT';

    if (event.key === '/' && !isInput) {
      event.preventDefault();
      const searchInput = document.querySelector('.filter-group input') as HTMLInputElement;
      if (searchInput) searchInput.focus();
    } else if (event.key === 'Escape') {
      this.closeDocumentDrawer();
      this.openActionMenuId = null;
    }
  }

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialog: DialogService,
    private route: ActivatedRoute,
    private twoFactor: TwoFactorEnforcerService,
    public avatar: AvatarService,
    private cdr: ChangeDetectorRef
  ) { }

  // Global Dynamic Telemetry Header Metrics
  globalTotalLawyers = 0;
  globalPendingCount = 0;
  globalVerifiedCount = 0;
  globalPlatformRating = '0.0';

  // Date Range Filter State
  startDate = '';
  endDate = '';
  dateFrom = '';
  dateTo = '';

  get isFilterActive(): boolean {
    return !!(this.search || this.verificationFilter || this.selectedCity || this.selectedCourtCategory || this.startDate || this.endDate || this.dateFrom || this.dateTo);
  }

  onDateRangeChange(event: DateRangeEvent): void {
    this.startDate = event.startDate;
    this.endDate = event.endDate;
    this.dateFrom = event.startDate;
    this.dateTo = event.endDate;
    this.onFilterChange();
  }

  filterByHeaderMetric(type: string): void {
    if (type === 'pending') {
      this.verificationFilter = this.verificationFilter === 'false' ? '' : 'false';
    } else if (type === 'verified') {
      this.verificationFilter = this.verificationFilter === 'true' ? '' : 'true';
    } else if (type === 'all') {
      this.verificationFilter = '';
    }
    this.onFilterChange();
  }

  // Document Viewer & Enterprise Feature Helpers
  openDocumentDrawer(lawyer: any): void {
    this.selectedLawyerForReview = lawyer;
    this.activeDocType = 'bar_card';
    this.documentZoom = 100;
    this.documentRotation = 0;
    this.registryResult = null;
    this.isPreviewDrawerOpen = true;
    this.openActionMenuId = null;
    document.body.style.overflow = 'hidden';
    this.cdr.markForCheck();
    this.fetchLawyerAuditLogs(lawyer.id);
  }

  closeDocumentDrawer(): void {
    this.isPreviewDrawerOpen = false;
    this.selectedLawyerForReview = null;
    document.body.style.overflow = '';
    this.cdr.markForCheck();
  }

  setDocType(type: 'bar_card' | 'cop' | 'degree' | 'pan' | 'audit_trail'): void {
    this.activeDocType = type;
    this.documentZoom = 100;
    this.documentRotation = 0;
    this.cdr.markForCheck();
  }

  fetchLawyerAuditLogs(id: number): void {
    this.isLoadingAuditLogs = true;
    this.cdr.markForCheck();
    this.api.getLawyerAuditLogs(id).subscribe({
      next: (res: any) => {
        this.isLoadingAuditLogs = false;
        this.lawyerAuditLogs = res.data || [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingAuditLogs = false;
        this.lawyerAuditLogs = [];
        this.cdr.markForCheck();
      }
    });
  }

  verifyWithBarRegistry(id: number): void {
    this.isVerifyingRegistry = true;
    this.cdr.markForCheck();
    this.api.verifyBarRegistry(id).subscribe({
      next: (res: any) => {
        this.isVerifyingRegistry = false;
        this.registryResult = res;
        this.toast.success(`Bar Council Master Registry verified: ${res.standingStatus}`);
        this.cdr.markForCheck();
        this.fetchLawyerAuditLogs(id);
      },
      error: (err: any) => {
        this.isVerifyingRegistry = false;
        this.toast.error(err?.error?.message || 'Bar Registry API check failed.');
        this.cdr.markForCheck();
      }
    });
  }

  dispatchCopRenewalNotice(id: number): void {
    this.api.dispatchCopRenewalNotice(id).subscribe({
      next: (res: any) => { this.toast.success(res.message || 'COP Renewal notice email dispatched.'); this.cdr.markForCheck(); },
      error: (err: any) => { this.toast.error(err?.error?.message || 'Failed to dispatch renewal notice.'); this.cdr.markForCheck(); }
    });
  }

  zoomIn(): void {
    if (this.documentZoom < 250) this.documentZoom += 25;
  }

  zoomOut(): void {
    if (this.documentZoom > 50) this.documentZoom -= 25;
  }

  resetDocView(): void {
    this.documentZoom = 100;
    this.documentRotation = 0;
  }

  rotateDoc(): void {
    this.documentRotation = (this.documentRotation + 90) % 360;
  }

  async approveLawyerFromDrawer(): Promise<void> {
    if (!this.selectedLawyerForReview) return;
    const l = this.selectedLawyerForReview;

    if (!l.profile) l.profile = {};
    l.profile.isVerified = true;
    l.profile.verificationRemarks = 'Verified & Approved by Bar Council Audit';
    this.toast.success(`Advocate "${l.fullName}" credentials verified & approved.`);
    this.closeDocumentDrawer();

    this.api.verifyLawyer(l.id, { isVerified: true, remarks: 'Verified & Approved by Bar Council Audit' }).subscribe({
      next: () => { this.swrCacheMap.clear(); this.cdr.markForCheck(); },
      error: () => this.cdr.markForCheck()
    });
  }

  async rejectLawyerFromDrawer(): Promise<void> {
    if (!this.selectedLawyerForReview) return;
    const l = this.selectedLawyerForReview;

    const confirmed = await this.dialog.confirm({
      title: 'Reject Credential Verification',
      message: `Reject advocate license verification for "${l.fullName}" with reason: "${this.rejectionReason}"?`,
      type: 'danger',
      confirmText: 'Reject Verification'
    });

    if (!confirmed) return;

    if (!l.profile) l.profile = {};
    l.profile.isVerified = false;
    l.profile.verificationRemarks = this.rejectionReason;
    this.toast.info(`Verification rejected for "${l.fullName}". Rejection notice sent.`);
    this.closeDocumentDrawer();

    this.api.verifyLawyer(l.id, { isVerified: false, remarks: this.rejectionReason }).subscribe({
      next: () => { this.swrCacheMap.clear(); this.cdr.markForCheck(); },
      error: () => this.cdr.markForCheck()
    });
  }

  async toggleVerification(lawyer: any): Promise<void> {
    if (!lawyer) return;
    const isCurrentlyVerified = lawyer.profile?.isVerified;
    const nextState = !isCurrentlyVerified;
    const actionName = nextState ? 'Approve & Verify' : 'Revoke Verification for';

    const confirmed = await this.dialog.confirm({
      title: `Confirm Advocate ${nextState ? 'Verification' : 'Revocation'}`,
      message: `Are you sure you want to ${actionName} "${lawyer.fullName}"?`,
      type: nextState ? 'info' : 'warning',
      confirmText: nextState ? 'Approve Credentials' : 'Revoke Verification'
    });

    if (!confirmed) return;

    if (!lawyer.profile) lawyer.profile = {};
    lawyer.profile.isVerified = nextState;

    this.api.verifyLawyer(lawyer.id, { isVerified: nextState }).subscribe({
      next: () => {
        this.swrCacheMap.clear();
        this.toast.success(`Verification status updated for "${lawyer.fullName}".`);
        this.cdr.markForCheck();
        this.fetchLawyers();
      },
      error: (err: any) => { this.toast.error(err?.error?.message || 'Verification update failed.'); this.cdr.markForCheck(); }
    });
  }

  async deleteLawyer(id: number): Promise<void> {
    const lawyer = this.lawyers.find(l => l.id === id);
    const name = lawyer ? lawyer.fullName : 'this advocate';
    const confirmed = await this.dialog.confirm({
      title: 'Delete Advocate Profile',
      message: `Are you sure you want to permanently delete the advocate account for "${name}"? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete Advocate'
    });

    if (!confirmed) return;

    this.api.deleteUser(id).subscribe({
      next: () => {
        this.swrCacheMap.clear();
        this.lawyers = this.lawyers.filter(l => l.id !== id);
        this.selection.delete(id);
        this.toast.success(`Advocate profile for "${name}" deleted.`);
        this.cdr.markForCheck();
        this.fetchLawyers();
      },
      error: (err: any) => { this.toast.error(err?.error?.message || 'Failed to delete advocate profile.'); this.cdr.markForCheck(); }
    });
  }

  getSpecializationList(specStr: string): string[] {
    if (!specStr) return ['General Practice'];
    return specStr.split(',').map(s => s.trim()).filter(Boolean);
  }

  getRating(l: any): number {
    return l.rating || l.avgRating || 0;
  }

  computeAvgRating(data: any[]): string {
    if (!data || data.length === 0) return '0.0';
    const ratings = data.map(l => Number(l.rating || l.avgRating || l.profile?.rating || 0)).filter(r => r > 0);
    if (ratings.length === 0) return '0.0';
    const sum = ratings.reduce((acc, curr) => acc + curr, 0);
    return (sum / ratings.length).toFixed(1);
  }

  getSla(l: any): number {
    return l.sla || 0;
  }

  getDisputes(l: any): number {
    return l.disputeCount || 0;
  }

  async bulkVerifyLawyers(targetStatus: boolean): Promise<void> {
    if (this.selection.isEmpty) return;
    const action = targetStatus ? 'Approve & Verify' : 'Revoke Verification for';
    const count = this.selection.size;

    const confirmed = await this.dialog.confirm({
      title: `Bulk Lawyer ${targetStatus ? 'Verification' : 'Revocation'}`,
      message: `Are you sure you want to ${action} ${count} selected advocate profile(s)?`,
      type: targetStatus ? 'info' : 'warning',
      confirmText: `Bulk ${targetStatus ? 'Approve' : 'Revoke'}`
    });

    if (!confirmed) return;

    const ids = this.selection.toArray();

    this.api.bulkVerifyLawyers(ids, targetStatus).subscribe({
      next: (res: any) => {
        this.swrCacheMap.clear();
        this.toast.success(res.message || `Bulk ${action} applied to ${ids.length} selected lawyer profiles.`);
        this.selection.clear();
        this.cdr.markForCheck();
        this.fetchLawyers();
      },
      error: (err: any) => { this.toast.error(err?.error?.message || 'Bulk verification update failed.'); this.cdr.markForCheck(); }
    });
  }

  isExporting = false;

  openExportModal(): void {
    this.isExportModalOpen = true;
  }

  closeExportModal(): void {
    this.isExportModalOpen = false;
  }

  handleExport(config: ExportConfig): void {
    if (this.isExporting) return;
    this.isExporting = true;

    // Determine source: selected rows or server fetch
    if (config.scope === 'selected') {
      const selectedLawyers = this.lawyers.filter(l => this.selection.isSelected(l.id));
      this.exportLawyerData(selectedLawyers, config.columns);
      return;
    }

    this.api.getLawyers({
      search: this.search || undefined,
      isVerified: this.verificationFilter || undefined,
      city: this.selectedCity || undefined,
      courtCategory: this.selectedCourtCategory || undefined,
      page: 1,
      limit: 5000
    }).subscribe({
      next: (res: any) => {
        const fullList = res.data || res.lawyers || res || [];
        if (!fullList.length) {
          this.isExporting = false;
          this.toast.warning('No lawyer records available to export.');
          this.cdr.markForCheck();
          return;
        }
        this.exportLawyerData(fullList, config.columns);
      },
      error: () => {
        this.isExporting = false;
        this.toast.error('Failed to fetch complete lawyer records for export.');
        this.cdr.markForCheck();
      }
    });
  }

  private exportLawyerData(data: any[], columnKeys: string[]): void {
    const columnMap: Record<string, { header: string; extract: (l: any) => any }> = {
      id: { header: 'ID', extract: l => l.id },
      fullName: { header: 'Full Name', extract: l => l.fullName || '' },
      email: { header: 'Email', extract: l => l.email || '' },
      phone: { header: 'Phone', extract: l => l.phoneNumber || l.phone || '' },
      barCouncil: { header: 'Bar License Number', extract: l => l.profile?.barCouncilLicenseNumber || l.profile?.barCouncilNumber || '' },
      city: { header: 'City', extract: l => l.profile?.city || l.city || '' },
      activeCourts: { header: 'Active Courts', extract: l => l.profile?.activeCourts || '' },
      experienceYears: { header: 'Experience Years', extract: l => l.profile?.experienceYears || 0 },
      specialization: { header: 'Specialization', extract: l => l.profile?.specialization || '' },
      verificationStatus: { header: 'Verification Status', extract: l => l.profile?.isVerified ? 'Verified' : 'Pending' },
      consultationFee: { header: 'Consultation Fee', extract: l => l.profile?.consultationFee || 0 },
      verificationRemarks: { header: 'Verification Remarks', extract: l => l.profile?.verificationRemarks || '' }
    };

    const activeCols = columnKeys.map(k => columnMap[k]).filter(Boolean);
    const headers = activeCols.map(c => c.header);
    const rows = data.map(l => activeCols.map(c => c.extract(l)));

    try {
      CsvExporter.export('legalconnect_lawyers_verification_queue', headers, rows);
      this.toast.success(`Exported ${data.length} advocate records (${headers.length} columns) to CSV.`);
    } catch (err: any) {
      this.toast.error(err.message || 'Export failed.');
    }
    this.isExporting = false;
    this.isExportModalOpen = false;
    this.cdr.markForCheck();
  }

  // Scroll-close now managed by ActionMenuComponent

  ngAfterViewInit(): void {
    // Scroll-close managed by ActionMenuComponent
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  ngOnInit(): void {
    this.buildDynamicCityOptions();

    this.searchSubject$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.search = query;
      this.pagination.page = 1;
      this.fetchLawyers();
    });

    this.route.queryParams.subscribe(params => {
      if (params['city']) {
        this.search = params['city'];
        this.selectedCity = params['city'];
      }
      if (params['search']) {
        this.search = params['search'];
      }
      this.fetchLawyers();
    });
  }

  onSearchInput(val: string): void {
    this.searchSubject$.next(val);
  }

  fetchLawyers(): void {
    const isFirstTime = this.isInitialLoad;
    const cacheKey = `${this.search}_${this.verificationFilter}_${this.selectedCity}_${this.selectedCourtCategory}_${this.sortBy}_${this.sortOrder}_${this.pagination.page}_${this.pagination.limit}`;

    // SWR Cache Hydration (0ms Instant Render)
    if (this.swrCacheMap.has(cacheKey)) {
      const cached = this.swrCacheMap.get(cacheKey)!;
      this.lawyers = cached.data;
      this.buildDynamicCityOptions(cached.data, cached.summary);
      this.pagination = { ...cached.pagination };
      if (cached.summary) {
        this.globalTotalLawyers = cached.summary.totalLawyers || this.globalTotalLawyers;
        this.globalPendingCount = cached.summary.pendingCount || this.globalPendingCount;
        this.globalVerifiedCount = cached.summary.verifiedCount || this.globalVerifiedCount;
        this.globalPlatformRating = cached.summary.platformRating ? Number(cached.summary.platformRating).toFixed(1) : this.computeAvgRating(cached.data);
      }
      this.isInitialLoad = false;
      this.cdr.markForCheck();
    }

    this.api.getLawyers({
      search: this.search || undefined,
      isVerified: this.verificationFilter || undefined,
      city: this.selectedCity || undefined,
      courtCategory: this.selectedCourtCategory || undefined,
      dateFrom: this.dateFrom || undefined,
      dateTo: this.dateTo || undefined,
      sort: this.sortBy,
      sortOrder: this.sortOrder,
      page: this.pagination.page,
      limit: this.pagination.limit
    }).pipe(smartLoading(l => { this.isLoading = l; this.cdr.markForCheck(); }, isFirstTime && !this.swrCacheMap.has(cacheKey))).subscribe({
      next: (res: any) => {
        this.isInitialLoad = false;
        let fetchedData = res.data || res.lawyers || res || [];

        // Apply client-side date range filtering if dates are set
        if (this.dateFrom || this.dateTo) {
          if (this.dateFrom) {
            const fromTime = new Date(this.dateFrom).getTime();
            fetchedData = fetchedData.filter((l: any) => new Date(l.createdAt || l.profile?.createdAt || 0).getTime() >= fromTime);
          }
          if (this.dateTo) {
            const toTime = new Date(this.dateTo).setHours(23, 59, 59, 999);
            fetchedData = fetchedData.filter((l: any) => new Date(l.createdAt || l.profile?.createdAt || 0).getTime() <= toTime);
          }
        }

        const fetchedPagination = res.pagination ? {
          page: res.pagination.page || this.pagination.page,
          limit: res.pagination.limit || this.pagination.limit,
          total: res.pagination.total || fetchedData.length,
          pages: res.pagination.pages || 1
        } : {
          page: this.pagination.page,
          limit: this.pagination.limit,
          total: fetchedData.length,
          pages: 1
        };

        this.lawyers = fetchedData;
        this.buildDynamicCityOptions(fetchedData, res.summary);
        this.pagination = fetchedPagination;

        if (res.summary) {
          this.globalTotalLawyers = res.summary.totalLawyers || this.lawyers.length;
          this.globalPendingCount = res.summary.pendingCount || 0;
          this.globalVerifiedCount = res.summary.verifiedCount || 0;
          this.globalPlatformRating = res.summary.platformRating ? Number(res.summary.platformRating).toFixed(1) : this.computeAvgRating(fetchedData);
        } else {
          this.globalPlatformRating = this.computeAvgRating(fetchedData);
          if (!this.search && !this.verificationFilter && !this.selectedCity && !this.selectedCourtCategory && !this.dateFrom && !this.dateTo) {
            this.globalTotalLawyers = this.pagination.total || this.lawyers.length;
          }
        }

        // Store SWR Cache snapshot
        this.swrCacheMap.set(cacheKey, {
          data: fetchedData,
          summary: res.summary,
          pagination: fetchedPagination
        });
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.isInitialLoad = false;
        this.toast.error(err?.error?.message || 'Failed to fetch lawyer verification list.');
        this.cdr.markForCheck();
      }
    });
  }

  onSearch(): void {
    this.selection.clear();
    this.pagination.page = 1;
    this.fetchLawyers();
  }

  onSearchChange(query: string): void {
    this.search = query;
    this.selection.clear();
    this.pagination.page = 1;
    this.fetchLawyers();
  }

  onSortChange(event: { key: string; order: 'asc' | 'desc' }): void {
    this.sortBy = event.key;
    this.sortOrder = event.order;
    this.pagination.page = 1;
    this.swrCacheMap.clear();
    this.fetchLawyers();
  }

  onFilterChange(): void {
    this.selection.clear();
    this.pagination.page = 1;
    this.fetchLawyers();
  }

  resetFilters(): void {
    this.search = '';
    this.verificationFilter = '';
    this.selectedCity = '';
    this.selectedCourtCategory = '';
    this.startDate = '';
    this.endDate = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.selection.clear();
    this.pagination.page = 1;
    this.fetchLawyers();
  }

  onPageChange(newPage: number): void {
    this.pagination.page = newPage;
    this.fetchLawyers();
  }

  onLimitChange(newLimit: number): void {
    this.pagination.limit = newLimit;
    this.pagination.page = 1;
    this.fetchLawyers();
  }

  viewLawyer(id: number): void {
    this.api.getLawyer(id).subscribe({
      next: (res: any) => { this.selectedLawyerDetail = res.data || res; this.cdr.markForCheck(); },
      error: (err: any) => { this.toast.error(err?.error?.message || 'Failed to view lawyer details.'); this.cdr.markForCheck(); }
    });
  }

  closeViewModal(): void {
    this.selectedLawyerDetail = null;
  }

  openDetailModal(lawyer: any): void {
    this.api.getLawyer(lawyer.id).subscribe({
      next: (res: any) => {
        this.selectedLawyerDetail = res.data || res;
        this.cdr.markForCheck();
      },
      error: () => { this.toast.error('Failed to load complete lawyer credentials.'); this.cdr.markForCheck(); }
    });
  }

  closeDetailModal(): void {
    this.selectedLawyerDetail = null;
    this.cdr.markForCheck();
  }

  openEditModal(lawyer: any): void {
    this.editingLawyer = lawyer;
    this.editForm = {
      fullName: lawyer.fullName,
      email: lawyer.email,
      phoneNumber: lawyer.phoneNumber,
      barCouncilLicenseNumber: lawyer.profile?.barCouncilLicenseNumber || lawyer.profile?.barCouncilNumber || '',
      experienceYears: lawyer.profile?.experienceYears || 0,
      specialization: lawyer.profile?.specialization || '',
      activeCourts: lawyer.profile?.activeCourts || 'Supreme Court of India, High Court',
      consultationFee: lawyer.profile?.consultationFee || 0,
      officeAddress: lawyer.profile?.officeAddress || ''
    };
    this.cdr.markForCheck();
  }

  closeEditModal(): void {
    this.editingLawyer = null;
    this.editForm = {};
    this.cdr.markForCheck();
  }

  saveLawyerEdit(): void {
    if (!this.editingLawyer) return;
    this.api.updateLawyerProfile(this.editingLawyer.id, this.editForm).subscribe({
      next: () => {
        this.swrCacheMap.clear();
        this.toast.success(`Lawyer profile for "${this.editingLawyer.fullName}" updated & synced across MySQL and MongoDB.`);
        this.closeEditModal();
        this.fetchLawyers();
      },
      error: (err) => { this.toast.error(err?.error?.message || 'Failed to update lawyer profile.'); this.cdr.markForCheck(); }
    });
  }
}