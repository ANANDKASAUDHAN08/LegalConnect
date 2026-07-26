import { Component, OnInit } from '@angular/core';
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

  editingLawyer: any = null;
  editForm: any = {};

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialog: DialogService,
    private route: ActivatedRoute
  ) { }

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