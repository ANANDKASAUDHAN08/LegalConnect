/**
 * High-performance CSV Exporter Utility
 * Features:
 * - UTF-8 BOM (\uFEFF) for Excel & Multi-language character support (India IT Act statutory audit logs)
 * - Safe CSV escaping (handling embedded quotes, commas, and newlines)
 * - Blob memory creation with automatic URL object revoking
 */
export class CsvExporter {
  static export(filename: string, headers: string[], rows: any[][]): void {
    if (!rows || rows.length === 0) {
      throw new Error('No dataset available to export.');
    }

    const escapeCell = (val: any): string => {
      if (val === null || val === undefined) return '""';
      let str = String(val).trim();
      // Replace double quotes with escaped double quotes
      str = str.replace(/"/g, '""');
      // Wrap in double quotes if string contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str}"`;
      }
      return `"${str}"`;
    };

    const headerLine = headers.map(h => escapeCell(h)).join(',');
    const rowLines = rows.map(row => row.map(cell => escapeCell(cell)).join(','));

    // Prepend UTF-8 Byte Order Mark (\uFEFF) to guarantee Excel opens formatted cleanly
    const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const sanitizedFilename = filename.endsWith('.csv') ? filename : `${filename}_${dateStamp}.csv`;
    link.setAttribute('download', sanitizedFilename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}