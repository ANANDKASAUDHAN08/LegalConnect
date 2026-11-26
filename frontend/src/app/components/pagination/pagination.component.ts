import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  HostListener,
  ElementRef,
  inject,
  computed,
  signal,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  ViewChild,
  OnDestroy,
  TemplateRef,
  DestroyRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { IconComponent } from '../icon/icon.component';
import { TooltipDirective } from '../../directives/tooltip.directive';
import {
  PaginationVariant,
  PaginationColor,
  PaginationSize,
  PaginationLayout,
  PaginationMode,
  PaginationItemInfo,
  PaginationEvent,
  PageItem,
  PageItemType
} from './pagination.types';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, TooltipDirective],
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class PaginationComponent implements OnInit, OnChanges, OnDestroy {
  private elementRef = inject(ElementRef);
  private router = inject(Router, { optional: true });
  private route = inject(ActivatedRoute, { optional: true });
  private destroyRef = inject(DestroyRef);

  // ── Core Inputs & Outputs ──
  @Input() total = 0;
  @Input() page = 1;
  @Output() pageChange = new EventEmitter<number>();

  @Input() pageSize = 12;
  @Output() pageSizeChange = new EventEmitter<number>();

  @Output() paginationChange = new EventEmitter<PaginationEvent>();

  // ── Customization & Config Inputs ──
  @Input() pageSizeOptions: number[] = [6, 12, 24, 48];
  @Input() itemName = 'items';
  @Input() itemNameHindi = 'आइटम';
  @Input() isHindi = false;
  @Input() customSummaryTemplate?: TemplateRef<any>;

  @Input() variant: PaginationVariant = 'glass';
  @Input() color: PaginationColor = 'blue';
  @Input() size: PaginationSize = 'md';
  @Input() layout: PaginationLayout = 'between';
  @Input() mode: PaginationMode = 'paged';

  // ── Visibility Toggles ──
  @Input() showTotal = true;
  @Input() showPageSize = true;
  @Input() showQuickJumper = false;
  @Input() showFirstLast = true;
  @Input() showPrevNext = true;
  @Input() showPageNumbers = true;
  @Input() showPageIndicator = true;
  @Input() autoHide = false;
  @Input() autoClamp = true;
  @Input() loading = false;

  // ── Advanced Behavior ──
  @Input() scrollToTop = false;
  @Input() scrollToAnchor = '';
  @Input() syncWithUrl = false;
  @Input() storageKey?: string;
  @Input() boundaryCount = 1;
  @Input() siblingCount = 1;
  @Input() fastJumpStep = 5;
  @Input() dropPosition: 'auto' | 'up' | 'down' = 'auto';

  @ViewChild('pageSizeTriggerBtn') pageSizeTriggerBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('mobilePageSizeTriggerBtn') mobilePageSizeTriggerBtn?: ElementRef<HTMLButtonElement>;

  // ── Internal Reactive Signals ──
  totalSig = signal(0);
  pageSig = signal(1);
  pageSizeSig = signal(12);

  // ── Interactive UI State ──
  isPageSizeOpen = signal(false);
  isDesktopPagePickerOpen = signal(false);
  isMobilePageSizeSheetOpen = signal(false);
  menuPosition = signal<'up' | 'down'>('up');
  isMobilePickerOpen = signal(false);
  hoveredLeftEllipsis = signal(false);
  hoveredRightEllipsis = signal(false);
  jumperValue = signal<number | string>(1);
  jumperError = signal(false);

  // ── Computed Total Pages ──
  totalPages = computed(() => {
    const tot = this.totalSig();
    const size = this.pageSizeSig();
    if (tot <= 0 || size <= 0) return 1;
    return Math.max(1, Math.ceil(tot / size));
  });

  // ── Computed Visible Item Range ──
  visibleRange = computed<PaginationItemInfo>(() => {
    const tot = this.totalSig();
    const size = this.pageSizeSig();
    const cur = this.pageSig();
    const totalP = this.totalPages();

    if (tot === 0) {
      return { page: 1, pageSize: size, total: 0, start: 0, end: 0, totalPages: 1 };
    }

    const start = (cur - 1) * size + 1;
    const end = Math.min(cur * size, tot);
    return {
      page: cur,
      pageSize: size,
      total: tot,
      start: Math.max(1, start),
      end,
      totalPages: totalP
    };
  });

  // ── Computed Items Remaining (For 'load-more' mode) ──
  remainingItems = computed(() => {
    const tot = this.totalSig();
    const end = this.visibleRange().end;
    return Math.max(0, tot - end);
  });

  // ── Computed Page Items with Smart Windowing & Fast-Jump Ellipses ──
  pageItems = computed<PageItem[]>(() => {
    const totalP = this.totalPages();
    const cur = this.pageSig();
    const siblings = this.siblingCount;
    const boundaries = this.boundaryCount;

    // Small total: show all numbers without ellipsis
    const maxSimpleSlots = boundaries * 2 + siblings * 2 + 3;
    if (totalP <= maxSimpleSlots) {
      const items: PageItem[] = [];
      for (let i = 1; i <= totalP; i++) {
        items.push({ type: i, value: i, isCurrent: i === cur });
      }
      return items;
    }

    // Determine window boundaries
    const leftSiblingIndex = Math.max(cur - siblings, boundaries + 1);
    const rightSiblingIndex = Math.min(cur + siblings, totalP - boundaries);

    const showLeftEllipsis = leftSiblingIndex > boundaries + 1;
    const showRightEllipsis = rightSiblingIndex < totalP - boundaries;

    const items: PageItem[] = [];

    // Left boundary pages (e.g. page 1)
    for (let i = 1; i <= boundaries; i++) {
      items.push({ type: i, value: i, isCurrent: i === cur });
    }

    // Left Ellipsis
    if (showLeftEllipsis) {
      items.push({ type: 'left-ellipsis' });
    } else if (boundaries + 1 < leftSiblingIndex) {
      for (let i = boundaries + 1; i < leftSiblingIndex; i++) {
        items.push({ type: i, value: i, isCurrent: i === cur });
      }
    }

    // Middle window around current page
    for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
      items.push({ type: i, value: i, isCurrent: i === cur });
    }

    // Right Ellipsis
    if (showRightEllipsis) {
      items.push({ type: 'right-ellipsis' });
    } else if (rightSiblingIndex < totalP - boundaries) {
      for (let i = rightSiblingIndex + 1; i <= totalP - boundaries; i++) {
        items.push({ type: i, value: i, isCurrent: i === cur });
      }
    }

    // Right boundary pages (e.g. last page)
    for (let i = totalP - boundaries + 1; i <= totalP; i++) {
      if (i > rightSiblingIndex) {
        items.push({ type: i, value: i, isCurrent: i === cur });
      }
    }

    return items;
  });

  ngOnInit(): void {
    // 1. Restore saved pageSize from localStorage if available
    if (this.storageKey && typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (parsed > 0 && (this.pageSizeOptions.includes(parsed) || parsed === this.pageSize)) {
            this.pageSize = parsed;
            this.pageSizeSig.set(parsed);
            this.pageSizeChange.emit(parsed);
          }
        }
      } catch (err) {
        console.warn('PaginationComponent: unable to read storageKey', err);
      }
    }

    // 2. Sync from URL Query Params if enabled (supports browser Back / Forward history)
    if (this.syncWithUrl && this.route) {
      this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(qp => {
        let changed = false;
        if (qp['page']) {
          const p = parseInt(qp['page'], 10);
          if (p > 0 && p !== this.pageSig()) {
            this.page = p;
            this.pageSig.set(p);
            this.jumperValue.set(p);
            this.pageChange.emit(p);
            changed = true;
          }
        }
        if (qp['pageSize']) {
          const s = parseInt(qp['pageSize'], 10);
          if (s > 0 && s !== this.pageSizeSig()) {
            this.pageSize = s;
            this.pageSizeSig.set(s);
            this.pageSizeChange.emit(s);
            changed = true;
          }
        }
        if (changed) {
          this.emitPaginationEvent();
        }
      });
    }

    this.syncState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    let stateChanged = false;

    if (changes['total'] || changes['pageSize']) {
      this.totalSig.set(this.total);
      this.pageSizeSig.set(this.pageSize);
      stateChanged = true;

      // Auto-clamp: ensure current page is within valid range after total / pageSize change
      if (this.autoClamp && this.totalSig() > 0) {
        const maxP = this.totalPages();
        if (this.pageSig() > maxP) {
          this.setPage(maxP, false);
        }
      }
    }

    if (changes['page']) {
      this.pageSig.set(this.page);
      this.jumperValue.set(this.page);
      stateChanged = true;
    }

    if (stateChanged) {
      this.syncState();
    }
  }

  // ── Page Navigation Handlers ──

  private lastNavTimestamp = 0;

  setPage(targetPage: number, triggerScroll = true): void {
    const now = Date.now();
    // Guard against rapid micro-clicks (< 200ms) firing duplicate requests
    if (now - this.lastNavTimestamp < 200 && triggerScroll) {
      return;
    }
    this.lastNavTimestamp = now;

    const clamped = Math.max(1, Math.min(targetPage, this.totalPages()));
    if (clamped === this.pageSig() && this.page === clamped) return;

    this.page = clamped;
    this.pageSig.set(clamped);
    this.jumperValue.set(clamped);
    this.pageChange.emit(clamped);

    this.emitPaginationEvent();
    this.updateUrl();

    if (triggerScroll) {
      this.handleAutoScroll();
    }
  }

  firstPage(): void {
    if (this.pageSig() > 1) {
      this.setPage(1);
    }
  }

  prevPage(): void {
    if (this.pageSig() > 1) {
      this.setPage(this.pageSig() - 1);
    }
  }

  nextPage(): void {
    if (this.pageSig() < this.totalPages()) {
      this.setPage(this.pageSig() + 1);
    }
  }

  lastPage(): void {
    if (this.pageSig() < this.totalPages()) {
      this.setPage(this.totalPages());
    }
  }

  fastJumpLeft(): void {
    const target = Math.max(1, this.pageSig() - this.fastJumpStep);
    this.setPage(target);
  }

  fastJumpRight(): void {
    const target = Math.min(this.totalPages(), this.pageSig() + this.fastJumpStep);
    this.setPage(target);
  }

  // ── Page Size Selection ──

  togglePageSizeMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    if (!this.isPageSizeOpen()) {
      if (this.dropPosition === 'auto') {
        const rect = this.pageSizeTriggerBtn?.nativeElement.getBoundingClientRect();
        if (rect && rect.top < 170) {
          this.menuPosition.set('down');
        } else {
          this.menuPosition.set('up');
        }
      } else {
        this.menuPosition.set(this.dropPosition);
      }
    }
    this.isPageSizeOpen.update(v => !v);
  }

  toggleMobilePageSizeSheet(event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.isMobilePageSizeSheetOpen()) {
      this.closeMobilePageSizeSheet();
    } else {
      this.openMobilePageSizeSheet();
    }
  }

  openMobilePageSizeSheet(): void {
    this.isMobilePageSizeSheetOpen.set(true);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('bottom-sheet-open', 'overflow-hidden');
      document.body.classList.add('bottom-sheet-open', 'sheet-open', 'overflow-hidden');
    }
  }

  closeMobilePageSizeSheet(): void {
    this.isMobilePageSizeSheetOpen.set(false);
    if (typeof document !== 'undefined' && !this.isMobilePickerOpen()) {
      document.documentElement.classList.remove('bottom-sheet-open', 'overflow-hidden');
      document.body.classList.remove('bottom-sheet-open', 'sheet-open', 'overflow-hidden');
    }
  }

  selectPageSize(size: number): void {
    if (size === this.pageSizeSig()) {
      this.isPageSizeOpen.set(false);
      this.closeMobilePageSizeSheet();
      return;
    }

    this.pageSize = size;
    this.pageSizeSig.set(size);
    this.pageSizeChange.emit(size);
    this.isPageSizeOpen.set(false);
    this.closeMobilePageSizeSheet();

    // Save to localStorage if storageKey is configured
    if (this.storageKey && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.storageKey, size.toString());
      } catch (e) {
        console.warn('PaginationComponent: unable to write storageKey', e);
      }
    }

    // Auto-clamp page if it now exceeds new totalPages
    const newTotalPages = this.totalPages();
    if (this.pageSig() > newTotalPages) {
      this.setPage(newTotalPages);
    } else {
      this.emitPaginationEvent();
      this.updateUrl();
      this.handleAutoScroll();
    }
  }

  // ── Quick Page Jumper (Strictly Numbers Only) ──

  onJumperKeyDown(event: KeyboardEvent): void {
    // Allow control/navigation keys
    if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }
    // Allow clipboard shortcuts
    if (event.ctrlKey || event.metaKey) {
      return;
    }
    // Block anything that is not a digit (0-9)
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  onJumperInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/[^0-9]/g, '');
    input.value = sanitized;
    this.jumperValue.set(sanitized);
  }

  onJumperPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') || '';
    const sanitized = pasted.replace(/[^0-9]/g, '');
    const input = event.target as HTMLInputElement;
    input.value = sanitized;
    this.jumperValue.set(sanitized);
  }

  submitJumper(): void {
    const raw = this.jumperValue().toString().trim();
    if (!raw) {
      this.jumperValue.set(this.pageSig());
      return;
    }

    const val = parseInt(raw, 10);
    if (isNaN(val) || val < 1 || val > this.totalPages()) {
      // Trigger error shake animation
      this.jumperError.set(true);
      setTimeout(() => this.jumperError.set(false), 600);
      this.jumperValue.set(this.pageSig());
      return;
    }

    this.setPage(val);
  }

  // ── Mobile Page Picker Sheet (Locks Background Scroll & Hides Bottom Nav) ──

  toggleMobilePicker(event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.isMobilePickerOpen()) {
      this.closeMobilePicker();
    } else {
      this.openMobilePicker();
    }
  }

  openMobilePicker(): void {
    this.isMobilePickerOpen.set(true);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('bottom-sheet-open', 'overflow-hidden');
      document.body.classList.add('bottom-sheet-open', 'sheet-open', 'overflow-hidden');
    }
  }

  closeMobilePicker(): void {
    this.isMobilePickerOpen.set(false);
    if (typeof document !== 'undefined' && !this.isMobilePageSizeSheetOpen()) {
      document.documentElement.classList.remove('bottom-sheet-open', 'overflow-hidden');
      document.body.classList.remove('bottom-sheet-open', 'sheet-open', 'overflow-hidden');
    }
  }

  selectMobilePage(p: number): void {
    this.setPage(p);
    this.closeMobilePicker();
  }

  onBackdropTouch(event: TouchEvent): void {
    if (event.target === event.currentTarget) {
      event.preventDefault();
    }
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('bottom-sheet-open', 'overflow-hidden');
      document.body.classList.remove('bottom-sheet-open', 'sheet-open', 'overflow-hidden');
    }
  }

  // ── Load More Mode ──

  onLoadMore(): void {
    this.nextPage();
  }

  toggleDesktopPagePicker(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isDesktopPagePickerOpen.update(v => !v);
  }

  // ── Keyboard & Click-Outside Listeners ──

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    if (this.isDesktopPagePickerOpen()) {
      this.isDesktopPagePickerOpen.set(false);
    }

    // Close Page Size dropdown if open and click is anywhere except the trigger button
    if (this.isPageSizeOpen()) {
      if (!this.pageSizeTriggerBtn?.nativeElement.contains(target)) {
        this.isPageSizeOpen.set(false);
      }
    }

    // Close mobile picker if open and click is outside
    if (this.isMobilePickerOpen()) {
      if (!this.elementRef.nativeElement.contains(target)) {
        this.closeMobilePicker();
      }
    }
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.isPageSizeOpen.set(false);
      this.isDesktopPagePickerOpen.set(false);
      this.closeMobilePageSizeSheet();
      this.closeMobilePicker();
      return;
    }

    // Only intercept arrow keys when keyboard focus is actually within the pagination component
    const target = event.target as HTMLElement;
    if (!this.elementRef.nativeElement.contains(target)) return;

    const isTargetInput = target.tagName === 'INPUT';
    if (isTargetInput) return;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.prevPage();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.nextPage();
    }
  }

  // ── Private Utilities ──

  private syncState(): void {
    this.totalSig.set(this.total);
    this.pageSig.set(this.page);
    this.pageSizeSig.set(this.pageSize);
    this.jumperValue.set(this.page);
  }

  private emitPaginationEvent(): void {
    const range = this.visibleRange();
    this.paginationChange.emit({
      page: range.page,
      pageSize: range.pageSize,
      startIndex: range.start,
      endIndex: range.end,
      total: range.total
    });
  }

  private handleAutoScroll(): void {
    if (typeof window === 'undefined') return;

    if (this.scrollToAnchor) {
      try {
        const target = document.querySelector(this.scrollToAnchor);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
      } catch (e) {
        console.warn('PaginationComponent: invalid anchor', this.scrollToAnchor, e);
      }
    }

    if (this.scrollToTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private updateUrl(): void {
    if (!this.syncWithUrl || !this.router || !this.route) return;

    const curPage = this.pageSig();
    const curSize = this.pageSizeSig();
    const defaultSize = this.pageSizeOptions?.[0] || 12;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: curPage > 1 ? curPage : null,
        pageSize: curSize !== defaultSize ? curSize : null
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  // Memoized array generator for mobile sheet buttons (capped at 100 for mobile memory safety)
  mobilePagesArray = computed(() => {
    const count = Math.min(this.totalPages(), 100);
    return Array.from({ length: count }, (_, i) => i + 1);
  });

  // Pure trackBy functions for high-performance DOM diffing
  trackByPageItem(index: number, item: PageItem): string | number {
    return item.value !== undefined ? item.value : `${item.type}-${index}`;
  }

  trackByNumber(_: number, num: number): number {
    return num;
  }
}