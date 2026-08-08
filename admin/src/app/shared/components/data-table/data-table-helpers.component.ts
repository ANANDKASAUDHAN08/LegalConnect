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

// ---------------------------------------------------------------
// 1. SEARCH INPUT - Debounced search with built-in icon & XSS protection
// ---------------------------------------------------------------
@Component({
  selector: 'admin-search-input',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective],
  template: `
    <div class="search-box flex-1 relative" [style.min-width]="minWidth" [style.max-width]="maxWidth">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
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
  imports: [CommonModule, TooltipDirective],
  template: `
    <th class="p-2.5 whitespace-nowrap cursor-pointer group hover:text-sky-300 transition-colors select-none"
        (click)="onSort()"
        [adminTooltip]="'Click to sort by ' + label"
        tooltipPosition="top">
      <div class="flex items-center gap-1.5">
        <span [class.text-sky-400]="isActive">{{ label }}</span>
        @if (isActive) {
          @if (currentOrder === 'asc') {
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
              class="text-sky-400 flex-shrink-0">
              <path d="M12 19V5M5 12l7-7 7 7"></path>
            </svg>
          } @else {
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
              class="text-sky-400 flex-shrink-0">
              <path d="M12 5v14M5 12l7 7 7-7"></path>
            </svg>
          }
        } @else {
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            class="text-slate-600 group-hover:text-sky-400/70 transition-colors flex-shrink-0">
            <path d="M7 15l5 5 5-5M7 9l5-5 5 5"></path>
          </svg>
        }
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
  imports: [CommonModule],
  template: `
    <div class="empty-state-full-wrapper min-h-[360px] py-16 px-4 flex flex-col items-center justify-center text-center my-auto">
      <div class="w-16 h-16 rounded-2xl bg-gradient-to-b from-indigo-500/15 to-slate-800/40 border border-indigo-500/25 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/5 group hover:scale-105 transition-all duration-300 mb-3">
        <ng-content select="[icon]"></ng-content>
        @if (!hasCustomIcon) {
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        }
      </div>
      <div class="flex flex-col gap-1 max-w-md">
        <h3 class="text-base font-extrabold text-slate-100 tracking-tight">{{ title }}</h3>
        <p class="text-xs text-slate-400 leading-relaxed">{{ message }}</p>
      </div>
      @if (showAction) {
        <button (click)="action.emit()"
          class="mt-4 btn inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/50 transition-all shadow-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <path d="M3 3v5h5"></path>
          </svg>
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