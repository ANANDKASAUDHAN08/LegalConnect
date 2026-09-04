import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  OnInit,
  signal,
  computed,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';
import { IconComponent } from '../../../../../components/icon/icon.component';
import { SavedItemsService } from '../../../../../services/saved-items.service';

export type DirectoryFilterType = 'ALL' | 'lawyer' | 'resource' | 'helpline';

@Component({
  selector: 'app-saved-directory-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TooltipDirective, IconComponent],
  templateUrl: './saved-directory-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SavedDirectoryTabComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  public savedItemsService = inject(SavedItemsService);

  // Reactive inputs using signals for zero-recomputation memoization
  private _lawyers = signal<any[]>([]);
  private _resources = signal<any[]>([]);
  private _helplines = signal<any[]>([]);

  @Input() set savedLawyersDetails(val: any[]) { this._lawyers.set(val || []); }
  get savedLawyersDetails(): any[] { return this._lawyers(); }

  @Input() set savedResourcesDetails(val: any[]) { this._resources.set(val || []); }
  get savedResourcesDetails(): any[] { return this._resources(); }

  @Input() set savedHelplinesDetails(val: any[]) { this._helplines.set(val || []); }
  get savedHelplinesDetails(): any[] { return this._helplines(); }

  @Output() openDrawer = new EventEmitter<{ type: 'lawyer' | 'resource' | 'helpline'; data: any }>();

  // Filter & Search Signals
  activeFilter = signal<DirectoryFilterType>('ALL');
  searchQuery = signal<string>('');
  debouncedQuery = signal<string>('');

  // 200ms RxJS search debounce subject
  private searchSubject = new Subject<string>();

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(query => {
      this.debouncedQuery.set(query);
      this.cdr.markForCheck();
    });
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.searchSubject.next(value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.debouncedQuery.set('');
    this.searchSubject.next('');
    this.cdr.markForCheck();
  }

  trackById(index: number, item: any): string {
    return item._id || item.id || index.toString();
  }

  // ── High-Performance Computed Signals ──

  totalCount = computed(() => this._lawyers().length + this._resources().length + this._helplines().length);
  lawyersCount = computed(() => this._lawyers().length);
  resourcesCount = computed(() => this._resources().length);
  helplinesCount = computed(() => this._helplines().length);

  filteredLawyers = computed(() => {
    const lawyers = this._lawyers();
    const q = this.debouncedQuery().toLowerCase().trim();
    if (!q) return lawyers;
    return lawyers.filter(l =>
      l.name?.toLowerCase().includes(q) ||
      l.specializations?.some((s: string) => s.toLowerCase().includes(q)) ||
      l.city?.toLowerCase().includes(q) ||
      l.location?.toLowerCase().includes(q)
    );
  });

  filteredResources = computed(() => {
    const resources = this._resources();
    const q = this.debouncedQuery().toLowerCase().trim();
    if (!q) return resources;
    return resources.filter(r =>
      r.name?.toLowerCase().includes(q) ||
      r.type?.toLowerCase().includes(q) ||
      r.location?.toLowerCase().includes(q) ||
      r.city?.toLowerCase().includes(q)
    );
  });

  filteredHelplines = computed(() => {
    const helplines = this._helplines();
    const q = this.debouncedQuery().toLowerCase().trim();
    if (!q) return helplines;
    return helplines.filter(h =>
      h.name?.toLowerCase().includes(q) ||
      h.number?.toLowerCase().includes(q) ||
      h.category?.toLowerCase().includes(q)
    );
  });

  activeTotalCount = computed(() => {
    const filter = this.activeFilter();
    if (filter === 'lawyer') return this.filteredLawyers().length;
    if (filter === 'resource') return this.filteredResources().length;
    if (filter === 'helpline') return this.filteredHelplines().length;
    return this.filteredLawyers().length + this.filteredResources().length + this.filteredHelplines().length;
  });

  setFilter(filter: DirectoryFilterType): void {
    this.activeFilter.set(filter);
  }

  getDirectionsUrl(item: any): string {
    const query = encodeURIComponent(`${item.name} ${item.location || item.city || ''}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }
}