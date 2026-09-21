import {
  Component, forwardRef, Input, signal, computed,
  ChangeDetectionStrategy, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';

/**
 * Shared Date Picker Component
 *
 * A custom calendar dropdown that works as a ControlValueAccessor for Reactive Forms.
 * Accepts/emits ISO date strings (YYYY-MM-DD).
 *
 * Usage:
 *   <app-date-picker formControlName="dateOfBirth" label="Date of Birth"></app-date-picker>
 */
@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true
    }
  ],
  templateUrl: './date-picker.component.html'
})
export class DatePickerComponent implements ControlValueAccessor {
  @Input() label = 'Date';
  @Input() inputId = 'date-picker';
  @Input() errorId = '';
  @Input() placeholder = 'Select date';
  @Input() minYear = 1920;
  @Input() maxYear = new Date().getFullYear();

  // ─── State ───────────────────────────────────────────────────
  selectedDate = signal('');
  showCalendar = signal(false);
  calendarYear = signal(new Date().getFullYear());
  calendarMonth = signal(new Date().getMonth());
  disabled = signal(false);

  private onChange: (value: string) => void = () => { };
  private onTouched: () => void = () => { };

  readonly monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  readonly weekDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  // ─── Computed ────────────────────────────────────────────────
  displayValue = computed(() => {
    const dateStr = this.selectedDate();
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  });

  calendarDays = computed<(Date | null)[]>(() => {
    const year = this.calendarYear();
    const month = this.calendarMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Mon-based

    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  });

  yearOptions = computed(() => {
    const years: number[] = [];
    for (let y = this.maxYear; y >= this.minYear; y--) years.push(y);
    return years;
  });

  // ─── ControlValueAccessor ────────────────────────────────────
  writeValue(value: string | null): void {
    const dateStr = value ? value.split('T')[0] : '';
    this.selectedDate.set(dateStr);
    if (dateStr) {
      const d = new Date(dateStr + 'T00:00:00');
      this.calendarYear.set(d.getFullYear());
      this.calendarMonth.set(d.getMonth());
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  // ─── Actions ─────────────────────────────────────────────────
  toggleCalendar(): void {
    if (this.disabled()) return;
    const isOpen = !this.showCalendar();
    this.showCalendar.set(isOpen);

    if (isOpen) {
      const dateStr = this.selectedDate();
      if (dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        this.calendarYear.set(d.getFullYear());
        this.calendarMonth.set(d.getMonth());
      } else {
        const now = new Date();
        this.calendarYear.set(now.getFullYear());
        this.calendarMonth.set(now.getMonth());
      }
    }
  }

  closeCalendar(): void {
    this.showCalendar.set(false);
    this.onTouched();
  }

  prevMonth(): void {
    if (this.calendarMonth() === 0) {
      this.calendarMonth.set(11);
      this.calendarYear.update(y => y - 1);
    } else {
      this.calendarMonth.update(m => m - 1);
    }
  }

  nextMonth(): void {
    if (this.calendarMonth() === 11) {
      this.calendarMonth.set(0);
      this.calendarYear.update(y => y + 1);
    } else {
      this.calendarMonth.update(m => m + 1);
    }
  }

  onMonthChange(month: string | number): void {
    this.calendarMonth.set(Number(month));
  }

  onYearChange(year: string | number): void {
    this.calendarYear.set(Number(year));
  }

  selectDate(date: Date): void {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const isoDate = `${y}-${m}-${d}`;
    this.selectedDate.set(isoDate);
    this.onChange(isoDate);
    this.showCalendar.set(false);
  }

  goToToday(): void {
    const today = new Date();
    this.calendarYear.set(today.getFullYear());
    this.calendarMonth.set(today.getMonth());
    this.selectDate(today);
  }

  clearDate(): void {
    this.selectedDate.set('');
    this.onChange('');
    this.closeCalendar();
  }

  isSelected(date: Date): boolean {
    const sel = this.selectedDate();
    if (!sel) return false;
    const selDate = new Date(sel + 'T00:00:00');
    return date.getFullYear() === selDate.getFullYear() &&
      date.getMonth() === selDate.getMonth() &&
      date.getDate() === selDate.getDate();
  }

  isToday(date: Date): boolean {
    const t = new Date();
    return date.getFullYear() === t.getFullYear() &&
      date.getMonth() === t.getMonth() &&
      date.getDate() === t.getDate();
  }

  // ─── TrackBy ─────────────────────────────────────────────────
  trackByDay(_index: number, date: Date | null): string {
    return date ? date.toISOString() : `empty-${_index}`;
  }

  trackByString(_index: number, item: string): string {
    return item;
  }

  trackByNumber(_index: number, item: number): number {
    return item;
  }
}