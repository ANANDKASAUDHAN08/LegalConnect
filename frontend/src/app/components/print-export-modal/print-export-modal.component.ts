import { Component, ChangeDetectionStrategy, HostListener, OnDestroy, inject, signal, effect, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  PrintExportService,
  ExportFormat,
  ExportExecutionParams,
  PaperSize,
  PageOrientation,
  MarginPreset,
  PrintQuality,
  ColorMode,
  PAPER_SIZES,
  MARGIN_PRESETS,
  PRINT_PRESETS,
  PrintPreset,
  DEFAULT_PRINT_SETTINGS,
} from '../../services/print-export.service';
import { PrintService, PrintConfig } from '../../services/print.service';
import { IconComponent } from '../icon/icon.component';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { CustomSelectComponent } from '../custom-select/custom-select.component';
import { SelectOption } from '../custom-select/custom-select.types';

@Component({
  selector: 'app-print-export-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, TooltipDirective, CustomSelectComponent],
  templateUrl: './print-export-modal.component.html',
  styleUrls: ['./print-export-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrintExportModalComponent implements OnDestroy {
  @ViewChild('previewIframe') previewIframeRef?: ElementRef<HTMLIFrameElement>;

  exportService = inject(PrintExportService);
  private printService = inject(PrintService);
  private sanitizer = inject(DomSanitizer);

  /* ═══════════════ MOBILE RESPONSIVE TABS ═══════════════ */
  mobileTab = signal<'settings' | 'preview'>('settings');

  /* ═══════════════ FORM STATE ═══════════════ */
  selectedFormat = signal<ExportFormat>('pdf');
  selectedScope = signal<string>('current');
  selectedWatermark = signal<string>('NONE');
  includeQr = signal<boolean>(true);
  includeCharts = signal<boolean>(true);
  includeReviews = signal<boolean>(true);
  tableDensity = signal<'standard' | 'compact'>('standard');

  /* ═══════════════ PRINT CONTROLS ═══════════════ */

  // Page Setup
  paperSize = signal<PaperSize>('A4');
  orientation = signal<PageOrientation>('portrait');
  margins = signal<MarginPreset>('default');
  customMargins = signal<{ top: number; right: number; bottom: number; left: number }>({ top: 8, right: 10, bottom: 8, left: 10 });
  scale = signal<number>(75);

  // Appearance
  colorMode = signal<ColorMode>('color');
  printQuality = signal<PrintQuality>('standard');
  showHeaderFooter = signal<boolean>(true);
  showBackgroundGraphics = signal<boolean>(true);

  // Copies & Range
  copies = signal<number>(1);
  collate = signal<boolean>(true);
  pageRange = signal<'all' | 'custom'>('all');
  customPageRange = signal<string>('');
  duplexPrint = signal<boolean>(false);
  fileName = signal<string>('');

  // Active preset (null = custom)
  activePreset = signal<string | null>(null);

  // Accordion panels
  expandedSection = signal<string | null>('pageSetup');

  // Live preview & Pagination
  previewHtml = signal<string>('');
  previewLoading = signal<boolean>(false);
  showPreview = signal<boolean>(true);
  previewZoom = signal<number>(100);
  isWidePreview = signal<boolean>(false);
  estimatedPages = signal<number>(1);
  currentPage = signal<number>(1);

  private previewTimer: any = null;

  /* ═══════════════ STATIC DATA ═══════════════ */

  readonly PAPER_SIZES = PAPER_SIZES;
  readonly MARGIN_PRESETS = MARGIN_PRESETS;
  readonly PRINT_PRESETS = PRINT_PRESETS;

  readonly WATERMARK_OPTIONS: SelectOption[] = [
    { value: 'NONE', label: 'None (Clean)', sublabel: 'No watermark stamp', icon: 'check' },
    { value: 'OFFICIAL COPY', label: 'Official Copy', sublabel: 'Institutional record', icon: 'shield' },
    { value: 'CONFIDENTIAL', label: 'Confidential', sublabel: 'Restricted distribution', icon: 'lock' },
    { value: 'DRAFT', label: 'Draft Instrument', sublabel: 'Non-final review copy', icon: 'edit' },
    { value: 'ATTORNEY-CLIENT PRIVILEGED', label: 'Privileged', sublabel: 'Protected legal work product', icon: 'scale' },
  ];

  readonly PAPER_SIZE_OPTIONS: SelectOption[] = Object.entries(PAPER_SIZES).map(([key, val]) => ({
    value: key,
    label: val.label,
    sublabel: val.region,
  }));

  readonly MARGIN_OPTIONS: SelectOption[] = Object.entries(MARGIN_PRESETS).map(([key, val]) => ({
    value: key,
    label: val.label,
    sublabel: val.description,
  }));

  readonly QUALITY_OPTIONS: SelectOption[] = [
    { value: 'draft', label: 'Draft', sublabel: 'Fast, ink-saving', icon: 'zap' },
    { value: 'standard', label: 'Standard', sublabel: 'Balanced quality', icon: 'check' },
    { value: 'high', label: 'High', sublabel: 'Maximum fidelity', icon: 'sparkles' },
  ];

  /* ═══════════════ COMPUTED SIGNALS ═══════════════ */

  safePreviewHtml = computed<SafeHtml>(() => {
    const raw = this.previewHtml();
    if (!raw) return '';
    return this.sanitizer.bypassSecurityTrustHtml(raw);
  });

  scopeOptions = computed<SelectOption[]>(() => {
    const scopes = this.exportService.config()?.scopes || [];
    return scopes.map(s => {
      let icon: any = 'layers';
      if (s.id === 'bookmarks') icon = 'bookmark';
      else if (s.id === 'directory') icon = 'users';
      else if (s.id === 'casePacks') icon = 'folder';
      else if (s.id === 'inquiries') icon = 'mail';
      else if (s.id === 'analytics') icon = 'circle-dollar';
      else if (s.id === 'reports') icon = 'shield';
      else if (s.id === 'fullDossier') icon = 'layers';

      return {
        value: s.id,
        label: s.label,
        sublabel: s.description,
        icon,
        count: s.count
      };
    });
  });

  selectedScopeMeta = computed(() => {
    const currentId = this.selectedScope();
    return this.scopeOptions().find(o => o.value === currentId) || null;
  });

  currentScopeCount = computed(() => {
    return this.selectedScopeMeta()?.count;
  });

  scopeTitle = computed(() => {
    return this.exportService.config()?.scopeTitle || 'Export Scope';
  });

  scopeBadgeText = computed(() => {
    const count = this.currentScopeCount();
    if (count === undefined) return null;
    const unit = this.exportService.config()?.scopeUnit;
    if (unit) {
      return `${count} ${count === 1 ? unit : unit + 's'}`;
    }
    return `${count} ${count === 1 ? 'record available' : 'records available'}`;
  });

  isPdfMode = computed(() => this.selectedFormat() === 'pdf');

  showPageSetup = computed(() => {
    const cfg = this.exportService.config();
    if (cfg?.showPageSetup !== undefined) return cfg.showPageSetup;
    return this.isPdfMode();
  });

  showAppearance = computed(() => {
    const cfg = this.exportService.config();
    if (cfg?.showAppearance !== undefined) return cfg.showAppearance;
    return this.isPdfMode();
  });

  showPresets = computed(() => {
    const cfg = this.exportService.config();
    if (cfg?.showPresets !== undefined) return cfg.showPresets;
    return this.isPdfMode();
  });

  pageSetupSummary = computed(() => {
    const ps = this.paperSize();
    const orient = this.orientation();
    const mg = this.margins();
    return `${ps} · ${orient} · ${mg.charAt(0).toUpperCase() + mg.slice(1)}`;
  });

  appearanceSummary = computed(() => {
    const cm = this.colorMode() === 'color' ? 'Color' : 'B&W';
    const q = this.printQuality().charAt(0).toUpperCase() + this.printQuality().slice(1);
    return `${cm} · ${q}`;
  });

  dataPreview = computed(() => {
    const fmt = this.selectedFormat();
    const cfg = this.exportService.config();
    const title = cfg?.title || 'LegalConnect Data Export';
    const scopeLabel = this.selectedScopeMeta()?.label || 'All Records';
    const count = this.currentScopeCount() ?? 139;

    if (fmt === 'csv') {
      const columns = ['Record ID', 'Institution / Title', 'Jurisdiction / State', 'Category / Type', 'Status', 'Verified Date'];
      const rows = [
        ['LC-DL-001', 'Delhi High Court - Legal Aid Clinic', 'New Delhi, DL', 'Court Legal Aid', 'Active Verified', '2026-11-15'],
        ['LC-MH-042', 'Bombay High Court Legal Services Committee', 'Mumbai, MH', 'Court Committee', 'Active Verified', '2026-11-14'],
        ['LC-KA-108', 'Bangalore Urban DLSA Front Office', 'Bengaluru, KA', 'District Clinic', 'Active Verified', '2026-11-12'],
        ['LC-TN-219', 'Madras High Court Mediation Centre', 'Chennai, TN', 'Mediation Center', 'Active Verified', '2026-11-10'],
        ['LC-WB-305', 'Kolkata Legal Assistance Front Desk', 'Kolkata, WB', 'Legal Aid Clinic', 'Active Verified', '2026-11-08'],
      ];
      return { type: 'csv' as const, title: `${title} (${scopeLabel})`, columns, rows, count };
    }

    if (fmt === 'json') {
      const sample = {
        meta: {
          exportType: 'Official Registry Export',
          source: 'LegalConnect Platform (All India)',
          scope: scopeLabel,
          totalRecords: count,
          exportedAt: new Date().toISOString(),
          auditSignature: 'SHA256:8f4c2e...verified',
        },
        records: [
          {
            id: 'LC-DL-001',
            name: 'Delhi High Court Legal Services Committee',
            category: 'Legal Aid & ADR',
            jurisdiction: 'NCT of Delhi',
            verified: true,
            coordinates: { lat: 28.6083, lng: 77.2384 }
          },
          {
            id: 'LC-MH-042',
            name: 'Bombay High Court Legal Aid Cell',
            category: 'State Appellate Clinic',
            jurisdiction: 'Maharashtra & Goa',
            verified: true,
            coordinates: { lat: 18.9298, lng: 72.8301 }
          }
        ]
      };
      return { type: 'json' as const, title: `${title} Payload`, content: JSON.stringify(sample, null, 2), count };
    }

    const lines = [
      '========================================================================',
      ` OFFICIAL LEGAL REGISTRY EXPORT — ${title.toUpperCase()}`,
      ` SCOPE: ${scopeLabel.toUpperCase()} | TOTAL RECORDS: ${count}`,
      ` GENERATED: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      '========================================================================',
      '',
      '[001] Delhi High Court Legal Services Committee',
      '      Jurisdiction: New Delhi (DL) | Forum: High Court Appellate',
      '      Status: Verified & Active    | DLSA Helpline: 15100',
      '',
      '[002] Bombay High Court Legal Aid Cell',
      '      Jurisdiction: Mumbai (MH)    | Forum: High Court Appellate',
      '      Status: Verified & Active    | DLSA Helpline: 15100',
      '',
      `... [Truncated: ${count} verified records total in output file] ...`,
      '========================================================================',
      ' END OF OFFICIAL RECORD EXPORT'
    ];
    return { type: 'txt' as const, title: `${title} Text`, content: lines.join('\n'), count };
  });

  constructor() {
    // Body scroll lock effect
    effect(() => {
      const isOpen = this.exportService.isOpen();
      if (typeof document !== 'undefined') {
        if (isOpen) {
          document.body.classList.add('overflow-hidden');
        } else {
          document.body.classList.remove('overflow-hidden');
        }
      }
    });

    // Reset/hydrate defaults whenever a new config is opened
    effect(() => {
      const cfg = this.exportService.config();
      if (cfg) {
        // Format
        if (cfg.formats && cfg.formats.length > 0) {
          this.selectedFormat.set(cfg.formats[0]);
        } else {
          this.selectedFormat.set('pdf');
        }

        // Scope
        if (cfg.scopes && cfg.scopes.length > 0) {
          this.selectedScope.set(cfg.defaultScope || cfg.scopes[0].id);
        } else {
          this.selectedScope.set('current');
        }

        // Watermark / QR / Charts / Reviews
        this.selectedWatermark.set(cfg.defaultWatermark || 'NONE');
        this.includeQr.set(cfg.defaultIncludeQr !== undefined ? cfg.defaultIncludeQr : true);
        this.includeCharts.set(cfg.defaultIncludeCharts !== undefined ? cfg.defaultIncludeCharts : true);
        this.includeReviews.set(cfg.defaultIncludeReviews !== undefined ? cfg.defaultIncludeReviews : true);

        // Page Setup — merge config defaults → remembered settings → built-in defaults
        const defaults = this.exportService.getEffectiveDefaults();
        this.paperSize.set(cfg.defaultPaperSize || defaults.paperSize || 'A4');
        this.orientation.set(cfg.defaultOrientation || defaults.orientation || 'portrait');
        this.margins.set(cfg.defaultMargins || defaults.margins || 'default');
        this.scale.set(cfg.defaultScale || defaults.scale || 75);

        // Appearance
        this.colorMode.set(cfg.defaultColorMode || defaults.colorMode || 'color');
        this.printQuality.set(cfg.defaultPrintQuality || defaults.printQuality || 'standard');
        this.showHeaderFooter.set(cfg.defaultShowHeaderFooter ?? defaults.showHeaderFooter ?? true);
        this.showBackgroundGraphics.set(cfg.defaultShowBackgroundGraphics ?? defaults.showBackgroundGraphics ?? true);

        // Reset
        this.copies.set(1);
        this.collate.set(true);
        this.pageRange.set('all');
        this.customPageRange.set('');
        this.duplexPrint.set(false);
        this.tableDensity.set('standard');
        this.currentPage.set(1);
        this.fileName.set(cfg.defaultFileName || '');
        this.activePreset.set(null);
        this.expandedSection.set('pageSetup');
        this.showPreview.set(true);
        this.mobileTab.set('settings');
        this.previewZoom.set(100);

        // Auto trigger preview for instant gratification
        setTimeout(() => this.refreshPreview(true), 50);
      }
    }, { allowSignalWrites: true });
  }

  ngOnDestroy() {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewHtml.set('');
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden');
    }
  }

  /* ═══════════════ DEBOUNCED PREVIEW REFRESH ═══════════════ */

  schedulePreviewUpdate(): void {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => {
      this.refreshPreview();
    }, 250);
  }

  async refreshPreview(force = false): Promise<void> {
    if (!this.exportService.isOpen()) return;
    if (this.selectedFormat() !== 'pdf') {
      this.previewLoading.set(false);
      return;
    }

    this.previewLoading.set(true);
    try {
      const cfg = this.exportService.config();
      if (!cfg) return;

      const params = this.buildParams();

      if (cfg.previewConfig) {
        const preview = typeof cfg.previewConfig === 'function' ? cfg.previewConfig(params) : cfg.previewConfig;
        const html = this.printService.buildPreviewHtml(preview, params, cfg.allowWatermark !== false);
        this.previewHtml.set(html);
        this.updateEstimatedPages(html);
        return;
      }

      const captured = await this.exportService.capturePreview(params);
      if (captured) {
        const html = this.printService.generatePreviewHtml(
          this.printService.applyPrintParams(captured, params, cfg.allowWatermark !== false)
        );
        this.previewHtml.set(html);
        this.updateEstimatedPages(html);
      } else {
        this.previewHtml.set('');
        this.updateEstimatedPages('');
      }
    } catch {
      this.previewHtml.set('');
      this.updateEstimatedPages('');
    } finally {
      this.previewLoading.set(false);
    }
  }

  updateEstimatedPages(rawHtml: string): void {
    if (!rawHtml) {
      this.estimatedPages.set(1);
      return;
    }
    const explicitBreaks = (rawHtml.match(/class="[^"]*page-break/gi) || []).length;
    const printSections = (rawHtml.match(/class="[^"]*print-section/gi) || []).length;
    const trMatches = (rawHtml.match(/<tr/gi) || []).length;
    const charLen = rawHtml.length;

    const rowsEstimate = trMatches > 0 ? Math.ceil(trMatches / 18) : 1;
    const charsEstimate = Math.ceil(charLen / 3400);
    const breaksEstimate = Math.max(explicitBreaks + 1, printSections);

    const pages = Math.max(1, Math.min(25, Math.max(breaksEstimate, Math.min(rowsEstimate, charsEstimate))));
    this.estimatedPages.set(pages);
    if (this.currentPage() > pages) {
      this.currentPage.set(1);
    }
  }

  /* ═══════════════ REAL-WORLD DOM MEASUREMENT & 60FPS LIVE STYLING ═══════════════ */

  /**
   * Enterprise accuracy: Measure real scrollHeight of the document inside the iframe
   * against the physical page height in CSS pixels (96 DPI standard).
   */
  onIframeLoaded(): void {
    try {
      const iframe = this.previewIframeRef?.nativeElement;
      const doc = iframe?.contentDocument;
      if (doc && doc.body) {
        const paper = PAPER_SIZES[this.paperSize()] || PAPER_SIZES['A4'];
        const heightMm = this.orientation() === 'landscape' ? paper.width : paper.height;
        // Standard CSS print resolution: 96 CSS pixels per 25.4 millimeters (1 inch)
        const pageHeightPx = (heightMm / 25.4) * 96;
        const scrollHeight = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
        if (scrollHeight > 100) {
          const measuredPages = Math.max(1, Math.ceil((scrollHeight - 16) / pageHeightPx));
          this.estimatedPages.set(measuredPages);
        }
      }
    } catch {
      // Graceful fallback to heuristic if iframe context is unavailable
    }
  }

  /**
   * Resolves current margin configuration to precise millimeter values.
   */
  getMarginValues(): { top: number; right: number; bottom: number; left: number } {
    if (this.margins() === 'custom') {
      return this.customMargins();
    }
    const preset = MARGIN_PRESETS[this.margins()] || MARGIN_PRESETS['default'];
    return { top: preset.top, right: preset.right, bottom: preset.bottom, left: preset.left };
  }

  /**
   * GPU-Accelerated Live Style Streaming:
   * Directly updates CSS Custom Properties on the iframe root without rebuilding the DOM tree.
   * Delivers 60fps instant response when adjusting scale or margins.
   */
  updateIframeLiveStyle(): boolean {
    try {
      const iframe = this.previewIframeRef?.nativeElement;
      const doc = iframe?.contentDocument;
      if (doc && doc.documentElement) {
        const root = doc.documentElement;
        root.style.setProperty('--lc-scale', `${this.scale() / 100}`);
        const m = this.getMarginValues();
        root.style.setProperty('--lc-padding', `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`);
        root.style.setProperty('--lc-margin-top', `${m.top}mm`);
        root.style.setProperty('--lc-margin-right', `${m.right}mm`);
        root.style.setProperty('--lc-margin-bottom', `${m.bottom}mm`);
        root.style.setProperty('--lc-margin-left', `${m.left}mm`);

        // Recalculate physical page count based on newly styled geometry
        setTimeout(() => this.onIframeLoaded(), 60);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  /* ═══════════════ FORMAT / SCOPE ═══════════════ */

  isFormatAvailable(fmt: ExportFormat): boolean {
    const formats = this.exportService.config()?.formats;
    if (!formats || formats.length === 0) return true;
    return formats.includes(fmt);
  }

  setFormat(fmt: ExportFormat): void {
    this.selectedFormat.set(fmt);
    this.schedulePreviewUpdate();
  }

  setScope(scopeId: string): void {
    this.selectedScope.set(scopeId);
    this.schedulePreviewUpdate();
  }

  get activeScopeDetails() {
    const scopes = this.exportService.config()?.scopes || [];
    return scopes.find(s => s.id === this.selectedScope());
  }

  /* ═══════════════ QUICK PRESETS ═══════════════ */

  applyPreset(preset: PrintPreset): void {
    if (this.activePreset() === preset.id) {
      this.activePreset.set(null);
      return;
    }
    this.activePreset.set(preset.id);
    const s = preset.settings;
    if (s.paperSize) this.paperSize.set(s.paperSize);
    if (s.orientation) this.orientation.set(s.orientation);
    if (s.margins) this.margins.set(s.margins);
    if (s.scale !== undefined) this.scale.set(s.scale);
    if (s.colorMode) this.colorMode.set(s.colorMode);
    if (s.printQuality) this.printQuality.set(s.printQuality);
    if (s.showHeaderFooter !== undefined) this.showHeaderFooter.set(s.showHeaderFooter);
    if (s.showBackgroundGraphics !== undefined) this.showBackgroundGraphics.set(s.showBackgroundGraphics);
    if (s.watermark) this.selectedWatermark.set(s.watermark);
    if (s.tableDensity) this.tableDensity.set(s.tableDensity);
    if (s.duplexPrint !== undefined) this.duplexPrint.set(s.duplexPrint);
    if (s.collate !== undefined) this.collate.set(s.collate);
    this.schedulePreviewUpdate();
  }

  /* ═══════════════ PAGE SETUP ═══════════════ */

  setPaperSize(size: string): void {
    this.paperSize.set(size as PaperSize);
    this.activePreset.set(null);
    this.schedulePreviewUpdate();
  }

  setOrientation(o: PageOrientation): void {
    this.orientation.set(o);
    this.activePreset.set(null);
    this.schedulePreviewUpdate();
  }

  setMargins(preset: string): void {
    this.margins.set(preset as MarginPreset);
    this.activePreset.set(null);
    if (!this.updateIframeLiveStyle()) {
      this.schedulePreviewUpdate();
    }
  }

  updateCustomMargin(side: 'top' | 'right' | 'bottom' | 'left', value: any): void {
    const num = Math.max(0, Math.min(50, Number(value) || 0));
    this.customMargins.update(curr => ({ ...curr, [side]: num }));
    this.activePreset.set(null);
    if (!this.updateIframeLiveStyle()) {
      this.schedulePreviewUpdate();
    }
  }

  setScale(val: number): void {
    this.scale.set(Math.max(25, Math.min(200, val)));
    this.activePreset.set(null);
    if (!this.updateIframeLiveStyle()) {
      this.schedulePreviewUpdate();
    }
  }

  /* ═══════════════ APPEARANCE ═══════════════ */

  toggleColorMode(): void {
    this.colorMode.set(this.colorMode() === 'color' ? 'grayscale' : 'color');
    this.activePreset.set(null);
    this.schedulePreviewUpdate();
  }

  setQuality(val: string): void {
    this.printQuality.set(val as PrintQuality);
    this.activePreset.set(null);
    this.schedulePreviewUpdate();
  }

  toggleHeaderFooter(): void {
    this.showHeaderFooter.set(!this.showHeaderFooter());
    this.activePreset.set(null);
    this.schedulePreviewUpdate();
  }

  toggleBackgroundGraphics(): void {
    this.showBackgroundGraphics.set(!this.showBackgroundGraphics());
    this.activePreset.set(null);
    this.schedulePreviewUpdate();
  }

  setWatermark(w: string): void {
    this.selectedWatermark.set(w);
    this.activePreset.set(null);
    this.schedulePreviewUpdate();
  }

  toggleQr(): void {
    this.includeQr.set(!this.includeQr());
    this.schedulePreviewUpdate();
  }

  toggleCharts(): void {
    this.includeCharts.set(!this.includeCharts());
    this.schedulePreviewUpdate();
  }

  toggleReviews(): void {
    this.includeReviews.set(!this.includeReviews());
    this.schedulePreviewUpdate();
  }

  /* ═══════════════ COPIES & RANGE ═══════════════ */

  adjustCopies(delta: number): void {
    const next = Math.max(1, Math.min(99, this.copies() + delta));
    this.copies.set(next);
  }

  setPageRange(range: 'all' | 'custom'): void {
    this.pageRange.set(range);
    this.activePreset.set(null);
    this.schedulePreviewUpdate();
  }

  setCustomPageRange(range: string): void {
    this.customPageRange.set(range);
    this.activePreset.set(null);
    this.schedulePreviewUpdate();
  }

  toggleCollate(): void {
    this.collate.set(!this.collate());
    this.activePreset.set(null);
  }

  toggleDuplex(): void {
    this.duplexPrint.set(!this.duplexPrint());
    this.activePreset.set(null);
    this.schedulePreviewUpdate();
  }

  setTableDensity(d: 'standard' | 'compact'): void {
    this.tableDensity.set(d);
    this.activePreset.set(null);
    this.schedulePreviewUpdate();
  }

  /* ═══════════════ SECTION ACCORDION ═══════════════ */

  toggleSection(section: string): void {
    this.expandedSection.set(this.expandedSection() === section ? null : section);
  }

  /* ═══════════════ PREVIEW ZOOM & PAGINATION ═══════════════ */

  zoomIn(): void {
    this.previewZoom.update(z => Math.min(160, z + 15));
  }

  zoomOut(): void {
    this.previewZoom.update(z => Math.max(60, z - 15));
  }

  resetZoom(): void {
    this.previewZoom.set(100);
  }

  toggleWidePreview(): void {
    this.isWidePreview.update(w => !w);
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.scrollIframeToPage(this.currentPage());
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.estimatedPages()) {
      this.currentPage.update(p => p + 1);
      this.scrollIframeToPage(this.currentPage());
    }
  }

  private scrollIframeToPage(page: number): void {
    try {
      const iframe = document.querySelector('.paper-iframe') as HTMLIFrameElement;
      if (iframe?.contentWindow) {
        const totalHeight = iframe.contentWindow.document.body.scrollHeight || 1000;
        const pageHeight = totalHeight / (this.estimatedPages() || 1);
        const targetScroll = (page - 1) * pageHeight;
        iframe.contentWindow.scrollTo({ top: targetScroll, behavior: 'smooth' });
      }
    } catch {
      // Cross-origin safe fallback
    }
  }

  /* ═══════════════ RESET SETTINGS ═══════════════ */

  resetToDefaults(): void {
    this.exportService.clearLastUsedSettings();
    const d = DEFAULT_PRINT_SETTINGS;
    this.paperSize.set(d.paperSize);
    this.orientation.set(d.orientation);
    this.margins.set(d.margins);
    this.scale.set(d.scale);
    this.colorMode.set(d.colorMode);
    this.printQuality.set(d.printQuality);
    this.showHeaderFooter.set(d.showHeaderFooter);
    this.showBackgroundGraphics.set(d.showBackgroundGraphics);
    this.copies.set(1);
    this.collate.set(true);
    this.pageRange.set('all');
    this.customPageRange.set('');
    this.duplexPrint.set(false);
    this.tableDensity.set('standard');
    this.currentPage.set(1);
    this.isWidePreview.set(false);
    this.activePreset.set(null);
    this.schedulePreviewUpdate();
  }

  /* ═══════════════ ACTIONS ═══════════════ */

  onClose(): void {
    this.exportService.close();
  }

  async onConfirmExport(): Promise<void> {
    const params = this.buildParams();
    await this.exportService.executeExport(params);
  }

  @HostListener('window:keydown.escape')
  handleEscape(): void {
    if (this.exportService.isOpen()) {
      this.onClose();
    }
  }

  @HostListener('window:keydown.enter', ['$event'])
  handleEnter(event: KeyboardEvent): void {
    if (!this.exportService.isOpen()) return;
    const target = event.target as HTMLElement | null;
    const tagName = target?.tagName?.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
      return;
    }
    if (this.exportService.isExporting()) return;
    event.preventDefault();
    this.onConfirmExport();
  }

  /* ═══════════════ MOBILE TOUCH DISMISS ═══════════════ */

  private touchStartY = 0;

  onTouchStartHandle(event: TouchEvent): void {
    if (event.touches && event.touches[0]) {
      this.touchStartY = event.touches[0].clientY;
    }
  }

  onTouchEndHandle(event: TouchEvent): void {
    if (event.changedTouches && event.changedTouches[0]) {
      const deltaY = event.changedTouches[0].clientY - this.touchStartY;
      // If pulled down by more than 50px, close bottom sheet
      if (deltaY > 50) {
        this.onClose();
      }
    }
  }


  /* ═══════════════ PARAM BUILDER ═══════════════ */

  private buildParams(): ExportExecutionParams {
    return {
      format: this.selectedFormat(),
      scope: this.selectedScope(),
      watermark: this.selectedWatermark(),
      includeQr: this.includeQr(),
      includeCharts: this.includeCharts(),
      includeReviews: this.includeReviews(),
      tableDensity: this.tableDensity(),
      paperSize: this.paperSize(),
      orientation: this.orientation(),
      margins: this.margins(),
      customMargins: this.margins() === 'custom' ? this.customMargins() : undefined,
      scale: this.scale(),
      colorMode: this.colorMode(),
      printQuality: this.printQuality(),
      showHeaderFooter: this.showHeaderFooter(),
      showBackgroundGraphics: this.showBackgroundGraphics(),
      pageRange: this.pageRange(),
      customPageRange: this.pageRange() === 'custom' ? this.customPageRange() : undefined,
      copies: this.copies(),
      collate: this.collate(),
      duplexPrint: this.duplexPrint(),
      fileName: this.fileName(),
      classification: this.selectedWatermark() !== 'NONE' ? this.selectedWatermark() : '',
    };
  }
}