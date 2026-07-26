import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { smartLoading } from '../../core/utils/smart-loading.operator';

@Component({
  selector: 'admin-bookmarks',
  standalone: true,
  imports: [CommonModule, SkeletonComponent, TooltipDirective],
  templateUrl: './bookmarks.component.html',
  styleUrl: './bookmarks.component.scss'
})
export class BookmarksComponent implements OnInit {
  stats: any = null;
  isLoading = false;

  constructor(
    private api: AdminApiService,
    private toast: ToastService
  ) { }

  ngOnInit(): void {
    this.fetchStats();
  }

  fetchStats(): void {
    this.api.getBookmarkStats().pipe(smartLoading(l => this.isLoading = l)).subscribe({
      next: (res) => {
        this.stats = res;
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'Failed to fetch bookmark & research telemetry.');
      }
    });
  }
}