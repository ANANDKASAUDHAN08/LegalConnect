import { Injectable, inject } from '@angular/core';
import { IconService } from '../components/icon/icon.service';
import { PrintExportService, ExportExecutionParams } from './print-export.service';

/* ═══════════════════════════════════════════════════════════════════
   TYPE INTERFACES
   ═══════════════════════════════════════════════════════════════════ */

export interface PrintConfig {
  title: string;
  subtitle?: string;
  accentColor?: string;
  subjectStrip?: string;
  content: string;
  sealText?: string;
  watermark?: string;
  classification?: 'CONFIDENTIAL' | 'ATTORNEY-CLIENT PRIVILEGED' | 'OFFICIAL COPY' | 'DRAFT' | 'LEGAL BRIEF' | string;
  headerQrData?: string;
  extraMeta?: { label: string; value: string }[];
  onPopupBlocked?: () => void;
  coverPage?: string;
  suppressDefaultHeader?: boolean;
  /* Page Setup */
  paperSize?: 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5';
  orientation?: 'portrait' | 'landscape';
  margins?: 'default' | 'none' | 'minimum' | 'narrow' | 'wide' | 'custom';
  customMargins?: { top: number; right: number; bottom: number; left: number };
  scale?: number;
  /* Appearance */
  colorMode?: 'color' | 'grayscale';
  printQuality?: 'draft' | 'standard' | 'high';
  showHeaderFooter?: boolean;
  showBackgroundGraphics?: boolean;
  /* Identity */
  fileName?: string;
  /* Output */
  copies?: number;
  collate?: boolean;
  pageRange?: 'all' | 'custom';
  customPageRange?: string;
  duplexPrint?: boolean;
  tableDensity?: 'standard' | 'compact';
  /**
   * Bypass the universal print dialog and print immediately.
   * By default every print() call opens the Print & Export dialog with a live preview.
   */
  skipDialog?: boolean;
}

export interface KpiCard {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
  bold?: boolean;
}

export interface TableConfig {
  title?: string;
  badge?: string;
  columns: TableColumn[];
  rows: Record<string, any>[];
}

export interface PrintableResource {
  _id?: string;
  name: string;
  name_hi?: string;
  type?: string;
  address?: string;
  address_hi?: string;
  district?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string | string[];
  phones?: string[];
  number?: string;
  alternateNumber?: string;
  contactNumber?: string[];
  email?: string[];
  website?: string;
  officialPortal?: string;
  jurisdictionLevel?: string;
  operatingHours?: string;
  operatingHours_hi?: string;
  lunchBreak?: string;
  executiveChairman?: string;
  memberSecretary?: string;
  patronInChief?: string;
  languages?: string[];
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  location?: {
    type?: string;
    coordinates?: [number, number] | number[];
  };
  coordinates?: { lat?: number; lng?: number } | [number, number];
  facilities?: {
    hasEfiling?: boolean;
    hasLADCS?: boolean;
    hasVCRoom?: boolean;
    hasLegalAidClinic?: boolean;
    isWheelchairAccessible?: boolean;
  };
}

export interface PrintableStatuteSection {
  section_number?: string | number;
  title?: string;
  content?: string | { text?: string; content?: string } | Array<string | { text?: string; content?: string }>;
  introduction_text?: string;
  snippet?: string;
  content_blocks?: Array<{ text?: string }>;
}

export interface PrintableAct {
  actName?: string;
  shortName?: string;
  year?: string | number;
}

export interface PrintableUserProfile {
  fullName?: string;
  FullName?: string;
  email?: string;
  Email?: string;
  role?: string;
  Role?: string;
}

/* ═══════════════════════════════════════════════════════════════════
   PRINT SERVICE — Unified Enterprise Print Rendering Engine
   ═══════════════════════════════════════════════════════════════════
   Single source of truth for all print operations across the app.
   Uses our custom SVG icon system (IconService / ICON_REGISTRY)
   for clean, crisp, resolution-independent vector printing.

   Features:
   1. Brand Identity & Official Typography
   2. Custom SVG Vector Icon Integration
   3. Multi-page Table Header Repetition (table-header-group)
   4. Orphan/Widow Header Prevention (break-after: avoid)
   5. Dynamic Watermarks & Document Classification Badges
   6. Automatic Image-Load Verification Before Print Trigger
   7. Hidden Iframe Fallback for Popup Blockers
   8. QR Code Verification & Deep GPS Directions
   9. Institutional Executive Cover Page & TOC Architecture
   ═══════════════════════════════════════════════════════════════════ */

@Injectable({ providedIn: 'root' })
export class PrintService {
  private iconService = inject(IconService);
  private printHub = inject(PrintExportService);

  /* ─────────────── BRAND CONSTANTS ─────────────── */

  private readonly BRAND_NAME = 'LegalConnect';
  private readonly BRAND_TAGLINE = 'LEGAL HELP, SIMPLIFIED.';

