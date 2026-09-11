import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { AdminIconComponent } from '../../shared/components/icon/icon.component';
import { ToastService } from '../../shared/services/toast.service';
import { smartLoading } from '../../core/utils/smart-loading.operator';

@Component({
  selector: 'admin-bookmarks',
  standalone: true,
  imports: [CommonModule, SkeletonComponent, TooltipDirective, AdminIconComponent],
  templateUrl: './bookmarks.component.html',
  styleUrl: './bookmarks.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookmarksComponent implements OnInit {
  stats: any = null;
  isLoading = false;

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.fetchStats();
  }

  fetchStats(): void {
    this.api.getBookmarkStats().pipe(smartLoading(l => { this.isLoading = l; this.cdr.markForCheck(); })).subscribe({
      next: (res) => {
        this.stats = res;
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(err.error?.message || 'Failed to fetch bookmark & research telemetry.');
        this.cdr.markForCheck();
      }
    });
  }
}