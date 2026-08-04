import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminApiService } from '../../core/admin-api.service';
import { ActivityStreamService } from '../../core/services/activity-stream.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { SystemAnnouncementItem } from '../../core/models/admin.models';

export interface BroadcasterForm {
  version: string;
  targetCohort: 'all' | 'lawyers' | 'citizens' | 'admins';
  severity: 'critical' | 'warning' | 'info' | 'success';
  category: 'announcement' | 'security' | 'verification' | 'support' | 'consultation';
  title: string;
  summary: string;
  detailsMarkdown: string;
  isModalTrigger: boolean;
  isActive: boolean;
}

@Component({
  selector: 'admin-announcements',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent, TooltipDirective],
  templateUrl: './announcements.component.html',
  styleUrl: './announcements.component.scss'
})
export class AnnouncementsComponent implements OnInit, OnDestroy {
  private api = inject(AdminApiService);
  private activityService = inject(ActivityStreamService);
  private toast = inject(ToastService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  announcements: SystemAnnouncementItem[] = [];
  isLoading = false;
  isDispatching = false;
  showModal = false;
  expandedId: number | null = null;

  private routeSub?: Subscription;

  form: BroadcasterForm = {
    version: '1.3.0',
    targetCohort: 'all',
    severity: 'info',
    category: 'announcement',
    title: '',
    summary: '',
    detailsMarkdown: '',
    isModalTrigger: true,
    isActive: true
  };

  ngOnInit(): void {
    this.fetchAnnouncements();

    // Listen to ?action=new from Notifications page redirect
    this.routeSub = this.route.queryParams.subscribe(params => {
      if (params['action'] === 'new') {
        this.openCreateModal();
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  fetchAnnouncements(): void {
    this.isLoading = true;
    this.api.getAnnouncements().subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.announcements = Array.isArray(res)
          ? res
          : (res?.announcements || res?.data || res?.items || []);
      },
      error: (err: any) => {
        this.isLoading = false;
        this.toast.error(err?.error?.message || 'Failed to fetch announcements.');
      }
    });
  }

  openCreateModal(): void {
    this.form = {
      version: '1.3.0',
      targetCohort: 'all',
      severity: 'info',
      category: 'announcement',
      title: '',
      summary: '',
      detailsMarkdown: '',
      isModalTrigger: true,
      isActive: true
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    // Clear query param if present
    if (this.route.snapshot.queryParams['action']) {
      this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    }
  }

  toggleExpand(id: number, e?: MouseEvent): void {
    if (e) e.stopPropagation();
    this.expandedId = this.expandedId === id ? null : id;
  }

  saveAnnouncement(): void {
    if (!this.form.title || !this.form.summary) {
      this.toast.warning('Please enter both title and summary.');
      return;
    }

    this.isDispatching = true;

    // Use activityService.dispatchBroadcast for rich enterprise dispatch
    this.activityService.dispatchBroadcast({
      targetCohort: this.form.targetCohort,
      title: this.form.title,
      summary: this.form.summary,
      detailsMarkdown: this.form.detailsMarkdown || this.form.summary,
      severity: this.form.severity,
      category: this.form.category,
      isModalTrigger: this.form.isModalTrigger
    }).then(() => {
      this.isDispatching = false;
      this.toast.success(`Broadcast announcement published live to '${this.form.targetCohort.toUpperCase()}' cohort!`);
      this.closeModal();
      this.fetchAnnouncements();
    }).catch((err: any) => {
      // Fallback to legacy API endpoint if needed
      this.api.createAnnouncement({
        version: this.form.version,
        title: this.form.title,
        summary: this.form.summary,
        detailsMarkdown: this.form.detailsMarkdown,
        isModalTrigger: this.form.isModalTrigger,
        isActive: this.form.isActive
      }).subscribe({
        next: () => {
          this.isDispatching = false;
          this.toast.success('System announcement published live.');
          this.closeModal();
          this.fetchAnnouncements();
        },
        error: (apiErr: any) => {
          this.isDispatching = false;
          this.toast.error(apiErr?.error?.message || err?.error?.message || 'Failed to publish announcement.');
        }
      });
    });
  }

  async deleteAnnouncement(id: number): Promise<void> {
    const confirmed = await this.dialog.danger(
      'Delete Announcement Broadcast',
      'Are you sure you want to delete this broadcast announcement? It will be removed from all user feeds.'
    );

    if (confirmed) {
      this.api.deleteAnnouncement(id).subscribe({
        next: () => {
          this.toast.success('Announcement removed.');
          this.fetchAnnouncements();
        },
        error: (err: any) => this.toast.error(err?.error?.message || 'Delete failed.')
      });
    }
  }
}