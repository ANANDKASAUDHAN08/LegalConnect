import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { SavedItemsService } from '../../../../services/saved-items.service';

@Component({
  selector: 'app-resource-card',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './resource-card.component.html',
  styles: [`:host { display: block; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResourceCardComponent implements OnInit {
  @Input() resource: any;
  @Input() isFreeAidEligible = false;

  @Output() bookmark = new EventEmitter<string>(); // backwards compat
  @Output() directions = new EventEmitter<{ lat: number, lng: number }>();
  @Output() share = new EventEmitter<any>();
  @Output() showQr = new EventEmitter<any>();

  operatingStatus!: { label: string, colorClass: string };

  // Reactive saved state
  isSaved = computed(() => this.resource?._id ? this.savedItems.isSavedResource(this.resource._id) : false);

  constructor(private savedItems: SavedItemsService) {}

  ngOnInit(): void {
    this.operatingStatus = this.getLiveOperatingStatus();
  }

  onBookmarkClick(event: Event) {
    event.stopPropagation();
    if (this.resource?._id) {
      this.savedItems.toggleResource(this.resource._id, this.resource.name);
      this.bookmark.emit(this.resource._id); // backwards compat
    }
  }

  // Dynamic status check based on current time
  getLiveOperatingStatus(): { label: string, colorClass: string } {
    const hoursStr = this.resource.operatingHours;
    if (!hoursStr) return { label: 'Open Now', colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    const cleaned = hoursStr.toLowerCase().trim();

    if (cleaned.includes('24 hours')) {
      return { label: 'Open 24 Hours', colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    }

    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentTime = currentHour * 60 + now.getMinutes();

      if (currentHour === 13) {
        return { label: 'Lunch Break (Reopens 2 PM)', colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
      }

      const parts = cleaned.split('-');
      if (parts.length === 2) {
        const startMin = this.parseTimeToMinutes(parts[0]);
        const endMin = this.parseTimeToMinutes(parts[1]);

        if (currentTime >= startMin && currentTime <= endMin) {
          if (endMin - currentTime <= 30) {
            return { label: 'Closing Soon', colorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-500/20' };
          }
          return { label: 'Open Now', colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
        }
      }
    } catch (e) {
      // Fallback
    }

    return { label: 'Closed Now', colorClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' };
  }

  private parseTimeToMinutes(timeStr: string): number {
    const time = timeStr.trim();
    const isPM = time.includes('pm');
    const cleanTime = time.replace('am', '').replace('pm', '').trim();
    const parts = cleanTime.split(':');
    let hours = parseInt(parts[0]);
    const minutes = parts.length > 1 ? parseInt(parts[1]) : 0;

    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  trackBySubcategory(_: number, sub: string): string {
    return sub;
  }
}