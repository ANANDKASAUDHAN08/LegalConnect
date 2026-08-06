import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { AdminReviewItem } from '../../core/models/admin.models';
import { ActivatedRoute, Router } from '@angular/router';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { Subscription } from 'rxjs';
import { smartLoading } from '../../core/utils/smart-loading.operator';
import { ActionMenuComponent } from '../../shared/components/action-menu/action-menu.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { ColumnCustomizerComponent, ColumnDef } from '../../shared/components/column-customizer/column-customizer.component';
import { AdminSearchInputComponent, AdminEmptyStateComponent, AdminSortHeaderComponent } from '../../shared/components/data-table/data-table-helpers.component';
import { DateRangePickerComponent, DateRangeEvent } from '../../shared/components/date-range-picker/date-range-picker.component';
import { TableSelection, sortByField, handleTableKeyboardNav } from '../../core/utils/table.utils';
import { SwrCacheService } from '../../core/services/admin-swr-cache.service';
import { maskPhone, maskEmail } from '../../core/utils/security-utils';

@Component({
  selector: 'admin-reviews',
  standalone: true,
  imports: [
    CommonModule, FormsModule, SkeletonComponent, TooltipDirective, SelectComponent,
    ActionMenuComponent, PaginationComponent, ColumnCustomizerComponent,
    AdminSearchInputComponent, AdminEmptyStateComponent, AdminSortHeaderComponent, DateRangePickerComponent
  ],
  templateUrl: './reviews.component.html',
  styleUrl: './reviews.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReviewsComponent implements OnInit, OnDestroy {
  maskPhone = maskPhone;
  maskEmail = maskEmail;
  reviews: AdminReviewItem[] = [];
  isLoading = false;
  isInitialLoad = true;
  private routeSub?: Subscription;

  // Sorting state matching Users/Lawyers page
  sortBy = 'createdAt';
  sortOrder: 'asc' | 'desc' = 'desc';

  // Pagination matching Users/Lawyers page
  pagination = { page: 1, limit: 10, total: 0, pages: 1 };

  // Filters
  ratingFilter = '';
  moderationFilter = '';
  search = '';

  // Date range filter matching Users/Lawyers/Support
  startDate = '';
  endDate = '';

  activeMetricCard: 'all' | 'approved' | 'pending' | 'flagged' | 'hidden' = 'all';

  // Column Customizer setup matching Users/Lawyers page
  columnDefs: ColumnDef[] = [
    { key: 'reviewer', label: 'Reviewer Details' },
    { key: 'target', label: 'Target Advocate' },
    { key: 'rating', label: 'Star Rating' },
    { key: 'comment', label: 'Feedback Comment' },
    { key: 'status', label: 'Moderation Status' },
    { key: 'submitted', label: 'Submitted Date' }
  ];

  columnVisibility: Record<string, boolean> = {
    reviewer: true,
    target: true,
    rating: true,
    comment: true,
    status: true,
    submitted: true
  };

  get isNoColumnsVisible(): boolean {
    return Object.values(this.columnVisibility).every(v => !v);
  }

  get isAnyColumnHidden(): boolean {
    return Object.values(this.columnVisibility).some(v => !v);
  }

  get hasQueryFilter(): boolean {
    return !!(this.search || this.ratingFilter || this.moderationFilter || this.startDate || this.endDate || this.isAnyColumnHidden);
  }

  resetColumnVisibility(): void {
    const keys = Object.keys(this.columnVisibility);
    const reset: Record<string, boolean> = {};
    keys.forEach(k => reset[k] = true);
    this.columnVisibility = reset;
    this.cdr.markForCheck();
  }

  // Inspection Modal
  selectedReview: AdminReviewItem | null = null;
  flagReasonInput = '';

  // Bulk Selection
  selectedReviewIds: Set<number> = new Set();

  // Floating Action Menu ViewChild
  @ViewChild('actionMenu') actionMenuRef!: ActionMenuComponent;
  openActionMenuId: number | null = null;

  ratingOptions: SelectOption[] = [
    { label: 'All Ratings', value: '', icon: 'info', color: '#38bdf8' },
    { label: '5 Stars Only', value: '5', icon: 'star', color: '#f59e0b' },
    { label: '4 Stars Only', value: '4', icon: 'star', color: '#f59e0b' },
    { label: '3 Stars Only', value: '3', icon: 'star', color: '#eab308' },
    { label: '2 Stars Only', value: '2', icon: 'star', color: '#f97316' },
    { label: '1 Star Only', value: '1', icon: 'star', color: '#ef4444' }
  ];

  moderationOptions: SelectOption[] = [
    { label: 'All Moderation Statuses', value: '', icon: 'info', color: '#38bdf8' },
    { label: 'Approved & Public', value: 'Approved', icon: 'check', color: '#10b981' },
    { label: 'Pending Audit Queue', value: 'Pending', icon: 'clock', color: '#f59e0b' },
    { label: 'Flagged / Quarantined', value: 'Flagged', icon: 'shield', color: '#f43f5e' },
    { label: 'Hidden / Rejected', value: 'Hidden', icon: 'archive', color: '#64748b' }
  ];

  selection = new TableSelection<number>();

  get reviewIds(): number[] {
    return this.reviews.map(r => r.id);
  }

  isAllSelected(): boolean {
    return this.selection.isAllSelected(this.reviewIds);
  }

  toggleSelectAll(event?: Event): void {
    this.selection.toggleAll(this.reviewIds);
  }

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialog: DialogService,
    private route: ActivatedRoute,
    private router: Router,
    public swrCache: SwrCacheService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.routeSub = this.route.queryParams.subscribe(params => {
      this.ratingFilter = params['rating'] || '';
      this.moderationFilter = params['moderation'] || '';
      this.search = params['search'] || '';
      this.startDate = params['startDate'] || '';
      this.endDate = params['endDate'] || '';
      this.sortBy = params['sort'] || 'createdAt';
      this.sortOrder = params['sortOrder'] || 'desc';
      this.activeMetricCard = params['card'] || (
        this.moderationFilter === 'Approved' ? 'approved' :
        this.moderationFilter === 'Pending' ? 'pending' :
        this.moderationFilter === 'Flagged' ? 'flagged' :
        this.moderationFilter === 'Hidden' ? 'hidden' : 'all'
      );
      this.pagination.page = parseInt(params['page'], 10) || 1;
      this.fetchReviews();
    });
  }

  ngOnDestroy(): void {
    if (this.rowClickTimeout) {
      clearTimeout(this.rowClickTimeout);
    }
    this.routeSub?.unsubscribe();
  }

  focusedRowIndex = -1;

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    handleTableKeyboardNav(event, {
      getListLength: () => this.reviews.length,
      getFocusedIndex: () => this.focusedRowIndex,
      setFocusedIndex: (idx) => { this.focusedRowIndex = idx; this.cdr.markForCheck(); },
      onEnter: (idx) => { if (this.reviews[idx]) this.openInspectionModal(this.reviews[idx]); },
      onEscape: () => { this.selectedReview = null; this.openActionMenuId = null; this.cdr.markForCheck(); }
    });
  }

  openInspectionModal(review: AdminReviewItem): void {
    this.selectedReview = review;
    this.cdr.markForCheck();
  }

  private updateUrlParams(): void {
    const queryParams: any = {};
    if (this.search) queryParams.search = this.search;
    if (this.ratingFilter) queryParams.rating = this.ratingFilter;
    if (this.moderationFilter) queryParams.moderation = this.moderationFilter;
    if (this.startDate) queryParams.startDate = this.startDate;
    if (this.endDate) queryParams.endDate = this.endDate;
    if (this.activeMetricCard && this.activeMetricCard !== 'all') queryParams.card = this.activeMetricCard;
    if (this.sortBy && this.sortBy !== 'createdAt') queryParams.sort = this.sortBy;
    if (this.sortOrder && this.sortOrder !== 'desc') queryParams.sortOrder = this.sortOrder;
    if (this.pagination.page > 1) queryParams.page = this.pagination.page;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true
    });
  }

  get isFilterActive(): boolean {
    return this.hasQueryFilter;
  }

  toggleMetricFilter(type: 'all' | 'approved' | 'pending' | 'flagged' | 'hidden'): void {
    if (this.activeMetricCard === type && type !== 'all') {
      this.activeMetricCard = 'all';
      this.moderationFilter = '';
    } else {
      this.activeMetricCard = type;
      this.moderationFilter = '';

      if (type === 'approved') {
        this.moderationFilter = 'Approved';
      } else if (type === 'pending') {
        this.moderationFilter = 'Pending';
      } else if (type === 'flagged') {
        this.moderationFilter = 'Flagged';
      } else if (type === 'hidden') {
        this.moderationFilter = 'Hidden';
      }
    }
    this.onFilterChange();
  }

  onDateRangeChange(event: DateRangeEvent): void {
    this.startDate = event.startDate || '';
    this.endDate = event.endDate || '';
    this.pagination.page = 1;
    this.updateUrlParams();
    this.fetchReviews();
  }

  refreshData(): void {
    this.swrCache.invalidate('reviews');
    this.fetchReviews();
  }

  onSearchChange(query: string): void {
    this.search = query;
    this.pagination.page = 1;
    this.updateUrlParams();
    this.fetchReviews();
  }

  onFilterChange(): void {
    this.pagination.page = 1;
    this.updateUrlParams();
    this.fetchReviews();
  }

  resetFilters(): void {
    this.activeMetricCard = 'all';
    this.search = '';
    this.ratingFilter = '';
    this.moderationFilter = '';
    this.startDate = '';
    this.endDate = '';
    this.pagination.page = 1;
    this.resetColumnVisibility();
    this.selection.clear();
    this.updateUrlParams();
    this.fetchReviews();
  }

  onColumnVisibilityChange(visibility: Record<string, boolean>): void {
    this.columnVisibility = visibility;
    this.cdr.markForCheck();
  }

  onSortChange(event: { key: string; order: 'asc' | 'desc' }): void {
    this.sortBy = event.key;
    this.sortOrder = event.order;
    this.pagination.page = 1;
    this.swrCache.invalidate('reviews');
    this.updateUrlParams();
  }

  sortData(list: AdminReviewItem[]): AdminReviewItem[] {
    return sortByField(list, this.sortBy, this.sortOrder, {
      rating: (r: any) => Number(r.rating) || 0
    });
  }

  fetchReviews(): void {
    const params = {
      rating: this.ratingFilter ? Number(this.ratingFilter) : undefined,
      moderationStatus: this.moderationFilter || undefined,
      search: this.search || undefined,
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined,
      sort: this.sortBy,
      sortOrder: this.sortOrder,
      page: this.pagination.page,
      limit: this.pagination.limit
    };

    // 0ms Instant SWR Cache Hydration
    const cached = this.swrCache.get<any>('reviews', params);
    if (cached) {
      this.reviews = this.sortData(cached.data || []);
      this.selection.retainOnly(this.reviews.map(r => r.id));
      if (cached.pagination) this.pagination = cached.pagination;
      this.isInitialLoad = false;
      this.isLoading = false;
      this.cdr.markForCheck();
    }

    const showLoader = this.isInitialLoad && !cached;

    this.api.getReviews(params).pipe(
      smartLoading((val: boolean) => { this.isLoading = val; this.cdr.markForCheck(); }, showLoader)
    ).subscribe({
      next: (res: any) => {
        const rawItems = res.data || res.items || res || [];
        this.reviews = this.sortData(rawItems);
        this.selection.retainOnly(this.reviews.map(r => r.id));
        const p = res.pagination || {};
        const total = p.total ?? p.totalItems ?? this.reviews.length;
        const limit = p.limit || this.pagination.limit || 10;
        const pages = p.pages ?? p.totalPages ?? (Math.ceil(total / limit) || 1);
        const pageMeta = {
          page: p.page || this.pagination.page || 1,
          limit,
          total,
          pages
        };
        this.pagination = pageMeta;
        this.swrCache.set('reviews', params, { data: rawItems, pagination: pageMeta });
        this.isInitialLoad = false;
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        if (!cached) {
          this.toast.error(err?.error?.message || 'Failed to load reviews.');
        }
        this.isInitialLoad = false;
        this.cdr.markForCheck();
      }
    });
  }

  onPageChange(page: number): void {
    this.pagination.page = page;
    this.updateUrlParams();
  }

  onLimitChange(limit: number): void {
    this.pagination.limit = limit;
    this.pagination.page = 1;
    this.updateUrlParams();
  }

  get totalReviewsCount(): number {
    return this.pagination.total || this.reviews.length;
  }

  get averageRating(): string {
    if (this.reviews.length === 0) return '0.0';
    const sum = this.reviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / this.reviews.length).toFixed(1);
  }

  get pendingAuditCount(): number {
    return this.reviews.filter(r => r.moderationStatus === 'Pending' || (r.rating === 3 && !r.moderationStatus)).length;
  }

  get flaggedCount(): number {
    return this.reviews.filter(r => r.moderationStatus === 'Flagged').length;
  }

  get verifiedClientCount(): number {
    return this.reviews.filter(r => r.isVerifiedClient !== false).length;
  }

  getRatingCount(star: number): number {
    return this.reviews.filter(r => r.rating === star).length;
  }

  getRatingPercentage(star: number): number {
    if (this.reviews.length === 0) return 0;
    return Math.round((this.getRatingCount(star) / this.reviews.length) * 100);
  }

  getReviewerInitial(rev: AdminReviewItem): string {
    const name = rev.userName || rev.userRole || 'A';
    return name.trim().charAt(0).toUpperCase();
  }

  getReviewerName(rev: AdminReviewItem): string {
    if (rev.userName && rev.userName.trim()) {
      return rev.userName;
    }
    return 'Anonymous Client';
  }

  private rowClickTimeout: any = null;

  onRowClick(id: any): void {
    if (this.rowClickTimeout) {
      clearTimeout(this.rowClickTimeout);
    }
    this.rowClickTimeout = setTimeout(() => {
      this.toggleReviewSelection(id);
      this.rowClickTimeout = null;
      this.cdr.markForCheck();
    }, 250);
  }

  onRowDblClick(rev: AdminReviewItem): void {
    if (this.rowClickTimeout) {
      clearTimeout(this.rowClickTimeout);
      this.rowClickTimeout = null;
    }
    this.openInspectModal(rev);
  }

  openInspectModal(rev: AdminReviewItem): void {
    this.selectedReview = { ...rev };
    this.flagReasonInput = rev.flagReason || '';
    this.closeActionMenu();
  }

  closeInspectModal(): void {
    this.selectedReview = null;
    this.flagReasonInput = '';
  }

  updateModeration(rev: AdminReviewItem, status: 'Approved' | 'Pending' | 'Flagged' | 'Hidden', reason?: string): void {
    rev.moderationStatus = status;
    if (reason) rev.flagReason = reason;

    this.api.updateReviewModeration(rev.id, { moderationStatus: status, flagReason: reason }).subscribe({
      next: () => {
        this.toast.success(`Review status updated to ${status}`);
        this.fetchReviews();
        this.cdr.markForCheck();
      },
      error: () => this.toast.error('Failed to update review moderation status')
    });
  }

  approveAdvocateReply(rev: AdminReviewItem): void {
    rev.advocateReplyStatus = 'Approved';
    this.api.updateReviewModeration(rev.id, {
      moderationStatus: rev.moderationStatus || 'Approved',
      flagReason: rev.flagReason,
      advocateReplyStatus: 'Approved'
    }).subscribe({
      next: () => { this.toast.success('Advocate response approved for display'); this.cdr.markForCheck(); },
      error: () => this.toast.error('Failed to approve advocate response')
    });
  }

  deleteReview(id: number): void {
    this.dialog.confirm({
      title: 'Delete Review',
      message: 'Are you sure you want to permanently delete this client review? This action cannot be undone.',
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel',
      type: 'danger'
    }).then(confirmed => {
      if (confirmed) {
        this.api.deleteReview(id).subscribe({
          next: () => {
            this.toast.success('Review deleted permanently.');
            this.reviews = this.reviews.filter(r => r.id !== id);
            this.closeInspectModal();
            this.cdr.markForCheck();
          },
          error: () => this.toast.error('Failed to delete review.')
        });
      }
    });
  }

  toggleSelectRow(id: number, event?: Event): void {
    if (event) event.stopPropagation();
    this.selection.toggle(id);
  }

  toggleReviewSelection(id: number, event?: Event): void {
    this.toggleSelectRow(id, event);
  }

  isReviewSelected(id: number): boolean {
    return this.selection.isSelected(id);
  }

  bulkUpdateModeration(status: 'Approved' | 'Hidden' | 'Flagged'): void {
    if (this.selection.isEmpty) return;
    const ids = this.selection.toArray();
    let count = 0;
    this.reviews.forEach(rev => {
      if (this.selection.isSelected(rev.id)) {
        rev.moderationStatus = status;
        count++;
        this.api.updateReviewModeration(rev.id, { moderationStatus: status }).subscribe();
      }
    });
    this.swrCache.invalidate('reviews');
    this.toast.success(`Bulk updated ${count} review(s) to ${status}.`);
    this.selection.clear();
  }

  // Floating Action Menu matching Users/Lawyers page
  getOpenActionReview(): AdminReviewItem | null {
    if (!this.openActionMenuId) return null;
    return this.reviews.find(r => r.id === this.openActionMenuId) || null;
  }

  getOpenActionItem(): AdminReviewItem | null {
    return this.getOpenActionReview();
  }

  toggleActionMenu(id: number, buttonEl: HTMLElement, event: Event): void {
    event.stopPropagation();
    if (this.openActionMenuId === id) {
      this.openActionMenuId = null;
      return;
    }
    this.openActionMenuId = id;
    if (this.actionMenuRef) {
      this.actionMenuRef.openAt(buttonEl);
    }
  }

  closeActionMenu(): void {
    this.openActionMenuId = null;
  }
}