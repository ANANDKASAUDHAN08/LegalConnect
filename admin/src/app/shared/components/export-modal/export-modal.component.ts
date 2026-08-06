import { Component, Input, Output, EventEmitter, HostListener, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

export interface ExportColumnDef {
  key: string;
  label: string;
  selected: boolean;
}

export interface ExportConfig {
  scope: 'all' | 'filtered' | 'selected';
  columns: string[];
  format: 'csv' | 'json' | 'xlsx';
}

export function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return '';

  const parseDate = (s?: string | null) => {
    if (!s) return null;
    const d = new Date(s.includes('T') ? s : s + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  };

  const dStart = parseDate(start);
  const dEnd = parseDate(end);

  if (dStart && dEnd) {
    const sIso = dStart.toISOString().slice(0, 10);
    const eIso = dEnd.toISOString().slice(0, 10);

    if (sIso === eIso) {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (sIso === todayStr) {
        return `Today (${dStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
      }
      return dStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    if (dStart.getMonth() === dEnd.getMonth() && dStart.getFullYear() === dEnd.getFullYear()) {
      const month = dStart.toLocaleDateString('en-US', { month: 'short' });
      return `${month} ${dStart.getDate()} – ${dEnd.getDate()}, ${dStart.getFullYear()}`;
    }

    if (dStart.getFullYear() === dEnd.getFullYear()) {
      const startStr = dStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = dEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${startStr} – ${endStr}, ${dStart.getFullYear()}`;
    }

    const startStr = dStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const endStr = dEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }

  if (dStart) {
    return `From ${dStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  if (dEnd) {
    return `Until ${dEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  return '';
}

@Component({
  selector: 'admin-export-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './export-modal.component.html',
  styleUrls: ['./export-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExportModalComponent {
  private route = inject(ActivatedRoute, { optional: true });

  private _isOpen = false;
  @Input() set isOpen(val: boolean) {
    this._isOpen = val;
    if (val) {
      if (this.selectedCount > 0) {
        this.exportScope = 'selected';
      } else if (this.isFilterActive) {
        this.exportScope = 'filtered';
      } else {
        this.exportScope = 'all';
      }
      this.selectAllColumns(true);
    }
    this.cdr.markForCheck();
  }
  get isOpen(): boolean {
    return this._isOpen;
  }

  @Input() isExporting = false;
  @Input() totalRecords = 0;
  @Input() filteredCount = 0;
  @Input() selectedCount = 0;
  @Input() isFilterActive = false;
  @Input() dateRangeLabel = '';

  get computedDateRangeLabel(): string {
    if (this.dateRangeLabel) return this.dateRangeLabel;

    const params = this.route?.snapshot?.queryParams;
    return formatDateRange(params?.['startDate'], params?.['endDate']);
  }

  @Input() set columns(val: { key: string; label: string }[]) {
    this._allColumns = val || [];
    this.rebuildExportColumns();
    this.cdr.markForCheck();
  }

  @Input() set visibleColumnKeys(val: string[]) {
    this._visibleKeys = new Set(val || []);
    this.cdr.markForCheck();
  }

  @Output() exportRequest = new EventEmitter<ExportConfig>();
  @Output() exportConfirm = new EventEmitter<ExportConfig>();
  @Output() closed = new EventEmitter<void>();

  exportScope: 'all' | 'filtered' | 'selected' = 'all';
  exportFormat: 'csv' | 'json' | 'xlsx' = 'csv';
  columnMode: 'all' | 'visible' = 'all';
  exportColumns: ExportColumnDef[] = [];

  private _allColumns: { key: string; label: string }[] = [];
  private _visibleKeys = new Set<string>();

  constructor(private cdr: ChangeDetectorRef) {
    try {
      const savedFormat = localStorage.getItem('lc_export_format') as any;
      if (savedFormat && ['csv', 'json', 'xlsx'].includes(savedFormat)) {
        this.exportFormat = savedFormat;
      }
    } catch { }
  }

  get selectedColumnCount(): number {
    return this.exportColumns.filter(c => c.selected).length;
  }

  get exportRowCount(): number {
    if (this.exportScope === 'selected') return this.selectedCount;
    if (this.exportScope === 'filtered' && this.isFilterActive) return this.filteredCount || this.totalRecords;
    return this.totalRecords;
  }

  selectAllColumns(select: boolean): void {
    this.exportColumns.forEach(c => c.selected = select);
    this.cdr.markForCheck();
  }

  toggleColumnMode(): void {
    if (this.columnMode === 'all') {
      this.columnMode = 'visible';
      if (this._visibleKeys.size > 0) {
        this.exportColumns.forEach(c => c.selected = this._visibleKeys.has(c.key));
      }
    } else {
      this.columnMode = 'all';
      this.exportColumns.forEach(c => c.selected = true);
    }
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.closed.emit();
    this.cdr.markForCheck();
  }

  doExport(): void {
    if (this.isExporting || this.selectedColumnCount === 0) return;
    try {
      localStorage.setItem('lc_export_format', this.exportFormat);
    } catch { }

    const selectedCols = this.exportColumns.filter(c => c.selected).map(c => c.key);
    const config: ExportConfig = {
      scope: this.exportScope,
      columns: selectedCols,
      format: this.exportFormat
    };
    this.exportRequest.emit(config);
    this.exportConfirm.emit(config);
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.closeModal();
    }
  }

  @HostListener('document:keydown.enter', ['$event'])
  onEnter(event: KeyboardEvent): void {
    if (this.isOpen && !this.isExporting && this.selectedColumnCount > 0) {
      event.preventDefault();
      this.doExport();
    }
  }

  private rebuildExportColumns(): void {
    if (!this._allColumns) return;
    this.exportColumns = this._allColumns.map(c => ({
      key: c.key,
      label: c.label,
      selected: true
    }));
  }
}