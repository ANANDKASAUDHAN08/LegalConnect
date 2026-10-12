import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../components/icon/icon.component';
import { IconName } from '../../../../components/icon/icon.types';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { EnterpriseNotification, NotificationType } from '../../../../services/notification.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { ShareMenuComponent } from '../../../../components/share-menu/share-menu.component';

interface NotificationTypeMetadata {
  icon: IconName;
  badgeClass: string;
  iconBgClass: string;
  calloutBorderClass: string;
  calloutAccentClass: string;
  label: string;
}

const TYPE_CONFIG_MAP: Record<NotificationType, NotificationTypeMetadata> = {
  legal: {
    icon: 'scale',
    badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25',
    iconBgClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 shadow-indigo-500/5',
    calloutBorderClass: 'border-l-indigo-500 dark:border-l-indigo-400',
    calloutAccentClass: 'text-indigo-600 dark:text-indigo-400',
    label: 'Statute Alert'
  },
  case: {
    icon: 'calendar',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25',
    iconBgClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 shadow-blue-500/5',
    calloutBorderClass: 'border-l-blue-500 dark:border-l-blue-400',
    calloutAccentClass: 'text-blue-600 dark:text-blue-400',
    label: 'Case Update'
  },
  lawyer: {
    icon: 'message-square',
    badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25',
    iconBgClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 shadow-purple-500/5',
    calloutBorderClass: 'border-l-purple-500 dark:border-l-purple-400',
    calloutAccentClass: 'text-purple-600 dark:text-purple-400',
    label: 'Advocate Message'
  },
  review: {
    icon: 'star',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
    iconBgClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 shadow-amber-500/5',
    calloutBorderClass: 'border-l-amber-500 dark:border-l-amber-400',
    calloutAccentClass: 'text-amber-600 dark:text-amber-400',
    label: 'Review Feedback'
  },
  profile: {
    icon: 'user',
    badgeClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/25',
    iconBgClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20 shadow-teal-500/5',
    calloutBorderClass: 'border-l-teal-500 dark:border-l-teal-400',
    calloutAccentClass: 'text-teal-600 dark:text-teal-400',
    label: 'Profile Audit'
  },
  security: {
    icon: 'shield',
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25',
    iconBgClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-rose-500/5',
    calloutBorderClass: 'border-l-rose-500 dark:border-l-rose-400',
    calloutAccentClass: 'text-rose-600 dark:text-rose-400',
    label: 'Security Notice'
  },
  verification: {
    icon: 'badge-check',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
    iconBgClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-emerald-500/5',
    calloutBorderClass: 'border-l-emerald-500 dark:border-l-emerald-400',
    calloutAccentClass: 'text-emerald-600 dark:text-emerald-400',
    label: 'BCI Verification'
  },
  hearing: {
    icon: 'gavel',
    badgeClass: 'bg-amber-600/10 text-amber-800 dark:text-amber-200 border-amber-500/25',
    iconBgClass: 'bg-amber-600/10 text-amber-700 dark:text-amber-300 border-amber-500/20 shadow-amber-500/5',
    calloutBorderClass: 'border-l-amber-500 dark:border-l-amber-400',
    calloutAccentClass: 'text-amber-700 dark:text-amber-300',
    label: 'Court Hearing'
  },
  document: {
    icon: 'file-text',
    badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/25',
    iconBgClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20 shadow-cyan-500/5',
    calloutBorderClass: 'border-l-cyan-500 dark:border-l-cyan-400',
    calloutAccentClass: 'text-cyan-600 dark:text-cyan-400',
    label: 'Legal Dossier'
  },
  payment: {
    icon: 'wallet',
    badgeClass: 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border-emerald-600/25',
    iconBgClass: 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border-emerald-600/20 shadow-emerald-600/5',
    calloutBorderClass: 'border-l-emerald-500 dark:border-l-emerald-400',
    calloutAccentClass: 'text-emerald-600 dark:text-emerald-400',
    label: 'Escrow Billing'
  },
  system: {
    icon: 'zap',
    badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/25',
    iconBgClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 shadow-slate-500/5',
    calloutBorderClass: 'border-l-slate-400 dark:border-l-slate-500',
    calloutAccentClass: 'text-slate-600 dark:text-slate-400',
    label: 'Platform Update'
  }
};

