import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  signal,
  computed,
  effect,
  HostListener,
  OnDestroy,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { ShareMenuComponent } from '../../../../components/share-menu/share-menu.component';
import { KebabMenuComponent, KebabActionGroup, KebabMenuService } from '../../../../components/kebab-menu';
import { StatutoryRight } from '../../../../services/rights.service';
import { ModerationReportService } from '../../../../services/moderation-report.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { StatuteResolverService } from '../../../../services/statute-resolver.service';
import {
  getRightTitle,
  getRightSummary,
  getRightShareUrl,
  getRightShareSubject,
  getRightShareText,
  getRightCitationText
} from '../../utils/rights-helpers.util';

export type TableDensity = 'compact' | 'comfortable' | 'spacious';
export type TableSortColumn = 'title' | 'act' | 'summary' | 'penalties' | 'forum';

@Component({
  selector: 'app-rights-directory-view',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, TooltipDirective, ShareMenuComponent, KebabMenuComponent],
  templateUrl: './rights-directory-view.component.html',
  styleUrls: ['./rights-directory-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RightsDirectoryViewComponent implements OnDestroy {
  private snackbar = inject(SnackbarService);
  private kebabService = inject(KebabMenuService);
  private statuteResolver = inject(StatuteResolverService);
  private reportService = inject(ModerationReportService);
  private _rights = signal<StatutoryRight[]>([]);

  @Input({ required: true })
  set rights(value: StatutoryRight[]) {
    this._rights.set(value || []);
  }
  get rights(): StatutoryRight[] {
    return this._rights();
  }

  @Input() currentLanguage: 'en' | 'hi' = 'en';
  @Input() isAdmin = false;
  @Input() isSpeaking = false;
  @Input() speakingRightId: string | null = null;

  @Output() flashPass = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() share = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() speak = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() openNotice = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() copyCitation = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() adminEdit = new EventEmitter<{ rightId: string; event: Event }>();
  @Output() viewDetails = new EventEmitter<{ rightId: string; event: Event }>();

  // Interactive Table Column Sorting State
  sortColumn = signal<TableSortColumn>('title');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Pagination State
  pageSize = signal<number>(10);
  currentPage = signal<number>(1);
  pageSizeOptions: number[] = [10, 20, 50, 100];
  isPageSizeDropdownOpen = signal<boolean>(false);

  // Table Density Mode ('compact' | 'comfortable' | 'spacious')
  density = signal<TableDensity>('comfortable');

  // Full-Width Focus Modal Mode
  isFullMode = signal<boolean>(false);

  // Instant Feedback State
  copiedCitationId = signal<string | null>(null);
  isBatchCopying = signal<boolean>(false);

  constructor() {
    // Automatically clamp current page when total pages reduces
    effect(() => {
      const maxPages = this.totalPages();
      if (this.currentPage() > maxPages) {
        this.currentPage.set(maxPages);
      }
    });
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden');
    }
  }

  // Sorted Statutory Rights based on active column and direction
  sortedRights = computed(() => {
    let list = [...this._rights()];

    const col = this.sortColumn();
    const dir = this.sortDirection() === 'asc' ? 1 : -1;

    list.sort((a, b) => {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;

      let valA = '';
      let valB = '';
      if (col === 'title') {
        valA = (this.getTitle(a) || '').toLowerCase();
        valB = (this.getTitle(b) || '').toLowerCase();
      } else if (col === 'act') {
        valA = (a.statutoryBasis?.shortAct || a.statutoryBasis?.actName || '').toLowerCase();
        valB = (b.statutoryBasis?.shortAct || b.statutoryBasis?.actName || '').toLowerCase();
      } else if (col === 'summary') {
        valA = (this.getSummary(a) || '').toLowerCase();
        valB = (this.getSummary(b) || '').toLowerCase();
      } else if (col === 'penalties') {
        valA = (a.penaltiesForViolation || '').toLowerCase();
        valB = (b.penaltiesForViolation || '').toLowerCase();
      } else if (col === 'forum') {
        valA = (a.legalRemedy || '').toLowerCase();
        valB = (b.legalRemedy || '').toLowerCase();
      }
      return valA.localeCompare(valB) * dir;
    });

    return list;
  });

  // Total items in directory view
  totalItems = computed(() => this.sortedRights().length);

  // Total Pages
  totalPages = computed(() => Math.max(1, Math.ceil(this.totalItems() / this.pageSize())));

  // Sliced Rights for Current Page
  paginatedRights = computed(() => {
    const list = this.sortedRights();
    const page = Math.min(this.currentPage(), this.totalPages());
    const size = this.pageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  // Range Display Information (e.g., Showing 1-10 of 42)
  visibleRange = computed(() => {
    const total = this.totalItems();
    if (total === 0) {
      return { start: 0, end: 0, total: 0 };
    }
    const page = Math.min(this.currentPage(), this.totalPages());
    const size = this.pageSize();
    const start = (page - 1) * size + 1;
    const end = Math.min(start + size - 1, total);
    return { start, end, total };
  });

  // Smart Pagination Page Numbers with Ellipsis Generator
  pagesList = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: (number | string)[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
      return pages;
    }

    if (current <= 4) {
      for (let i = 1; i <= 5; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
      return pages;
    }

    if (current >= total - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = total - 4; i <= total; i++) {
        pages.push(i);
      }
      return pages;
    }

    pages.push(1);
    pages.push('...');
    pages.push(current - 1);
    pages.push(current);
    pages.push(current + 1);
    pages.push('...');
    pages.push(total);
    return pages;
  });

  // Check if sort is modified from default
  isSorted = computed(() => this.sortColumn() !== 'title' || this.sortDirection() !== 'asc');

  // Dynamic Density Styling Classes
  get cellPaddingClass(): string {
    switch (this.density()) {
      case 'compact':
        return 'py-1.5 px-3 text-[11px]';
      case 'spacious':
        return 'py-3.5 px-4 text-sm';
      case 'comfortable':
      default:
        // Streamlined padding in normal inline mode (py-2 px-3) for a clean enterprise grid
        return this.isFullMode() ? 'py-3 px-4 text-xs' : 'py-2 px-3 text-xs';
    }
  }

  // --- Full Focus Modal Methods ---
  openFullMode(): void {
    this.closeKebab();
    this.isFullMode.set(true);
    if (typeof document !== 'undefined') {
      document.body.classList.add('overflow-hidden');
    }
  }

  closeFullMode(): void {
    this.closeKebab();
    this.isFullMode.set(false);
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden');
    }
  }

  toggleFullMode(): void {
    if (this.isFullMode()) {
      this.closeFullMode();
    } else {
      this.openFullMode();
    }
  }

  // --- Sort Handlers ---
  toggleSort(column: TableSortColumn): void {
    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
    this.currentPage.set(1);
  }

  resetSort(): void {
    this.sortColumn.set('title');
    this.sortDirection.set('asc');
    this.currentPage.set(1);
  }

  getSortLabel(): string {
    switch (this.sortColumn()) {
      case 'title': return 'Statutory Right';
      case 'act': return 'Governing Act';
      case 'summary': return 'Citizen Guarantee';
      case 'penalties': return 'Penalties';
      case 'forum': return 'Redressal Forum';
      default: return 'Default';
    }
  }

  // --- Pagination Handlers ---
  setPage(page: number | string): void {
    if (page === '...') return;
    const num = typeof page === 'string' ? parseInt(page, 10) : page;
    if (isNaN(num)) return;
    const max = this.totalPages();
    const target = Math.max(1, Math.min(num, max));
    this.currentPage.set(target);
    this.closeAllDropdowns();
  }

  isCurrentPage(page: number | string): boolean {
    return page === this.currentPage();
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.setPage(this.currentPage() - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.setPage(this.currentPage() + 1);
    }
  }

  firstPage(): void {
    this.setPage(1);
  }

  lastPage(): void {
    this.setPage(this.totalPages());
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.isPageSizeDropdownOpen.set(false);
    this.closeAllDropdowns();
  }

  togglePageSizeDropdown(event: Event): void {
    event.stopPropagation();
    this.closeKebab();
    this.isPageSizeDropdownOpen.set(!this.isPageSizeDropdownOpen());
  }

  onJumpInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val)) {
      this.setPage(val);
    }
  }

  // --- Table Density Switcher ---
  setDensity(d: TableDensity): void {
    this.density.set(d);
  }

  // --- Kebab Menu Groups Configuration ---
  getKebabGroups(right: StatutoryRight): KebabActionGroup[] {
    const isCopied = this.copiedCitationId() === right.id;
    const groups: KebabActionGroup[] = [
      {
        title: 'Statutory Playbook',
        items: [
          {
            id: 'details',
            label: 'Open Full Dossier',
            sublabel: 'Precedents, Bare Act & Defenses',
            icon: 'book-open',
            iconClass: 'text-blue-600 dark:text-blue-400',
            iconBgClass: 'bg-blue-500/10'
          },
          {
            id: 'pass',
            label: 'Flash Digital Pass',
            sublabel: 'Instant on-screen citizen shield',
            icon: 'badge-check',
            iconClass: 'text-cyan-600 dark:text-cyan-400',
            iconBgClass: 'bg-cyan-500/10'
          }
        ]
      },
      {
        title: 'Drafting & Enforcement',
        items: [
          {
            id: 'citation',
            label: isCopied ? 'Citation Copied!' : 'Copy Bare Act Citation',
            sublabel: 'Section references for drafting',
            icon: isCopied ? 'check' : 'copy',
            iconClass: 'text-emerald-600 dark:text-emerald-400',
            iconBgClass: 'bg-emerald-500/10'
          },
          {
            id: 'notice',
            label: 'Draft Statutory Notice',
            sublabel: 'Open in Template Studio',
            icon: 'file-text',
            iconClass: 'text-indigo-600 dark:text-indigo-400',
            iconBgClass: 'bg-indigo-500/10'
          }
        ]
      },
      {
        title: 'Accuracy & Trust',
        items: [
          {
            id: 'suggest-correction',
            label: this.hasReported(right.id) ? 'Discrepancy Under Review' : 'Suggest Legal Correction',
            sublabel: this.hasReported(right.id) ? `Case: ${this.getReport(right.id)?.referenceId}` : 'Report outdated statute, wrong section, or dead phone',
            icon: this.hasReported(right.id) ? 'alert-triangle' : 'flag',
            iconClass: this.hasReported(right.id) ? 'text-amber-600 dark:text-amber-400' : 'text-amber-500',
            iconBgClass: 'bg-amber-500/10'
          }
        ]
      }
    ];

    if (this.isAdmin) {
      groups.push({
        title: 'Administration',
        items: [
          {
            id: 'admin',
            label: 'Admin Edit Record',
            sublabel: 'Modify legal basis & text',
            icon: 'edit',
            iconClass: 'text-indigo-600 dark:text-indigo-400',
            iconBgClass: 'bg-indigo-500/10'
          }
        ]
      });
    }

    return groups;
  }

  closeKebab(): void {
    this.kebabService.closeAll();
  }

  closeAllDropdowns(): void {
    this.kebabService.closeAll();
    this.isPageSizeDropdownOpen.set(false);
  }

  hasReported(rightId: string): boolean {
    return this.reportService.hasReported('StatutoryRight', rightId);
  }

  getReport(rightId: string) {
    return this.reportService.getReport('StatutoryRight', rightId);
  }

  onSuggestCorrection(right: StatutoryRight, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    const title = `${this.getTitle(right)} (${right.statutoryBasis?.shortAct || right.statutoryBasis?.actName})`;
    this.reportService.openReport('StatutoryRight', right.id, title);
  }

  // Unified action dispatcher
  triggerKebabAction(
    action: string,
    right: StatutoryRight,
    event: Event
  ): void {
    this.closeKebab();
    switch (action) {
      case 'details':
        this.onViewDetails(right.id, event);
        break;
      case 'pass':
        this.onFlashPass(right, event);
        break;
      case 'citation':
        this.onCopyCitation(right, event);
        break;
      case 'notice':
        this.onOpenNotice(right, event);
        break;
      case 'speak':
        this.onSpeak(right, event);
        break;
      case 'share':
        this.onShare(right, event);
        break;
      case 'suggest-correction':
        this.onSuggestCorrection(right, event);
        break;
      case 'admin':
        this.onAdminEdit(right.id, event);
        break;
    }
  }

  // Section helpers
  getSections(right: StatutoryRight): string[] {
    return right?.statutoryBasis?.sections || [];
  }

  getSectionsPreview(right: StatutoryRight): string[] {
    // In normal mode show 1 badge to prevent multi-line vertical stretching; in full mode show up to 3
    const limit = this.isFullMode() ? 3 : 1;
    return this.getSections(right).slice(0, limit);
  }

  getSectionsRemaining(right: StatutoryRight): number {
    const limit = this.isFullMode() ? 3 : 1;
    return Math.max(0, this.getSections(right).length - limit);
  }

  getSectionsTooltip(right: StatutoryRight): string {
    return this.getSections(right).join(', ');
  }

  // --- Statute & Section Resolvers ---
  getActUrl(right: StatutoryRight): string {
    return this.statuteResolver.getActUrl(right?.statutoryBasis);
  }

  getSectionUrl(sec: string, right: StatutoryRight): string {
    return this.statuteResolver.getSectionUrl(sec, right?.statutoryBasis);
  }

  onActClick(right: StatutoryRight, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (right?.statutoryBasis) {
      this.statuteResolver.navigateToActSafely(right.statutoryBasis);
    }
  }

  onSectionClick(sec: string, right: StatutoryRight, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (right?.statutoryBasis) {
      this.statuteResolver.navigateToSectionSafely(sec, right.statutoryBasis);
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  // --- Global Listeners to auto-dismiss popups ---
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.pagesize-container') && !target.closest('.share-container') && !target.closest('.share-desktop-dropdown')) {
      this.closeAllDropdowns();
    }
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onWindowChange(): void {
    this.closeKebab();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isFullMode()) {
      this.closeFullMode();
    } else {
      this.closeAllDropdowns();
    }
  }

  // --- Action Dispatchers ---
  onCopyCitation(right: StatutoryRight, event: Event): void {
    this.copyCitation.emit({ right, event });
    this.copiedCitationId.set(right.id);
    setTimeout(() => this.copiedCitationId.set(null), 2500);
  }

  onFlashPass(right: StatutoryRight, event: Event): void {
    this.flashPass.emit({ right, event });
  }

  onShare(right: StatutoryRight, event: Event): void {
    this.share.emit({ right, event });
  }

  onSpeak(right: StatutoryRight, event: Event): void {
    this.speak.emit({ right, event });
  }

  onOpenNotice(right: StatutoryRight, event: Event): void {
    this.openNotice.emit({ right, event });
  }

  onAdminEdit(rightId: string, event: Event): void {
    this.adminEdit.emit({ rightId, event });
  }

  onViewDetails(rightId: string, event: Event): void {
    this.viewDetails.emit({ rightId, event });
  }

  // --- Pro Lawyer Batch Action ---
  copyAllVisibleCitations(): void {
    const visible = this.paginatedRights();
    if (visible.length === 0) return;

    const lines = visible.map((r, i) => {
      const title = this.getTitle(r);
      const act = r.statutoryBasis?.shortAct || r.statutoryBasis?.actName || 'Statute';
      const sections = (r.statutoryBasis?.sections || []).join(', ');
      const secStr = sections ? ` (${sections})` : '';
      return `${i + 1}. ${title} — ${act}${secStr}`;
    });

    const text = `=== Citizen Statutory Rights & Bare Act Citations ===\n` + lines.join('\n');
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      this.isBatchCopying.set(true);
      this.snackbar.show(`Copied Bare Act citations for ${visible.length} statutory rights!`, 'success');
      setTimeout(() => this.isBatchCopying.set(false), 2500);
    }
  }

  getTitle(right: StatutoryRight | null | undefined): string {
    return getRightTitle(right, this.currentLanguage);
  }

  getSummary(right: StatutoryRight | null | undefined): string {
    return getRightSummary(right, this.currentLanguage);
  }

  // --- Share Helpers for Global Share Menu ---
  getShareUrl(right: StatutoryRight): string {
    return getRightShareUrl(right?.id);
  }

  getShareSubject(right: StatutoryRight): string {
    return getRightShareSubject(right, this.currentLanguage);
  }

  getShareText(right: StatutoryRight): string {
    return getRightShareText(right, this.currentLanguage);
  }

  getCitationText(right: StatutoryRight): string {
    return getRightCitationText(right, false);
  }

  trackByRightId(index: number, right: StatutoryRight): string {
    return right?.id || String(index);
  }

  trackByPage(_index: number, page: number | string): string {
    return String(page);
  }

  trackByNumber(_index: number, num: number): number {
    return num;
  }
}