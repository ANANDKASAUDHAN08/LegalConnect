import { Injectable, signal, inject } from '@angular/core';
import type { PrintConfig } from './print.service';
import { SnackbarService } from './snackbar.service';

/* ═══════════════════════════════════════════════════════════════════
   TYPE EXPORTS
   ═══════════════════════════════════════════════════════════════════ */

export type ExportFormat = 'pdf' | 'csv' | 'json' | 'txt';
export type PaperSize = 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5';
export type PageOrientation = 'portrait' | 'landscape';
export type MarginPreset = 'default' | 'none' | 'minimum' | 'narrow' | 'wide' | 'custom';
export type PrintQuality = 'draft' | 'standard' | 'high';
export type ColorMode = 'color' | 'grayscale';

/* ═══════════════════════════════════════════════════════════════════
   PAPER SIZE DIMENSIONS (mm)
   ═══════════════════════════════════════════════════════════════════ */

export const PAPER_SIZES: Record<PaperSize, { width: number; height: number; label: string; region: string }> = {
  'A4': { width: 210, height: 297, label: 'A4 (210 × 297 mm)', region: 'International' },
  'Letter': { width: 215.9, height: 279.4, label: 'US Letter (8.5 × 11 in)', region: 'North America' },
  'Legal': { width: 215.9, height: 355.6, label: 'US Legal (8.5 × 14 in)', region: 'North America' },
  'A3': { width: 297, height: 420, label: 'A3 (297 × 420 mm)', region: 'International' },
  'A5': { width: 148, height: 210, label: 'A5 (148 × 210 mm)', region: 'International' },
};

export const MARGIN_PRESETS: Record<string, { top: number; right: number; bottom: number; left: number; label: string; description: string }> = {
  'default': { top: 8, right: 10, bottom: 8, left: 10, label: 'Default', description: 'Optimized modern document margins' },
  'none': { top: 0, right: 0, bottom: 0, left: 0, label: 'None', description: 'Edge-to-edge (printer limits apply)' },
  'minimum': { top: 4, right: 4, bottom: 4, left: 4, label: 'Minimum', description: 'Smallest printable margins' },
  'narrow': { top: 5, right: 6, bottom: 5, left: 6, label: 'Narrow', description: 'Compact spacing for data-dense output' },
  'wide': { top: 20, right: 20, bottom: 20, left: 20, label: 'Wide', description: 'Extra spacing for binding & notes' },
  'custom': { top: 8, right: 10, bottom: 8, left: 10, label: 'Custom', description: 'Set your own margins (mm)' },
};

/* ═══════════════════════════════════════════════════════════════════
   QUICK PRINT PRESETS
   Real-world print dialogs overwhelm users with options.
   One-click presets solve the most common scenarios instantly.
   ═══════════════════════════════════════════════════════════════════ */

export interface PrintPreset {
  id: string;
  label: string;
  icon: string;
  description: string;
  settings: Partial<ExportExecutionParams>;
}

export const PRINT_PRESETS: PrintPreset[] = [
  {
    id: 'official',
    label: 'Official',
    icon: 'shield',
    description: 'Court-grade institutional document',
    settings: {
      paperSize: 'A4', orientation: 'portrait', margins: 'default', scale: 100,
      colorMode: 'color', printQuality: 'high', showHeaderFooter: true,
      showBackgroundGraphics: true, watermark: 'OFFICIAL COPY',
      classification: 'OFFICIAL COPY',
    }
  },
  {
    id: 'draft',
    label: 'Draft',
    icon: 'edit',
    description: 'Internal review copy',
    settings: {
      paperSize: 'A4', orientation: 'portrait', margins: 'default', scale: 100,
      colorMode: 'grayscale', printQuality: 'draft', showHeaderFooter: true,
      showBackgroundGraphics: false, watermark: 'DRAFT',
      classification: 'DRAFT',
    }
  },
  {
    id: 'eco',
    label: 'Save Ink',
    icon: 'zap',
    description: 'Maximum economy print',
    settings: {
      paperSize: 'A4', orientation: 'portrait', margins: 'narrow', scale: 90,
      colorMode: 'grayscale', printQuality: 'draft', showHeaderFooter: false,
      showBackgroundGraphics: false, watermark: 'NONE',
      tableDensity: 'compact',
    }
  },
  {
    id: 'legal-brief',
    label: 'Legal Brief',
    icon: 'scale',
    description: 'Wide margins for court filing',
    settings: {
      paperSize: 'Legal', orientation: 'portrait', margins: 'wide', scale: 100,
      colorMode: 'color', printQuality: 'high', showHeaderFooter: true,
      showBackgroundGraphics: true, watermark: 'ATTORNEY-CLIENT PRIVILEGED',
      classification: 'ATTORNEY-CLIENT PRIVILEGED',
    }
  },
];

