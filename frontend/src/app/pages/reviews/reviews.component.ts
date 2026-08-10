import { Component, OnInit, OnDestroy, AfterViewInit, HostListener, ChangeDetectionStrategy, ChangeDetectorRef, NgZone, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ReviewService, ReviewItem } from '../../services/review.service';
import { AuthService, UserProfile } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { WriteReviewModalComponent } from '../../components/write-review-modal/write-review-modal.component';
import { ReviewCardComponent } from '../../components/review-card/review-card.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { ShareMenuComponent } from '../../components/share-menu/share-menu.component';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { Subject, fromEvent } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, WriteReviewModalComponent, ReviewCardComponent, ConfirmDialogComponent, ShareMenuComponent, TooltipDirective],
  templateUrl: './reviews.component.html',
  styleUrls: ['./reviews.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReviewsComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();
  private searchSubject$ = new Subject<string>();

  // Modal Dialog Signals
  isConfirmOpen = signal<boolean>(false);
  confirmTitle = signal<string>('');
  confirmMessage = signal<string>('');
  confirmType = signal<'danger' | 'warning' | 'info'>('warning');
  onConfirmAction: (() => void) | null = null;

  triggerConfirm(title: string, message: string, type: 'danger' | 'warning' | 'info', action: () => void) {
    this.confirmTitle.set(title);
    this.confirmMessage.set(message);
    this.confirmType.set(type);
    this.onConfirmAction = action;
    this.isConfirmOpen.set(true);
  }

  onConfirmDialog() {
    this.isConfirmOpen.set(false);
    if (this.onConfirmAction) {
      this.onConfirmAction();
    }
  }

  onCancelDialog() {
    this.isConfirmOpen.set(false);
    this.onConfirmAction = null;
  }

  readonly starArray = [1, 2, 3, 4, 5];
  readonly distributionStars = [5, 4, 3, 2, 1];
  readonly skeletonItems = [1, 2, 3, 4, 5, 6, 7, 8];

  // State Signals
  currentUser = signal<UserProfile | null>(null);
  allReviews = signal<ReviewItem[]>([]);

  pageSize = signal<number>(12);
  currentPage = signal<number>(1);

  // Filters & Sorting Signals
  searchText = signal<string>('');
  roleFilter = signal<string>('all'); // 'all', 'Client', 'Lawyer'
  ratingFilter = signal<string>('all'); // 'all', '5', '4', '3', '2', '1'
  topicFilter = signal<string>('all'); // 'all', 'consultation', 'property', 'documentation', 'court', 'advocate'
  sortBy = signal<'recent' | 'highest' | 'lowest' | 'likes'>('recent');
  verifiedOnlyFilter = signal<boolean>(false);

  showRatingDropdown = signal<boolean>(false);
  showSortDropdown = signal<boolean>(false);
  showTopicsDropdown = signal<boolean>(false);
  showMobileFilterSheet = signal<boolean>(false);

  showWriteModal = signal<boolean>(false);
  editModeReview = signal<ReviewItem | null>(null);
  highlightedReviewId = signal<number | null>(null);
  isLoading = signal<boolean>(true);
  navbarHeight = 68;
  pendingFragmentInfo: { id: number; fragment: string } | null = null;

  roleOptions = [
    {
      value: 'all',
      label: 'All Roles',
      tooltip: 'View reviews from all community roles',
      iconPath: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z'
    },
    {
      value: 'Client',
      label: 'Clients',
      tooltip: 'View consultation feedback submitted by verified clients',
      iconPath: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z'
    },
    {
      value: 'Lawyer',
      label: 'Advocates',
      tooltip: 'View ratings and verified reviews for legal advocates',
      iconPath: 'M12 14l9-5-9-5-9 5 9 5zM12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z'
    }
  ];

  ratingOptions = [
    { value: 'all', label: 'All Ratings', stars: 0 },
    { value: '5', label: '5 Stars', stars: 5 },
    { value: '4', label: '4 Stars', stars: 4 },
    { value: '3', label: '3 Stars', stars: 3 },
    { value: '2', label: '2 Stars', stars: 2 },
    { value: '1', label: '1 Star', stars: 1 }
  ];

  sortOptions: {
    value: 'recent' | 'highest' | 'lowest' | 'likes';
    label: string;
    iconPath: string;
    iconClass: string;
    isFill?: boolean;
  }[] = [
      {
        value: 'recent',
        label: 'Most Recent',
        iconPath: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
        iconClass: 'text-blue-500'
      },
      {
        value: 'highest',
        label: 'Highest Rated',
        iconPath: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
        iconClass: 'text-amber-400 fill-amber-400',
        isFill: true
      },
      {
        value: 'lowest',
        label: 'Lowest Rated',
        iconPath: 'M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.511l-5.511-3.181',
        iconClass: 'text-rose-500'
      },
      {
        value: 'likes',
        label: 'Most Helpful',
        iconPath: 'M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.25M5.25 10.25h-1.5a1.5 1.5 0 00-1.5 1.5v6.75a1.5 1.5 0 001.5 1.5h1.5',
        iconClass: 'text-emerald-500'
      }
    ];

  topicOptions: {
    id: string;
    label: string;
    iconPath: string;
    iconClass: string;
  }[] = [
      {
        id: 'all',
        label: 'All Topics',
        iconPath: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z',
        iconClass: 'text-blue-500'
      },
      {
        id: 'consultation',
        label: 'Consultation',
        iconPath: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z',
        iconClass: 'text-indigo-500'
      },
      {
        id: 'property',
        label: 'Property Law',
        iconPath: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75',
        iconClass: 'text-emerald-500'
      },
      {
        id: 'documentation',
        label: 'Documentation',
        iconPath: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
        iconClass: 'text-amber-500'
      },
      {
        id: 'court',
        label: 'Court & Case',
        iconPath: 'M12 3v17.25m0 0l-4.5-4.5M12 20.25l4.5-4.5M4.5 9l7.5-6 7.5 6M3.75 9h16.5',
        iconClass: 'text-purple-500'
      },
      {
        id: 'advocate',
        label: 'Advocate Reply',
        iconPath: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
        iconClass: 'text-sky-500'
      }
    ];

  // Computed Signals
  totalReviewsCount = computed(() => this.allReviews().length);

  averageRating = computed(() => {
    const list = this.allReviews();
    if (list.length === 0) return '5.0';
    const sum = list.reduce((acc, r) => acc + (r.rating || 5), 0);
    return (sum / list.length).toFixed(1);
  });

  verifiedCount = computed(() => {
    return this.allReviews().filter(r => !!r.consultationId).length;
  });

  ratingCounts = computed(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of this.allReviews()) {
      const star = r.rating || 5;
      if (counts[star] !== undefined) counts[star]++;
    }
    return counts;
  });

  ratingPercentages = computed(() => {
    const total = this.allReviews().length;
    const percentages: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (total === 0) return percentages;
    const counts = this.ratingCounts();
    for (let s = 1; s <= 5; s++) {
      percentages[s] = Math.round((counts[s] / total) * 100);
    }
    return percentages;
  });

  featuredReviews = computed(() => {
    return this.allReviews()
      .filter(r => r.rating === 5)
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, 3);
  });

  filteredReviews = computed(() => {
    const reviews = this.allReviews();
    const role = this.roleFilter();
    const rating = this.ratingFilter();
    const verified = this.verifiedOnlyFilter();
    const topic = this.topicFilter();
    const query = this.searchText().toLowerCase().trim();
    const sort = this.sortBy();

    let result = reviews.filter(rev => {
      if (role !== 'all') {
        if (role === 'Client' && rev.userRole !== 'Client' && rev.userRole !== 'Guest') return false;
        if (role === 'Lawyer' && rev.userRole !== 'Lawyer') return false;
      }
      if (rating !== 'all') {
        if (rev.rating.toString() !== rating) return false;
      }
      if (verified && !rev.consultationId) return false;

      if (topic !== 'all') {
        const text = ((rev.content || '') + ' ' + (rev.targetName || '')).toLowerCase();
        if (topic === 'consultation' && !text.includes('consult') && !text.includes('advice') && !text.includes('meeting')) return false;
        if (topic === 'property' && !text.includes('property') && !text.includes('land') && !text.includes('real estate') && !text.includes('deed')) return false;
        if (topic === 'documentation' && !text.includes('document') && !text.includes('draft') && !text.includes('paperwork') && !text.includes('agreement')) return false;
        if (topic === 'court' && !text.includes('court') && !text.includes('case') && !text.includes('hearing') && !text.includes('judge') && !text.includes('bail')) return false;
        if (topic === 'advocate' && !rev.advocateReply) return false;
      }

      if (query) {
        const contentMatch = (rev.content || '').toLowerCase().includes(query);
        const authorMatch = (rev.authorName || '').toLowerCase().includes(query);
        const targetMatch = (rev.targetName || '').toLowerCase().includes(query);
        const roleMatch = (rev.userRole || '').toLowerCase().includes(query);
        if (!contentMatch && !authorMatch && !targetMatch && !roleMatch) return false;
      }

      return true;
    });

    return result.sort((a, b) => {
      if (sort === 'highest') return b.rating - a.rating;
      if (sort === 'lowest') return a.rating - b.rating;
      if (sort === 'likes') return (b.likes || 0) - (a.likes || 0);
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  });

  totalPages = computed(() => {
    return Math.ceil(this.filteredReviews().length / this.pageSize()) || 1;
  });

  paginatedReviews = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const size = this.pageSize();
    const start = (page - 1) * size;
    return this.filteredReviews().slice(start, start + size);
  });

  pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = Math.min(this.currentPage(), total);
    const pages: number[] = [];
    const maxVisible = 7;
    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push(-1);
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < total - 2) pages.push(-1);
      pages.push(total);
    }
    return pages;
  });

  activeFiltersCount = computed(() => {
    let count = 0;
    if (this.searchText().trim()) count++;
    if (this.roleFilter() !== 'all') count++;
    if (this.ratingFilter() !== 'all') count++;
    if (this.topicFilter() !== 'all') count++;
    if (this.verifiedOnlyFilter()) count++;
    if (this.sortBy() !== 'recent') count++;
    return count;
  });

  activeFilterPills = computed(() => {
    const list: { id: string; type: string; label: string }[] = [];
    if (this.searchText().trim()) {
      list.push({ id: 'search', type: 'search', label: `Search: "${this.searchText().trim()}"` });
    }
    if (this.roleFilter() !== 'all') {
      list.push({ id: 'role', type: 'role', label: `Role: ${this.roleFilter() === 'Client' ? 'Clients' : 'Lawyers'}` });
    }
    if (this.ratingFilter() !== 'all') {
      list.push({ id: 'rating', type: 'rating', label: `★ ${this.ratingFilter()} Stars` });
    }
    if (this.topicFilter() !== 'all') {
      const topOpt = this.topicOptions.find(t => t.id === this.topicFilter());
      list.push({ id: 'topic', type: 'topic', label: `Topic: ${topOpt ? topOpt.label : this.topicFilter()}` });
    }
    if (this.verifiedOnlyFilter()) {
      list.push({ id: 'verified', type: 'verified', label: 'Verified Only' });
    }
    if (this.sortBy() !== 'recent') {
      const sortOpt = this.sortOptions.find(s => s.value === this.sortBy());
      list.push({ id: 'sort', type: 'sort', label: `Sort: ${sortOpt ? sortOpt.label : this.sortBy()}` });
    }
    return list;
  });

  hasActiveFilters = computed(() => this.activeFiltersCount() > 0);

  selectedRatingLabel = computed(() => {
    const opt = this.ratingOptions.find(o => o.value === this.ratingFilter());
    return opt ? opt.label : 'All Ratings';
  });

  selectedSortOption = computed(() => {
    return this.sortOptions.find(o => o.value === this.sortBy()) || this.sortOptions[0];
  });

  selectedTopicOption = computed(() => {
    return this.topicOptions.find(t => t.id === this.topicFilter()) || this.topicOptions[0];
  });

  setSortBy(val: 'recent' | 'highest' | 'lowest' | 'likes') {
    this.sortBy.set(val);
    this.currentPage.set(1);
    this.showSortDropdown.set(false);
  }

  setTopicFilter(topicId: string) {
    this.topicFilter.set(topicId);
    this.currentPage.set(1);
  }

  setRatingFilter(star: number | string) {
    this.ratingFilter.set(star.toString());
    this.currentPage.set(1);
  }

  removeFilterPill(type: string) {
    if (type === 'search') this.searchText.set('');
    else if (type === 'role') this.roleFilter.set('all');
    else if (type === 'rating') this.ratingFilter.set('all');
    else if (type === 'topic') this.topicFilter.set('all');
    else if (type === 'verified') this.verifiedOnlyFilter.set(false);
    else if (type === 'sort') this.sortBy.set('recent');
    this.currentPage.set(1);
  }

  resetAllFilters() {
    this.searchText.set('');
    this.roleFilter.set('all');
    this.ratingFilter.set('all');
    this.topicFilter.set('all');
    this.verifiedOnlyFilter.set(false);
    this.sortBy.set('recent');
    this.currentPage.set(1);
  }

  openMobileFilterSheet() {
    this.showMobileFilterSheet.set(true);
    if (typeof document !== 'undefined') {
      document.body.classList.add('overflow-hidden', 'mobile-drawer-open');
    }
  }

  closeMobileFilterSheet() {
    this.showMobileFilterSheet.set(false);
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden', 'mobile-drawer-open');
    }
  }

  toggleMobileFilterSheet() {
    if (this.showMobileFilterSheet()) {
      this.closeMobileFilterSheet();
    } else {
      this.openMobileFilterSheet();
    }
  }

  get pageShareUrl(): string {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}`;
  }

  trackByReviewId(index: number, item: ReviewItem): number {
    return item.id || index;
  }

  trackByNumber(index: number, item: number): number {
    return item || index;
  }

  trackByOptionValue(index: number, item: any): string {
    return item?.value || index.toString();
  }

  getRatingCount(star: number): number {
    return this.ratingCounts()[star] || 0;
  }

  getRatingPercentage(star: number): number {
    return this.ratingPercentages()[star] || 0;
  }

  updatePageSize() {
    const isMobile = window.innerWidth < 640;
    const newPageSize = isMobile ? 10 : 12;
    if (this.pageSize() !== newPageSize) {
      this.pageSize.set(newPageSize);
      this.currentPage.set(1);
    }
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      const gridElement = document.querySelector('.reviews-grid-container');
      if (gridElement) {
        gridElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.goToPage(this.currentPage() + 1);
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.goToPage(this.currentPage() - 1);
    }
  }

  onSearchInput(query: string) {
    this.searchSubject$.next(query);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.rating-dropdown-container')) {
      if (this.showRatingDropdown()) {
        this.showRatingDropdown.set(false);
      }
    }
    if (!target.closest('.sort-dropdown-container')) {
      if (this.showSortDropdown()) {
        this.showSortDropdown.set(false);
      }
    }
    if (!target.closest('.topics-dropdown-container')) {
      if (this.showTopicsDropdown()) {
        this.showTopicsDropdown.set(false);
      }
    }
  }

  constructor(
    private reviewService: ReviewService,
    private auth: AuthService,
    private snackbar: SnackbarService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }

  ngOnInit() {
    this.updatePageSize();
    this.updateNavbarHeight();

    this.ngZone.runOutsideAngular(() => {
      fromEvent(window, 'resize').pipe(
        debounceTime(150),
        takeUntil(this.destroy$)
      ).subscribe(() => {
        this.ngZone.run(() => {
          this.updatePageSize();
          this.updateNavbarHeight();
        });
      });
    });

    this.auth.currentUser$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(user => {
      this.currentUser.set(user);
    });

    this.searchSubject$.pipe(
      debounceTime(300),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.searchText.set(query);
      this.currentPage.set(1);
      this.cdr.markForCheck();
    });

    this.loadReviews();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.updateNavbarHeight();
    }, 0);
    this.route.fragment.pipe(
      takeUntil(this.destroy$)
    ).subscribe(frag => {
      if (frag && frag.startsWith('review-')) {
        const id = parseInt(frag.replace('review-', ''), 10);
        if (!isNaN(id)) {
          this.highlightedReviewId.set(id);
          if (this.allReviews().length > 0) {
            this.goToReviewPageAndScroll(id, frag);
          } else {
            this.pendingFragmentInfo = { id, fragment: frag };
          }
        }
      }
    });
  }

  goToReviewPageAndScroll(reviewId: number, fragment: string) {
    const index = this.filteredReviews().findIndex(r => r.id === reviewId);
    if (index !== -1) {
      const page = Math.floor(index / this.pageSize()) + 1;
      this.currentPage.set(page);
      this.scrollToReview(fragment);
    }
  }

  ngOnDestroy() {
    document.body.classList.remove('overflow-hidden');
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadReviews() {
    this.isLoading.set(true);
    this.reviewService.getReviews().subscribe({
      next: (res: any) => {
        const data = res.data || res.items || res || [];
        this.allReviews.set(Array.isArray(data) ? data : []);
        this.isLoading.set(false);
        if (this.pendingFragmentInfo) {
          this.goToReviewPageAndScroll(this.pendingFragmentInfo.id, this.pendingFragmentInfo.fragment);
          this.pendingFragmentInfo = null;
        }
      },
      error: (err) => {
        console.error('Failed to load reviews', err);
        this.isLoading.set(false);
        this.snackbar.show('Failed to fetch reviews.', 'error');
      }
    });
  }

  scrollToReview(elementId: string) {
    setTimeout(() => {
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          this.highlightedReviewId.set(null);
        }, 3500);
      }
    }, 100);
  }

  hasLiked(reviewId: number): boolean {
    if (!reviewId) return false;
    return localStorage.getItem(`liked_review_${reviewId}`) === 'true';
  }

  likeReview(review: ReviewItem) {
    if (!review.id) return;

    if (this.hasLiked(review.id)) {
      this.reviewService.unlikeReview(review.id).subscribe({
        next: (updatedReview) => {
          this.allReviews.update(list => list.map(r => r.id === review.id ? { ...r, likes: updatedReview.likes } : r));
          localStorage.removeItem(`liked_review_${review.id}`);
        },
        error: (err) => {
          console.error('Failed to unlike review', err);
        }
      });
    } else {
      this.reviewService.likeReview(review.id).subscribe({
        next: (updatedReview) => {
          this.allReviews.update(list => list.map(r => r.id === review.id ? { ...r, likes: updatedReview.likes } : r));
          localStorage.setItem(`liked_review_${review.id}`, 'true');
        },
        error: (err) => {
          console.error('Failed to like review', err);
        }
      });
    }
  }

  openWriteModal() {
    this.updateNavbarHeight();
    this.editModeReview.set(null);
    this.showWriteModal.set(true);
    document.body.classList.add('overflow-hidden');
  }

  openEditModal(review: ReviewItem) {
    this.updateNavbarHeight();
    this.editModeReview.set(review);
    this.showWriteModal.set(true);
    document.body.classList.add('overflow-hidden');
  }

  closeWriteModal() {
    this.showWriteModal.set(false);
    document.body.classList.remove('overflow-hidden');
  }

  onReviewSaved(savedReview: ReviewItem) {
    this.allReviews.update(list => {
      const idx = list.findIndex(r => r.id === savedReview.id);
      if (idx !== -1) {
        const copy = [...list];
        copy[idx] = savedReview;
        return copy;
      } else {
        return [savedReview, ...list];
      }
    });
  }

  private updateNavbarHeight() {
    const nav = document.querySelector('nav');
    if (nav) {
      this.navbarHeight = nav.offsetHeight;
    }
  }

  onDeleteReview(review: ReviewItem) {
    if (!review.id) return;
    this.triggerConfirm(
      'Delete Review',
      'Are you sure you want to delete this review? This action cannot be undone and will permanently remove your feedback.',
      'danger',
      () => {
        this.reviewService.deleteReview(review.id!).subscribe({
          next: () => {
            this.allReviews.update(list => list.filter(r => r.id !== review.id));
            this.snackbar.show('Review deleted successfully.', 'info');
          },
          error: (err) => {
            console.error('Failed to delete review', err);
            this.snackbar.show('Failed to delete review.', 'error');
          }
        });
      }
    );
  }

  onReportReview(review: ReviewItem) {
    if (!review.id) return;
    this.triggerConfirm(
      'Report Review to Moderation',
      'Are you sure you want to report this review for community guidelines violation? It will be flagged for moderator audit.',
      'danger',
      () => {
        this.reviewService.flagReview(review.id!, 'Flagged by community user').subscribe({
          next: () => {
            this.snackbar.show('Review reported to moderators for audit.', 'info');
          },
          error: () => {
            this.snackbar.show('Failed to report review to moderators.', 'error');
          }
        });
      }
    );
  }

  onDisputeReview(review: ReviewItem) {
    if (!review.id) return;
    this.triggerConfirm(
      'Request Review Removal',
      'Submit a formal dispute request to LegalConnect moderators for this review?',
      'warning',
      () => {
        this.reviewService.submitDispute(review.id!, 'Advocate requested removal audit via lawyer dashboard').subscribe({
          next: () => {
            this.allReviews.update(list => list.map(r => r.id === review.id ? { ...r, isDisputeRequested: true } : r));
            this.snackbar.show('Dispute request submitted to moderation desk.', 'info');
          },
          error: (err) => {
            this.snackbar.show(err?.error?.message || 'Failed to submit dispute request.', 'error');
          }
        });
      }
    );
  }
}