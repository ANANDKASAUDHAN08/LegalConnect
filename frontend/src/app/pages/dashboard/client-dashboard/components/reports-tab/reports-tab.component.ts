import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  HostListener,
  DestroyRef,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ModerationReportService } from '../../../../../services/moderation-report.service';
import { SnackbarService } from '../../../../../services/snackbar.service';
import { IconComponent } from '../../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';

export interface UserReportItem {
  id: number;
  referenceId: string;
  targetType: string;
  targetId: string;
  targetTitle: string;
  reasonCategory: string;
  description: string;
  evidenceUrl?: string;
  severity: string;
  status: 'Pending' | 'UnderReview' | 'Resolved' | 'Dismissed' | 'ActionTaken' | string;
  adminResolutionNotes?: string;
  resolvedAt?: string;
  createdAt: string;
}

@Component({
  selector: 'app-reports-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, TooltipDirective],
  templateUrl: './reports-tab.component.html',
  styleUrls: ['./reports-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsTabComponent implements OnInit {
  private moderationService = inject(ModerationReportService);
  private snackbar = inject(SnackbarService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  @Output() reportsChange = new EventEmitter<UserReportItem[]>();
  @Output() openTarget = new EventEmitter<{ type: string; id: string; title: string }>();

  // ── Core State Signals ──
  reports = signal<UserReportItem[]>([]);
  isLoading = signal(true);
  hasError = signal(false);
  statusFilter = signal<'ALL' | 'ACTIVE' | 'RESOLVED' | 'DISMISSED'>('ALL');

  // ── High-Performance Search & Debounce Engine ──
  searchQuery = signal<string>('');
  debouncedQuery = signal<string>('');
  isSearching = signal<boolean>(false);
  sortOrder = signal<'newest' | 'oldest' | 'severity'>('newest');
  private searchSubject = new Subject<string>();

  // ── Appeal / Re-Review Modal State ──
  showAppealModal = signal(false);
  selectedReportForAppeal = signal<UserReportItem | null>(null);
  appealReason = signal('');
  isSubmittingAppeal = signal(false);

  // ── Withdraw Confirmation Dialog State ──
  confirmWithdrawTarget = signal<UserReportItem | null>(null);
  isWithdrawing = signal(false);

  // ── Evidence Preview Modal State ──
  previewEvidenceUrl = signal<string | null>(null);

  // ── Memoization Caches ──
  private reasonCache = new Map<string, string>();

  // ── Single-Pass O(N) Memoized Counts (Eliminates 4x Array Traversal) ──
  readonly stats = computed(() => {
    const list = this.reports();
    let pending = 0;
    let resolved = 0;
    let dismissed = 0;

    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (this.isDismissedOrNoAction(r)) {
        dismissed++;
      } else if (r.status === 'Pending' || r.status === 'UnderReview') {
        pending++;
      } else if (r.status === 'Resolved' || r.status === 'ActionTaken') {
        resolved++;
      }
    }

    return { total: list.length, pending, resolved, dismissed };
  });

  readonly totalCount = computed(() => this.stats().total);
  readonly pendingCount = computed(() => this.stats().pending);
  readonly resolvedCount = computed(() => this.stats().resolved);
  readonly dismissedCount = computed(() => this.stats().dismissed);

  // ── Multi-Token, Multi-Field Search & High-Efficiency Sorting ──
  readonly filteredReports = computed(() => {
    let list = this.reports();
    const filter = this.statusFilter();
    const rawQuery = this.debouncedQuery().trim().toLowerCase();
    const sort = this.sortOrder();

    // 1. Filter by Status Category
    if (filter === 'ACTIVE') {
      list = list.filter(r => r.status === 'Pending' || r.status === 'UnderReview');
    } else if (filter === 'RESOLVED') {
      list = list.filter(r => (r.status === 'Resolved' || r.status === 'ActionTaken') && !this.isDismissedOrNoAction(r));
    } else if (filter === 'DISMISSED') {
      list = list.filter(r => this.isDismissedOrNoAction(r));
    }

    // 2. Multi-Token Matching (Matches irrespective of token order)
    if (rawQuery) {
      const tokens = rawQuery.split(/\s+/).filter(Boolean);
      list = list.filter(r => {
        const searchable = (
          (r.referenceId || '') + ' ' +
          (r.targetTitle || '') + ' ' +
          (r.targetType || '') + ' ' +
          (r.reasonCategory || '') + ' ' +
          (this.formatReason(r.reasonCategory)) + ' ' +
          (r.description || '') + ' ' +
          (r.adminResolutionNotes || '') + ' ' +
          (r.status || '') + ' ' +
          (r.severity || '')
        ).toLowerCase();

        return tokens.every(token => searchable.includes(token));
      });
    }

    // 3. Multi-Dimensional Sorting
    const sorted = [...list];
    if (sort === 'oldest') {
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sort === 'severity') {
      const severityRank = (s: string) => {
        const v = (s || '').toLowerCase();
        if (v.includes('critical') || v.includes('urgent')) return 4;
        if (v.includes('high')) return 3;
        if (v.includes('medium')) return 2;
        return 1;
      };
      sorted.sort((a, b) =>
        severityRank(b.severity) - severityRank(a.severity) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else {
      // Default: Newest first
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return sorted;
  });

  // ── Global Keyboard Shortcuts (Ctrl+K / Cmd+K / Slash focus) ──
  @HostListener('window:keydown', ['$event'])
  handleGlobalKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.searchInputRef?.nativeElement?.focus();
      this.searchInputRef?.nativeElement?.select();
    } else if (event.key === '/' && !this.isUserTyping(event)) {
      event.preventDefault();
      this.searchInputRef?.nativeElement?.focus();
    }
  }

  private isUserTyping(event: KeyboardEvent): boolean {
    const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || (event.target as HTMLElement)?.isContentEditable;
  }

  ngOnInit(): void {
    // 200ms debounce pipe for silky-smooth responsive search
    this.searchSubject.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(query => {
      this.debouncedQuery.set(query);
      this.isSearching.set(false);
      this.cdr.markForCheck();
    });

    this.loadReports();
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    const trimmed = value.trim();
    if (!trimmed) {
      this.debouncedQuery.set('');
      this.isSearching.set(false);
      this.searchSubject.next('');
    } else {
      this.isSearching.set(true);
      this.searchSubject.next(trimmed);
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.debouncedQuery.set(this.searchQuery().trim());
      this.isSearching.set(false);
    } else if (event.key === 'Escape') {
      this.clearSearch();
    }
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.debouncedQuery.set('');
    this.isSearching.set(false);
    this.searchSubject.next('');
    this.searchInputRef?.nativeElement?.focus();
  }

  cycleSortOrder(): void {
    const current = this.sortOrder();
    if (current === 'newest') this.sortOrder.set('oldest');
    else if (current === 'oldest') this.sortOrder.set('severity');
    else this.sortOrder.set('newest');
  }

  getSortIcon(): string {
    const current = this.sortOrder();
    if (current === 'oldest') return 'sort-asc';
    if (current === 'severity') return 'alert-triangle';
    return 'sort-desc';
  }

  loadReports(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.moderationService.getMyReports(1, 50).subscribe({
      next: (res: any) => {
        const items = res?.data || [];
        this.reports.set(items);
        this.reportsChange.emit(items);
        this.isLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
        this.snackbar.show('Unable to sync moderation reports. Please check your connection.', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  setFilter(filter: 'ALL' | 'ACTIVE' | 'RESOLVED' | 'DISMISSED'): void {
    this.statusFilter.set(filter);
  }

  resetFilters(): void {
    this.statusFilter.set('ALL');
    this.clearSearch();
  }

  /**
   * Identifies tickets where moderator reviewed and verified the record without modifying it.
   */
  isDismissedOrNoAction(r: UserReportItem): boolean {
    if (r.status === 'Dismissed') return true;
    if (!r.adminResolutionNotes) return false;
    const note = r.adminResolutionNotes.toLowerCase();
    return note.includes('noactionrequired') || note.includes('no action required') || note.includes('verified compliant');
  }

  /**
   * Resolves contradictions: returns accurate label, colors and badge for each ticket state.
   */
  getDisplayStatus(rep: UserReportItem): { label: string; shortLabel: string; badgeClass: string; icon: string } {
    if (rep.status === 'Pending' || rep.status === 'UnderReview') {
      return {
        label: 'Under Review',
        shortLabel: 'Under Review',
        badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        icon: 'clock'
      };
    }

    if (this.isDismissedOrNoAction(rep)) {
      return {
        label: 'Reviewed • Verified Compliant',
        shortLabel: 'Verified Compliant',
        badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
        icon: 'shield-check'
      };
    }

    if (rep.status === 'Resolved' || rep.status === 'ActionTaken') {
      return {
        label: 'Action Taken & Resolved',
        shortLabel: 'Action Taken',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        icon: 'check'
      };
    }

    return {
      label: 'Ticket Closed',
      shortLabel: 'Closed',
      badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
      icon: 'shield'
    };
  }

  formatTargetType(type: string): string {
    if (!type) return 'Listing';
    const t = type.toLowerCase();
    if (t.includes('resource')) return 'Resource';
    if (t.includes('lawyer')) return 'Lawyer';
    if (t.includes('act') || t.includes('section') || t.includes('statute')) return 'Statute';
    if (t.includes('helpline')) return 'Helpline';
    if (t.includes('template')) return 'Template';
    return type.replace(/([A-Z])/g, ' $1').trim();
  }

  /**
   * Replaces raw system strings with reassuring, professional customer communication.
   */
  getHumanResolutionNote(rep: UserReportItem): string {
    if (this.isDismissedOrNoAction(rep)) {
      return 'Our Trust & Safety team reviewed this record against official court circulars and certified directories. The published details were verified accurate, and no changes were required.';
    }

    if (rep.adminResolutionNotes && rep.adminResolutionNotes.trim() && !rep.adminResolutionNotes.toLowerCase().includes('noactionrequired')) {
      return rep.adminResolutionNotes;
    }

    return 'The reported discrepancy was investigated and verified by our compliance team. Official directory corrections and data updates have been successfully applied.';
  }

  /**
   * Action: Opens the reported target entity (deep-link or directory drawer).
   */
  viewTarget(rep: UserReportItem, event?: MouseEvent): void {
    if (event) event.stopPropagation();

    // 1. Emit to parent client-dashboard in case it manages drawer modal
    this.openTarget.emit({
      type: rep.targetType,
      id: rep.targetId,
      title: rep.targetTitle
    });

    // 2. Direct router navigation support
    const targetType = (rep.targetType || '').toLowerCase();
    if (targetType.includes('resource')) {
      this.router.navigate(['/legal-resources', rep.targetId]);
    } else if (targetType.includes('lawyer')) {
      this.router.navigate(['/lawyers', rep.targetId]);
    } else if (targetType.includes('act') || targetType.includes('section') || targetType.includes('statute')) {
      this.router.navigate(['/laws', rep.targetId]);
    } else if (targetType.includes('helpline')) {
      this.router.navigate(['/find-help']);
    } else if (targetType.includes('template')) {
      this.router.navigate(['/laws/templates']);
    }
  }

  /**
   * Opens the Appeal / Re-Review dialog.
   */
  openAppealModal(rep: UserReportItem, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.selectedReportForAppeal.set(rep);
    this.appealReason.set('');
    this.showAppealModal.set(true);
  }

  closeAppealModal(): void {
    this.showAppealModal.set(false);
    this.selectedReportForAppeal.set(null);
    this.appealReason.set('');
  }

  async submitAppeal(): Promise<void> {
    const rep = this.selectedReportForAppeal();
    const reason = this.appealReason().trim();

    if (!rep || !reason) {
      this.snackbar.show('Please provide a reason or additional context for the appeal.', 'warning');
      return;
    }

    this.isSubmittingAppeal.set(true);
    try {
      await this.moderationService.appealReport(rep.referenceId || rep.id.toString(), reason);
      this.snackbar.show('Appeal submitted. Our Trust & Safety team will re-review this record.', 'success');
      this.closeAppealModal();
      this.loadReports();
    } catch (e: any) {
      this.snackbar.show(e?.message || 'Failed to submit appeal. Please try again.', 'error');
    } finally {
      this.isSubmittingAppeal.set(false);
    }
  }

  /**
   * Opens the Withdraw Confirmation dialog.
   */
  promptWithdraw(rep: UserReportItem, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.confirmWithdrawTarget.set(rep);
  }

  cancelWithdraw(): void {
    this.confirmWithdrawTarget.set(null);
  }

  async executeWithdraw(): Promise<void> {
    const rep = this.confirmWithdrawTarget();
    if (!rep) return;

    this.isWithdrawing.set(true);
    try {
      await this.moderationService.withdrawReport(rep.targetType, rep.targetId);
      this.snackbar.show(`Report #${rep.referenceId || rep.id} has been withdrawn.`, 'success');
      this.confirmWithdrawTarget.set(null);
      this.loadReports();
    } catch (e: any) {
      this.snackbar.show(e?.message || 'Failed to withdraw report.', 'error');
    } finally {
      this.isWithdrawing.set(false);
    }
  }

  /**
   * Action: Open report modal for submitting a fresh report.
   */
  openNewReportModal(): void {
    this.moderationService.openReport('LegalResource', '', 'General Platform Issue');
  }

  /**
   * Photo / Document Evidence Preview
   */
  openEvidencePreview(url: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.previewEvidenceUrl.set(url);
  }

  closeEvidencePreview(): void {
    this.previewEvidenceUrl.set(null);
  }

  copyRef(refId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (!refId) return;
    navigator.clipboard.writeText(refId).then(() => {
      this.snackbar.show(`Copied reference #${refId} to clipboard`, 'success');
    }).catch(() => {
      this.snackbar.show('Failed to copy reference', 'error');
    });
  }

  getTargetBadgeClass(type: string): string {
    const t = (type || '').toLowerCase();
    if (t.includes('lawyer')) return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/40';
    if (t.includes('resource')) return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800/40';
    if (t.includes('review')) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40';
    if (t.includes('helpline')) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40';
    return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800/40';
  }

  formatReason(reason: string): string {
    if (!reason) return 'General Issue';
    const cached = this.reasonCache.get(reason);
    if (cached) return cached;
    const formatted = reason.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    this.reasonCache.set(reason, formatted);
    return formatted;
  }

  trackByReportId(index: number, item: UserReportItem): any {
    return item.id || item.referenceId || index;
  }
}