/* ═══════════════════════════════════════════════════════════════════
   INTERFACES
   ═══════════════════════════════════════════════════════════════════ */

export interface ExportScopeOption {
  id: string;
  label: string;
  count?: number;
  description?: string;
}

export interface ExportExecutionParams {
  /* Core (existing) */
  format: ExportFormat;
  scope: string;
  watermark: string;
  includeQr: boolean;
  includeCharts: boolean;
  includeReviews?: boolean;
  tableDensity: 'standard' | 'compact';

  /* Page Setup */
  paperSize: PaperSize;
  orientation: PageOrientation;
  margins: MarginPreset;
  customMargins?: { top: number; right: number; bottom: number; left: number };
  scale: number;

  /* Appearance */
  colorMode: ColorMode;
  printQuality: PrintQuality;
  showHeaderFooter: boolean;
  showBackgroundGraphics: boolean;

  /* Range & Copies */
  pageRange: 'all' | 'custom';
  customPageRange?: string;
  copies: number;
  collate: boolean;
  duplexPrint: boolean;

  /* Identity */
  fileName: string;
  classification: string;
}

export interface ExportModalConfig {
  title: string;
  subtitle?: string;
  formats?: ExportFormat[];
  scopes?: ExportScopeOption[];
  defaultScope?: string;
  scopeTitle?: string;
  scopeUnit?: string;
  allowWatermark?: boolean;
  defaultWatermark?: string;
  allowQrToggle?: boolean;
  defaultIncludeQr?: boolean;
  allowChartsToggle?: boolean;
  defaultIncludeCharts?: boolean;
  allowReviewsToggle?: boolean;
  defaultIncludeReviews?: boolean;
  reviewsCount?: number;
  onExport: (params: ExportExecutionParams) => Promise<void> | void;

  /* Page setup defaults */
  defaultPaperSize?: PaperSize;
  defaultOrientation?: PageOrientation;
  defaultMargins?: MarginPreset;
  defaultScale?: number;

  /* Appearance defaults */
  defaultColorMode?: ColorMode;
  defaultPrintQuality?: PrintQuality;
  defaultShowHeaderFooter?: boolean;
  defaultShowBackgroundGraphics?: boolean;

  /* Feature visibility — all default to true for PDF, false for other formats */
  showPageSetup?: boolean;
  showAppearance?: boolean;
  showPrintRange?: boolean;
  showPresets?: boolean;

  /* Identity */
  defaultFileName?: string;

  /**
   * A fully-built document to preview. Set automatically when a page calls
   * PrintService.print() directly; hub-style callers get a preview via capture.
   * Can also be a dynamic builder function that receives current ExportExecutionParams.
   */
  previewConfig?: PrintConfig | ((params: ExportExecutionParams) => PrintConfig);
}

/** Params handed to PrintService while the dialog is executing a print. */
export type ActivePrintParams = ExportExecutionParams & { applyWatermark: boolean };

/* ═══════════════════════════════════════════════════════════════════
   SMART DEFAULTS
   ═══════════════════════════════════════════════════════════════════ */

/** Regions that use US Letter by default (everyone else uses A4). */
const LETTER_REGIONS = ['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE', 'GT', 'CR', 'PA', 'DO', 'PR', 'SV', 'NI', 'HN', 'BO'];

/**
 * Wrong paper size is the #1 cause of clipped / mis-scaled prints.
 * Pick the user's regional default instead of hard-coding A4.
 */
