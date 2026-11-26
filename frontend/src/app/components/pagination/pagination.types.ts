export type PaginationVariant = 'glass' | 'pills' | 'bordered' | 'subtle';
export type PaginationColor = 'blue' | 'amber' | 'emerald' | 'purple' | 'slate';
export type PaginationSize = 'sm' | 'md' | 'lg';
export type PaginationLayout = 'between' | 'center' | 'right' | 'compact';
export type PaginationMode = 'paged' | 'load-more';

export interface PaginationConfig {
  total: number;
  page: number;
  pageSize: number;
  pageSizeOptions?: number[];
  itemName?: string;
  itemNameHindi?: string;
  isHindi?: boolean;
  variant?: PaginationVariant;
  color?: PaginationColor;
  size?: PaginationSize;
  layout?: PaginationLayout;
  mode?: PaginationMode;
  showTotal?: boolean;
  showPageSize?: boolean;
  showQuickJumper?: boolean;
  showFirstLast?: boolean;
  showPrevNext?: boolean;
  showPageNumbers?: boolean;
  autoHide?: boolean;
  autoClamp?: boolean;
  loading?: boolean;
  scrollToTop?: boolean;
  scrollToAnchor?: string;
  syncWithUrl?: boolean;
  storageKey?: string;
  boundaryCount?: number;
  siblingCount?: number;
}

export interface PaginationItemInfo {
  page: number;
  pageSize: number;
  total: number;
  start: number;
  end: number;
  totalPages: number;
}

export interface PaginationEvent {
  page: number;
  pageSize: number;
  startIndex: number;
  endIndex: number;
  total: number;
}

export type PageItemType = number | 'left-ellipsis' | 'right-ellipsis';

export interface PageItem {
  type: PageItemType;
  value?: number;
  isCurrent?: boolean;
}

/**
 * Pure utility function for 1-line client-side array pagination.
 *
 * Example:
 * ```ts
 * visibleItems = computed(() => paginate(this.allItems(), this.page(), this.pageSize()));
 * ```
 */
export function paginate<T>(items: T[] | null | undefined, page: number, pageSize: number): T[] {
  if (!items || items.length === 0) return [];
  const validPage = Math.max(1, page || 1);
  const validSize = Math.max(1, pageSize || 12);
  const start = (validPage - 1) * validSize;
  return items.slice(start, start + validSize);
}