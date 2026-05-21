import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NotificationService, FollowedAct } from '../../services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent implements OnInit {
  followedActs: FollowedAct[] = [];

  constructor(private notificationService: NotificationService) {}

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.followedActs = this.notificationService.getFollowedActs();
  }

  unfollow(shortName: string, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.notificationService.toggleFollow(shortName, '');
    this.loadNotifications();
  }

  clearAll() {
    if (confirm('Are you sure you want to clear all alerts?')) {
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
