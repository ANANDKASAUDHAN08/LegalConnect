import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { SystemAnnouncementItem } from '../../core/models/admin.models';

@Component({
  selector: 'admin-announcements',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent, TooltipDirective],
  templateUrl: './announcements.component.html',
  styleUrl: './announcements.component.scss'
})
export class AnnouncementsComponent implements OnInit {
  announcements: SystemAnnouncementItem[] = [];
  isLoading = false;
  showModal = false;
  form: any = { version: '1.3.0', title: '', summary: '', isModalTrigger: true, isActive: true };

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialog: DialogService
  ) { }

  ngOnInit(): void {
    this.fetchAnnouncements();
  }

  fetchAnnouncements(): void {
    this.isLoading = true;
    this.api.getAnnouncements().subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.announcements = res || [];
      },
      error: (err: any) => {
        this.isLoading = false;
        this.toast.error(err?.error?.message || 'Failed to fetch announcements.');
      }
    });
  }

  openCreateModal(): void {
    this.form = { version: '1.3.0', title: '', summary: '', isModalTrigger: true, isActive: true };
    this.showModal = true;
  }

  saveAnnouncement(): void {
    if (!this.form.title || !this.form.summary) {
      this.toast.warning('Please enter both title and summary.');
      return;
    }
    this.api.createAnnouncement(this.form).subscribe({
      next: () => {
        this.toast.success('System announcement published live.');
        this.showModal = false;
        this.fetchAnnouncements();
      },
      error: (err: any) => this.toast.error(err?.error?.message || 'Failed to publish announcement.')
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