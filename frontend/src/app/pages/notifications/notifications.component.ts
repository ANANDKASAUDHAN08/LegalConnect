import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NotificationService, FollowedAct } from '../../services/notification.service';
import { SystemAnnouncementService, SystemAnnouncement } from '../../services/system-announcement.service';
import { SnackbarService } from '../../services/snackbar.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

export interface GroupedAnnouncements {
  label: string;
  items: SystemAnnouncement[];
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink, TooltipDirective, ConfirmDialogComponent],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent implements OnInit {
  activeTab: 'all' | 'system' | 'laws' = 'all';
  followedActs: FollowedAct[] = [];

  systemAnnouncementService = inject(SystemAnnouncementService);
  notificationService = inject(NotificationService);
  snackbar = inject(SnackbarService);

  // Modal Dialog variables
  isConfirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmType: 'danger' | 'warning' | 'info' = 'warning';
  onConfirmAction: (() => void) | null = null;

  triggerConfirm(title: string, message: string, type: 'danger' | 'warning' | 'info', action: () => void) {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.confirmType = type;
    this.onConfirmAction = action;
    this.isConfirmOpen = true;
  }

  onConfirmDialog() {
    this.isConfirmOpen = false;
    if (this.onConfirmAction) {
      this.onConfirmAction();
    }
  }

  onCancelDialog() {
    this.isConfirmOpen = false;
    this.onConfirmAction = null;
  }

  // Loading indicator
  isLoading = signal(true);

  // Computed grouped notifications
  groupedSystemAnnouncements = computed(() => {
    const raw = this.systemAnnouncementService.announcements();
    const today: SystemAnnouncement[] = [];
    const yesterday: SystemAnnouncement[] = [];
    const older: SystemAnnouncement[] = [];

    const now = new Date();
    const todayStr = now.toDateString();
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterdayStr = yesterdayDate.toDateString();

    raw.forEach(item => {
      const pubDate = new Date(item.publishedAt);
      const pubDateStr = pubDate.toDateString();

      if (pubDateStr === todayStr) {
        today.push(item);
      } else if (pubDateStr === yesterdayStr) {
        yesterday.push(item);
      } else {
        older.push(item);
      }
    });

    const groups: GroupedAnnouncements[] = [];
    if (today.length > 0) groups.push({ label: 'Today', items: today });
    if (yesterday.length > 0) groups.push({ label: 'Yesterday', items: yesterday });
    if (older.length > 0) groups.push({ label: 'Earlier', items: older });

    return groups;
  });

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.isLoading.set(true);
    this.followedActs = this.notificationService.getFollowedActs();

    // Simulating slight delay to showcase skeleton loader
    setTimeout(() => {
      this.systemAnnouncementService.fetchLatestAnnouncements();
      this.isLoading.set(false);
    }, 600);
  }

  setTab(tab: 'all' | 'system' | 'laws') {
    this.activeTab = tab;
  }

  markRead(announcementId: number) {
    this.systemAnnouncementService.markAsRead(announcementId);
    this.snackbar.show('Notification marked as read.', 'success');
  }

  markAllRead() {
    const unread = this.systemAnnouncementService.announcements().filter(a => !a.isRead);
    if (unread.length === 0) {
      this.snackbar.show('All updates are already read.', 'info');
      return;
    }
    unread.forEach(a => this.systemAnnouncementService.markAsRead(a.id));
    this.snackbar.show('All notifications marked as read.', 'success');
  }

  unfollow(shortName: string, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.notificationService.toggleFollow(shortName, '');
    this.loadNotifications();
    this.snackbar.show('Statute alerts unfollowed successfully.', 'success');
  }

  clearAll() {
    this.triggerConfirm(
      'Clear All Followed Laws',
      'Are you sure you want to stop monitoring all followed law alerts? This will clear your notifications list.',
      'danger',
      () => {
        this.notificationService.clearAll();
        this.loadNotifications();
        this.snackbar.show('Unfollowed all followed statutes.', 'success');
      }
    );
  }

  formatDate(date: any): string {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}