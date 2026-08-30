import { Injectable, inject } from '@angular/core';
import { IconService } from '../components/icon/icon.service';

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
   ═══════════════════════════════════════════════════════════════════ */

@Injectable({ providedIn: 'root' })
export class PrintService {
  private iconService = inject(IconService);

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
  private buildStyles(accentColor = '#4f46e5'): string {
    return `
@page{size:A4 portrait;margin:12mm 14mm 14mm 14mm}
*{box-sizing:border-box;margin:0;padding:0}
*,*::before,*::after{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
body{
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  color:#0f172a;background:#fff;line-height:1.5;font-size:12px;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  position:relative;
}

/* ── Watermark ── */
.lc-watermark{
  position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);
  font-size:4rem;font-weight:900;color:rgba(15,23,42,0.035);
  text-transform:uppercase;letter-spacing:0.18em;pointer-events:none;z-index:0;
  white-space:nowrap;user-select:none;
}

/* ── Classification Pill ── */
.lc-class-badge{
  display:inline-block;font-size:8px;font-weight:800;letter-spacing:0.1em;
  text-transform:uppercase;padding:2px 8px;border-radius:4px;
  background:#fee2e2;color:#991b1b;border:1px solid #fecaca;margin-bottom:4px;
}

/* ── Header ── */
.lc-header{
  border-top:4px solid ${accentColor};padding:14px 0 12px;border-bottom:2px solid #0f172a;
  display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;
  position:relative;z-index:1;
}
.lc-brand{display:flex;align-items:center;gap:10px}
.lc-brand-icon{
  width:36px;height:36px;border-radius:50%;
  background:linear-gradient(135deg,#2563eb,${accentColor});
  display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;
}
.lc-brand-name{font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.03em;line-height:1.1}
.lc-brand-name span{color:${accentColor}}
.lc-brand-tag{font-size:8px;font-weight:800;color:#64748b;letter-spacing:0.1em;text-transform:uppercase;margin-top:1px}
.lc-doc-title{font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:700;color:#0f172a;margin:6px 0 2px;break-after:avoid;page-break-after:avoid}
.lc-doc-sub{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.07em;font-weight:600}
.lc-meta{text-align:right;font-size:10px;color:#475569}
.lc-ref{
  font-family:'Courier New',monospace;font-weight:700;color:#0f172a;
  background:#f1f5f9;padding:2px 6px;border-radius:4px;display:inline-block;margin-bottom:3px;
}

/* ── Footer ── */
.lc-footer{
  border-top:1px solid #e2e8f0;padding-top:10px;margin-top:28px;
  display:flex;justify-content:space-between;align-items:center;
  font-size:8px;color:#94a3b8;page-break-inside:avoid;break-inside:avoid;
  position:relative;z-index:1;
}
.lc-seal{border-left:2px solid ${accentColor};padding-left:8px;font-style:italic}

/* ── Subject Strip ── */
.lc-subject{
  background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
  padding:10px 14px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;
  position:relative;z-index:1;page-break-inside:avoid;break-inside:avoid;
}
.lc-subject-name{font-size:14px;font-weight:700;color:#0f172a}
.lc-subject-sub{font-size:10px;color:#64748b;margin-top:2px}
.lc-subject-badge{
  background:#ecfdf5;border:1px solid #10b981;color:#047857;
  padding:3px 10px;border-radius:20px;font-size:9px;font-weight:700;
  text-transform:uppercase;letter-spacing:0.05em;display:inline-flex;align-items:center;gap:4px;
}

/* ── Section ── */
.lc-section{
  border:1px solid #e2e8f0;border-radius:8px;padding:14px;
  margin-bottom:16px;background:#fff;page-break-inside:avoid;break-inside:avoid;
  position:relative;z-index:1;
}
.lc-section-title{
  font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;
  color:#0f172a;border-bottom:1px solid #f1f5f9;padding-bottom:6px;margin-bottom:10px;
  display:flex;justify-content:space-between;align-items:center;
  break-after:avoid;page-break-after:avoid;
}
.lc-section-badge{font-size:9px;font-weight:600;color:#64748b;text-transform:none;letter-spacing:normal}

/* ── KPI Grid ── */
.lc-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;position:relative;z-index:1}
@media print{.lc-kpi-grid{grid-template-columns:repeat(4,1fr)!important}}
.lc-kpi{border:1px solid #e2e8f0;border-radius:8px;padding:10px;position:relative;background:#fff;page-break-inside:avoid;break-inside:avoid}
.lc-kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:8px 8px 0 0}
.lc-kpi.green::before{background:#10b981}
.lc-kpi.amber::before{background:#f59e0b}
.lc-kpi.indigo::before{background:#6366f1}
.lc-kpi.blue::before{background:#0284c7}
.lc-kpi.emerald::before{background:#059669}
.lc-kpi.slate::before{background:#64748b}
.lc-kpi.rose::before{background:#f43f5e}
.lc-kpi-label{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;color:#64748b}
.lc-kpi-val{font-size:17px;font-weight:700;color:#0f172a;margin-top:3px;display:flex;align-items:center;gap:4px}
.lc-kpi-sub{font-size:9px;color:#64748b;margin-top:2px}

/* ── Tables with Multi-Page Repeating Headers ── */
.lc-table{width:100%;border-collapse:collapse;margin-top:6px}
.lc-table thead{display:table-header-group}
.lc-table tfoot{display:table-footer-group}
.lc-table tr{page-break-inside:avoid;break-inside:avoid}
.lc-table th{
  background:#0f172a;color:#fff;font-size:9px;font-weight:700;
  text-transform:uppercase;letter-spacing:0.05em;padding:6px 8px;text-align:left;
}
.lc-table td{padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:10px;color:#334155}
.lc-table tr:nth-child(even) td{background:#f8fafc}
.lc-table .mono{font-family:'Courier New',monospace}
.lc-table .bold{font-weight:700}
.lc-table .right{text-align:right}
.lc-table .center{text-align:center}

/* ── Resource Cards ── */
.lc-res-card{
  border:1px solid #e2e8f0;border-left:4px solid #64748b;border-radius:8px;
  padding:12px 14px;margin-bottom:10px;display:flex;gap:14px;
  justify-content:space-between;page-break-inside:avoid;break-inside:avoid;position:relative;z-index:1;
}
.lc-res-card.type-legal-aid{border-left-color:#7c3aed}
.lc-res-card.type-court{border-left-color:#b45309}
.lc-res-card.type-gov{border-left-color:#0369a1}
.lc-res-card.type-police{border-left-color:#dc2626}
.lc-res-body{flex:1;min-width:0}
.lc-res-type{
  display:inline-block;font-size:8px;font-weight:800;text-transform:uppercase;
  letter-spacing:0.06em;padding:2px 6px;border-radius:4px;margin-bottom:5px;
}
.lc-res-type.legal-aid{background:#f3e8ff;color:#6d28d9}
.lc-res-type.court{background:#fef3c7;color:#92400e}
.lc-res-type.gov{background:#e0f2fe;color:#0c4a6e}
.lc-res-type.police{background:#fee2e2;color:#991b1b}
.lc-res-name{font-size:13px;font-weight:700;color:#0f172a;margin-bottom:3px}
.lc-res-addr{font-size:10px;color:#475569;line-height:1.4;display:flex;align-items:flex-start;gap:4px}
.lc-res-contact{font-size:10px;margin-top:4px;color:#334155;display:flex;align-items:center;gap:4px}
.lc-res-contact strong{font-weight:700;color:#0f172a}
.lc-res-url{font-size:9px;color:#2563eb;word-break:break-all;margin-top:3px;display:flex;align-items:center;gap:4px}
.lc-res-tags{margin-top:5px;display:flex;flex-wrap:wrap;gap:3px}
.lc-res-tag{
  font-size:8px;font-weight:700;padding:2px 5px;border-radius:3px;
  background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd;
  display:inline-flex;align-items:center;gap:2px;
}
.lc-res-qr{flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:3px}
.lc-res-qr img{width:80px;height:80px;border:1px solid #e2e8f0;border-radius:4px}
.lc-res-qr span{font-size:7px;color:#94a3b8;text-align:center;max-width:80px}

/* ── Statute Text ── */
.lc-statute{
  background:#f8fafc;border:1px solid #e2e8f0;border-left:5px solid ${accentColor};
  border-radius:8px;padding:16px;margin-bottom:14px;page-break-inside:avoid;break-inside:avoid;position:relative;z-index:1;
}
.lc-statute-num{font-size:10px;font-weight:800;color:${accentColor};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;display:flex;align-items:center;gap:4px}
.lc-statute-title{font-size:14px;font-weight:700;color:#0f172a;margin-bottom:8px}
.lc-statute-body{font-size:11px;color:#334155;line-height:1.7;white-space:pre-wrap}

/* ── Comparative Transition Grid (Law Mapper) ── */
.lc-compare-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;position:relative;z-index:1}
.lc-compare-card{border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;background:#f8fafc;page-break-inside:avoid;break-inside:avoid}
.lc-compare-card.old-act{border-top:3px solid #64748b}
.lc-compare-card.new-act{border-top:3px solid ${accentColor}}
.lc-compare-tag{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:4px}
.lc-compare-title{font-size:13px;font-weight:700;color:#0f172a;margin-bottom:6px}
.lc-compare-content{font-size:11px;color:#334155;line-height:1.6}

/* ── Legal Document Draft Formatting (Document Templates) ── */
.lc-legal-draft{
  font-family:Georgia,'Times New Roman',serif;font-size:12px;line-height:1.8;
  color:#1e293b;padding:10px 4px;white-space:pre-wrap;text-align:justify;position:relative;z-index:1;
}
.lc-legal-draft h1,.lc-legal-draft h2,.lc-legal-draft h3{font-family:inherit;text-align:center;margin:16px 0 10px;text-transform:uppercase}
.lc-sig-block{display:flex;justify-content:space-between;margin-top:40px;page-break-inside:avoid;break-inside:avoid}
.lc-sig-line{width:200px;border-top:1px solid #0f172a;text-align:center;padding-top:6px;font-size:10px;font-weight:700}

/* ── Profile Card ── */
.lc-profile{
  background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
  padding:12px 14px;margin-bottom:16px;display:flex;gap:12px;align-items:center;
  page-break-inside:avoid;break-inside:avoid;position:relative;z-index:1;
}
.lc-profile-info{flex:1}
.lc-profile-name{font-size:14px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:6px}
.lc-profile-detail{font-size:10px;color:#64748b;margin-top:2px}

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
.lc-mt{margin-top:14px}
.lc-mb{margin-bottom:14px}
.lc-text-sm{font-size:10px}
.lc-text-muted{color:#64748b}
.lc-text-bold{font-weight:700}
.lc-text-mono{font-family:'Courier New',monospace}
.lc-text-green{color:#059669}
.lc-text-amber{color:#b45309}
.lc-text-red{color:#dc2626}
.lc-divider{border:none;border-top:1px solid #e2e8f0;margin:12px 0}

@media print{
  body{margin:0;background:#fff!important;color:#0f172a!important}
  .no-print{display:none!important}
}`;
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

  /** Build a list of print-optimized resource cards with optional GPS QR codes */
  buildResourceCards(resources: any[], options: { showQr?: boolean } = {}): string {
    if (!resources || resources.length === 0) return '';
    const shouldShowQr = options.showQr != null ? options.showQr : resources.length <= 10;
    const parts: string[] = [];
    for (const r of resources) {
      parts.push(this.buildSingleResourceCard(r, shouldShowQr));
    }
    return parts.join('');
  }

  /** Build a single resource card for print */
  private buildSingleResourceCard(r: any, showQr = true): string {
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

    const parts: string[] = [];
    parts.push(`<div class="lc-res-card ${cardClass}">`);
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
      const qrUrl = this.generateQrUrl(mapsUrl, 75);
      parts.push(`<div class="lc-res-qr">`);
      parts.push(`<img src="${qrUrl}" alt="GPS QR" width="75" height="75">`);
      parts.push(`<span>Scan for GPS</span>`);
      parts.push(`</div>`);
    }

    parts.push(`</div>`);
    return parts.join('');
  }

