import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';
import { ActivityStreamService, ActivityEvent } from '../../../../core/services/activity-stream.service';

@Component({
  selector: 'app-dashboard-activity-feed',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './dashboard-activity-feed.component.html',
  styleUrl: './dashboard-activity-feed.component.scss'
})
export class DashboardActivityFeedComponent {
  @Input() activeActivityFilter: 'all' | 'verification_req' | 'security_alert' | 'urgent_ticket' = 'all';
  @Input() activityFeed: ActivityEvent[] = [];

  @Output() filterChange = new EventEmitter<'all' | 'verification_req' | 'security_alert' | 'urgent_ticket'>();
  @Output() openVerifyModal = new EventEmitter<void>();
  @Output() navigateSupport = new EventEmitter<{ status: string }>();

  constructor(public activityStream: ActivityStreamService) {}

  setFilter(filter: 'all' | 'verification_req' | 'security_alert' | 'urgent_ticket'): void {
    this.filterChange.emit(filter);
  }

  markAllRead(): void {
    this.activityStream.markAllAsRead();
  }

  get unreadCount(): number {
    return this.activityStream.unreadCount;
  }

  get filteredEvents(): ActivityEvent[] {
    if (this.activeActivityFilter === 'all') return this.activityFeed;
    return this.activityFeed.filter(e => e.type === this.activeActivityFilter);
  }
}