import { Injectable, inject } from '@angular/core';
import { UnifiedBookmark } from './universal-bookmark.service';
import { PrintService } from './print.service';
import { PrintExportService, ExportFormat } from './print-export.service';
import { DataExportService } from './data-export.service';
import { SnackbarService } from './snackbar.service';

/**
 * CasePackExportService — Tier-1 MNC Clean Domain Export Service
 *
 * Encapsulates all data transformation, serialization, and document layout
 * rendering for Legal Case Packs, research dossiers, and unified bookmarks.
 * Reusable across Saved Workbench, Law Viewer, Search, and Advocate Portals.
 */
@Injectable({
  providedIn: 'root'
})
export class CasePackExportService {
  private printService = inject(PrintService);
  private printExportService = inject(PrintExportService);
  private dataExportService = inject(DataExportService);
  private snackbar = inject(SnackbarService);

  /**
   * Opens the universal export hub modal with page-specific scopes.
   */
  openExportHub(
    filteredItems: UnifiedBookmark[],
    allItems: UnifiedBookmark[],
    collectionName: string = 'ALL'
  ): void {
    if (filteredItems.length === 0 && allItems.length === 0) {
      this.snackbar.show('No items in current view to export.', 'warning');
      return;
    }

    const title = collectionName === 'ALL'
      ? 'Saved Workbench Dossier & Case Pack'
      : `Case Pack — ${collectionName}`;

    this.printExportService.open({
      title,
      subtitle: `${filteredItems.length} bookmarked statutory provisions & directory entries`,
      formats: ['pdf', 'csv', 'txt', 'json'],
      scopes: [
        {
          id: 'filtered',
          label: `Current Filtered View (${filteredItems.length} items)`,
          count: filteredItems.length
        },
        {
          id: 'all',
          label: `All Saved Workbench Items (${allItems.length} items)`,
          count: allItems.length
        }
      ],
      defaultScope: 'filtered',
      allowWatermark: true,
      defaultWatermark: 'LEGALCONNECT CASE PACK',
      allowQrToggle: true,
      onExport: (params) => {
        const targetItems = params.scope === 'all' ? allItems : filteredItems;
        this.exportCasePack(params.format, targetItems, collectionName);
      }
    });
  }

  /**
   * Generates and downloads or prints the Case Pack in the chosen format.
   */
  exportCasePack(
    format: ExportFormat = 'pdf',
    items: UnifiedBookmark[],
    collectionName: string = 'General'
  ): void {
    if (!items || items.length === 0) {
      this.snackbar.show('No items available for export.', 'warning');
      return;
    }

    const dossierTitle = collectionName === 'ALL'
      ? 'LegalConnect Saved Dossier & Case Pack'
      : `Case Pack — ${collectionName}`;

    switch (format) {
      case 'csv':
        this.exportAsCsv(items, collectionName);
        break;
      case 'json':
        this.exportAsJson(items, dossierTitle, collectionName);
        break;
      case 'txt':
        this.exportAsTxt(items, dossierTitle, collectionName);
        break;
      case 'pdf':
      default:
        this.exportAsPdf(items, dossierTitle, collectionName);
        break;
    }
  }

  /* ─────────────── FORMAT SPECIFIC EXPORTERS ─────────────── */

  private exportAsCsv(items: UnifiedBookmark[], collectionName: string): void {
    let csv = 'Type,Title,Subtitle,Folder,Notes,Saved Date,Target ID\n';
    for (const item of items) {
      const row = [
        `"${item.targetType}"`,
        `"${(item.title || '').replace(/"/g, '""')}"`,
        `"${(item.subtitle || '').replace(/"/g, '""')}"`,
        `"${(item.collectionName || 'General').replace(/"/g, '""')}"`,
        `"${(item.customNotes || '').replace(/"/g, '""')}"`,
        `"${new Date(item.savedAt).toISOString().split('T')[0]}"`,
        `"${item.targetId}"`
      ];
      csv += row.join(',') + '\n';
    }
    this.dataExportService.downloadBlob(csv, 'text/csv', `LegalConnect_CasePack_${Date.now()}.csv`);
    this.snackbar.show('Case Pack CSV exported successfully ✓', 'success');
  }

  private exportAsJson(items: UnifiedBookmark[], title: string, collectionName: string): void {
    const payload = JSON.stringify({
      title,
      folder: collectionName,
      exportedAt: new Date().toISOString(),
      totalItems: items.length,
      items
    }, null, 2);

    this.dataExportService.downloadBlob(payload, 'application/json', `LegalConnect_CasePack_${Date.now()}.json`);
    this.snackbar.show('Case Pack JSON exported successfully ✓', 'success');
  }