const DEFAULT_TYPE_CONFIG: NotificationTypeMetadata = {
  icon: 'bell',
  badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/25',
  iconBgClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  calloutBorderClass: 'border-l-blue-500 dark:border-l-blue-400',
  calloutAccentClass: 'text-blue-600 dark:text-blue-400',
  label: 'Notification'
};

/**
 * Notification Card Component
 * 
 * High-performance notification row item supporting multi-select, read/unread triage,
 * metadata chip extraction, deep-link routing, and direct clipboard actions.
 * Optimized with OnPush change detection, Signals, and O(1) type config resolution.
 */
@Component({
  selector: 'app-notification-card',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, TooltipDirective, ShareMenuComponent],
  templateUrl: './notification-card.component.html',
  styleUrls: ['./notification-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationCardComponent {
  private readonly snackbar = inject(SnackbarService);

  // Core Inputs
  item = input.required<EnterpriseNotification>();
  isSelected = input<boolean>(false);
  isSelectionMode = input<boolean>(false);
  isVirtualScroll = input<boolean>(false);

  // Core Action Outputs
  toggleSelect = output<Event>();
  markRead = output<string>();
  delete = output<Event>();

  // Computed visual configuration via O(1) dictionary
  typeConfig = computed<NotificationTypeMetadata>(() => {
    return TYPE_CONFIG_MAP[this.item().type] || DEFAULT_TYPE_CONFIG;
  });

  // Dynamic context header for callout box
  calloutLabel = computed<string>(() => {
    switch (this.item().type) {
      case 'legal':
        return 'Statutory Provision Extract';
      case 'case':
        return 'Docket Notice & Action Item';
      case 'lawyer':
        return 'Advocate Consultation Note';
      case 'hearing':
        return 'Court Hearing Docket Extract';
      case 'security':
        return 'Security & Session Advisory';
      case 'verification':
        return 'Credential Validation Record';
      case 'payment':
        return 'Escrow Billing Summary';
      case 'document':
        return 'Legal Dossier Synopsis';
      default:
        return 'Key Takeaway & Docket Details';
    }
  });

  // Cached metadata keys array to avoid template re-allocation
  metadataKeys = computed<string[]>(() => {
    const meta = this.item().metadata;
    return meta ? Object.keys(meta) : [];
  });

  // Formatted date string for tooltip precision
  formattedDate = computed<string>(() => {
    const dateStr = this.item().createdAt;
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  });

  // Relative human-friendly timestamp
  relativeTime = computed<string>(() => {
    const dateStr = this.item().createdAt;
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  });

  // Detect whether actionUrl points to an external web page
  isExternalActionUrl = computed<boolean>(() => {
    const url = this.item().actionUrl;
    return !!url && (url.startsWith('http://') || url.startsWith('https://'));
  });

  onCardClick(event: Event): void {
    const selection = typeof window !== 'undefined' ? window.getSelection()?.toString() : '';
    if (selection && selection.length > 0) return;
    if (this.isSelected() || this.isSelectionMode()) {
      this.toggleSelect.emit(event);
    }
  }

  onCheckboxClick(event: Event): void {
    event.stopPropagation();
    this.toggleSelect.emit(event);
  }

  onCtaClick(event: Event): void {
    event.stopPropagation();
    if (!this.item().isRead) {
      this.markRead.emit(this.item().id);
    }
  }

  onMarkRead(event: Event): void {
    event.stopPropagation();
    this.markRead.emit(this.item().id);
  }

  onDelete(event: Event): void {
    event.stopPropagation();
    this.delete.emit(event);
  }

  copyActionLink(url: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      const fullUrl = this.getShareUrl(url);
      navigator.clipboard.writeText(fullUrl).then(
        () => this.snackbar.show('Deep link copied to clipboard.', 'success'),
        () => this.snackbar.show('Failed to copy link to clipboard.', 'error')
      );
    }
  }

  getShareUrl(path?: string): string {
    if (!path) return typeof window !== 'undefined' ? window.location.href : '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
  }

  copyMetadata(key: string, value: any, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(String(value)).then(
        () => this.snackbar.show(`Copied ${key}: ${value}`, 'info', 2500),
        () => this.snackbar.show('Failed to copy metadata.', 'error')
      );
    }
  }

  trackByKey(_index: number, key: string): string {
    return key;
  }
}