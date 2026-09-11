import { Injectable, inject } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { TableSelection } from '../../../core/utils/table.utils';
import { ModerationReport } from '../../../core/services/admin-moderation.service';
import { ColumnDef } from '../../../shared/components/column-customizer/column-customizer.component';
import { SelectOption } from '../../../shared/components/select/select.component';

export interface ModerationFilterState {
  searchQuery: string;
  selectedStatus: string;
  selectedType: string;
  selectedSeverity: string;
  startDate: string;
  endDate: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  page: number;
  limit: number;
  viewMode?: 'table' | 'split';
}

export interface FilterPill {
  key: 'status' | 'type' | 'severity' | 'search' | 'dateRange' | 'sort';
  label: string;
}

@Injectable()
export class ModerationStateService {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /** Multi-selection state for batch moderation actions */
  readonly selection = new TableSelection<number>();

  /** Internal URL sync lock to prevent infinite feedback loops with Angular router */
  isInternalUrlSync = false;

  // Workspace View Mode
  viewMode: 'table' | 'split' = 'table';

  // Filters
  selectedStatus = '';
  selectedType = '';
  selectedSeverity = '';
  startDate = '';
  endDate = '';
  searchQuery = '';
  sortBy = 'createdAt';
  sortOrder: 'asc' | 'desc' = 'desc';

  // Pagination
  pagination = { page: 1, limit: 10, total: 0, pages: 1 };

  // Table Column Definitions & Visibility
  readonly columnDefs: ColumnDef[] = [
    { key: 'select', label: 'Select' },
    { key: 'reportRef', label: 'Ref Ticket' },
    { key: 'targetEntity', label: 'Target Entity' },
    { key: 'reasonSeverity', label: 'Reason & Severity' },
    { key: 'reporter', label: 'Reporter & IP' },
    { key: 'duplicates', label: 'Duplicates & Brigading' },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Reported At' },
    { key: 'actions', label: 'Quick Actions' }
  ];

  columnVisibility: Record<string, boolean> = {
    select: true,
    reportRef: true,
    targetEntity: true,
    reasonSeverity: true,
    reporter: true,
    duplicates: true,
    status: true,
    createdAt: true,
    actions: true
  };

  get selectedReportIds(): Set<number> {
    return this.selection.selectedIds;
  }

  get selectedCount(): number {
    return this.selection.size;
  }

  isAllSelected(reports: ModerationReport[]): boolean {
    return this.selection.isAllSelected(reports.map(r => r.id));
  }

  isPartiallySelected(reports: ModerationReport[]): boolean {
    const ids = reports.map(r => r.id);
    return ids.some(id => this.selection.isSelected(id)) && !this.selection.isAllSelected(ids);
  }

  toggleSelect(id: number): void {
    this.selection.toggle(id);
  }

  toggleSelectAll(reports: ModerationReport[]): void {
    this.selection.toggleAll(reports.map(r => r.id));
  }

  clearSelection(): void {
    this.selection.clear();
  }

  // Column Visibility Controls
  get isNoColumnsVisible(): boolean {
    return Object.values(this.columnVisibility).every(v => !v);
  }

  resetColumnVisibility(): void {
    const reset: Record<string, boolean> = {};
    this.columnDefs.forEach(c => reset[c.key] = true);
    this.columnVisibility = reset;
  }

  // Sorting Mechanics (3-State cycling: asc -> desc -> default createdAt desc)
  get isCustomSortActive(): boolean {
    return this.sortBy !== 'createdAt' || this.sortOrder !== 'desc';
  }

  toggleSort(column: string): void {
    if (this.sortBy === column) {
      if (column === 'createdAt') {
        this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
      } else {
        const initialOrder = (column === 'reportRef') ? 'desc' : 'asc';
        if (this.sortOrder === initialOrder) {
          this.sortOrder = initialOrder === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortBy = 'createdAt';
          this.sortOrder = 'desc';
        }
      }
    } else {
      this.sortBy = column;
      this.sortOrder = (column === 'createdAt' || column === 'reportRef') ? 'desc' : 'asc';
    }
    this.pagination.page = 1;
  }

