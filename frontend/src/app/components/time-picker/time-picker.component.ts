import {
  Component,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  OnChanges,
  SimpleChanges,
  HostListener,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icon.types';
import {
  formatTime12,
  parseTime24,
  formatTime24,
  STANDARD_HOURS_12,
  STANDARD_MINUTES,
  COMMON_START_TIMES,
  COMMON_END_TIMES,
  TimeOption
} from '../../utils/time.util';

/**
 * Enterprise Time Picker Modal
 * 
 * Luxury, mobile-responsive time selection dialog for LegalConnect.
 * Features:
 * - Real-time synchronized digital display with tactile steppers (+ / -)
 * - Custom dark glass dropdowns for Hour & Minute (ZERO native OS wheel/select overlays)
 * - 1-tap quick popular hour presets
 * - AM / PM segmented controls
 * - Built-in Escape key and backdrop dismissal
 * - Emits standardized 24-hour "HH:mm" strings
 */
@Component({
  selector: 'app-time-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './time-picker.component.html',
  styleUrls: ['./time-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimePickerComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() initialTime = '22:00'; // 24-hour "HH:mm"
  @Input() title = 'Set Schedule Time';
  @Input() subtitle = 'Select the start or end time for your schedule';
  @Input() icon: IconName = 'clock';
  @Input() iconColorClass = 'bg-indigo-500/20 text-indigo-400';
  @Input() mode: 'start' | 'end' | 'general' = 'general';

  @Output() timeChange = new EventEmitter<string>(); // Emits 24h "HH:mm"
  @Output() close = new EventEmitter<void>();

  // Internal draft signals
  draftHour = signal<number>(10);
  draftMinute = signal<string>('00');
  draftPeriod = signal<'AM' | 'PM'>('PM');

  // Custom in-DOM dropdown states (no native OS select popups!)
  isHourDropdownOpen = signal<boolean>(false);
  isMinuteDropdownOpen = signal<boolean>(false);

  readonly hours12 = STANDARD_HOURS_12;
  readonly minutesList = STANDARD_MINUTES;

  quickOptions = computed<readonly TimeOption[]>(() => {
    if (this.mode === 'start') return COMMON_START_TIMES;
    if (this.mode === 'end') return COMMON_END_TIMES;
    return this.draftPeriod() === 'PM' ? COMMON_START_TIMES : COMMON_END_TIMES;
  });

  formattedCurrentDraft = computed<string>(() => {
    const time24 = formatTime24(this.draftHour(), this.draftMinute(), this.draftPeriod());
    return formatTime12(time24);
  });

  constructor(private elementRef: ElementRef) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialTime'] || (changes['isOpen'] && this.isOpen)) {
      this.syncFromInitialTime();
    }
    if (changes['isOpen'] && !this.isOpen) {
      this.closeAllDropdowns();
    }
  }

  private syncFromInitialTime(): void {
    const parts = parseTime24(this.initialTime);
    this.draftHour.set(parts.hour12);
    this.draftMinute.set(parts.minute);
    this.draftPeriod.set(parts.period);
    this.closeAllDropdowns();
  }

  toggleHourDropdown(event?: Event): void {
    if (event) event.stopPropagation();
    this.isMinuteDropdownOpen.set(false);
    this.isHourDropdownOpen.update(v => !v);
  }

  toggleMinuteDropdown(event?: Event): void {
    if (event) event.stopPropagation();
    this.isHourDropdownOpen.set(false);
    this.isMinuteDropdownOpen.update(v => !v);
  }

  closeAllDropdowns(): void {
    this.isHourDropdownOpen.set(false);
    this.isMinuteDropdownOpen.set(false);
  }

  selectHour(h: number): void {
    this.draftHour.set(h);
    this.isHourDropdownOpen.set(false);
  }

  selectMinute(m: string): void {
    this.draftMinute.set(m);
    this.isMinuteDropdownOpen.set(false);
  }

  setPeriod(period: 'AM' | 'PM'): void {
    this.draftPeriod.set(period);
    this.closeAllDropdowns();
  }

  togglePeriod(): void {
    this.draftPeriod.update(p => (p === 'AM' ? 'PM' : 'AM'));
    this.closeAllDropdowns();
  }

  incrementHour(): void {
    let current = this.draftHour();
    current = current >= 12 ? 1 : current + 1;
    this.draftHour.set(current);
  }

  decrementHour(): void {
    let current = this.draftHour();
    current = current <= 1 ? 12 : current - 1;
    this.draftHour.set(current);
  }

  incrementMinute(): void {
    const list = this.minutesList;
    const idx = list.indexOf(this.draftMinute());
    const nextIdx = (idx + 1) % list.length;
    this.draftMinute.set(list[nextIdx]);
  }

  decrementMinute(): void {
    const list = this.minutesList;
    const idx = list.indexOf(this.draftMinute());
    const prevIdx = (idx - 1 + list.length) % list.length;
    this.draftMinute.set(list[prevIdx]);
  }

  selectQuickPreset(time24: string): void {
    const parts = parseTime24(time24);
    this.draftHour.set(parts.hour12);
    this.draftMinute.set(parts.minute);
    this.draftPeriod.set(parts.period);
    this.closeAllDropdowns();
  }

  isCurrentPresetActive(time24: string): boolean {
    const current24 = formatTime24(this.draftHour(), this.draftMinute(), this.draftPeriod());
    return current24 === time24;
  }

  apply(): void {
    const time24 = formatTime24(this.draftHour(), this.draftMinute(), this.draftPeriod());
    this.timeChange.emit(time24);
    this.closeAllDropdowns();
    this.close.emit();
  }

  onCancel(): void {
    this.closeAllDropdowns();
    this.close.emit();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // If click was outside dropdown menus, close open dropdowns
    this.closeAllDropdowns();
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (this.isHourDropdownOpen() || this.isMinuteDropdownOpen()) {
      this.closeAllDropdowns();
      return;
    }
    if (this.isOpen) {
      this.onCancel();
    }
  }
}