import { Injectable, Optional } from '@angular/core';
import { ToastService } from '../../shared/services/toast.service';

export interface LegalPrintMetadataItem {
  label: string;
  value: string | number;
}

export interface LegalPrintSectionItem {
  secId: string | number;
  cleanTitle: string;
  cleanBody: string;
  title_hi?: string;
  introduction_text_hi?: string;
  content_hi?: string;
  citation?: string;
}

export interface LegalPrintChapterItem {
  chapterNumber: string | number;
  title: string;
  sections: LegalPrintSectionItem[];
}

export interface LegalPrintSectionOptions {
  actOrDocTitle: string;
  shortCode?: string;
  year?: string | number;
  sectionNumber: string | number;
  sectionTitle: string;
  chapterNumber?: string | number;
  chapterTitle?: string;
  bodyTextOrHtml: string;
  hindiTitle?: string;
  hindiBody?: string;
  metadata?: LegalPrintMetadataItem[];
  citation?: string;
}

export interface LegalPrintActOptions {
  actName: string;
  shortName: string;
  year?: string | number;
  description?: string;
  totalSections?: number;
  totalChapters?: number;
  chapters: LegalPrintChapterItem[];
}

export interface LegalPrintGenericDocOptions {
  title: string;
  subtitle?: string;
  docRef?: string;
  statusBadge?: string;
  description?: string;
  metadata?: LegalPrintMetadataItem[];
  contentHtml?: string;
  chapters?: Array<{
    chapterNumber?: string | number;
    title: string;
    sections: Array<{
      header: string;
      body: string;
      subtext?: string;
      citation?: string;
    }>;
  }>;
  citation?: string;
  footerNotes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LegalPrintService {
  constructor(@Optional() private toast?: ToastService) {}

  /**
   * Universal styles for certified legal printouts
   */
  private getBaseLegalPrintStyles(): string {
    return `
      @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');

      @page {
        size: A4 portrait;
        margin: 18mm 16mm 18mm 16mm;
        @bottom-right {
          content: counter(page) " of " counter(pages);
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 8pt;
          color: #64748b;
        }
      }

      * { box-sizing: border-box; }
      body {
        font-family: 'Lora', Georgia, 'Times New Roman', serif;
        color: #0f172a;
        background: #ffffff;
        line-height: 1.75;
        font-size: 10.5pt;
        padding: 24px 32px;
        margin: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* Legal Crest & Letterhead */
      .legal-header {
        border-bottom: 2.5px double #0f172a;
        padding-bottom: 14px;
        margin-bottom: 22px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
      }
      .brand-group {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .brand-emblem {
        width: 42px;
        height: 42px;
        background: #0f172a;
        color: #ffffff;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        font-weight: bold;
        font-family: 'Cinzel', serif;
      }
      .brand-name {
        font-family: 'Cinzel', serif;
        font-size: 17pt;
        font-weight: 800;
        letter-spacing: 1.5px;
        color: #0f172a;
        line-height: 1.1;
      }
      .brand-subtitle {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 7.5pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: #475569;
        margin-top: 3px;
      }
      .security-tag {
        text-align: right;
        font-family: 'JetBrains Mono', monospace;
        font-size: 7.5pt;
        color: #475569;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        padding: 5px 10px;
        border-radius: 6px;
      }

      /* Metadata Dossier Banner */
      .dossier-card {
        background: #f8fafc;
        border: 1.5px solid #cbd5e1;
        border-left: 5px solid #1e3a8a;
        border-radius: 8px;
        padding: 16px 20px;
        margin-bottom: 24px;
        page-break-inside: avoid;
      }
      .dossier-label {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 8.5pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #2563eb;
        margin-bottom: 4px;
      }
      .dossier-title {
        font-family: 'Lora', serif;
        font-size: 18pt;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.3;
        margin: 0;
      }
      .dossier-subheading {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 10.5pt;
        font-weight: 600;
        color: #475569;
        margin-top: 5px;
      }
      .dossier-desc {
        font-size: 10pt;
        color: #334155;
        margin-top: 8px;
        line-height: 1.6;
      }
      .props-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 10px;
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid #e2e8f0;
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 8.5pt;
      }
      .prop-item span {
        display: block;
        color: #64748b;
        font-size: 7pt;
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.5px;
        margin-bottom: 2px;
      }
      .prop-item strong {
        color: #0f172a;
        font-weight: 700;
      }

      /* Statutory Chapters & Sections */
      .chapter-banner {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 11.5pt;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #1e3a8a;
        background: #eff6ff;
        border-left: 4px solid #2563eb;
        padding: 8px 14px;
        border-radius: 4px;
        margin-top: 28px;
        margin-bottom: 16px;
        page-break-after: avoid;
        page-break-inside: avoid;
      }
      .section-block {
        margin-bottom: 20px;
        padding-bottom: 14px;
        border-bottom: 1px solid #f1f5f9;
        page-break-inside: avoid;
      }
      .section-header {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 11pt;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 6px;
      }
      .section-body {
        font-size: 10.5pt;
        line-height: 1.8;
        color: #1e293b;
        text-align: justify;
        white-space: pre-wrap;
      }
      .hindi-subblock {
        margin-top: 10px;
        padding: 8px 12px;
        background: #fffbeb;
        border-left: 3px solid #f59e0b;
        border-radius: 4px;
        font-size: 10pt;
        color: #78350f;
      }

      /* Citation Card */
      .citation-card {
        background: #f1f5f9;
        border: 1px dashed #94a3b8;
        border-radius: 6px;
        padding: 10px 14px;
        margin-top: 24px;
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 8.5pt;
        color: #334155;
        page-break-inside: avoid;
      }
      .citation-card strong { color: #0f172a; }

      /* Footer & End Stamp */
      .doc-footer {
        margin-top: 36px;
        padding-top: 12px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 8pt;
        color: #64748b;
      }
      .end-stamp {
        margin-top: 36px;
        padding: 16px;
        text-align: center;
        border-top: 2px dashed #cbd5e1;
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 8.5pt;
        color: #64748b;
        page-break-inside: avoid;
      }

      @media print {
        body { padding: 0; }
      }
    `;
  }

  /**
   * Helper to write HTML and trigger printing reliably
   */
  private launchPrintWindow(title: string, fullHtml: string): void {
    const printWin = window.open('', '_blank', 'width=1000,height=850');
    if (!printWin) {
      if (this.toast) {
        this.toast.error('Pop-up blocked. Please allow pop-ups to print or export.');
      } else {
        alert('Pop-up blocked. Please allow pop-ups to print or export.');
      }
      return;
    }

    printWin.document.open();
    printWin.document.write(fullHtml);
    printWin.document.close();

    setTimeout(() => {
      try {
        printWin.focus();
        printWin.print();
      } catch (err) {
        console.error('LegalPrintService print error:', err);
      }
    }, 450);
  }

  /**
   * Print a Single Legal Provision / Section
   */
  printLegalSection(options: LegalPrintSectionOptions): void {
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const shortCode = options.shortCode || 'DOC';
    const docRef = `LC-SEC-${shortCode}-${options.sectionNumber}-${Date.now().toString(36).toUpperCase()}`;

    const metadataGrid = options.metadata || [
      { label: 'Act Short Code', value: shortCode },
      { label: 'Jurisdiction', value: 'Republic of India' },
      { label: 'Status', value: 'Certified Statute' }
    ];

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Section ${options.sectionNumber} — ${options.actOrDocTitle} (${options.year || ''})</title>
        <style>${this.getBaseLegalPrintStyles()}</style>
      </head>
      <body>
        <!-- Header -->
        <div class="legal-header">
          <div class="brand-group">
            <div class="brand-emblem">§</div>
            <div>
              <div class="brand-name">LEGALCONNECT</div>
              <div class="brand-subtitle">Official Statutory Repository • Republic of India</div>
            </div>
          </div>
          <div class="security-tag">
            <div>REF: ${docRef}</div>
            <div>STATUS: CERTIFIED RECORD</div>
          </div>
        </div>

        <!-- Dossier Banner -->
        <div class="dossier-card">
          <div class="dossier-label">${options.actOrDocTitle} ${options.year ? `(${options.year})` : ''}</div>
          <h1 class="dossier-title">Section ${options.sectionNumber}. ${options.sectionTitle}</h1>
          ${options.chapterTitle ? `<div class="dossier-subheading">Chapter ${options.chapterNumber || ''}: ${options.chapterTitle}</div>` : ''}
          <div class="props-grid">
            ${metadataGrid.map(m => `<div class="prop-item"><span>${m.label}</span><strong>${m.value}</strong></div>`).join('')}
          </div>
        </div>

        <!-- Statutory Content -->
        <div class="section-body" style="font-size: 11pt; line-height: 1.85; margin: 24px 0;">${options.bodyTextOrHtml}</div>

        <!-- Optional Hindi Statutory Body -->
        ${options.hindiTitle || options.hindiBody ? `
          <div class="hindi-subblock" style="margin-top: 20px; padding: 14px 16px;">
            <strong style="display: block; font-size: 10.5pt; margin-bottom: 6px;">धारा ${options.sectionNumber} — ${options.hindiTitle || options.sectionTitle} (हिन्दी पाठ)</strong>
            <div>${options.hindiBody || ''}</div>
          </div>
        ` : ''}

        <!-- Official Citation -->
        <div class="citation-card">
          <strong>Official Citation:</strong> ${options.citation || `Section ${options.sectionNumber}, ${options.actOrDocTitle} (${options.year || ''}) — LegalConnect Digital Statutory Record.`}
        </div>

        <!-- Running Footer -->
        <div class="doc-footer">
          <div>Generated on ${dateStr} at ${timeStr} • LegalConnect Law Reports</div>
          <div>Official Certified Record • Page 1 of 1</div>
        </div>
      </body>
      </html>
    `;

    this.launchPrintWindow(`Section ${options.sectionNumber} — ${options.actOrDocTitle}`, html);
  }

  /**
   * Print / Export a Complete Bare Act Compilation
   */
  printCompleteAct(options: LegalPrintActOptions): void {
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const docRef = `LC-ACT-${options.shortName}-${Date.now().toString(36).toUpperCase()}`;

    let fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>${options.actName} (${options.year || ''}) — Complete Act Dossier</title>
        <style>${this.getBaseLegalPrintStyles()}</style>
      </head>
      <body>
        <!-- Header -->
        <div class="legal-header">
          <div class="brand-group">
            <div class="brand-emblem">§</div>
            <div>
              <div class="brand-name">LEGALCONNECT</div>
              <div class="brand-subtitle">Official Statutory Repository • Republic of India</div>
            </div>
          </div>
          <div class="security-tag">
            <div>REF: ${docRef}</div>
            <div>ARCHIVE COMPILATION</div>
          </div>
        </div>

        <!-- Master Act Cover Dossier -->
        <div class="dossier-card">
          <h1 class="dossier-title">${options.actName} ${options.year ? `(${options.year})` : ''}</h1>
          ${options.description ? `<div class="dossier-desc">${options.description}</div>` : ''}
          <div class="props-grid">
            <div class="prop-item"><span>Act Short Code</span><strong>${options.shortName}</strong></div>
            <div class="prop-item"><span>Year of Enactment</span><strong>${options.year || 'N/A'}</strong></div>
            <div class="prop-item"><span>Total Provisions</span><strong>${options.totalSections || options.chapters.reduce((acc, c) => acc + c.sections.length, 0)} Sections</strong></div>
            <div class="prop-item"><span>Total Chapters</span><strong>${options.totalChapters || options.chapters.length} Chapters</strong></div>
          </div>
        </div>
    `;

    for (const chap of options.chapters) {
      fullHtml += `<div class="chapter-banner">Chapter ${chap.chapterNumber}: ${chap.title}</div>`;
      for (const sec of chap.sections) {
        fullHtml += `
          <div class="section-block">
            <div class="section-header">Section ${sec.secId}. ${sec.cleanTitle}</div>
            <div class="section-body">${sec.cleanBody}</div>
            ${sec.introduction_text_hi || sec.content_hi ? `
              <div class="hindi-subblock">
                <strong>हिन्दी:</strong> ${sec.introduction_text_hi || sec.content_hi}
              </div>
            ` : ''}
            <div class="citation-card" style="margin-top: 8px; padding: 6px 10px; font-size: 7.5pt;">
              <strong>Citation:</strong> Section ${sec.secId}, ${options.actName} (${options.year || ''})
            </div>
          </div>
        `;
      }
    }

    fullHtml += `
        <div class="end-stamp">
          <div><strong>— END OF STATUTE COMPILATION —</strong></div>
          <div style="margin-top: 4px;">Certified Digital Extract from the LegalConnect Statutory Knowledge Base</div>
          <div style="font-size: 7.5pt; color: #94a3b8; margin-top: 2px;">Generated on ${dateStr} at ${timeStr}</div>
        </div>
      </body>
      </html>
    `;

    this.launchPrintWindow(`${options.actName} (${options.year || ''})`, fullHtml);
  }

  /**
   * Generic Universal Legal Document Print (Judgments, Consultations, Notices, Reports)
   */
  printGenericLegalDocument(options: LegalPrintGenericDocOptions): void {
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const docRef = options.docRef || `LC-DOC-${Date.now().toString(36).toUpperCase()}`;

    let fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>${options.title}</title>
        <style>${this.getBaseLegalPrintStyles()}</style>
      </head>
      <body>
        <!-- Header -->
        <div class="legal-header">
          <div class="brand-group">
            <div class="brand-emblem">§</div>
            <div>
              <div class="brand-name">LEGALCONNECT</div>
              <div class="brand-subtitle">Official Legal Document • Republic of India</div>
            </div>
          </div>
          <div class="security-tag">
            <div>REF: ${docRef}</div>
            <div>${options.statusBadge || 'AUTHENTIC RECORD'}</div>
          </div>
        </div>

        <!-- Dossier Card -->
        <div class="dossier-card">
          <h1 class="dossier-title">${options.title}</h1>
          ${options.subtitle ? `<div class="dossier-subheading">${options.subtitle}</div>` : ''}
          ${options.description ? `<div class="dossier-desc">${options.description}</div>` : ''}
          ${options.metadata && options.metadata.length > 0 ? `
            <div class="props-grid">
              ${options.metadata.map(m => `<div class="prop-item"><span>${m.label}</span><strong>${m.value}</strong></div>`).join('')}
            </div>
          ` : ''}
        </div>
    `;

    if (options.contentHtml) {
      fullHtml += `<div class="section-body" style="margin: 20px 0;">${options.contentHtml}</div>`;
    }

    if (options.chapters && options.chapters.length > 0) {
      for (const chap of options.chapters) {
        fullHtml += `<div class="chapter-banner">${chap.chapterNumber ? `Part ${chap.chapterNumber}: ` : ''}${chap.title}</div>`;
        for (const sec of chap.sections) {
          fullHtml += `
            <div class="section-block">
              <div class="section-header">${sec.header}</div>
              <div class="section-body">${sec.body}</div>
              ${sec.subtext ? `<div class="hindi-subblock">${sec.subtext}</div>` : ''}
              ${sec.citation ? `<div class="citation-card" style="margin-top: 8px; padding: 6px 10px; font-size: 7.5pt;"><strong>Citation:</strong> ${sec.citation}</div>` : ''}
            </div>
          `;
        }
      }
    }

    if (options.citation) {
      fullHtml += `<div class="citation-card"><strong>Official Citation:</strong> ${options.citation}</div>`;
    }

    fullHtml += `
        <div class="doc-footer">
          <div>Generated on ${dateStr} at ${timeStr} • LegalConnect Legal Network</div>
          <div>${options.footerNotes || 'Official Certified Record'}</div>
        </div>
      </body>
      </html>
    `;

    this.launchPrintWindow(options.title, fullHtml);
  }
}