  clearSort(): void {
    this.sortBy = 'createdAt';
    this.sortOrder = 'desc';
    this.pagination.page = 1;
  }

  getColumnSortLabel(column: string): string {
    switch (column) {
      case 'reportRef': return 'Ref Ticket';
      case 'targetType': return 'Target Entity';
      case 'severity': return 'Severity';
      case 'duplicateCount': return 'Duplicates';
      case 'status': return 'Status';
      case 'createdAt': return 'Reported At';
      default: return column;
    }
  }

  getSortTooltip(column: string, label: string): string {
    if (this.sortBy !== column) return `Click to sort by ${label}`;
    if (column === 'createdAt') {
      return this.sortOrder === 'desc' ? 'Sorted newest first • Click to sort oldest first' : 'Sorted oldest first • Click to restore newest first';
    }
    const initialOrder = (column === 'reportRef') ? 'desc' : 'asc';
    return this.sortOrder === initialOrder
      ? `Sorted ${this.sortOrder.toUpperCase()} • Click to reverse direction`
      : `Sorted ${this.sortOrder.toUpperCase()} • Click to reset to default order`;
  }

  // Filter Pills & Filter Reset Logic
  get hasQueryFilter(): boolean {
    return !!(this.searchQuery || this.selectedStatus || this.selectedType || this.selectedSeverity || this.startDate || this.endDate || this.isCustomSortActive);
  }

  getActiveFilterPills(typeOptions: SelectOption[]): FilterPill[] {
    const pills: FilterPill[] = [];
    if (this.searchQuery) pills.push({ key: 'search', label: `Search: "${this.searchQuery}"` });
    if (this.selectedStatus) pills.push({ key: 'status', label: `Status: ${this.selectedStatus}` });
    if (this.selectedType) {
      const opt = typeOptions.find(o => o.value === this.selectedType);
      pills.push({ key: 'type', label: `Entity: ${opt ? opt.label : this.selectedType}` });
    }
    if (this.selectedSeverity) pills.push({ key: 'severity', label: `Severity: ${this.selectedSeverity}` });
    if (this.startDate || this.endDate) pills.push({ key: 'dateRange', label: `Date: ${this.startDate || '...'} to ${this.endDate || '...'}` });
    if (this.isCustomSortActive) {
      const dir = this.sortOrder === 'asc' ? '↑ Asc' : '↓ Desc';
      pills.push({ key: 'sort', label: `Sort: ${this.getColumnSortLabel(this.sortBy)} (${dir})` });
    }
    return pills;
  }

  removeFilter(key: 'status' | 'type' | 'severity' | 'search' | 'dateRange' | 'sort'): void {
    if (key === 'status') this.selectedStatus = '';
    if (key === 'type') this.selectedType = '';
    if (key === 'severity') this.selectedSeverity = '';
    if (key === 'search') this.searchQuery = '';
    if (key === 'dateRange') { this.startDate = ''; this.endDate = ''; }
    if (key === 'sort') { this.clearSort(); return; }
    this.pagination.page = 1;
  }

  resetAllFilters(): void {
    this.selectedStatus = '';
    this.selectedType = '';
    this.selectedSeverity = '';
    this.searchQuery = '';
    this.startDate = '';
    this.endDate = '';
    this.sortBy = 'createdAt';
    this.sortOrder = 'desc';
    this.pagination.page = 1;
  }

