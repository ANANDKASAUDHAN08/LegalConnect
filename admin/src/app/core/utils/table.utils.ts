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