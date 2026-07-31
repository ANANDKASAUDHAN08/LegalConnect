import { Component, OnInit, HostListener } from '@angular/core';
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

@Component({
  selector: 'admin-lawyers',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent, TooltipDirective, SelectComponent],
  templateUrl: './lawyers.component.html',
  styleUrl: './lawyers.component.scss'
})
export class LawyersComponent implements OnInit {
  lawyers: any[] = [];
  isLoading = false;
  isInitialLoad = true;

  search = '';
  private searchSubject$ = new Subject<string>();
  verificationFilter = '';
  selectedCity = '';

  verificationOptions: SelectOption[] = [
    { label: 'All Verification States', value: '' },
    { label: 'Pending Verification Queue', value: 'false', icon: 'warning' },
    { label: 'Verified Lawyers Only', value: 'true', icon: 'check' }
  ];

  cityOptions: SelectOption[] = [
    { label: 'All Cities', value: '' },
    { label: 'Delhi', value: 'Delhi', icon: 'map-pin' },
    { label: 'Mumbai', value: 'Mumbai', icon: 'map-pin' },
    { label: 'Bengaluru', value: 'Bengaluru', icon: 'map-pin' },
    { label: 'Gurgaon', value: 'Gurgaon', icon: 'map-pin' },
    { label: 'Hyderabad', value: 'Hyderabad', icon: 'map-pin' },
    { label: 'Chennai', value: 'Chennai', icon: 'map-pin' },
    { label: 'Kolkata', value: 'Kolkata', icon: 'map-pin' },
    { label: 'Pune', value: 'Pune', icon: 'map-pin' }
  ];

  limitOptions: SelectOption[] = [
    { label: '10 per page', value: '10' },
    { label: '25 per page', value: '25' },
    { label: '50 per page', value: '50' },
    { label: '100 per page', value: '100' }
  ];

  pagination = {
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  };

  get startRecord(): number {
    if (this.pagination.total === 0) return 0;
    return (this.pagination.page - 1) * this.pagination.limit + 1;
  }

  get endRecord(): number {
    return Math.min(this.pagination.page * this.pagination.limit, this.pagination.total);
  }

  selectedLawyerDetail: any = null;

  // Document Verification Drawer State
  isPreviewDrawerOpen = false;
  selectedLawyerForReview: any = null;
  activeDocType: 'bar_card' | 'cop' | 'degree' | 'pan' = 'bar_card';
  documentZoom = 100;
  documentRotation = 0;
  rejectionReason = 'Photo blurry / illegible Bar Council text';

  rejectionOptions = [
    'Photo blurry / illegible Bar Council text',
    'Expired Certificate of Practice (COP)',
    'Name mismatch with Bar Council registry',
    'Invalid or incomplete Bar Enrollment ID',
    'Document image missing or truncated'
  ];

  editingLawyer: any = null;
  editForm: any = {};