export function detectRegionalPaperSize(): PaperSize {
  try {
    const lang = (typeof navigator !== 'undefined' && (navigator.language || (navigator.languages || [])[0])) || '';
    const region = lang.split('-')[1]?.toUpperCase();
    return region && LETTER_REGIONS.includes(region) ? 'Letter' : 'A4';
  } catch {
    return 'A4';
  }
}

export const DEFAULT_PRINT_SETTINGS: Omit<ExportExecutionParams, 'format' | 'scope' | 'watermark' | 'includeQr' | 'includeCharts' | 'fileName' | 'classification'> = {
  tableDensity: 'standard',
  paperSize: 'A4',
  orientation: 'portrait',
  margins: 'default',
  scale: 75,
  colorMode: 'color',
  printQuality: 'standard',
  showHeaderFooter: true,
  showBackgroundGraphics: true,
  pageRange: 'all',
  copies: 1,
  collate: true,
  duplexPrint: false,
};

/** Settings worth remembering between prints (like Chrome does). One-off choices are excluded. */
const REMEMBERED_KEYS: (keyof ExportExecutionParams)[] = [
  'paperSize', 'orientation', 'margins', 'customMargins', 'scale',
  'colorMode', 'printQuality', 'showHeaderFooter', 'showBackgroundGraphics', 'tableDensity',
];

const STORAGE_KEY = 'lc-print-settings';

/* ═══════════════════════════════════════════════════════════════════
   PRINT EXPORT SERVICE
   ═══════════════════════════════════════════════════════════════════ */

@Injectable({
  providedIn: 'root'
})
export class PrintExportService {
  private snackbar = inject(SnackbarService);

  // Reactive Signals for State
  private _isOpen = signal(false);
  private _config = signal<ExportModalConfig | null>(null);
  private _isExporting = signal(false);

  // Public Readonly Signals
  readonly isOpen = this._isOpen.asReadonly();
  readonly config = this._config.asReadonly();
  readonly isExporting = this._isExporting.asReadonly();

  /* Non-reactive coordination state shared with PrintService */
  private _activeParams: ActivePrintParams | null = null;
  private _captureDepth = 0;
  private _captured: PrintConfig | null = null;
  private _quickPrintArmedAt = 0;

