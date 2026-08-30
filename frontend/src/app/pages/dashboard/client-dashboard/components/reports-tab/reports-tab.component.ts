import { Component, OnInit, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

  reports = signal<UserReportItem[]>([]);
  isLoading = signal(true);
  statusFilter = signal<string>('ALL');
  searchQuery = signal<string>('');

  // Stats computed
  totalCount = computed(() => this.reports().length);
  pendingCount = computed(() =>
    this.reports().filter(r => r.status === 'Pending' || r.status === 'UnderReview').length
  );
  resolvedCount = computed(() =>
    this.reports().filter(r => r.status === 'Resolved' || r.status === 'ActionTaken').length
  );
  dismissedCount = computed(() =>
    this.reports().filter(r => r.status === 'Dismissed').length
  );

  filteredReports = computed(() => {
    let list = this.reports();
    const filter = this.statusFilter();
    const query = this.searchQuery().trim().toLowerCase();

    if (filter === 'ACTIVE') {
      list = list.filter(r => r.status === 'Pending' || r.status === 'UnderReview');
    } else if (filter === 'RESOLVED') {
      list = list.filter(r => r.status === 'Resolved' || r.status === 'ActionTaken');
    } else if (filter === 'DISMISSED') {
      list = list.filter(r => r.status === 'Dismissed');
    }

    if (query) {
      list = list.filter(r =>
        (r.referenceId && r.referenceId.toLowerCase().includes(query)) ||
        (r.targetTitle && r.targetTitle.toLowerCase().includes(query)) ||
        (r.reasonCategory && r.reasonCategory.toLowerCase().includes(query)) ||
        (r.description && r.description.toLowerCase().includes(query))
      );
    }

    return list;
  });

  ngOnInit(): void {
    this.loadReports();
  }

  loadReports(): void {
    this.isLoading.set(true);
    this.moderationService.getMyReports(1, 50).subscribe({
      next: (res: any) => {
        const items = res?.data || [];
        this.reports.set(items);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
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
    switch (type) {
      case 'Lawyer': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/40';
      case 'LegalResource': return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800/40';
      case 'Review': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40';
      case 'Helpline': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40';
      default: return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800/40';
    }
  }

  formatReason(reason: string): string {
    if (!reason) return 'General Issue';
    return reason.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  trackByReportId(index: number, item: UserReportItem): any {
    return item.id || item.referenceId || index;
  }
}