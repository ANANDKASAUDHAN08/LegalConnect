/**
 * Data Table Helper Components (Clubbed: 3-in-1)
 * Contains: AdminSearchInput, AdminSortHeader, AdminEmptyState
 */
import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { sanitizeSearchInput } from '../../../core/utils/security-utils';
import { AdminIconComponent } from '../icon/icon.component';

// ---------------------------------------------------------------
// 1. SEARCH INPUT - Debounced search with built-in icon & XSS protection
// ---------------------------------------------------------------
@Component({
  selector: 'admin-search-input',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective, AdminIconComponent],
  template: `
    <div class="search-box flex-1 relative" [style.min-width]="minWidth" [style.max-width]="maxWidth">
      <admin-icon name="search" [size]="16" [strokeWidth]="2"
        cssClass="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></admin-icon>
      <input type="text"
        class="form-input w-full !pl-10 !pr-8 bg-slate-800/80 border-slate-700/80 text-slate-100 placeholder-slate-400 rounded-xl text-xs py-2.5 transition-all focus:border-indigo-500/50"
        [placeholder]="placeholder"
        [value]="value"
        (input)="onInput($any($event.target).value)"
        [adminTooltip]="tooltip"
        tooltipPosition="top" />
      @if (value) {
        <button type="button"
          (click)="clearSearch()"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-0.5 rounded-full hover:bg-slate-700/60"
          adminTooltip="Clear search"
          tooltipPosition="top">
          <admin-icon name="x" [size]="14" [strokeWidth]="2"></admin-icon>
        </button>
      }
    </div>
  `
})
export class AdminSearchInputComponent implements OnInit, OnDestroy, OnChanges {
  @Input() placeholder = 'Search...';
  @Input() value = '';
  @Input() tooltip = 'Type to search (debounced 300ms)';
  @Input() minWidth = '250px';
  @Input() maxWidth = 'none';
  @Input() debounceMs = 300;
  @Output() searchChange = new EventEmitter<string>();

  private searchSubject$ = new Subject<string>();
  private subscription?: Subscription;

  ngOnInit(): void {
    this.subscription = this.searchSubject$.pipe(
      debounceTime(this.debounceMs),
      distinctUntilChanged()
    ).subscribe(query => {
      const sanitized = sanitizeSearchInput(query);
      this.searchChange.emit(sanitized);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && !changes['value'].firstChange) {
      this.value = changes['value'].currentValue || '';
    }
  }

  onInput(val: string): void {
    this.value = val;
    this.searchSubject$.next(val);
  }

  clearSearch(): void {
    this.value = '';
    this.searchSubject$.next('');
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.searchSubject$.complete();
  }
}

// ---------------------------------------------------------------
// 2. SORT HEADER - Clickable <th> with sort direction indicators
// ---------------------------------------------------------------
@Component({
  selector: 'admin-sort-header',
  standalone: true,
  imports: [CommonModule, TooltipDirective, AdminIconComponent],
  template: `
    <th class="p-2.5 whitespace-nowrap cursor-pointer group hover:text-sky-300 transition-colors select-none"
        (click)="onSort()"
        [adminTooltip]="'Click to sort by ' + label"
        tooltipPosition="top">
      <div class="flex items-center gap-1.5">
        <span [class.text-sky-400]="isActive">{{ label }}</span>
        <admin-icon [name]="isActive ? (currentOrder === 'asc' ? 'sort-asc' : 'sort-desc') : 'sort-unsorted'"
          [size]="13" [strokeWidth]="isActive ? 2.5 : 2"
          [cssClass]="isActive ? 'text-sky-400 flex-shrink-0' : 'text-slate-600 group-hover:text-sky-400/70 transition-colors flex-shrink-0'"></admin-icon>
      </div>
    </th>
  `
})
export class AdminSortHeaderComponent {
  @Input() label = '';
  @Input() key = '';
  @Input() currentSort = '';
  @Input() currentOrder: 'asc' | 'desc' = 'desc';
  @Output() sortChange = new EventEmitter<{ key: string; order: 'asc' | 'desc' }>();

  get isActive(): boolean {
    return this.currentSort === this.key;
  }

  onSort(): void {
    const newOrder: 'asc' | 'desc' = this.isActive
      ? (this.currentOrder === 'asc' ? 'desc' : 'asc')
      : 'asc';
    this.sortChange.emit({ key: this.key, order: newOrder });
  }
}

// ---------------------------------------------------------------
// 3. EMPTY STATE - Reusable "no data" display
// ---------------------------------------------------------------
@Component({
  selector: 'admin-empty-state',
  standalone: true,
  imports: [CommonModule, AdminIconComponent],
  template: `
    <div class="empty-state-full-wrapper min-h-[360px] py-16 px-4 flex flex-col items-center justify-center text-center my-auto">
      <div class="w-16 h-16 rounded-2xl bg-gradient-to-b from-indigo-500/15 to-slate-800/40 border border-indigo-500/25 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/5 group hover:scale-105 transition-all duration-300 mb-3">
        <ng-content select="[icon]"></ng-content>
        @if (!hasCustomIcon) {
          <admin-icon name="users" [size]="30" [strokeWidth]="1.8"></admin-icon>
        }
      </div>
      <div class="flex flex-col gap-1 max-w-md">
        <h3 class="text-base font-extrabold text-slate-100 tracking-tight">{{ title }}</h3>
        <p class="text-xs text-slate-400 leading-relaxed">{{ message }}</p>
      </div>
      @if (showAction) {
        <button (click)="action.emit()"
          class="mt-4 btn inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/50 transition-all shadow-sm">
          <admin-icon name="refresh" [size]="14" [strokeWidth]="2"></admin-icon>
          <span>{{ actionLabel }}</span>
        </button>
      }
    </div>
  `
})
export class AdminEmptyStateComponent {
  @Input() title = 'No Records Found';
  @Input() message = 'No records match your active search or filter criteria.';
  @Input() showAction = false;
  @Input() actionLabel = 'Reset Filters';
  @Input() hasCustomIcon = false;
  @Output() action = new EventEmitter<void>();
}