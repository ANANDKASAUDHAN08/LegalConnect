import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { SnackbarService } from '../../../../services/snackbar.service';
import { EnterpriseNotification, FollowedAct } from '../../../../services/notification.service';

/**
 * Notification Insights Component
 * 
 * Enterprise telemetry panel rendering key alert metrics (Total, Unread, Urgent, Monitored Acts),
 * delivery channel health diagnostics (In-App, Email, Real-Time SSE, Browser Web Push),
 * and quick-access shortcuts to actively monitored Indian Bare Acts under statutory watch.
 * 
 * Implemented with OnPush change detection, Angular Signal inputs, and custom snackbars.
 */
@Component({
  selector: 'app-notification-insights',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, TooltipDirective],
  templateUrl: './notification-insights.component.html',
  styleUrls: ['./notification-insights.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationInsightsComponent {
  private readonly snackbar = inject(SnackbarService);

  // Core Inputs
  notifications = input.required<EnterpriseNotification[]>();
  unreadCount = input.required<number>();
  urgentCount = input.required<number>();
  followedActs = input.required<FollowedAct[]>();
  activeTab = input.required<string>();
  sseConnected = input.required<boolean>();
  webPushPermission = input.required<string>();
  isMobileSheet = input<boolean>(false);
  isLoading = input<boolean>(false);

  // Action Outputs
  filterMetric = output<'all' | 'unread' | 'urgent' | 'statutes'>();
  openPreferences = output<void>();
  enableWebPush = output<void>();
  viewAllStatutes = output<void>();

  /**
   * Dispatches triage metric filter event to parent container
   */
  onMetricClick(metric: 'all' | 'unread' | 'urgent' | 'statutes'): void {
    this.filterMetric.emit(metric);
  }

  /**
   * Opens notification channel preference modal
   */
  onConfigureClick(): void {
    this.openPreferences.emit();
  }

  /**
   * Requests browser Web Push notification permission
   */
  onEnableWebPushClick(): void {
    this.enableWebPush.emit();
  }

  /**
   * Provides actionable toast guidance when push notifications are blocked
   */
  onBlockedPushClick(): void {
    this.snackbar.show(
      'Push notifications are blocked. Please click the lock or site settings icon in your browser address bar to enable notifications for LegalConnect.',
      'warning',
      6000
    );
  }

  /**
   * Explains push notification browser incompatibility
   */
  onUnsupportedPushClick(): void {
    this.snackbar.show(
      'Web Push notifications are not supported by this browser or operating environment.',
      'info',
      4000
    );
  }

  /**
   * Displays SSE stream status and diagnostics toast
   */
  onLiveFeedClick(): void {
    if (this.sseConnected()) {
      this.snackbar.show(
        'Real-Time SSE Sync Active: Receiving live legal dockets, court updates, and statutory alerts.',
        'success',
        3500
      );
    } else {
      this.snackbar.show(
        'SSE Stream Disconnected: System is attempting automatic background reconnect...',
        'warning',
        4000
      );
    }
  }

  /**
   * Displays DPDP Act 2023 compliance security certification details
   */
  onDpdpClick(): void {
    this.snackbar.show(
      'DPDP Act 2023 Certified: End-to-end encryption enforced across all notifications, briefs, and client data.',
      'info',
      4500
    );
  }

  /**
   * Navigates to the Monitored Statutes management tab
   */
  onViewAllStatutesClick(): void {
    this.viewAllStatutes.emit();
  }

  /**
   * TrackBy function for efficient DOM reconciliation of followed statutory acts
   */
  trackByShortName(_index: number, act: FollowedAct): string {
    return act.shortName;
  }
}