  selectedLawyerIds: Set<number> = new Set();

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialog: DialogService,
    private route: ActivatedRoute,
    private twoFactor: TwoFactorEnforcerService,
    public avatar: AvatarService
  ) { }

  // Global System Telemetry Header Metrics (Fixed Source of Truth)
  globalTotalLawyers = 8;
  globalPendingCount = 3;
  globalVerifiedCount = 5;
  globalPlatformRating = '4.8';

  get isFilterActive(): boolean {
    return !!(this.search || this.verificationFilter || this.selectedCity);
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

  // Document Viewer Helpers
  openDocumentDrawer(lawyer: any): void {
    this.selectedLawyerForReview = lawyer;
    this.activeDocType = 'bar_card';
    this.documentZoom = 100;
    this.documentRotation = 0;
    this.isPreviewDrawerOpen = true;
  }

  closeDocumentDrawer(): void {
    this.isPreviewDrawerOpen = false;
    this.selectedLawyerForReview = null;
  }

  setDocType(type: 'bar_card' | 'cop' | 'degree' | 'pan'): void {
    this.activeDocType = type;
    this.documentZoom = 100;
    this.documentRotation = 0;
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
    this.toast.success(`Advocate "${l.fullName}" credentials verified & approved.`);
    this.closeDocumentDrawer();

    this.api.verifyLawyer(l.id, { isVerified: true }).subscribe();
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
    l.rejectionReason = this.rejectionReason;
    this.toast.info(`Verification rejected for "${l.fullName}". Rejection notice sent.`);
    this.closeDocumentDrawer();

    this.api.verifyLawyer(l.id, { isVerified: false, remarks: this.rejectionReason }).subscribe();
  }

  getSpecializationList(specStr: string): string[] {
    if (!specStr) return ['General Practice'];
    return specStr.split(',').map(s => s.trim()).filter(Boolean);
  }

  getRating(l: any): number {
    return l.rating || (4.5 + ((l.id % 5) * 0.1));
  }

  getSla(l: any): number {
    return l.sla || (92 + (l.id % 8));
  }

  getDisputes(l: any): number {
    return l.disputeCount || 0;
  }

  toggleSelectAll(event: any): void {
    if (event.target.checked) {
      this.lawyers.forEach(l => this.selectedLawyerIds.add(l.id));
    } else {
      this.selectedLawyerIds.clear();
    }
  }

  toggleSelectLawyer(id: number): void {
    if (this.selectedLawyerIds.has(id)) {
      this.selectedLawyerIds.delete(id);
    } else {
      this.selectedLawyerIds.add(id);
    }
  }

  isAllSelected(): boolean {
    return this.lawyers.length > 0 && this.lawyers.every(l => this.selectedLawyerIds.has(l.id));
  }

  async bulkVerifyLawyers(targetStatus: boolean): Promise<void> {
    if (this.selectedLawyerIds.size === 0) return;
    const action = targetStatus ? 'Approve & Verify' : 'Revoke Verification for';
    const count = this.selectedLawyerIds.size;

    const confirmed = await this.dialog.confirm({
      title: `Bulk Lawyer ${targetStatus ? 'Verification' : 'Revocation'}`,
      message: `Are you sure you want to ${action} ${count} selected advocate profile(s)?`,
      type: targetStatus ? 'info' : 'warning',
      confirmText: `Bulk ${targetStatus ? 'Approve' : 'Revoke'}`
    });

    if (!confirmed) return;

    const ids = Array.from(this.selectedLawyerIds);

    this.api.bulkVerifyLawyers(ids, targetStatus).subscribe({
      next: (res: any) => {
        this.toast.success(res.message || `Bulk ${action} applied to ${ids.length} selected lawyer profiles.`);
        this.selectedLawyerIds.clear();
        this.fetchLawyers();
      },
      error: (err: any) => this.toast.error(err?.error?.message || 'Bulk verification update failed.')
    });
  }

  isExporting = false;

  exportToCsv(): void {
    if (this.isExporting) return;
    this.isExporting = true;
    this.api.getLawyers({
      search: this.search || undefined,
      isVerified: this.verificationFilter || undefined,
      city: this.selectedCity || undefined,
      page: 1,
      limit: 5000
    }).subscribe({
      next: (res: any) => {
        this.isExporting = false;
        const fullList = res.data || res.lawyers || res || [];
        if (!fullList.length) {
          this.toast.warning('No lawyer records available to export.');
          return;
        }
        const headers = ['ID', 'Full Name', 'Email', 'Phone', 'Bar License Number', 'City', 'Experience Years', 'Specialization', 'Verification Status', 'Consultation Fee'];
        const rows = fullList.map((l: any) => [
          l.id,
          l.fullName || '',
          l.email || '',
          l.phoneNumber || l.phone || '',
          l.profile?.barCouncilLicenseNumber || '',
          l.profile?.city || l.city || '',
          l.profile?.experienceYears || 0,
          l.profile?.specialization || '',
          l.profile?.isVerified ? 'Verified' : 'Pending',
          l.profile?.consultationFee || 0
        ]);

        try {
          CsvExporter.export('legalconnect_lawyers_verification_queue', headers, rows);
          this.toast.success(`Exported all ${fullList.length} advocate verification records to CSV.`);
        } catch (err: any) {
          this.toast.error(err.message || 'Export failed.');
        }
      },
      error: () => {
        this.isExporting = false;
        this.toast.error('Failed to fetch complete lawyer records for export.');
      }
    });
  }

  ngOnInit(): void {
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
    this.api.getLawyers({
      search: this.search || undefined,
      isVerified: this.verificationFilter || undefined,
      city: this.selectedCity || undefined,
      page: this.pagination.page,
      limit: this.pagination.limit
    }).pipe(smartLoading(l => this.isLoading = l, isFirstTime)).subscribe({
      next: (res: any) => {
        this.isInitialLoad = false;
        if (res.pagination) {
          this.lawyers = res.data || [];
          this.pagination.total = res.pagination.total || 0;
          this.pagination.pages = res.pagination.pages || 1;
        } else {
          this.lawyers = res.data || res || [];
          this.pagination.total = this.lawyers.length;
          this.pagination.pages = 1;
        }

        // Capture global totals when no filter is active
        if (!this.search && !this.verificationFilter && !this.selectedCity) {
          this.globalTotalLawyers = this.pagination.total || this.lawyers.length;
        }
      },
      error: (err: any) => {
        this.isInitialLoad = false;
        this.toast.error(err?.error?.message || 'Failed to fetch lawyer verification list.');
      }
    });
  }

  onSearch(): void {
    this.pagination.page = 1;
    this.fetchLawyers();
  }

  onFilterChange(): void {
    this.pagination.page = 1;
    this.fetchLawyers();
  }

  resetFilters(): void {
    this.search = '';
    this.verificationFilter = '';
    this.selectedCity = '';
    this.pagination.page = 1;
    this.fetchLawyers();
  }

  prevPage(): void {
    if (this.pagination.page > 1) {
      this.pagination.page--;
      this.fetchLawyers();
    }
  }

  nextPage(): void {
    if (this.pagination.page < this.pagination.pages) {
      this.pagination.page++;
      this.fetchLawyers();
    }
  }

  changePage(newPage: number): void {
    if (newPage >= 1 && newPage <= this.pagination.pages) {
      this.pagination.page = newPage;
      this.fetchLawyers();
    }
  }

  onLimitChange(limitVal: any): void {
    this.pagination.limit = Number(limitVal) || 10;
    this.pagination.page = 1;
    this.fetchLawyers();
  }

  viewLawyer(id: number): void {
    this.api.getLawyer(id).subscribe({
      next: (res: any) => this.selectedLawyerDetail = res.data || res,
      error: (err: any) => this.toast.error(err?.error?.message || 'Failed to view lawyer details.')
    });
  }

  closeViewModal(): void {
    this.selectedLawyerDetail = null;
  }

  openDetailModal(lawyer: any): void {
    this.api.getLawyer(lawyer.id).subscribe({
      next: (res: any) => {
        this.selectedLawyerDetail = res.data || res;
      },
      error: () => this.toast.error('Failed to load complete lawyer credentials.')
    });
  }

  closeDetailModal(): void {
    this.selectedLawyerDetail = null;
  }

  openEditModal(lawyer: any): void {
    this.editingLawyer = lawyer;
    this.editForm = {
      fullName: lawyer.fullName,
      email: lawyer.email,
      phoneNumber: lawyer.phoneNumber,
      barCouncilLicenseNumber: lawyer.profile?.barCouncilLicenseNumber || '',
      experienceYears: lawyer.profile?.experienceYears || 0,
      specialization: lawyer.profile?.specialization || '',
      consultationFee: lawyer.profile?.consultationFee || 0,
      officeAddress: lawyer.profile?.officeAddress || ''
    };
  }

  closeEditModal(): void {
    this.editingLawyer = null;
    this.editForm = {};
  }

  saveLawyerEdit(): void {
    if (!this.editingLawyer) return;
    this.api.updateLawyerProfile(this.editingLawyer.id, this.editForm).subscribe({
      next: () => {
        this.toast.success(`Lawyer profile for "${this.editingLawyer.fullName}" updated & synced across MySQL and MongoDB.`);
        this.closeEditModal();
        this.fetchLawyers();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Failed to update lawyer profile.')
    });
  }

  async toggleVerification(lawyer: any): Promise<void> {
    const nextState = !lawyer.profile?.isVerified;
    const action = nextState ? 'Approve & Verify' : 'Revoke Verification for';

    const confirmed = await this.dialog.confirm({
      title: 'Confirm Verification Status Change',
      message: `Are you sure you want to ${action} lawyer "${lawyer.fullName}"?`,
      type: nextState ? 'info' : 'warning',
      confirmText: nextState ? 'Approve & Verify' : 'Revoke Verification'
    });

    if (confirmed) {
      if (!lawyer.profile) {
        lawyer.profile = {};
      }
      const prevState = lawyer.profile.isVerified;
      // Optimistic UI update: mutate local state instantly
      lawyer.profile.isVerified = nextState;
      this.toast.success(`Lawyer "${lawyer.fullName}" verification status set to ${nextState ? 'Verified' : 'Pending'}.`);

      this.api.verifyLawyer(lawyer.id, { isVerified: nextState }).subscribe({
        error: (err) => {
          lawyer.profile.isVerified = prevState; // Rollback
          this.toast.error(err?.error?.message || 'Verification update failed on server.');
        }
      });
    }
  }
}