  /**
   * Open the Universal Print & Export Hub with page-specific configuration.
   */
  open(config: ExportModalConfig): void {
    // Ctrl+Shift+P: skip the dialog entirely and print with remembered settings
    if (this.consumeQuickPrint()) {
      const fmt: ExportFormat = !config.formats?.length || config.formats.includes('pdf') ? 'pdf' : config.formats[0];
      const params: ExportExecutionParams = {
        ...this.getEffectiveDefaults(),
        format: fmt,
        scope: config.defaultScope || config.scopes?.[0]?.id || 'current',
        watermark: config.defaultWatermark || 'NONE',
        includeQr: config.defaultIncludeQr ?? true,
        includeCharts: config.defaultIncludeCharts ?? true,
      };
      this._config.set(config);
      void this.executeExport(params).catch(() => { /* logged in executeExport */ });
      return;
    }

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
      if (!this._isOpen()) this._config.set(null);
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
      // Any PrintService.print() call made by the page callback picks these up automatically
      this._activeParams = { ...params, applyWatermark: currentConfig.allowWatermark !== false };
      if (params.format === 'pdf') this.saveLastUsedSettings(params);
      await Promise.resolve(currentConfig.onExport(params));
      this._isExporting.set(false);
      this._isOpen.set(false);
      const formatMsg = params.format === 'pdf'
        ? 'Document sent to printer successfully'
        : `${params.format.toUpperCase()} export completed successfully`;
      this.snackbar.show(formatMsg, 'success');
      setTimeout(() => {
        if (!this._isOpen()) this._config.set(null);
      }, 200);
    } catch (err) {
      this._isExporting.set(false);
      console.error('[PrintExportService] Export failed:', err);
      throw err;
    } finally {
      this._activeParams = null;
    }
  }

  /* ─────────────── PrintService coordination ─────────────── */

  /** Params of the print currently being executed from the dialog (null otherwise). */
  activeParams(): ActivePrintParams | null {
    return this._activeParams;
  }

  /** True while the dialog is rendering a live preview (prints are captured, not sent). */
  isCapturing(): boolean {
    return this._captureDepth > 0 && !this._activeParams;
  }

  /** Receive a document built by a page while in capture mode. */
  capture(config: PrintConfig): void {
    if (!this._captured) this._captured = config;
  }

  /**
   * Build the real document for the live preview by running the page's own
   * export callback in capture mode — no page changes needed, nothing is printed.
   */
  async capturePreview(params: ExportExecutionParams): Promise<PrintConfig | null> {
    const cfg = this._config();
    if (!cfg) return null;
    if (cfg.previewConfig) {
      return typeof cfg.previewConfig === 'function' ? cfg.previewConfig(params) : cfg.previewConfig;
    }
    if (params.format !== 'pdf') return null;

    this._captured = null;
    this._captureDepth++;
    let pending: Promise<unknown> | null = null;
    try {
      const result = cfg.onExport({ ...params, format: 'pdf' });
      if (result && typeof (result as Promise<void>).then === 'function') pending = result as Promise<void>;
    } catch {
      /* preview is best-effort */
    }

    if (!this._captured && pending) {
      // Async builders (e.g. chart snapshots): wait briefly for the document
      await Promise.race([pending.catch(() => undefined), new Promise(r => setTimeout(r, 1200))]);
    }

    const captured = this._captured as PrintConfig | null;
    this._captured = null;

    // Keep swallowing late prints from a still-running callback so preview never prints for real
    if (pending) {
      const release = () => { this._captureDepth = Math.max(0, this._captureDepth - 1); };
      const timer = setTimeout(release, 5000);
      pending.then(() => { clearTimeout(timer); release(); }, () => { clearTimeout(timer); release(); });
    } else {
      this._captureDepth = Math.max(0, this._captureDepth - 1);
    }
    return captured;
  }

  /** Arm a one-shot quick print (consumed by the next print/open within 1.5s). */
  armQuickPrint(): void {
    this._quickPrintArmedAt = Date.now();
  }

  consumeQuickPrint(): boolean {
    const armed = this._quickPrintArmedAt > 0 && Date.now() - this._quickPrintArmedAt < 1500;
    this._quickPrintArmedAt = 0;
    return armed;
  }

  /** Built-in defaults → regional paper size → user's remembered settings. */
  getEffectiveDefaults(): ExportExecutionParams {
    return {
      format: 'pdf',
      scope: 'current',
      watermark: 'NONE',
      includeQr: true,
      includeCharts: true,
      fileName: '',
      classification: 'NONE',
      ...DEFAULT_PRINT_SETTINGS,
      paperSize: detectRegionalPaperSize(),
      ...(this.getLastUsedSettings() || {}),
    } as ExportExecutionParams;
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

  /**
   * Persist last-used print settings to localStorage for smart defaults.
   * Users shouldn't have to re-configure every time they print.
   * One-off choices (copies, filename, watermark, scope) are intentionally not remembered.
   */
  saveLastUsedSettings(params: Partial<ExportExecutionParams>): void {
    try {
      const printSettings: Record<string, unknown> = {};
      for (const key of REMEMBERED_KEYS) {
        if (params[key] !== undefined) printSettings[key] = params[key];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(printSettings));
    } catch { /* silent — localStorage may be unavailable */ }
  }

  /**
   * Retrieve last-used print settings from localStorage.
   */
  getLastUsedSettings(): Partial<ExportExecutionParams> | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) || {};
      const clean: Record<string, unknown> = {};
      for (const key of REMEMBERED_KEYS) {
        if (parsed[key] !== undefined) clean[key] = parsed[key];
      }
      return Object.keys(clean).length ? clean as Partial<ExportExecutionParams> : null;
    } catch { return null; }
  }

  /** Forget remembered settings (the dialog's "Reset" action). */
  clearLastUsedSettings(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* silent */ }
  }
}