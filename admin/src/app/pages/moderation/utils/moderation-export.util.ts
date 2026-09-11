import { ModerationReport } from '../../../core/services/admin-moderation.service';
import { ExportConfig } from '../../../shared/components/export-modal/export-modal.component';

/**
 * Pure export serialization and blob generation utility for moderation reports.
 */

export function serializeSelectedModerationExport(
  reports: ModerationReport[],
  selectedReportIds: Set<number>,
  config: ExportConfig
): { blob: Blob; filename: string; count: number } {
  const exportData = reports.filter(r => selectedReportIds.has(r.id));

  const formatted = exportData.map(r => {
    const row: Record<string, any> = {};
    if (config.columns.includes('reportRef')) row['Reference'] = r.reportRef;
    if (config.columns.includes('targetType')) row['Entity Type'] = r.targetType;
    if (config.columns.includes('targetTitle')) row['Target Title'] = r.targetTitle;
    if (config.columns.includes('reasonCategory')) row['Reason'] = r.reasonCategory;
    if (config.columns.includes('severity')) row['Severity'] = r.severity;
    if (config.columns.includes('status')) row['Status'] = r.status;
    if (config.columns.includes('reporterName')) row['Reporter Name'] = r.reporterName || 'Anonymous';
    if (config.columns.includes('reporterEmail')) row['Reporter Email'] = r.reporterEmail || 'N/A';
    if (config.columns.includes('reporterIp')) row['Reporter IP'] = r.reporterIp || 'N/A';
    if (config.columns.includes('duplicateCount')) row['Duplicate Flags'] = r.duplicateCount;
    if (config.columns.includes('createdAt')) row['Reported At'] = r.createdAt;
    if (config.columns.includes('moderatorNotes')) row['Resolution Notes'] = r.moderatorNotes || '';
    return row;
  });

  const timestamp = Date.now();
  if (config.format === 'json') {
    const blob = new Blob([JSON.stringify(formatted, null, 2)], { type: 'application/json' });
    return {
      blob,
      filename: `moderation-reports-${timestamp}.json`,
      count: formatted.length
    };
  } else {
    const headers = Object.keys(formatted[0] || {}).join(',');
    const csvRows = formatted.map(row =>
      Object.values(row)
        .map(val => `"${String(val).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent = [headers, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    return {
      blob,
      filename: `moderation-reports-${timestamp}.csv`,
      count: formatted.length
    };
  }
}

export function downloadFileBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}