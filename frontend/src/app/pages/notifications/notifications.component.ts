import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NotificationService, FollowedAct } from '../../services/notification.service';
import { SystemAnnouncementService, SystemAnnouncement } from '../../services/system-announcement.service';
import { TooltipDirective } from '../../directives/tooltip.directive';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink, TooltipDirective],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent implements OnInit {
  activeTab: 'all' | 'system' | 'laws' = 'all';
  followedActs: FollowedAct[] = [];

  systemAnnouncementService = inject(SystemAnnouncementService);
  notificationService = inject(NotificationService);

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.followedActs = this.notificationService.getFollowedActs();
    this.systemAnnouncementService.fetchLatestAnnouncements();
  }

  setTab(tab: 'all' | 'system' | 'laws') {
    this.activeTab = tab;
  }

  markRead(announcementId: number) {
    this.systemAnnouncementService.markAsRead(announcementId);
  }

  unfollow(shortName: string, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.notificationService.toggleFollow(shortName, '');
    this.loadNotifications();
  }

  clearAll() {
    if (confirm('Are you sure you want to clear all followed law alerts?')) {
      this.notificationService.clearAll();
      this.loadNotifications();
    }
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