  // State Hydration from URL Parameters
  hydrateFromParams(params: Params, isInitial: boolean): void {
    this.searchQuery = typeof params['search'] === 'string' ? params['search'] : '';
    this.selectedStatus = typeof params['status'] === 'string' ? params['status'] : '';
    this.selectedType = typeof params['targetType'] === 'string' ? params['targetType'] : '';
    this.selectedSeverity = typeof params['severity'] === 'string' ? params['severity'] : '';
    this.startDate = typeof params['startDate'] === 'string' ? params['startDate'] : '';
    this.endDate = typeof params['endDate'] === 'string' ? params['endDate'] : '';
    this.sortBy = typeof params['sortBy'] === 'string' && params['sortBy'] ? params['sortBy'] : 'createdAt';
    this.sortOrder = (params['sortOrder'] === 'asc' || params['sortOrder'] === 'desc') ? params['sortOrder'] : 'desc';

    const p = parseInt(params['page'], 10);
    this.pagination.page = !isNaN(p) && p > 0 ? p : 1;

    const l = parseInt(params['limit'], 10);
    this.pagination.limit = !isNaN(l) && l > 0 ? l : 10;

    if (params['viewMode'] === 'table' || params['viewMode'] === 'split') {
      this.viewMode = params['viewMode'];
    } else if (isInitial) {
      const savedMode = localStorage.getItem('lc_mod_view_mode') as 'table' | 'split';
      if (savedMode === 'table' || savedMode === 'split') {
        this.viewMode = savedMode;
      }
    }
  }

  // URL Comparison and Param Serialization
  areParamObjectsEqual(a: Record<string, unknown>, b: Params): boolean {
    const keysA = Object.keys(a).filter(k => a[k] !== undefined && a[k] !== '' && a[k] !== null);
    const keysB = Object.keys(b).filter(k => b[k] !== undefined && b[k] !== '' && b[k] !== null);

    if (keysA.length !== keysB.length) return false;
    return keysA.every(k => String(a[k]) === String(b[k]));
  }

  buildCleanUrlParams(filters: ModerationFilterState, activeInspectId: number | null): Record<string, string> {
    const p: Record<string, string> = {};
    if (filters.searchQuery) p['search'] = filters.searchQuery;
    if (filters.selectedStatus) p['status'] = filters.selectedStatus;
    if (filters.selectedType) p['targetType'] = filters.selectedType;
    if (filters.selectedSeverity) p['severity'] = filters.selectedSeverity;
    if (filters.startDate) p['startDate'] = filters.startDate;
    if (filters.endDate) p['endDate'] = filters.endDate;
    if (filters.sortBy && filters.sortBy !== 'createdAt') p['sortBy'] = filters.sortBy;
    if (filters.sortOrder && filters.sortOrder !== 'desc') p['sortOrder'] = filters.sortOrder;
    if (filters.page > 1) p['page'] = String(filters.page);
    if (filters.limit !== 10) p['limit'] = String(filters.limit);
    if (filters.viewMode === 'split') p['viewMode'] = 'split';
    if (activeInspectId !== null && activeInspectId > 0) p['inspect'] = String(activeInspectId);
    return p;
  }

  getCleanParams(activeInspectId: number | null): Record<string, string> {
    return this.buildCleanUrlParams({
      searchQuery: this.searchQuery.trim(),
      selectedStatus: this.selectedStatus,
      selectedType: this.selectedType,
      selectedSeverity: this.selectedSeverity,
      startDate: this.startDate,
      endDate: this.endDate,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder,
      page: this.pagination.page,
      limit: this.pagination.limit,
      viewMode: this.viewMode
    }, activeInspectId);
  }

  syncToUrl(filters: ModerationFilterState, activeInspectId: number | null): void {
    const cleanParams = this.buildCleanUrlParams(filters, activeInspectId);
    const currentParams = this.route.snapshot.queryParams;

    if (this.areParamObjectsEqual(cleanParams, currentParams)) {
      return;
    }

    this.isInternalUrlSync = true;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: cleanParams,
      queryParamsHandling: '',
      replaceUrl: true
    }).then(() => {
      setTimeout(() => {
        this.isInternalUrlSync = false;
      }, 50);
    });
  }
}