  private exportAsTxt(items: UnifiedBookmark[], title: string, collectionName: string): void {
    let txt = `========================================================================\n`;
    txt += `                 ${title.toUpperCase()}\n`;
    txt += `========================================================================\n`;
    txt += `Generated: ${new Date().toLocaleString('en-IN')}\n`;
    txt += `Total Entries: ${items.length}\n`;
    txt += `Folder Filter: ${collectionName}\n\n`;

    items.forEach((item, idx) => {
      txt += `[${idx + 1}] ${item.title}\n`;
      txt += `    Type:       ${this.getItemTypeLabel(item.targetType)}\n`;
      if (item.subtitle) txt += `    Details:    ${item.subtitle}\n`;
      txt += `    Folder:     ${item.collectionName || 'General'}\n`;
      if (item.customNotes) txt += `    Notes:      ${item.customNotes}\n`;
      txt += `    Saved:      ${new Date(item.savedAt).toLocaleDateString('en-IN')}\n\n`;
    });

    this.dataExportService.downloadBlob(txt, 'text/plain', `LegalConnect_CasePack_${Date.now()}.txt`);
    this.snackbar.show('Case Pack text dossier exported successfully ✓', 'success');
  }

  private exportAsPdf(items: UnifiedBookmark[], title: string, collectionName: string): void {
    let tableRowsHtml = '';
    items.forEach((item, idx) => {
      tableRowsHtml += `
        <tr>
          <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; font-weight:700; color:#64748b; font-size:11px;">#${idx + 1}</td>
          <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0;">
            <div style="font-weight:700; font-size:12px; color:#0f172a;">${this.printService.escapeHtml(item.title)}</div>
            ${item.subtitle ? `<div style="font-size:10.5px; color:#64748b; margin-top:2px;">${this.printService.escapeHtml(item.subtitle)}</div>` : ''}
            ${item.customNotes ? `<div style="font-size:10.5px; color:#4338ca; background:#eef2ff; padding:3px 6px; border-radius:4px; margin-top:4px; font-style:italic;">Note: ${this.printService.escapeHtml(item.customNotes)}</div>` : ''}
          </td>
          <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; font-size:11px; font-weight:600; color:#334155;">
            ${this.getItemTypeLabel(item.targetType)}
          </td>
          <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; font-size:11px; color:#475569;">
            ${this.printService.escapeHtml(item.collectionName || 'General')}
          </td>
          <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; font-size:10.5px; color:#64748b; white-space:nowrap;">
            ${new Date(item.savedAt).toLocaleDateString('en-IN')}
          </td>
        </tr>
      `;
    });

    const contentHtml = `
      <div style="margin-bottom:16px;">
        <p style="font-size:12px; color:#475569; margin:0 0 12px 0;">
          Consolidated legal research materials, statutory provisions, and verified directory contacts saved under this dossier pack.
        </p>
        <table style="width:100%; border-collapse:collapse; text-align:left;">
          <thead>
            <tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1;">
              <th style="padding:8px 10px; font-size:10.5px; text-transform:uppercase; color:#475569;">#</th>
              <th style="padding:8px 10px; font-size:10.5px; text-transform:uppercase; color:#475569;">Provision / Entity</th>
              <th style="padding:8px 10px; font-size:10.5px; text-transform:uppercase; color:#475569;">Classification</th>
              <th style="padding:8px 10px; font-size:10.5px; text-transform:uppercase; color:#475569;">Binder Folder</th>
              <th style="padding:8px 10px; font-size:10.5px; text-transform:uppercase; color:#475569;">Date Added</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>
    `;

    this.printService.print({
      title,
      subtitle: `Official Legal Dossier · ${items.length} Saved Entries · LegalConnect Research Hub`,
      classification: 'LEGAL BRIEF',
      accentColor: '#4f46e5',
      watermark: 'LEGALCONNECT CASE PACK',
      content: contentHtml,
      extraMeta: [
        { label: 'Active Folder', value: collectionName },
        { label: 'Total Entries', value: items.length.toString() },
        { label: 'Audit Timestamp', value: new Date().toLocaleString('en-IN') }
      ]
    });
  }

  private getItemTypeLabel(targetType: string): string {
    switch (targetType) {
      case 'BareActSection': return 'Act Section';
      case 'Lawyer': return 'Advocate';
      case 'LegalResource': return 'Legal Aid / Clinic';
      case 'Helpline': return 'Helpline';
      case 'Template': return 'Draft Template';
      default: return targetType;
    }
  }
}