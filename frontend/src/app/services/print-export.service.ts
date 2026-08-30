import { Injectable, signal, computed } from '@angular/core';

export type ExportFormat = 'pdf' | 'csv' | 'json' | 'txt';

export interface ExportScopeOption {
  id: string;
  label: string;
  count?: number;
  description?: string;
}

export interface ExportExecutionParams {
  format: ExportFormat;
  scope: string;
  watermark: string;
  includeQr: boolean;
  includeCharts: boolean;
  tableDensity: 'standard' | 'compact';
}

export interface ExportModalConfig {
  title: string;
  subtitle?: string;
  formats?: ExportFormat[];
  scopes?: ExportScopeOption[];
  defaultScope?: string;
  allowWatermark?: boolean;
  defaultWatermark?: string;
  allowQrToggle?: boolean;
  defaultIncludeQr?: boolean;
  allowChartsToggle?: boolean;
  defaultIncludeCharts?: boolean;
  onExport: (params: ExportExecutionParams) => Promise<void> | void;
}

@Injectable({
  providedIn: 'root'
})
export class PrintExportService {
  // Reactive Signals for State
  private _isOpen = signal(false);
  private _config = signal<ExportModalConfig | null>(null);
  private _isExporting = signal(false);

  // Public Readonly Signals
  readonly isOpen = this._isOpen.asReadonly();
  readonly config = this._config.asReadonly();
  readonly isExporting = this._isExporting.asReadonly();

  /**
   * Open the Universal Print & Export Hub with page-specific configuration.
   */
  open(config: ExportModalConfig): void {
    this._config.set(config);
    this._isExporting.set(false);
    this._isOpen.set(true);
  }

  /**
   * Close the modal and reset state.
   */
  close(): void {
    if (this._isExporting()) return; // Prevent abrupt close during async download
    this._isOpen.set(false);
    setTimeout(() => {
      this._config.set(null);
    }, 200);
  }

  /**
   * Execute export action with given parameters.
   */
  async executeExport(params: ExportExecutionParams): Promise<void> {
    const currentConfig = this._config();
    if (!currentConfig || !currentConfig.onExport) return;

    try {
      this._isExporting.set(true);
      await Promise.resolve(currentConfig.onExport(params));
      this._isExporting.set(false);
      this._isOpen.set(false);
      setTimeout(() => {
        this._config.set(null);
      }, 200);
    } catch (err) {
      this._isExporting.set(false);
      console.error('[PrintExportService] Export failed:', err);
      throw err;
    }
  }

  /**
   * Quick helper to convert an array of objects into a CSV string.
   */
  convertToCsv(data: Record<string, any>[], headers?: { key: string; label: string }[]): string {
    if (!data || data.length === 0) return '';

    const cols = headers || Object.keys(data[0]).map(k => ({ key: k, label: k }));
    const headerRow = cols.map(c => `"${String(c.label).replace(/"/g, '""')}"`).join(',');

    const rows = data.map(item => {
      return cols.map(c => {
        const val = item[c.key];
        if (val === null || val === undefined) return '""';
        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    });

    return [headerRow, ...rows].join('\r\n');
  }
}