  private readonly BRAND_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:22px;height:22px;display:block;">
    <path d="M12 4v16M8 20h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M5 8h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M5 8l-2 5M5 8l2 5M2 13c0 2 6 2 6 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M19 8l-2 5M19 8l2 5M16 13c0 2 6 2 6 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="12" cy="11" r="2.2" fill="currentColor"/>
  </svg>`;

  private readonly TYPE_LABELS: Record<string, string> = {
    LegalAid: 'Legal Aid Center',
    Court: 'Court',
    GovernmentOffice: 'Government Office',
    PoliceStation: 'Police Station',
    Tribunal: 'Tribunal',
    Notary: 'Notary',
    Mediation: 'Mediation Center',
  };

  /* ─────────────── CUSTOM SVG ICON ENGINE ─────────────── */

  /**
   * Generates a clean, crisp, resolution-independent SVG vector icon for print
   * using the centralized IconService and ICON_REGISTRY.
   */
  getSvg(name: string, options: { size?: number; color?: string; style?: string } = {}): string {
    const size = options.size || 12;
    const color = options.color || 'currentColor';
    const customStyle = options.style || '';
    let svg = this.iconService.getSvgString(name);

    if (color && color !== 'currentColor') {
      if (svg.includes('stroke="currentColor"')) {
        svg = svg.replace(/stroke="currentColor"/g, `stroke="${color}"`);
      }
      if (svg.includes('fill="currentColor"')) {
        svg = svg.replace(/fill="currentColor"/g, `fill="${color}"`);
      }
    }

    return `<span class="lc-icon" style="width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;flex-shrink:0;color:${color};${customStyle}">${svg}</span>`;
  }

  /* ─────────────── UTILITY METHODS ─────────────── */

  /** Escape HTML characters to prevent XSS in rendered documents */
  escapeHtml(str: any): string {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /** Format a date safely for print display */
  formatDate(dateVal: any, style: 'long' | 'short' = 'long'): string {
    if (!dateVal) return 'N/A';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return style === 'long'
        ? d.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
        : d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short' });
    } catch {
      return String(dateVal);
    }
  }

  /** Generate a traceable reference code like LC-REG-2026-AN-384921 */
  generateRefCode(prefix: string): string {
    const yr = new Date().getFullYear();
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `LC-${prefix}-${yr}-${rand}`;
  }

  /** Generate a QR code image URL using the free API (already used in qr-modal) */
  generateQrUrl(data: string, size = 120): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&format=svg`;
  }

  /** Snapshot a Chart.js canvas instance to a base64 PNG string */
  snapshotChart(chartInstance: any): string {
    try {
      return chartInstance?.toBase64Image?.('image/png', 1.0) || '';
    } catch {
      return '';
    }
  }

  /** Build Google Maps directions URL from coordinates */
  private buildMapsUrl(lat: number, lng: number): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }

  /** Get formatted current timestamp */
  private getTimestamp(): { dateStr: string; timeStr: string } {
    const now = new Date();
    return {
      dateStr: now.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
      timeStr: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };
  }

  /** Get type label for a resource type code */
  getTypeLabel(type: string): string {
    return this.TYPE_LABELS[type] || type || 'Legal Resource';
  }

  /* ─────────────── CSS BUILDER ─────────────── */

  /** Returns the complete print document stylesheet */
  private buildStyles(styleConfig: { accentColor?: string; paperSize?: string; orientation?: string; margins?: string; customMargins?: { top: number; right: number; bottom: number; left: number }; scale?: number; colorMode?: string; printQuality?: string; showBackgroundGraphics?: boolean; showHeaderFooter?: boolean; preview?: boolean; tableDensity?: 'standard' | 'compact'; duplexPrint?: boolean } = {}): string {
    const accentColor = styleConfig.accentColor || '#4f46e5';
    const pageSize = styleConfig.paperSize || 'A4';
    const orient = styleConfig.orientation || 'portrait';
    let marginCss = '8mm 10mm 10mm 10mm';
    if (styleConfig.margins === 'none') marginCss = '0';
    else if (styleConfig.margins === 'minimum') marginCss = '4mm';
    else if (styleConfig.margins === 'narrow') marginCss = '5mm';
    else if (styleConfig.margins === 'wide') marginCss = '18mm';
    else if (styleConfig.margins === 'custom' && styleConfig.customMargins) {
      const m = styleConfig.customMargins;
      marginCss = `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`;
    }
    const scaleVal = (styleConfig.scale || 100) / 100;
    // `zoom` re-flows content (fewer/more pages) instead of clipping it like transform:scale
    const scaleCss = scaleVal !== 1 ? `zoom:${scaleVal};` : '';
    // Applied on the root element so position:fixed watermarks still repeat on every page
    const grayscaleRootCss = styleConfig.colorMode === 'grayscale' ? 'html{filter:grayscale(1)!important}' : '';
    const printColorAdjust = styleConfig.showBackgroundGraphics !== false ? '-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;' : '';
    let draftCss = '';
    if (styleConfig.printQuality === 'draft') {
      draftCss = '\n.lc-brand-icon{opacity:0.6}\n.lc-section,.lc-kpi,.lc-res-card,.lc-compare-card{box-shadow:none!important}\nimg:not(.lc-chart-img){opacity:0.7}';
    }
    let hideHeaderFooterCss = '';
    if (styleConfig.showHeaderFooter === false) {
      hideHeaderFooterCss = '\n.lc-header,.lc-footer{display:none!important}';
    }
    let densityCss = '';
    if (styleConfig.tableDensity === 'compact') {
      densityCss = '\n.lc-table td,.lc-table th{padding:3px 6px!important;font-size:8.5px!important}\n.lc-res-card{padding:6px 8px!important;margin-bottom:6px!important}\n.lc-kpi{padding:5px 8px!important}\n.lc-statute{padding:6px 10px!important;margin-bottom:6px!important}';
    }
    let duplexCss = '';
    if (styleConfig.duplexPrint) {
      duplexCss = '\n@media print{body{padding-left:18mm!important}}';
    }

    const previewSheetCss = styleConfig.preview ? `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
html {
  --lc-scale: ${scaleVal};
  --lc-padding: ${marginCss};
  background: #ffffff !important;
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
}
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  color: #0f172a !important;
  background: #ffffff !important;
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  padding: var(--lc-padding, ${marginCss}) !important;
  box-sizing: border-box !important;
  position: relative !important;
  overflow-x: hidden !important;
  -webkit-font-smoothing: antialiased !important;
  -moz-osx-font-smoothing: grayscale !important;
  zoom: var(--lc-scale, ${scaleVal});
}
@media (max-width: 640px) {
  body {
    padding: max(4mm, calc(var(--lc-margin-top, 6mm) * 0.7)) max(4mm, calc(var(--lc-margin-right, 6mm) * 0.7)) !important;
  }
}
.lc-watermark {
  position: fixed !important;
  top: 45% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) rotate(-35deg) !important;
  font-size: 3.2rem !important;
  font-weight: 900 !important;
  color: rgba(99, 102, 241, 0.08) !important;
  text-transform: uppercase !important;
  letter-spacing: 0.16em !important;
  pointer-events: none !important;
  z-index: 0 !important;
  white-space: nowrap !important;
  user-select: none !important;
}
` : `
@page{size:${pageSize} ${orient};margin:${marginCss}}
body{
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  color:#0f172a;background:#fff;line-height:1.5;font-size:11.5px;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  position:relative;${scaleCss}
}
.lc-watermark{
  position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);
  font-size:4.2rem;font-weight:900;color:rgba(15,23,42,0.032);
  text-transform:uppercase;letter-spacing:0.18em;pointer-events:none;z-index:0;
  white-space:nowrap;user-select:none;
}
`;

    return `
*{box-sizing:border-box;margin:0;padding:0}
*,*::before,*::after{${printColorAdjust}}
${grayscaleRootCss}
${previewSheetCss}
.lc-copy-break{break-after:page;page-break-after:always;height:0}

/* ── Classification Pill ── */
.lc-class-badge{
  display:inline-flex;align-items:center;gap:3px;font-size:8px;font-weight:800;letter-spacing:0.08em;
  text-transform:uppercase;padding:2px 8px;border-radius:4px;
  background:#fee2e2;color:#991b1b;border:1px solid #fecaca;margin-bottom:4px;
}

/* ── Executive Cover Page ── */
.lc-cover-page{
  page-break-after:always!important;break-after:page!important;
  box-sizing:border-box;padding:4px 0 10px;position:relative;z-index:1;
}
.lc-cover-header{
  border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:14px;
  display:flex;justify-content:space-between;align-items:flex-start;
}
.lc-cover-title{
  font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:800;
  color:#0f172a;letter-spacing:-0.02em;line-height:1.2;margin:10px 0 4px;
}
.lc-cover-sub{
  font-size:10.5px;font-weight:600;color:#475569;letter-spacing:0.03em;
  text-transform:uppercase;line-height:1.4;
}
.lc-meta-matrix{
  display:grid;grid-template-columns:1fr 1fr;gap:8px;
  background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
  padding:10px 14px;margin-bottom:14px;
}
.lc-meta-item{display:flex;flex-direction:column;gap:2px}
.lc-meta-label{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#64748b}
.lc-meta-val{font-size:10.5px;font-weight:700;color:#0f172a}
.lc-toc-wrap{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:14px}
.lc-toc-title{
  background:#0f172a;color:#fff;font-size:8.5px;font-weight:800;
  letter-spacing:0.08em;text-transform:uppercase;padding:7px 12px;
  display:flex;justify-content:space-between;align-items:center;
}
.lc-toc-row{
  display:flex;justify-content:space-between;align-items:center;
  padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:9.5px;
}
.lc-toc-row:last-child{border-bottom:none}
.lc-toc-row:nth-child(even){background:#f8fafc}
.lc-toc-sec{font-weight:700;color:#1e3a8a;width:75px;flex-shrink:0}
.lc-toc-name{font-weight:600;color:#1e293b;flex:1}
.lc-toc-count{font-size:8.5px;font-weight:700;color:#475569;background:#e2e8f0;padding:1px 7px;border-radius:10px}
.lc-privilege-notice{
  border:1px solid #cbd5e1;border-left:4px solid #475569;background:#f8fafc;
  border-radius:6px;padding:8px 12px;font-size:8px;color:#475569;line-height:1.5;
}
.lc-privilege-title{
  font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.06em;
  margin-bottom:2px;display:flex;align-items:center;gap:4px;
}

/* ── Header ── */
.lc-header{
  border-top:4px solid ${accentColor};padding:12px 0 10px;border-bottom:2px solid #0f172a;
  display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;
  position:relative;z-index:1;
}
.lc-brand{display:flex;align-items:center;gap:10px}
.lc-brand-icon{
  width:34px;height:34px;border-radius:50%;
  background:linear-gradient(135deg,#2563eb,${accentColor});
  display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;
}
.lc-brand-name{font-size:19px;font-weight:800;color:#0f172a;letter-spacing:-0.03em;line-height:1.1}
.lc-brand-name span{color:${accentColor}}
.lc-brand-tag{font-size:7.5px;font-weight:800;color:#64748b;letter-spacing:0.1em;text-transform:uppercase;margin-top:1px}
.lc-doc-title{font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:700;color:#0f172a;margin:5px 0 2px;break-after:avoid;page-break-after:avoid}
.lc-doc-sub{font-size:9.5px;color:#64748b;text-transform:uppercase;letter-spacing:0.07em;font-weight:600}
.lc-meta{text-align:right;font-size:9.5px;color:#475569}
.lc-ref{
  font-family:'Courier New',monospace;font-weight:700;color:#0f172a;
  background:#f1f5f9;padding:2px 6px;border-radius:4px;display:inline-block;margin-bottom:3px;
}

/* ── Footer ── */
.lc-footer{
  border-top:1px solid #e2e8f0;padding-top:10px;margin-top:24px;
  display:flex;justify-content:space-between;align-items:center;
  font-size:8px;color:#94a3b8;page-break-inside:avoid;break-inside:avoid;
  position:relative;z-index:1;
}
.lc-seal{border-left:2px solid ${accentColor};padding-left:8px;font-style:italic}

/* ── Subject Strip ── */
.lc-subject{
  background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
  padding:10px 14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;
  position:relative;z-index:1;page-break-inside:avoid;break-inside:avoid;
}
.lc-subject-name{font-size:13.5px;font-weight:700;color:#0f172a}
.lc-subject-sub{font-size:9.5px;color:#64748b;margin-top:2px}
.lc-subject-badge{
  background:#ecfdf5;border:1px solid #10b981;color:#047857;
  padding:3px 10px;border-radius:20px;font-size:8.5px;font-weight:700;
  text-transform:uppercase;letter-spacing:0.05em;display:inline-flex;align-items:center;gap:4px;
}

/* ── Section & Part Headers ── */
.lc-section{
  border:1px solid #e2e8f0;border-radius:8px;padding:12px;
  margin-bottom:14px;background:#fff;page-break-inside:auto;break-inside:auto;
  position:relative;z-index:1;
}
.lc-section.keep-together{page-break-inside:avoid;break-inside:avoid}
.lc-section-title{
  font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;
  color:#0f172a;border-bottom:1px solid #f1f5f9;padding-bottom:6px;margin-bottom:10px;
  display:flex;justify-content:space-between;align-items:center;
  break-after:avoid;page-break-after:avoid;
}
.lc-section-badge{font-size:9px;font-weight:600;color:#64748b;text-transform:none;letter-spacing:normal}
.lc-part-header{
  background:#0f172a;color:#fff;padding:7px 12px;border-radius:6px;
  margin:16px 0 10px;display:flex;justify-content:space-between;align-items:center;
  break-after:avoid;page-break-after:avoid;position:relative;z-index:1;
}
.lc-part-title{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em}
.lc-part-badge{font-size:8.5px;font-weight:600;background:rgba(255,255,255,0.2);padding:1px 7px;border-radius:4px}
.lc-page-break{page-break-before:always;break-before:page}

/* ── KPI Grid ── */
.lc-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;position:relative;z-index:1}
@media print{.lc-kpi-grid{grid-template-columns:repeat(4,1fr)!important}}
.lc-kpi{border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;position:relative;background:#fff;page-break-inside:avoid;break-inside:avoid}
.lc-kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:6px 6px 0 0}
.lc-kpi.green::before{background:#10b981}
.lc-kpi.amber::before{background:#f59e0b}
.lc-kpi.indigo::before{background:#6366f1}
.lc-kpi.blue::before{background:#0284c7}
.lc-kpi.emerald::before{background:#059669}
.lc-kpi.slate::before{background:#64748b}
.lc-kpi.rose::before{background:#f43f5e}
.lc-kpi-label{font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;color:#64748b}
.lc-kpi-val{font-size:15px;font-weight:700;color:#0f172a;margin-top:2px;display:flex;align-items:center;gap:4px}
.lc-kpi-sub{font-size:8.5px;color:#64748b;margin-top:1px}

/* ── Tables with Multi-Page Repeating Headers ── */
.lc-table{width:100%;border-collapse:collapse;margin-top:6px}
.lc-table thead{display:table-header-group}
.lc-table tfoot{display:table-footer-group}
.lc-table tr{page-break-inside:avoid;break-inside:avoid}
.lc-table th{
  background:#0f172a;color:#fff;font-size:8.5px;font-weight:700;
  text-transform:uppercase;letter-spacing:0.05em;padding:5px 8px;text-align:left;
}
.lc-table td{padding:5px 8px;border-bottom:1px solid #f1f5f9;font-size:9.5px;color:#334155}
.lc-table tr:nth-child(even) td{background:#f8fafc}
.lc-table .mono{font-family:'Courier New',monospace}
.lc-table .bold{font-weight:700}
.lc-table .right{text-align:right}
.lc-table .center{text-align:center}

/* ── Resource Cards ── */
.lc-res-card{
  border:1px solid #e2e8f0;border-left:4px solid #64748b;border-radius:8px;
  padding:10px 12px;margin-bottom:10px;display:flex;gap:12px;
  justify-content:space-between;page-break-inside:avoid;break-inside:avoid;position:relative;z-index:1;
}
.lc-res-card.type-legal-aid{border-left-color:#7c3aed}
.lc-res-card.type-court{border-left-color:#b45309}
.lc-res-card.type-gov{border-left-color:#0369a1}
.lc-res-card.type-police{border-left-color:#dc2626}
.lc-res-body{flex:1;min-width:0}
.lc-res-type{
  display:inline-block;font-size:7.5px;font-weight:800;text-transform:uppercase;
  letter-spacing:0.06em;padding:2px 5px;border-radius:3px;margin-bottom:4px;
}
.lc-res-type.legal-aid{background:#f3e8ff;color:#6d28d9}
.lc-res-type.court{background:#fef3c7;color:#92400e}
.lc-res-type.gov{background:#e0f2fe;color:#0c4a6e}
.lc-res-type.police{background:#fee2e2;color:#991b1b}
.lc-res-name{font-size:12px;font-weight:700;color:#0f172a;margin-bottom:2px}
.lc-res-addr{font-size:9.5px;color:#475569;line-height:1.4;display:flex;align-items:flex-start;gap:4px}
.lc-res-contact{font-size:9.5px;margin-top:3px;color:#334155;display:flex;align-items:center;gap:4px}
.lc-res-contact strong{font-weight:700;color:#0f172a}
.lc-res-url{font-size:8.5px;color:#2563eb;word-break:break-all;margin-top:2px;display:flex;align-items:center;gap:4px}
.lc-res-tags{margin-top:4px;display:flex;flex-wrap:wrap;gap:3px}
.lc-res-tag{
  font-size:7.5px;font-weight:700;padding:1px 4px;border-radius:3px;
  background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd;
  display:inline-flex;align-items:center;gap:2px;
}
.lc-res-qr{flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:2px}
.lc-res-qr img{width:70px;height:70px;border:1px solid #e2e8f0;border-radius:4px}
.lc-res-qr span{font-size:6.5px;color:#94a3b8;text-align:center;max-width:70px}

/* ── Compact Resource Grid (2-Column in Print) ── */
.lc-res-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;position:relative;z-index:1}
@media print{.lc-res-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}}
.lc-res-card.compact{
  padding:8px 10px;margin-bottom:0;gap:8px;page-break-inside:avoid;break-inside:avoid;
}
.lc-res-card.compact .lc-res-qr img{width:50px;height:50px}
.lc-res-card.compact .lc-res-qr span{font-size:6.5px;max-width:50px}
.lc-res-card.compact .lc-res-name{font-size:11px;margin-bottom:2px}
.lc-res-card.compact .lc-res-addr,.lc-res-card.compact .lc-res-contact,.lc-res-card.compact .lc-res-url{font-size:8.5px;margin-top:2px}

/* ── Statute Text (Flows naturally across pages) ── */
.lc-statute{
  background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ${accentColor};
  border-radius:0!important;padding:8px 12px;margin-bottom:10px;
  page-break-inside:auto!important;break-inside:auto!important;
  -webkit-box-decoration-break:slice!important;box-decoration-break:slice!important;
  position:relative;z-index:1;
}
.lc-statute-num{
  font-size:9.5px;font-weight:800;color:${accentColor};text-transform:uppercase;
  letter-spacing:0.06em;margin-bottom:2px;display:flex;align-items:center;gap:4px;
  break-after:avoid!important;page-break-after:avoid!important;
}
.lc-statute-title{
  font-size:12px;font-weight:700;color:#0f172a;margin-bottom:4px;
  break-after:avoid!important;page-break-after:avoid!important;
}
.lc-statute-body{
  font-size:10px;color:#334155;line-height:1.5;white-space:pre-line!important;
  word-break:break-word;orphans:2;widows:2;
}
.lc-statute-note{
  background:#fffbeb;border-left:3px solid #d97706;padding:4px 8px;
  margin-top:4px;border-radius:0!important;font-size:9px;color:#78350f;
  page-break-inside:avoid;break-inside:avoid;
}

/* ── Comparative Transition Grid (Law Mapper) ── */
.lc-compare-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;position:relative;z-index:1}
.lc-compare-card{border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;background:#f8fafc;page-break-inside:avoid;break-inside:avoid}
.lc-compare-card.old-act{border-top:3px solid #64748b}
.lc-compare-card.new-act{border-top:3px solid ${accentColor}}
.lc-compare-tag{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:3px}
.lc-compare-title{font-size:12px;font-weight:700;color:#0f172a;margin-bottom:5px}
.lc-compare-content{font-size:10px;color:#334155;line-height:1.55}

/* ── Legal Document Draft Formatting (Document Templates) ── */
.lc-legal-draft{
  font-family:Georgia,'Times New Roman',serif;font-size:11.5px;line-height:1.75;
  color:#1e293b;padding:8px 4px;white-space:pre-wrap;text-align:justify;position:relative;z-index:1;
}
.lc-legal-draft h1,.lc-legal-draft h2,.lc-legal-draft h3{font-family:inherit;text-align:center;margin:14px 0 8px;text-transform:uppercase}
.lc-sig-block{display:flex;justify-content:space-between;margin-top:36px;page-break-inside:avoid;break-inside:avoid}
.lc-sig-line{width:180px;border-top:1px solid #0f172a;text-align:center;padding-top:5px;font-size:9.5px;font-weight:700}

/* ── Profile Card ── */
.lc-profile{
  background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;
  padding:10px 12px;margin-bottom:14px;display:flex;gap:10px;align-items:center;
  page-break-inside:avoid;break-inside:avoid;position:relative;z-index:1;
}
.lc-profile-info{flex:1}
.lc-profile-name{font-size:13px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:5px}
.lc-profile-detail{font-size:9.5px;color:#64748b;margin-top:2px}

/* ── Chart Image ── */
.lc-chart-img{width:100%;max-width:100%;border-radius:6px;margin-top:6px;page-break-inside:avoid;break-inside:avoid}

/* ── Progress Bar ── */
.lc-bar-wrap{width:100%;height:6px;background:#f1f5f9;border-radius:4px;overflow:hidden;margin-top:3px}
.lc-bar-fill{height:100%;border-radius:4px}

/* ── Severity Indicators ── */
.lc-severity-high{border-left-color:#ef4444!important}
.lc-severity-medium{border-left-color:#f59e0b!important}
.lc-severity-low{border-left-color:#10b981!important}

/* ── Status Pills ── */
.lc-pill{display:inline-block;padding:2px 7px;border-radius:4px;font-size:8px;font-weight:800;text-transform:uppercase}
.lc-pill-success{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}
.lc-pill-warning{background:#fffbeb;color:#b45309;border:1px solid #fde68a}
.lc-pill-danger{background:#fef2f2;color:#991b1b;border:1px solid #fca5a5}
.lc-pill-neutral{background:#f1f5f9;color:#64748b}

/* ── Utility ── */
.lc-mt{margin-top:12px}
.lc-mb{margin-bottom:12px}
.lc-text-sm{font-size:9.5px}
.lc-text-muted{color:#64748b}
.lc-text-bold{font-weight:700}
.lc-text-mono{font-family:'Courier New',monospace}
.lc-text-green{color:#059669}
.lc-text-amber{color:#b45309}
.lc-text-red{color:#dc2626}
.lc-divider{border:none;border-top:1px solid #e2e8f0;margin:10px 0}

@media print{
  body{margin:0;background:#fff!important;color:#0f172a!important}
  .no-print{display:none!important}
  .lc-statute,.lc-section,.lc-res-card,.lc-kpi,.lc-meta-matrix,.lc-toc-wrap,.lc-privilege-notice{
    border-radius:0!important;
    box-shadow:none!important;
  }
}
${draftCss}${hideHeaderFooterCss}${densityCss}${duplexCss}`;
  }

  /* ─────────────── HTML BUILDING BLOCKS ─────────────── */

  /** Build the official document header */
  private buildHeader(config: {
    title: string;
    subtitle?: string;
    refCode: string;
    accentColor?: string;
    classification?: string;
    headerQrData?: string;
    extraMeta?: { label: string; value: string }[];
  }): string {
    const e = this.escapeHtml.bind(this);
    const { dateStr, timeStr } = this.getTimestamp();
    const parts: string[] = [];

    parts.push(`<div class="lc-header">`);
    parts.push(`<div>`);

    // Document Classification (if requested)
    if (config.classification) {
      parts.push(`<div class="lc-class-badge">${e(config.classification)}</div>`);
    }

    // Brand identity
    parts.push(`<div class="lc-brand">`);
    parts.push(`<div class="lc-brand-icon">${this.BRAND_SVG}</div>`);
    parts.push(`<div>`);
    parts.push(`<div class="lc-brand-name">Legal<span>Connect</span></div>`);
    parts.push(`<div class="lc-brand-tag">${this.BRAND_TAGLINE}</div>`);
    parts.push(`</div></div>`);

    // Document title
    parts.push(`<div class="lc-doc-title">${e(config.title)}</div>`);
    if (config.subtitle) {
      parts.push(`<div class="lc-doc-sub">${e(config.subtitle)}</div>`);
    }
    parts.push(`</div>`);

    // Metadata block + optional Header QR
    parts.push(`<div style="display:flex;align-items:center;gap:12px">`);
    parts.push(`<div class="lc-meta">`);
    parts.push(`<div class="lc-ref">${e(config.refCode)}</div>`);
    parts.push(`<div><strong>Generated:</strong> ${e(dateStr)} &bull; ${e(timeStr)}</div>`);
    if (config.extraMeta) {
      for (const m of config.extraMeta) {
        parts.push(`<div><strong>${e(m.label)}:</strong> ${e(m.value)}</div>`);
      }
    }
    const checkSvg = this.getSvg('badge-check', { size: 10, color: '#059669', style: 'margin-right:2px;' });
    parts.push(`<div><strong>Status:</strong> ${checkSvg} Verified &amp; Audited</div>`);
    parts.push(`</div>`);

    if (config.headerQrData) {
      const qrUrl = this.generateQrUrl(config.headerQrData, 70);
      parts.push(`<div style="text-align:center;flex-shrink:0">
        <img src="${qrUrl}" alt="Registry QR" width="60" height="60" style="border:1px solid #e2e8f0;border-radius:4px;display:block">
        <div style="font-size:7px;color:#64748b;margin-top:2px;font-weight:600">Scan Registry</div>
      </div>`);
    }

    parts.push(`</div></div>`);

    return parts.join('');
  }

  /** Build the official document footer */
  private buildFooter(sealText: string, refCode: string): string {
    const yr = new Date().getFullYear();
    const shieldSvg = this.getSvg('shield', { size: 10, color: '#64748b', style: 'margin-right:3px;' });
    return `<div class="lc-footer">
      <div class="lc-seal">${shieldSvg} ${this.escapeHtml(sealText)}</div>
      <div>&copy; ${yr} ${this.BRAND_NAME} Network Inc. &bull; Document ID: ${this.escapeHtml(refCode)}</div>
    </div>`;
  }

  /** Build a subject strip (for advocate/client identification) */
  buildSubjectStrip(config: { name: string; subtitle?: string; badge?: string }): string {
    const e = this.escapeHtml.bind(this);
    const checkBadgeSvg = config.badge ? this.getSvg('badge-check', { size: 10, color: '#047857', style: 'margin-right:3px;' }) : '';
    return `<div class="lc-subject">
      <div>
        <div class="lc-subject-name">${e(config.name)}</div>
        ${config.subtitle ? `<div class="lc-subject-sub">${e(config.subtitle)}</div>` : ''}
      </div>
      ${config.badge ? `<div class="lc-subject-badge">${checkBadgeSvg}${e(config.badge)}</div>` : ''}
    </div>`;
  }

  /** Build a titled section box wrapper */
  buildSection(title: string, content: string, badge?: string): string {
    return `<div class="lc-section">
      <div class="lc-section-title">
        <span>${this.escapeHtml(title)}</span>
        ${badge ? `<span class="lc-section-badge">${this.escapeHtml(badge)}</span>` : ''}
      </div>
      ${content}
    </div>`;
  }

  /** Build a KPI metrics grid */
  buildKpiGrid(cards: KpiCard[]): string {
    if (!cards || cards.length === 0) return '';
    const parts = ['<div class="lc-kpi-grid">'];
    for (const c of cards) {
      const accent = c.accent || 'indigo';
      parts.push(`<div class="lc-kpi ${this.escapeHtml(accent)}">
        <div class="lc-kpi-label">${this.escapeHtml(c.label)}</div>
        <div class="lc-kpi-val">${this.escapeHtml(c.value)}</div>
        ${c.sub ? `<div class="lc-kpi-sub">${this.escapeHtml(c.sub)}</div>` : ''}
      </div>`);
    }
    parts.push('</div>');
    return parts.join('');
  }

  /** Build a data table with zebra rows and repeating thead */
  buildTable(config: TableConfig): string {
    if (!config.rows || config.rows.length === 0) return '';
    const e = this.escapeHtml.bind(this);
    const parts: string[] = [];

    // Header row with thead (repeats on multi-page print)
    parts.push('<table class="lc-table"><thead><tr>');
    for (const col of config.columns) {
      const align = col.align ? ` class="${col.align}"` : '';
      parts.push(`<th${align}>${e(col.label)}</th>`);
    }
    parts.push('</tr></thead><tbody>');

    // Data rows
    for (const row of config.rows) {
      parts.push('<tr>');
      for (const col of config.columns) {
        const classes: string[] = [];
        if (col.align) classes.push(col.align);
        if (col.mono) classes.push('mono');
        if (col.bold) classes.push('bold');
        const cls = classes.length > 0 ? ` class="${classes.join(' ')}"` : '';
        const val = row[col.key] ?? '';
        const rendered = typeof val === 'string' && (val.startsWith('<') || val.includes('<svg') || val.includes('<span')) ? val : e(val);
        parts.push(`<td${cls}>${rendered}</td>`);
      }
      parts.push('</tr>');
    }
    parts.push('</tbody></table>');

    const tableHtml = parts.join('');
    if (config.title) {
      return this.buildSection(config.title, tableHtml, config.badge);
    }
    return tableHtml;
  }

  /**
   * Builds an Executive Cover Page (Page 1) formatted according to top MNC legaltech standards
   * (Thomson Reuters, LexisNexis, Ironclad). Includes master classification pill, formal seal,
   * metadata identification matrix, 4-metric executive KPI cards, Table of Contents, and
   * Attorney-Client Privilege / DPDP Act statutory compliance warning.
   */
  buildExecutiveCoverPage(config: {
    title: string;
    subtitle?: string;
    refCode: string;
    classification?: string;
    clientName: string;
    clientEmail?: string;
    clientRole?: string;
    kpis: KpiCard[];
    tableOfContents: { section: string; title: string; count: string | number; desc?: string }[];
    notice?: string;
    accentColor?: string;
  }): string {
    const e = this.escapeHtml.bind(this);
    const { dateStr, timeStr } = this.getTimestamp();
    const classification = config.classification || 'ATTORNEY-CLIENT PRIVILEGED // STRICTLY CONFIDENTIAL';
    const shieldSvg = this.getSvg('shield', { size: 13, color: '#1e3a8a', style: 'margin-right:5px;' });
    const checkSvg = this.getSvg('badge-check', { size: 12, color: '#059669', style: 'margin-right:4px;' });
    const lockSvg = this.getSvg('lock', { size: 11, color: '#b91c1c', style: 'margin-right:4px;' });

    const parts: string[] = [];
    parts.push(`<div class="lc-cover-page">`);

    // Top Row: Header & Security Classification
    parts.push(`<div>`);
    parts.push(`<div class="lc-cover-header">`);
    parts.push(`<div class="lc-brand">`);
    parts.push(`<div class="lc-brand-icon" style="background:linear-gradient(135deg,#1e3a8a,#2563eb);">${this.BRAND_SVG}</div>`);
    parts.push(`<div>`);
    parts.push(`<div class="lc-brand-name">Legal<span>Connect</span></div>`);
    parts.push(`<div class="lc-brand-tag">NATIONAL LEGAL REPOSITORY &amp; PRACTICE INFRASTRUCTURE</div>`);
    parts.push(`</div></div>`);
    parts.push(`<div style="text-align:right;">`);
    parts.push(`<div class="lc-class-badge" style="background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;font-size:8.5px;padding:3px 8px;">${lockSvg}${e(classification)}</div>`);
    parts.push(`<div class="lc-ref" style="margin-top:4px;">${e(config.refCode)}</div>`);
    parts.push(`</div></div>`);

    // Main Title & Subtitle
    parts.push(`<div style="margin:16px 0 14px;">`);
    parts.push(`<div style="font-size:9px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#2563eb;margin-bottom:4px;">EXECUTIVE LEGAL BRIEF &bull; MASTER CLIENT DOSSIER</div>`);
    parts.push(`<h1 class="lc-cover-title">${e(config.title)}</h1>`);
    if (config.subtitle) {
      parts.push(`<div class="lc-cover-sub">${e(config.subtitle)}</div>`);
    }
    parts.push(`</div>`);

    // Metadata Identification Matrix
    parts.push(`<div class="lc-meta-matrix">`);
    parts.push(`<div class="lc-meta-item">
      <span class="lc-meta-label">Client / Matter Principal</span>
      <span class="lc-meta-val">${e(config.clientName)}</span>
    </div>`);
    parts.push(`<div class="lc-meta-item">
      <span class="lc-meta-label">Client Account / Contact</span>
      <span class="lc-meta-val">${e(config.clientEmail || 'Verified Platform User')}</span>
    </div>`);
    parts.push(`<div class="lc-meta-item">
      <span class="lc-meta-label">Date &amp; Time of Issuance</span>
      <span class="lc-meta-val">${e(dateStr)} &bull; ${e(timeStr)}</span>
    </div>`);
    parts.push(`<div class="lc-meta-item">
      <span class="lc-meta-label">Statutory Jurisdiction</span>
      <span class="lc-meta-val">Republic of India &bull; Central &amp; State Codes</span>
    </div>`);
    parts.push(`<div class="lc-meta-item">
      <span class="lc-meta-label">Document Security Grade</span>
      <span class="lc-meta-val" style="color:#991b1b;">Class A &bull; Privileged Legal Work Product</span>
    </div>`);
    parts.push(`<div class="lc-meta-item">
      <span class="lc-meta-label">Platform Verification</span>
      <span class="lc-meta-val" style="color:#059669;">${checkSvg} Tamper-Sealed Official Snapshot</span>
    </div>`);
    parts.push(`</div>`);

    // Executive Metrics Strip
    if (config.kpis && config.kpis.length > 0) {
      parts.push(`<div style="margin-bottom:14px;">`);
      parts.push(this.buildKpiGrid(config.kpis));
      parts.push(`</div>`);
    }

    // Table of Contents
    if (config.tableOfContents && config.tableOfContents.length > 0) {
      parts.push(`<div class="lc-toc-wrap">`);
      parts.push(`<div class="lc-toc-title"><span>Dossier Index &amp; Procedural Sections</span><span>Status / Units</span></div>`);
      for (const item of config.tableOfContents) {
        parts.push(`<div class="lc-toc-row">
          <span class="lc-toc-sec">${e(item.section)}</span>
          <div style="flex:1;">
            <div class="lc-toc-name">${e(item.title)}</div>
            ${item.desc ? `<div style="font-size:8.5px;color:#64748b;margin-top:1px;">${e(item.desc)}</div>` : ''}
          </div>
          <span class="lc-toc-count">${e(String(item.count))}</span>
        </div>`);
      }
      parts.push(`</div>`);
    }
    parts.push(`</div>`); // end top block

    // Bottom Block: Legal Privilege Notice & Bottom Bar
    parts.push(`<div>`);
    parts.push(`<div class="lc-privilege-notice">
      <div class="lc-privilege-title">${shieldSvg} PRIVILEGED &amp; CONFIDENTIAL ATTORNEY-CLIENT WORK PRODUCT</div>
      <div>${e(config.notice || 'This comprehensive dossier is compiled from user-curated legal research, active consultations, and verified practice directories on the LegalConnect platform. The contents hereof contain confidential, proprietary, and legally privileged work product. Any unauthorized dissemination, copying, distribution, or action taken in reliance on the contents of this information is strictly prohibited under the Advocates Act, 1961, the Bar Council of India Rules, and the Digital Personal Data Protection (DPDP) Act, 2023.')}</div>
    </div>`);

    parts.push(`<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:8px;color:#94a3b8;">
      <div>&copy; ${new Date().getFullYear()} ${this.BRAND_NAME} Legal Technologies Inc. &bull; Page 1 of Executive Dossier</div>
      <div style="font-family:'Courier New',monospace;font-weight:700;color:#64748b;">AUTHENTICITY KEY: ${e(config.refCode)}</div>
    </div>`);
    parts.push(`</div>`); // end bottom block

    parts.push(`</div>`); // end .lc-cover-page
    return parts.join('');
  }

  /** Build a list of print-optimized resource cards with optional GPS QR codes */
  buildResourceCards(resources: PrintableResource[], options: { showQr?: boolean; compact?: boolean } = {}): string {
    if (!resources || resources.length === 0) return '';
    const shouldShowQr = options.showQr != null ? options.showQr : resources.length <= 10;
    const isCompact = !!options.compact;
    const parts: string[] = [];
    if (isCompact) parts.push('<div class="lc-res-grid">');
    for (const r of resources) {
      parts.push(this.buildSingleResourceCard(r, shouldShowQr, isCompact));
    }
    if (isCompact) parts.push('</div>');
    return parts.join('');
  }

  /** Build a single resource card for print */
  private buildSingleResourceCard(r: PrintableResource, showQr = true, isCompact = false): string {
    const e = this.escapeHtml.bind(this);
    const type = r.type || '';
    const typeClass = type === 'LegalAid' ? 'legal-aid' :
      type === 'Court' ? 'court' :
        (type === 'GovernmentOffice' || type === 'PoliceStation') ? 'gov' : '';
    const cardClass = type === 'LegalAid' ? 'type-legal-aid' :
      type === 'Court' ? 'type-court' :
        (type === 'GovernmentOffice' || type === 'PoliceStation') ? 'type-gov' : '';

    const phoneSvg = this.getSvg('phone', { size: 11, color: '#0f172a', style: 'margin-right:4px;' });
    const globeSvg = this.getSvg('globe', { size: 11, color: '#2563eb', style: 'margin-right:4px;' });
    const mapPinSvg = this.getSvg('map-pin', { size: 11, color: '#64748b', style: 'margin-right:4px;' });

    const compactClass = isCompact ? 'compact' : '';
    const parts: string[] = [];
    parts.push(`<div class="lc-res-card ${cardClass} ${compactClass}">`);
    parts.push(`<div class="lc-res-body">`);

    // Type badge
    parts.push(`<div class="lc-res-type ${typeClass}">${e(this.getTypeLabel(type))}</div>`);

    // Name
    parts.push(`<div class="lc-res-name">${e(r.name)}</div>`);

    // Address with map-pin SVG
    const addr = r.address || [r.city, r.state].filter(Boolean).join(', ');
    if (addr) {
      parts.push(`<div class="lc-res-addr">${mapPinSvg} <span>${e(addr)}${r.pincode ? ` — ${e(r.pincode)}` : ''}</span></div>`);
    }

    // Contact info with phone SVG
    const phone = r.contactNumber || r.number || r.alternateNumber || (Array.isArray(r.phones) ? r.phones[0] : '');
    if (phone) {
      parts.push(`<div class="lc-res-contact">${phoneSvg} <span><strong>Contact:</strong> ${e(phone)}</span></div>`);
    }

    // Official portal URL with globe SVG
    const url = r.website || r.officialPortal || '';
    if (url) {
      const cleanUrl = String(url).replace(/^https?:\/\//, '');
      parts.push(`<div class="lc-res-url">${globeSvg} <span>${e(cleanUrl)}</span></div>`);
    }

    // Facility tags with badge-check SVG
    const tags = this.getResourceFacilityTags(r);
    if (tags.length > 0) {
      const checkTagSvg = this.getSvg('badge-check', { size: 8, color: '#0369a1' });
      parts.push(`<div class="lc-res-tags">`);
      for (const tag of tags) {
        parts.push(`<span class="lc-res-tag">${checkTagSvg} ${e(tag)}</span>`);
      }
      parts.push(`</div>`);
    }

    parts.push(`</div>`);

    // QR code for GPS directions (renders when showQr is enabled)
    if (showQr) {
      const mapsUrl = this.getResourceMapsUrl(r);
      const qrSize = isCompact ? 50 : 75;
      const qrUrl = this.generateQrUrl(mapsUrl, qrSize);
      parts.push(`<div class="lc-res-qr">`);
      parts.push(`<img src="${qrUrl}" alt="GPS QR" width="${qrSize}" height="${qrSize}">`);
      parts.push(`<span>Scan for GPS</span>`);
      parts.push(`</div>`);
    }

    parts.push(`</div>`);
    return parts.join('');
  }

  /**
   * Build a comprehensive, official institutional dossier for a Legal Resource
   * (Court, DLSA/SLSA Legal Aid Center, Government Office, Police Station, etc.)
   * Includes complete contact details, Section 12 eligibility, 4-step application procedure,
   * citizen document checklist, facilities, and deep GPS QR navigation.
   *
   * @param r The printable legal resource entity containing institutional contact details, facilities, and coordinates.
   * @returns Formatted HTML string ready for injection into print document assembly.
   */
  buildResourceDossier(r: PrintableResource): string {
    if (!r) return '';
    const e = this.escapeHtml.bind(this);
    const parts: string[] = [];

    // 1. Institutional Subject Strip
    parts.push(this.buildSubjectStrip({
      name: r.name,
      subtitle: `${r.address ? e(r.address) + ' • ' : ''}${r.state ? e(r.state) + ' Registry • ' : ''}${e(this.getTypeLabel(r.type || ''))}`,
      badge: 'Verified Official Registry Entry'
    }));

    // 2. KPI Metrics Strip
    const kpis: KpiCard[] = [
      {
        label: 'Institutional Body',
        value: this.getTypeLabel(r.type || ''),
        sub: 'Statutory Legal Facility',
        accent: 'indigo'
      },
      {
        label: 'Jurisdiction Level',
        value: r.jurisdictionLevel || 'State / District',
        sub: `${r.state || 'National'} Registry`,
        accent: 'blue'
      },
      {
        label: 'Citizen Legal Fee',
        value: '₹0.00',
        sub: '100% Free Defense Aid',
        accent: 'emerald'
      },
      {
        label: 'Desk Hours',
        value: r.operatingHours ? r.operatingHours.split('(')[0].trim() : '10 AM - 5 PM',
        sub: 'Mon - Sat (Court Days)',
        accent: 'amber'
      }
    ];
    parts.push(this.buildKpiGrid(kpis));

    // 3. Contact & Navigation Block
    const mapPinSvg = this.getSvg('map-pin', { size: 12, color: '#4f46e5', style: 'margin-right:4px;' });
    const phoneSvg = this.getSvg('phone', { size: 12, color: '#059669', style: 'margin-right:4px;' });
    const clockSvg = this.getSvg('clock', { size: 12, color: '#b45309', style: 'margin-right:4px;' });
    const globeSvg = this.getSvg('globe', { size: 12, color: '#2563eb', style: 'margin-right:4px;' });
    const mailSvg = this.getSvg('mail', { size: 12, color: '#7c3aed', style: 'margin-right:4px;' });

    const phones = r.contactNumber && r.contactNumber.length > 0
      ? r.contactNumber.join(' • ')
      : (r.number || r.alternateNumber || 'N/A');

    const emails = r.email && r.email.length > 0 ? r.email.join(', ') : 'N/A';
    const website = r.website || r.officialPortal || 'https://services.ecourts.gov.in';

    const mapsUrl = this.getResourceMapsUrl(r);
    const qrUrl = this.generateQrUrl(mapsUrl, 100);

    const contactHtml = `
      <div style="display:flex;gap:16px;align-items:flex-start;">
        <div style="flex:1;">
          <table class="lc-table" style="margin-top:0;">
            <tbody>
              <tr>
                <td style="width:26%;font-weight:700;color:#475569;">${mapPinSvg} Postal Address</td>
                <td style="color:#0f172a;font-weight:600;">${e(r.address || [r.district, r.city, r.state].filter(Boolean).join(', '))}${r.pincode ? ' — ' + e(r.pincode) : ''}</td>
              </tr>
              <tr>
                <td style="font-weight:700;color:#475569;">${phoneSvg} Direct Helplines</td>
                <td style="color:#0f172a;font-weight:700;">${e(phones)}</td>
              </tr>
              <tr>
                <td style="font-weight:700;color:#475569;">${clockSvg} Working Hours</td>
                <td style="color:#334155;">${e(r.operatingHours || '10:00 AM - 5:00 PM (Monday to Saturday)')}${r.lunchBreak ? ' &bull; <em>Lunch: ' + e(r.lunchBreak) + '</em>' : ''} &bull; <span style="color:#64748b;">Closed 2nd/4th Saturdays &amp; Holidays</span></td>
              </tr>
              <tr>
                <td style="font-weight:700;color:#475569;">${mailSvg} Official Email</td>
                <td style="color:#334155;">${e(emails)}</td>
              </tr>
              <tr>
                <td style="font-weight:700;color:#475569;">${globeSvg} Official Portal</td>
                <td><a href="${e(website)}" style="color:#2563eb;text-decoration:none;font-weight:600;">${e(website)}</a></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="text-align:center;flex-shrink:0;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
          <img src="${qrUrl}" alt="GPS QR" width="90" height="90" style="display:block;border-radius:4px;border:1px solid #cbd5e1;">
          <div style="font-size:8px;font-weight:700;color:#0f172a;margin-top:4px;">Scan for GPS Route</div>
          <div style="font-size:7px;color:#64748b;">Live Google Maps</div>
        </div>
      </div>
    `;
    parts.push(this.buildSection('Institutional Contact &amp; GPS Location', contactHtml));

    // 4. Section 12 Statutory Free Legal Aid Eligibility Matrix
    const scaleSvg = this.getSvg('scale', { size: 12, color: '#4f46e5', style: 'margin-right:4px;' });
    const checkSvg = this.getSvg('check', { size: 10, color: '#059669', style: 'margin-right:4px;' });

    const eligibilityHtml = `
      <div style="font-size:10px;color:#64748b;margin-bottom:8px;">
        ${scaleSvg} <strong>Legal Services Authorities Act, 1987 (Section 12):</strong> Qualified citizens receive 100% free legal defense representation with ₹0 fees in all court proceedings.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;">
          <strong style="color:#0f172a;font-size:11px;">${checkSvg} 1. Women &amp; Children</strong>
          <div style="font-size:9.5px;color:#475569;margin-top:1px;">All women &amp; children irrespective of annual income or social background.</div>
        </div>
        <div style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;">
          <strong style="color:#0f172a;font-size:11px;">${checkSvg} 2. Scheduled Castes &amp; Scheduled Tribes</strong>
          <div style="font-size:9.5px;color:#475569;margin-top:1px;">Members of SC/ST communities receive 100% free legal defense in all courts.</div>
        </div>
        <div style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;">
          <strong style="color:#0f172a;font-size:11px;">${checkSvg} 3. Persons in Custody / Undertrials</strong>
          <div style="font-size:9.5px;color:#475569;margin-top:1px;">Anyone in police lockup, judicial custody, or jail is entitled to a free defense lawyer.</div>
        </div>
        <div style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;">
          <strong style="color:#0f172a;font-size:11px;">${checkSvg} 4. Persons with Disabilities (PwD)</strong>
          <div style="font-size:9.5px;color:#475569;margin-top:1px;">Citizens with physical disabilities, blindness, or mental illness under the PwD Act.</div>
        </div>
        <div style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;">
          <strong style="color:#0f172a;font-size:11px;">${checkSvg} 5. Victims of Trafficking &amp; Begar</strong>
          <div style="font-size:9.5px;color:#475569;margin-top:1px;">Victims of human trafficking, forced bonded labor, or commercial exploitation.</div>
        </div>
        <div style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;">
          <strong style="color:#0f172a;font-size:11px;">${checkSvg} 6. Disaster &amp; Violence Victims</strong>
          <div style="font-size:9.5px;color:#475569;margin-top:1px;">Victims of mass disasters, ethnic/caste violence, floods, or industrial accidents.</div>
        </div>
        <div style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;">
          <strong style="color:#0f172a;font-size:11px;">${checkSvg} 7. Industrial Laborers &amp; Workmen</strong>
          <div style="font-size:9.5px;color:#475569;margin-top:1px;">Factory workers, construction laborers, and unorganized sector employees.</div>
        </div>
        <div style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;">
          <strong style="color:#0f172a;font-size:11px;">${checkSvg} 8. Low Income Citizens (&lt; ₹3 Lakh/yr)</strong>
          <div style="font-size:9.5px;color:#475569;margin-top:1px;">Annual family income below statutory state ceiling (₹3,00,000/yr in UP).</div>
        </div>
      </div>
    `;
    parts.push(this.buildSection('Section 12 Free Legal Aid Eligibility (Statutory)', eligibilityHtml, '100% Free Defense'));

    // 5. 4-Step Standard Legal Aid Application Procedure
    const stepsHtml = `
      <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:8px;">
        <div style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;">
          <div style="display:inline-block;width:18px;height:18px;border-radius:50%;background:#4f46e5;color:#fff;text-align:center;font-size:10px;font-weight:800;line-height:18px;margin-bottom:4px;">1</div>
          <div style="font-weight:700;font-size:10.5px;color:#0f172a;">Walk-in / Online</div>
          <div style="font-size:9px;color:#475569;margin-top:2px;">Visit Front Office at ADR Center or submit on NALSA portal.</div>
        </div>
        <div style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;">
          <div style="display:inline-block;width:18px;height:18px;border-radius:50%;background:#4f46e5;color:#fff;text-align:center;font-size:10px;font-weight:800;line-height:18px;margin-bottom:4px;">2</div>
          <div style="font-weight:700;font-size:10.5px;color:#0f172a;">Eligibility Check</div>
          <div style="font-size:9px;color:#475569;margin-top:2px;">Secretary / Paralegal checks papers &amp; Section 12 criteria.</div>
        </div>
        <div style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;">
          <div style="display:inline-block;width:18px;height:18px;border-radius:50%;background:#4f46e5;color:#fff;text-align:center;font-size:10px;font-weight:800;line-height:18px;margin-bottom:4px;">3</div>
          <div style="font-weight:700;font-size:10.5px;color:#0f172a;">Counsel Assigned</div>
          <div style="font-size:9px;color:#475569;margin-top:2px;">Panel advocate (LADCS) assigned within 24-48 hours.</div>
        </div>
        <div style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;">
          <div style="display:inline-block;width:18px;height:18px;border-radius:50%;background:#4f46e5;color:#fff;text-align:center;font-size:10px;font-weight:800;line-height:18px;margin-bottom:4px;">4</div>
          <div style="font-weight:700;font-size:10.5px;color:#0f172a;">Court Defense</div>
          <div style="font-size:9px;color:#475569;margin-top:2px;">Assigned lawyer drafts, files petitions &amp; argues case (₹0 fee).</div>
        </div>
      </div>
    `;
    parts.push(this.buildSection('Standard 4-Step Application Procedure', stepsHtml, 'Official NALSA Flow'));

    // 6. Citizen Preparation Checklist & Visitor Security Protocol
    const checklistHtml = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <strong style="font-size:10.5px;color:#0f172a;display:block;margin-bottom:4px;">Bring Original + 2 Self-Attested Photocopies:</strong>
          <ul style="list-style:none;padding-left:0;font-size:9.5px;color:#334155;line-height:1.6;">
            <li><span style="font-family:monospace;font-weight:700;color:#059669;">[ &check; ]</span> <strong>Govt Photo ID:</strong> Aadhaar Card, Voter ID, or Passport</li>
            <li><span style="font-family:monospace;font-weight:700;color:#059669;">[ &check; ]</span> <strong>Income Proof:</strong> BPL Card or Salary Slip (Not required for Women, SC/ST, Custody)</li>
            <li><span style="font-family:monospace;font-weight:700;color:#059669;">[ &check; ]</span> <strong>Case Papers:</strong> FIR copy, Police notice, Court summons, or previous orders</li>
            <li><span style="font-family:monospace;font-weight:700;color:#059669;">[ &check; ]</span> <strong>Brief Grievance:</strong> Written complaint summary (Paralegal volunteers assist on-site)</li>
          </ul>
        </div>
        <div style="padding:8px 10px;border-left:3px solid #f59e0b;background:#fffbeb;border-radius:4px;font-size:9.5px;color:#92400e;line-height:1.5;">
          <strong style="color:#78350f;font-size:10px;display:block;margin-bottom:2px;">Campus Visitor Security Protocol:</strong>
          &bull; Valid Government Photo ID required at security checkpoint.<br>
          &bull; Mobile phones must remain on silent mode in ADR / Court rooms.<br>
          &bull; <strong>Statutory Notice:</strong> DLSA / Legal Aid application and defense counsel assignment are 100% free (₹0.00). No fee or bribe shall be demanded.
        </div>
      </div>
    `;
    parts.push(this.buildSection('Citizen Document Preparation Checklist &amp; Protocol', checklistHtml));

    // 7. Facilities & Digital Amenities
    const facilityTags = this.getResourceFacilityTags(r);
    if (facilityTags.length > 0 || (r.languages && r.languages.length > 0)) {
      const facilityParts: string[] = [];
      if (facilityTags.length > 0) {
        facilityParts.push(`<div><strong>Digital Amenities &amp; Infrastructure:</strong> `);
        for (const tag of facilityTags) {
          facilityParts.push(`<span class="lc-res-tag" style="margin-right:4px;">${this.getSvg('badge-check', { size: 8, color: '#0369a1' })} ${e(tag)}</span>`);
        }
        facilityParts.push(`</div>`);
      }
      if (r.languages && r.languages.length > 0) {
        facilityParts.push(`<div style="margin-top:6px;"><strong>Languages Spoken at Desk:</strong> ${e(r.languages.join(', '))}</div>`);
      }
      parts.push(this.buildSection('Campus Facilities &amp; Desk Languages', facilityParts.join('')));
    }

    // 8. Judicial Leadership (if available)
    if (r.patronInChief || r.executiveChairman || r.memberSecretary) {
      const leadershipRows: string[] = [];
      if (r.patronInChief) leadershipRows.push(`<tr><td style="font-weight:700;color:#475569;width:30%;">Patron-in-Chief</td><td style="color:#0f172a;font-weight:600;">${e(r.patronInChief)}</td></tr>`);
      if (r.executiveChairman) leadershipRows.push(`<tr><td style="font-weight:700;color:#475569;">Executive Chairman</td><td style="color:#0f172a;font-weight:600;">${e(r.executiveChairman)}</td></tr>`);
      if (r.memberSecretary) leadershipRows.push(`<tr><td style="font-weight:700;color:#475569;">Member Secretary</td><td style="color:#0f172a;font-weight:600;">${e(r.memberSecretary)}</td></tr>`);
      parts.push(this.buildSection('Judicial Leadership &amp; Administrative Officers', `<table class="lc-table"><tbody>${leadershipRows.join('')}</tbody></table>`));
    }

    // 9. 24x7 National Legal Aid Helpline Banner
    const helplineHtml = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;">
        <div style="font-size:10px;color:#991b1b;font-weight:700;">
          ${this.getSvg('phone', { size: 11, color: '#dc2626', style: 'margin-right:3px;' })}
          24x7 National Legal Aid Toll-Free Helpline: <strong>15100</strong> (NALSA Tele-Law) &bull; National Emergency: <strong>112</strong>
        </div>
        <div style="font-size:9px;color:#7f1d1d;font-weight:600;">e-Courts Status: services.ecourts.gov.in</div>
      </div>
    `;
    parts.push(helplineHtml);

    return parts.join('');
  }

  /** Build robust Google Maps directions / search URL from resource */
  private getResourceMapsUrl(r: PrintableResource): string {
    const coords = r.coordinates;
    let lat: number | null = null;
    let lng: number | null = null;

    if (coords) {
      if (Array.isArray(coords)) {
        lat = coords[0];
        lng = coords[1];
      } else if (typeof coords === 'object') {
        lat = coords.lat ?? null;
        lng = coords.lng ?? null;
      }
    }
    if (lat == null && r.lat != null) lat = r.lat;
    if (lng == null && r.lng != null) lng = r.lng;
    if (lat == null && lng == null && r.location?.coordinates && Array.isArray(r.location.coordinates)) {
      lng = r.location.coordinates[0];
      lat = r.location.coordinates[1];
    }
    if (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng)) && Number(lat) !== 0 && Number(lng) !== 0) {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }
    const query = encodeURIComponent([r.name, r.address, r.city, r.state].filter(Boolean).join(', '));
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  /** Extract facility tags from a resource object */
  private getResourceFacilityTags(r: PrintableResource): string[] {
    const tags: string[] = [];
    const f = r.facilities;
    if (!f) return tags;
    if (f.hasEfiling) tags.push('e-Filing');
    if (f.hasLADCS) tags.push('LADCS');
    if (f.hasVCRoom) tags.push('VC Room');
    if (f.hasLegalAidClinic) tags.push('Clinic');
    if (f.isWheelchairAccessible) tags.push('Accessible');
    return tags;
  }

  /**
   * Build statute/law section text with scale SVG and optional research notes
   *
   * @param section The statutory section model including section number, title, and legal content.
   * @param act The parent act metadata including official name, short name, and enactment year.
   * @param notes Optional practitioner research notes or cross-citations to append.
   * @returns Formatted HTML string ready for document assembly.
   */
  buildStatuteText(section: PrintableStatuteSection, act: PrintableAct, notes?: string): string {
    const e = this.escapeHtml.bind(this);
    let rawContent = section?.content || section?.introduction_text || section?.snippet || '';
    let cleanContent = '';

    if (Array.isArray(rawContent)) {
      cleanContent = rawContent
        .map((item: any) => (typeof item === 'string' ? item : (item?.text || item?.content || '')))
        .filter(Boolean)
        .join('\n\n');
    } else if (typeof rawContent === 'object' && rawContent !== null) {
      cleanContent = (rawContent as any).text || (rawContent as any).content || '';
    } else {
      cleanContent = String(rawContent).replace(/<[^>]*>/g, '').trim();
    }

    if (cleanContent.includes('[object Object]') && section?.content_blocks && Array.isArray(section.content_blocks)) {
      cleanContent = section.content_blocks.map((b: any) => b.text || '').filter(Boolean).join('\n\n');
    }
    if (cleanContent.includes('[object Object]')) {
      cleanContent = cleanContent.replace(/\[object Object\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
    }

    const scaleSvg = this.getSvg('scale', { size: 12, color: '#4f46e5', style: 'margin-right:4px;' });
    const yearPart = act?.year ? `, ${e(act.year)}` : '';
    const parts: string[] = [];
    parts.push(`<div class="lc-statute">`);
    parts.push(`<div class="lc-statute-num">${scaleSvg} Section ${e(section?.section_number)} — ${e(act?.actName || act?.shortName || '')}${yearPart}</div>`);
    if (section?.title) {
      parts.push(`<div class="lc-statute-title">${e(section.title)}</div>`);
    }
    parts.push(`<div class="lc-statute-body">${e(cleanContent)}</div>`);
    if (notes) {
      parts.push(`<div class="lc-statute-note"><strong>Research Notes:</strong> ${e(notes)}</div>`);
    }
    parts.push(`</div>`);
    return parts.join('');
  }

  /** Build a profile card (for data exports) */
  buildProfileCard(profile: PrintableUserProfile): string {
    const e = this.escapeHtml.bind(this);
    const name = profile?.fullName || profile?.FullName || 'User';
    const email = profile?.email || profile?.Email || '';
    const role = profile?.role || profile?.Role || '';
    const userSvg = this.getSvg('user', { size: 14, color: '#4f46e5', style: 'margin-right:6px;' });
    return `<div class="lc-profile">
      <div class="lc-profile-info">
        <div class="lc-profile-name">${userSvg} ${e(name)}</div>
        <div class="lc-profile-detail">${e(email)}${role ? ` &bull; ${e(role)}` : ''}</div>
      </div>
    </div>`;
  }

  /** Build a chart image section from a base64 string */
  buildChartImage(base64: string, caption?: string): string {
    if (!base64) return '';
    return `<div>
      <img class="lc-chart-img" src="${base64}" alt="${this.escapeHtml(caption || 'Chart')}">
      ${caption ? `<div style="font-size:9px;color:#64748b;text-align:center;margin-top:4px">${this.escapeHtml(caption)}</div>` : ''}
    </div>`;
  }

  /** Build a progress bar */
  buildProgressBar(percentage: number, color = '#059669'): string {
    const pct = Math.max(0, Math.min(100, percentage));
    return `<div class="lc-bar-wrap"><div class="lc-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
  }

  /**
   * Build a comprehensive case pack section (law section + precedents + pro-se litigation guide)
   *
   * @param config The case pack configuration object containing statutory section, parent act, severity level, precedents, and pro-se guide.
   * @returns Formatted HTML string representing the case pack.
   */
  buildCasePack(config: {
    section: PrintableStatuteSection;
    act: PrintableAct;
    severity?: string;
    laymanExplanation?: string;
    precedents?: any[];
    proSeGuide?: any;
  }): string {
    const e = this.escapeHtml.bind(this);
    const parts: string[] = [];
    const sev = config.severity || 'low';
    const scaleSvg = this.getSvg('scale', { size: 12, color: '#4f46e5', style: 'margin-right:4px;' });

    // Section box with severity
    const content = config.section?.content || config.section?.introduction_text || config.section?.snippet || '';
    const cleanContent = String(content).replace(/<[^>]*>/g, '');
    parts.push(`<div class="lc-statute lc-severity-${sev}">`);
    parts.push(`<div class="lc-statute-num">${scaleSvg} Section ${e(config.section?.section_number)} — ${e(config.act?.actName || config.act?.shortName || '')}, ${e(config.act?.year || '')}</div>`);
    parts.push(`<div class="lc-statute-title">${e(config.section?.title || '')}</div>`);
    parts.push(`<div class="lc-statute-body">${e(cleanContent)}</div>`);
    parts.push(`</div>`);

    // Layman's explanation
    if (config.laymanExplanation) {
      parts.push(this.buildSection('Simplified Explanation', `<div style="font-size:11px;color:#334155;line-height:1.6">${e(config.laymanExplanation)}</div>`));
    }

    // Precedents
    if (config.precedents && config.precedents.length > 0) {
      const precParts: string[] = [];
      const landmarkSvg = this.getSvg('landmark', { size: 11, color: '#4f46e5', style: 'margin-right:4px;' });
      for (const p of config.precedents) {
        precParts.push(`<div style="margin-bottom:10px;padding:10px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc">
          <div style="display:flex;justify-content:space-between;font-weight:600;font-size:11px;color:#1e293b;margin-bottom:3px">
            <span>${landmarkSvg} ${e(p.caseName)}</span>
            <span class="lc-text-mono" style="color:#64748b">${e(p.citation)}</span>
          </div>
          <div style="font-size:10px;color:#475569"><strong>Holding:</strong> ${e(p.holding)}</div>
        </div>`);
      }
      parts.push(this.buildSection('Landmark Precedents', precParts.join(''), `${config.precedents.length} Cases`));
    }

    // Pro-se guide
    if (config.proSeGuide) {
      const g = config.proSeGuide;
      const guideRows: string[] = [];
      const guideFields = [
        { label: 'Judicial Forum', icon: 'landmark', value: g.forum },
        { label: 'Court Fee Estimate', icon: 'dollar-sign', value: g.courtFee },
        { label: 'Limitation Period', icon: 'clock', value: g.limitation },
        { label: 'Procedural Steps', icon: 'file-text', value: g.steps },
        { label: 'Required Documents', icon: 'checkbox', value: g.documents },
      ];
      for (const f of guideFields) {
        if (f.value) {
          const rowIcon = this.getSvg(f.icon, { size: 11, color: '#64748b', style: 'margin-right:4px;' });
          guideRows.push(`<tr><td style="font-weight:600;color:#475569;width:30%">${rowIcon} ${e(f.label)}</td><td style="color:#334155">${e(f.value)}</td></tr>`);
        }
      }
      if (guideRows.length > 0) {
        parts.push(this.buildSection('Pro-Se Litigation Guide', `<table class="lc-table"><tbody>${guideRows.join('')}</tbody></table>`));
      }
    }

    return parts.join('');
  }

  /**
   * Build comparative law transition block (Old Code vs New Criminal Code)
   *
   * @param config Configuration specifying legacy act/section, enacted reform act/section, similarity score, and diff summary.
   * @returns Formatted HTML string containing side-by-side comparative cards and legislative concordance analysis.
   */
  buildLawTransition(config: {
    oldAct: string;
    oldSection: any;
    newAct: string;
    newSection: any;
    similarity?: number;
    differencesSummary?: string;
  }): string {
    const e = this.escapeHtml.bind(this);
    const parts: string[] = [];

    const oldContent = config.oldSection?.content || config.oldSection?.introduction_text || '';
    const newContent = config.newSection?.content || config.newSection?.introduction_text || '';

    // Concordance Side-by-side
    parts.push(`<div class="lc-compare-grid">`);

    // Old Law Card
    parts.push(`<div class="lc-compare-card old-act">
      <div class="lc-compare-tag">Previous Regime &bull; ${e(config.oldAct)}</div>
      <div class="lc-compare-title">Section ${e(config.oldSection?.section_number)}: ${e(config.oldSection?.title)}</div>
      <div class="lc-compare-content">${e(String(oldContent).replace(/<[^>]*>/g, ''))}</div>
    </div>`);

    // New Law Card
    parts.push(`<div class="lc-compare-card new-act">
      <div class="lc-compare-tag">Current Enacted Law &bull; ${e(config.newAct)}</div>
      <div class="lc-compare-title">Section ${e(config.newSection?.section_number)}: ${e(config.newSection?.title)}</div>
      <div class="lc-compare-content">${e(String(newContent).replace(/<[^>]*>/g, ''))}</div>
    </div>`);

    parts.push(`</div>`);

    // Analysis / Diff Summary
    if (config.differencesSummary || config.similarity != null) {
      const simBadge = config.similarity != null ? `${config.similarity}% Substantive Match` : undefined;
      const diffText = config.differencesSummary || `Statutory mapping reflects legislative modernization under ${config.newAct}.`;
      parts.push(this.buildSection('Transition Analysis &amp; Legislative Notes', `<div style="font-size:11px;color:#334155;line-height:1.6">${e(diffText)}</div>`, simBadge));
    }

    return parts.join('');
  }

  /** Build a legal document draft (for Document Templates execution) */
  buildLegalDraft(text: string, options: { hasSignatureBlock?: boolean; parties?: string[] } = {}): string {
    const e = this.escapeHtml.bind(this);
    const parts: string[] = [];

    parts.push(`<div class="lc-legal-draft">${e(text)}</div>`);

    if (options.hasSignatureBlock !== false) {
      parts.push(`<div class="lc-sig-block">
        <div class="lc-sig-line">Executed by / First Party</div>
        <div class="lc-sig-line">In Presence of / Witness</div>
      </div>`);
    }

    return parts.join('');
  }

  /** Build raw HTML content for articles */
  buildArticleContent(htmlContent: string): string {
    return `<div style="font-size:12px;color:#1e293b;line-height:1.7">${htmlContent || ''}</div>`;
  }

  /* ─────────────── DOCUMENT ASSEMBLY ─────────────── */

  /** Assemble a complete HTML print document from the config */
  private assembleDocument(config: PrintConfig, opts: { preview?: boolean } = {}): string {
    const refCode = this.generateRefCode(opts.preview ? 'PRV' : 'DOC');
    const accent = config.accentColor || '#4f46e5';
    const seal = config.sealText || `Official ${this.BRAND_NAME} Document`;

    let styles = this.buildStyles({
      accentColor: accent, paperSize: config.paperSize, orientation: config.orientation,
      margins: config.margins, customMargins: config.customMargins, scale: config.scale,
      colorMode: config.colorMode, printQuality: config.printQuality,
      showBackgroundGraphics: config.showBackgroundGraphics, showHeaderFooter: config.showHeaderFooter,
      preview: opts.preview,
      tableDensity: config.tableDensity,
      duplexPrint: config.duplexPrint,
    });
    // On-screen preview: make print-only rules apply so the preview matches the paper output
    if (opts.preview) styles = styles.replace(/@media print/g, '@media all');

    const parts: string[] = [];
    parts.push(`<!DOCTYPE html><html lang="en"><head>`);
    parts.push(`<meta charset="utf-8">`);
    const docTitle = opts.preview ? 'Preview' : (config.fileName || `${config.title} | ${this.BRAND_NAME}`);
    parts.push(`<title>${this.escapeHtml(docTitle)}</title>`);
    parts.push(`<style>${styles}</style>`);
    parts.push(`</head><body>`);

    // Watermark (if specified) — position:fixed so it repeats on every printed page
    if (config.watermark) {
      parts.push(`<div class="lc-watermark">${this.escapeHtml(config.watermark)}</div>`);
    }

    // Document body (repeated per copy, collated, each copy starting on a fresh sheet)
    const body: string[] = [];

    // Cover Page (if specified)
    if (config.coverPage) {
      body.push(config.coverPage);
    }

    // Header (if not suppressed by cover page)
    if (!config.suppressDefaultHeader && config.showHeaderFooter !== false) {
      body.push(this.buildHeader({
        title: config.title,
        subtitle: config.subtitle,
        refCode,
        accentColor: accent,
        classification: config.classification,
        headerQrData: config.headerQrData,
        extraMeta: config.extraMeta,
      }));
    }

    // Subject strip (optional)
    if (config.subjectStrip) {
      body.push(config.subjectStrip);
    }

    // Main content
    body.push(config.content);

    // Footer
    if (config.showHeaderFooter !== false) {
      body.push(this.buildFooter(seal, refCode));
    }

    const bodyHtml = body.join('');
    const copies = opts.preview ? 1 : Math.min(Math.max(Math.floor(config.copies || 1), 1), 50);
    for (let i = 0; i < copies; i++) {
      if (i > 0) parts.push(`<div class="lc-copy-break"></div>`);
      parts.push(bodyHtml);
    }

    if (!opts.preview) {
      // Auto-print script that synchronizes image decoding and font readiness before invoking window.print().
      // Guarded so the dialog can never open twice (load + safety timeout race).
      parts.push(`<script>
      window.onload=function(){
        function doPrint(){
          if(window.__lcPrinted)return;window.__lcPrinted=true;
          try { window.focus(); window.print(); } catch(e){}
        }
        var imgs = Array.prototype.slice.call(document.images);
        var imgPromises = imgs.map(function(img){
          if(img.decode){
            return img.decode().catch(function(){});
          }
          return new Promise(function(resolve){
            if(img.complete) resolve();
            else { img.onload=img.onerror=resolve; }
          });
        });
        var fontPromise = (document.fonts && document.fonts.ready) ? document.fonts.ready.catch(function(){}) : Promise.resolve();
        Promise.all([Promise.all(imgPromises), fontPromise]).then(function(){
          requestAnimationFrame(function(){ setTimeout(doPrint, 80); });
        }).catch(function(){
          setTimeout(doPrint, 80);
        });
        setTimeout(doPrint, 3500);
      };
      window.onafterprint=function(){
        try { window.close(); } catch(e){}
      };
    </script>`);
    }

    parts.push(`</body></html>`);
    return parts.join('');
  }

  /* ─────────────── PRINT ENGINE ─────────────── */

  /**
   * Render HTML in a new window and trigger print dialog.
   * Falls back to a hidden iframe if the popup is blocked.
   */
  private renderAndPrint(htmlContent: string, documentTitle: string, onPopupBlocked?: () => void): boolean {
    if (typeof window === 'undefined') return false;

    // Strategy 1: Popup window (preferred — clean, separate context)
    try {
      const pw = window.open('', '_blank', 'width=960,height=820,scrollbars=yes,status=no,menubar=no,toolbar=no');
      if (pw && !pw.closed) {
        pw.document.open();
        pw.document.write(htmlContent);
        pw.document.title = documentTitle;
        pw.document.close();
        return true;
      }
    } catch { /* popup blocked or error — fall through to iframe */ }

    // Strategy 2: Hidden iframe fallback (no popup permission needed)
    try {
      const existingFrame = document.getElementById('lc-print-frame');
      if (existingFrame) existingFrame.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'lc-print-frame';
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
        setTimeout(() => {
          try {
            // The document's own auto-print script normally fires first; never open the dialog twice
            const win = iframe.contentWindow as (Window & { __lcPrinted?: boolean }) | null;
            if (win && !win.__lcPrinted) {
              win.__lcPrinted = true;
              win.focus();
              win.print();
            }
          } catch { /* silent */ }
          // Cleanup iframe safely
          setTimeout(() => {
            try { iframe.remove(); } catch { /* silent */ }
          }, 3000);
        }, 600);
        if (onPopupBlocked) onPopupBlocked();
        return true;
      }
    } catch (err) {
      console.error('[PrintService] Render failed:', err);
    }

    return false;
  }

  /* ─────────────── PUBLIC API ─────────────── */

  /**
   * Main entry point used by every page in the app.
   *
   * Smart routing (so no page needs to know about the dialog):
   *  1. Live-preview capture  → hand the document to the dialog's preview pane (nothing prints)
   *  2. Inside the dialog     → apply the user's paper/layout/appearance choices and print
   *  3. Quick print armed     → print immediately with the user's last-used settings (Ctrl+Shift+P)
   *  4. `skipDialog: true`    → print immediately as configured
   *  5. Otherwise             → open the universal Print dialog with a real live preview
   */
  print(config: PrintConfig): boolean {
    if (this.printHub.isCapturing()) {
      this.printHub.capture(config);
      return true;
    }

    const active = this.printHub.activeParams();
    if (active) {
      return this.printNow(this.applyPrintParams(config, active, active.applyWatermark));
    }

    if (this.printHub.consumeQuickPrint()) {
      return this.printNow(this.applyPrintParams(config, this.printHub.getEffectiveDefaults(), false));
    }

    if (config.skipDialog || typeof window === 'undefined') {
      return this.printNow(config);
    }

    this.openPrintDialog(config);
    return true;
  }

  /** Open the universal print dialog for an already-built document. */
  openPrintDialog(config: PrintConfig): void {
    this.printHub.open({
      title: config.title,
      subtitle: config.subtitle || 'Review the layout, then print or save as PDF.',
      formats: ['pdf'],
      allowWatermark: true,
      defaultWatermark: config.watermark || 'NONE',
      allowQrToggle: false,
      allowChartsToggle: false,
      previewConfig: config,
      // executeExport() marks params as active, so this re-entrant call takes route #2
      onExport: () => { this.print(config); },
    });
  }

  /** Render and print immediately — no dialog. */
  private printNow(config: PrintConfig): boolean {
    const html = this.assembleDocument(config);
    return this.renderAndPrint(html, this.buildFileName(config), config.onPopupBlocked);
  }

  /**
   * Browsers use the document title as the default "Save as PDF" filename.
   * Produce a clean, descriptive, filesystem-safe name instead of "localhost" or "about:blank".
   */
  buildFileName(config: Pick<PrintConfig, 'title' | 'fileName'>): string {
    const raw = config.fileName?.trim() || this.suggestFileName(config.title);
    return raw.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || this.BRAND_NAME;
  }

  /** Default filename suggestion: "LegalConnect - <Title> - YYYY-MM-DD" */
  suggestFileName(title: string): string {
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const clean = String(title || 'Document').replace(/[\\/:*?"<>|—–]+/g, '-').replace(/\s+/g, ' ').replace(/-+/g, '-').trim();
    return `${this.BRAND_NAME} - ${clean} - ${date}`.slice(0, 120);
  }

  /**
   * Merge the dialog's print settings into a page-built document config.
   * The user's choices in the dialog always win over page defaults.
   */
  applyPrintParams(config: PrintConfig, params: Partial<ExportExecutionParams>, applyWatermark: boolean): PrintConfig {
    const out: PrintConfig = {
      ...config,
      paperSize: params.paperSize ?? config.paperSize,
      orientation: params.orientation ?? config.orientation,
      margins: params.margins ?? config.margins,
      customMargins: params.customMargins ?? config.customMargins,
      scale: params.scale ?? config.scale,
      colorMode: params.colorMode ?? config.colorMode,
      printQuality: params.printQuality ?? config.printQuality,
      showHeaderFooter: params.showHeaderFooter ?? config.showHeaderFooter,
      showBackgroundGraphics: params.showBackgroundGraphics ?? config.showBackgroundGraphics,
      fileName: params.fileName || config.fileName,
      copies: params.copies ?? config.copies,
      collate: params.collate ?? config.collate,
      pageRange: params.pageRange ?? config.pageRange,
      customPageRange: params.customPageRange ?? config.customPageRange,
      duplexPrint: params.duplexPrint ?? config.duplexPrint,
      tableDensity: params.tableDensity ?? config.tableDensity,
    };
    if (applyWatermark && params.watermark !== undefined) {
      out.watermark = params.watermark && params.watermark !== 'NONE' ? params.watermark : undefined;
    }
    return out;
  }

  /**
   * Convert ExportExecutionParams to Partial<PrintConfig> for use in page callbacks.
   * Allows one-line spread: `this.printService.print({ ...this.printService.exportParamsToConfig(params), title, content })`
   */
  exportParamsToConfig(params: Partial<ExportExecutionParams>): Partial<PrintConfig> {
    return {
      paperSize: params.paperSize,
      orientation: params.orientation,
      margins: params.margins,
      customMargins: params.customMargins,
      scale: params.scale,
      colorMode: params.colorMode,
      printQuality: params.printQuality,
      showHeaderFooter: params.showHeaderFooter,
      showBackgroundGraphics: params.showBackgroundGraphics,
      watermark: params.watermark && params.watermark !== 'NONE' ? params.watermark : undefined,
      classification: params.classification && params.classification !== 'NONE' ? params.classification : undefined,
      fileName: params.fileName,
      copies: params.copies,
      collate: params.collate,
      pageRange: params.pageRange,
      customPageRange: params.customPageRange,
      duplexPrint: params.duplexPrint,
      tableDensity: params.tableDensity,
    };
  }

  /**
   * Generate preview HTML (without auto-print/auto-close scripts).
   * Used by the preview panel in the Print & Export modal.
   */
  generatePreviewHtml(config: PrintConfig): string {
    return this.assembleDocument(config, { preview: true });
  }

  /** Preview HTML for a document with the dialog's current settings applied. */
  buildPreviewHtml(config: PrintConfig, params: Partial<ExportExecutionParams>, applyWatermark: boolean): string {
    return this.assembleDocument(this.applyPrintParams(config, params, applyWatermark), { preview: true });
  }
}