import { Component, Input, Output, EventEmitter, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ExportColumnDef {
  key: string;
  label: string;
  selected: boolean;
}

export interface ExportConfig {
  scope: 'all' | 'filtered' | 'selected';
  columns: string[];
  format: 'csv' | 'xlsx';
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
  @Output() closed = new EventEmitter<void>();

  exportScope: 'all' | 'filtered' | 'selected' = 'all';
  exportFormat: 'csv' | 'xlsx' = 'csv';
  columnMode: 'all' | 'visible' = 'all';
  exportColumns: ExportColumnDef[] = [];

  private _allColumns: { key: string; label: string }[] = [];
  private _visibleKeys = new Set<string>();

  constructor(private cdr: ChangeDetectorRef) {}

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

  close(): void {
    this.closed.emit();
    this.cdr.markForCheck();
  }

  doExport(): void {
    if (this.isExporting || this.selectedColumnCount === 0) return;
    const selectedCols = this.exportColumns.filter(c => c.selected).map(c => c.key);
    this.exportRequest.emit({
      scope: this.exportScope,
      columns: selectedCols,
      format: this.exportFormat
    });
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.close();
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