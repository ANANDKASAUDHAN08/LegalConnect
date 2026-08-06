/**
 * Shared Table Utilities
 * Contains: TableSelection, getDatePresetRange, setupKeyboardNav
 * Used across: Users, Lawyers, Consultations pages
 */

// --- Multi-Row Selection Helper ------------------------------------------
export class TableSelection<T = number> {
  readonly selectedIds = new Set<T>();

  toggle(id: T): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  toggleAll(allIds: T[]): void {
    if (this.isAllSelected(allIds)) {
      this.selectedIds.clear();
    } else {
      allIds.forEach(id => this.selectedIds.add(id));
    }
  }

  isAllSelected(allIds: T[]): boolean {
    return allIds.length > 0 && allIds.every(id => this.selectedIds.has(id));
  }

  isSelected(id: T): boolean {
    return this.selectedIds.has(id);
  }

  get size(): number {
    return this.selectedIds.size;
  }

  get isEmpty(): boolean {
    return this.selectedIds.size === 0;
  }

  toArray(): T[] {
    return Array.from(this.selectedIds);
  }

  clear(): void {
    this.selectedIds.clear();
  }

  delete(id: T): void {
    this.selectedIds.delete(id);
  }

  /**
   * Retains only IDs that are present in visibleIds array.
   * Eliminates (unselects) any IDs that have been filtered out or hidden.
   * Type-safe with String() coercion to handle numeric vs string ID types seamlessly.
   */
  retainOnly(visibleIds: T[]): void {
    const visibleSet = new Set(visibleIds.map(id => String(id)));
    for (const id of Array.from(this.selectedIds)) {
      if (!visibleSet.has(String(id))) {
        this.selectedIds.delete(id);
      }
    }
  }
}

// --- Date Preset Range Helper --------------------------------------------
export interface DateRange {
  start: string;
  end: string;
}

export function getDatePresetRange(preset: 'today' | '7days' | '30days' | 'thisMonth'): DateRange {
  const today = new Date();
  const endDateStr = today.toISOString().split('T')[0];
  let startDateStr = '';

  if (preset === 'today') {
    startDateStr = endDateStr;
  } else if (preset === '7days') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    startDateStr = d.toISOString().split('T')[0];
  } else if (preset === '30days') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    startDateStr = d.toISOString().split('T')[0];
  } else if (preset === 'thisMonth') {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    startDateStr = d.toISOString().split('T')[0];
  }

  return { start: startDateStr, end: endDateStr };
}

// --- Keyboard Navigation Helper ------------------------------------------
export interface KeyboardNavConfig {
  getListLength: () => number;
  getFocusedIndex: () => number;
  setFocusedIndex: (idx: number) => void;
  onEnter?: (index: number) => void;
  onEscape?: () => void;
  scrollToRow?: (index: number) => void;
}

export function handleTableKeyboardNav(event: KeyboardEvent, config: KeyboardNavConfig): void {
  const target = event.target as HTMLElement;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
    return;
  }

  const listLen = config.getListLength();

  if (event.key === 'j' || event.key === 'ArrowDown') {
    event.preventDefault();
    if (listLen > 0) {
      const newIdx = Math.min(config.getFocusedIndex() + 1, listLen - 1);
      config.setFocusedIndex(newIdx);
      config.scrollToRow?.(newIdx);
    }
  } else if (event.key === 'k' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (listLen > 0) {
      const newIdx = Math.max(config.getFocusedIndex() - 1, 0);
      config.setFocusedIndex(newIdx);
      config.scrollToRow?.(newIdx);
    }
  } else if (event.key === 'Enter') {
    const idx = config.getFocusedIndex();
    if (idx >= 0 && idx < listLen) {
      event.preventDefault();
      config.onEnter?.(idx);
    }
  } else if (event.key === 'Escape') {
    config.onEscape?.();
  }
}

// --- Universal Sort Comparator Helper ------------------------------------
export function sortByField<T>(
  list: T[],
  sortBy: string,
  sortOrder: 'asc' | 'desc',
  customAccessors?: Record<string, (item: T) => any>
): T[] {
  if (!list || list.length === 0) return [];
  return [...list].sort((a: any, b: any) => {
    let valA: any = '';
    let valB: any = '';

    if (customAccessors && customAccessors[sortBy]) {
      valA = customAccessors[sortBy](a);
      valB = customAccessors[sortBy](b);
    } else if (sortBy === 'createdAt' || sortBy === 'submitted' || sortBy === 'newest' || sortBy === 'oldest') {
      valA = new Date(a.createdAt || a.createdAtFormatted || 0).getTime();
      valB = new Date(b.createdAt || b.createdAtFormatted || 0).getTime();
    } else {
      valA = a[sortBy] ?? '';
      valB = b[sortBy] ?? '';
    }

    if (typeof valA === 'string') {
      valA = (valA || '').toLowerCase();
      valB = (valB || '').toString().toLowerCase();
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });
}

// --- Universal Query Params Builder Helper --------------------------------
export function buildQueryParams(
  state: Record<string, any>,
  defaults: Record<string, any> = {}
): Record<string, any> {
  const queryParams: Record<string, any> = {};

  Object.keys(state).forEach(key => {
    const val = state[key];
    const defaultVal = defaults[key];

    if (val !== undefined && val !== null && val !== '' && val !== defaultVal) {
      queryParams[key] = val;
    }
  });

  return queryParams;
}