  /** Build robust Google Maps directions / search URL from resource */
  private getResourceMapsUrl(r: any): string {
    const lat = r.coordinates?.lat ?? r.lat ?? (Array.isArray(r.location?.coordinates) ? r.location.coordinates[1] : null);
    const lng = r.coordinates?.lng ?? r.lng ?? (Array.isArray(r.location?.coordinates) ? r.location.coordinates[0] : null);
    if (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng)) && Number(lat) !== 0 && Number(lng) !== 0) {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }
    const query = encodeURIComponent([r.name, r.address, r.city, r.state].filter(Boolean).join(', '));
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  /** Extract facility tags from a resource object */
  private getResourceFacilityTags(r: any): string[] {
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

  /** Build statute/law section text with scale SVG */
  buildStatuteText(section: any, act: any): string {
    const e = this.escapeHtml.bind(this);
    const content = section?.content || section?.introduction_text || section?.snippet || '';
    const cleanContent = String(content).replace(/<[^>]*>/g, '');
    const scaleSvg = this.getSvg('scale', { size: 12, color: '#4f46e5', style: 'margin-right:4px;' });
    return `<div class="lc-statute">
      <div class="lc-statute-num">${scaleSvg} Section ${e(section?.section_number)} — ${e(act?.actName || act?.shortName || '')}, ${e(act?.year || '')}</div>
      <div class="lc-statute-title">${e(section?.title || '')}</div>
      <div class="lc-statute-body">${e(cleanContent)}</div>
    </div>`;
  }

  /** Build a profile card (for data exports) */
  buildProfileCard(profile: any): string {
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

  /** Build a case pack section (law section + precedents + pro-se guide) */
  buildCasePack(config: {
    section: any;
    act: any;
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

  /** Build comparative law transition block (Old Code vs New Criminal Code) */
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
  private assembleDocument(config: PrintConfig): string {
    const refCode = this.generateRefCode('DOC');
    const accent = config.accentColor || '#4f46e5';
    const seal = config.sealText || `Official ${this.BRAND_NAME} Document`;

    const parts: string[] = [];
    parts.push(`<!DOCTYPE html><html lang="en"><head>`);
    parts.push(`<meta charset="utf-8">`);
    parts.push(`<title>${this.escapeHtml(config.title)} | ${this.BRAND_NAME}</title>`);
    parts.push(`<style>${this.buildStyles(accent)}</style>`);
    parts.push(`</head><body>`);

    // Watermark (if specified)
    if (config.watermark) {
      parts.push(`<div class="lc-watermark">${this.escapeHtml(config.watermark)}</div>`);
    }

    // Header
    parts.push(this.buildHeader({
      title: config.title,
      subtitle: config.subtitle,
      refCode,
      accentColor: accent,
      classification: config.classification,
      headerQrData: config.headerQrData,
      extraMeta: config.extraMeta,
    }));

    // Subject strip (optional)
    if (config.subjectStrip) {
      parts.push(config.subjectStrip);
    }

    // Main content
    parts.push(config.content);

    // Footer
    parts.push(this.buildFooter(seal, refCode));

    // Auto-print script that waits for all images to load & closes window after print
    parts.push(`<script>
      window.onload=function(){
        var imgs=document.querySelectorAll('img'),loaded=0,total=imgs.length;
        function doPrint(){
          try { window.focus(); window.print(); } catch(e){}
        }
        if(!total){setTimeout(doPrint,150);return}
        function check(){loaded++;if(loaded>=total)setTimeout(doPrint,150)}
        for(var i=0;i<total;i++){
          if(imgs[i].complete){check()}
          else{imgs[i].onload=imgs[i].onerror=check}
        }
        setTimeout(doPrint,2500);
      };
      window.onafterprint=function(){
        try { window.close(); } catch(e){}
      };
    </script>`);

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
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
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
   * Main entry point: Assembles a complete print document from the given
   * configuration and triggers the browser print dialog.
   */
  print(config: PrintConfig): boolean {
    const html = this.assembleDocument(config);
    const title = `${this.BRAND_NAME}-${config.title.replace(/\s+/g, '-')}`;
    return this.renderAndPrint(html, title, config.onPopupBlocked);
  }
}