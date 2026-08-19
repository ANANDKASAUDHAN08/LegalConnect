import { Component, Input, Output, EventEmitter, ElementRef, HostListener, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TooltipDirective } from '../../directives/tooltip.directive';

export interface DateRangeEvent {
  startDate: string;
  endDate: string;
  label: string;
}

export type DatePreset = 'today' | '7days' | '30days' | 'thisMonth';

@Component({
  selector: 'admin-date-range-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective],
  templateUrl: './date-range-picker.component.html',
  styleUrls: ['./date-range-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DateRangePickerComponent implements OnInit, OnDestroy {
  @Input() startDate = '';
  @Input() endDate = '';
  @Input() tooltip = 'Filter by custom date range bounds';
  @Input() activeColorClass = 'text-sky-400';
  @Input() dropDirection: 'auto' | 'up' | 'down' = 'auto';

  @Output() rangeChange = new EventEmitter<DateRangeEvent>();

  isOpen = false;
  opensUpward = false;
  selectedPresetLabel = '';

  private clickListener = (event: MouseEvent) => {
    if (this.isOpen) {
      const clickedInside = this.el.nativeElement.contains(event.target as Node);
      if (!clickedInside) {
        this.isOpen = false;
        this.cdr.markForCheck();
      }
    }
  };

  constructor(private el: ElementRef, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    window.addEventListener('click', this.clickListener, true);
  }

  ngOnDestroy(): void {
    window.removeEventListener('click', this.clickListener, true);
  }

  get displayLabel(): string {
    if (this.selectedPresetLabel) return this.selectedPresetLabel;
    if (!this.startDate && !this.endDate) return 'Dates';
    if (this.startDate && !this.endDate) return 'From ' + this.formatShortDate(this.startDate);
    if (!this.startDate && this.endDate) return 'Until ' + this.formatShortDate(this.endDate);
    if (this.startDate === this.endDate) return this.formatShortDate(this.startDate);

    const s = this.startDate <= this.endDate ? this.startDate : this.endDate;
    const e = this.startDate <= this.endDate ? this.endDate : this.startDate;

    return `${this.formatShortDate(s)} - ${this.formatShortDate(e)}`;
  }

  togglePopover(): void {
    if (!this.isOpen) {
      this.calculateSmartPlacement();
    }
    this.isOpen = !this.isOpen;
    this.cdr.markForCheck();
  }

  private calculateSmartPlacement(): void {
    if (this.dropDirection === 'up') {
      this.opensUpward = true;
      return;
    }
    if (this.dropDirection === 'down') {
      this.opensUpward = false;
      return;
    }
    const rect = this.el.nativeElement.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const popoverHeight = 280;

    this.opensUpward = spaceBelow < popoverHeight && spaceAbove > spaceBelow;
  }

  closePopover(): void {
    this.isOpen = false;
    this.cdr.markForCheck();
  }

  selectPreset(preset: DatePreset): void {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    this.endDate = formatDate(today);

    if (preset === 'today') {
      this.startDate = formatDate(today);
      this.selectedPresetLabel = 'Today';
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      this.startDate = formatDate(past);
      this.selectedPresetLabel = 'Last 7 Days';
    } else if (preset === '30days') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      this.startDate = formatDate(past);
      this.selectedPresetLabel = 'Last 30 Days';
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      this.startDate = formatDate(firstDay);
      this.selectedPresetLabel = 'This Month';
    }

    this.isOpen = false;
    this.emitRangeChange();
  }

  applyCustomRange(startVal: string, endVal: string): void {
    // If user picks future start and past end date, auto-swap them to create a valid chronological range
    if (startVal && endVal && startVal > endVal) {
      this.startDate = endVal;
      this.endDate = startVal;
    } else {
      this.startDate = startVal;
      this.endDate = endVal;
    }
    this.selectedPresetLabel = '';
    this.isOpen = false;
    this.emitRangeChange();
  }

  clearRange(): void {
    this.startDate = '';
    this.endDate = '';
    this.selectedPresetLabel = '';
    this.isOpen = false;
    this.emitRangeChange();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.closePopover();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.isOpen) {
      this.closePopover();
    }
  }

  private emitRangeChange(): void {
    this.rangeChange.emit({
      startDate: this.startDate,
      endDate: this.endDate,
      label: this.displayLabel
    });
    this.cdr.markForCheck();
  }

  private formatShortDate(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[month]} ${day}`;
  }
}