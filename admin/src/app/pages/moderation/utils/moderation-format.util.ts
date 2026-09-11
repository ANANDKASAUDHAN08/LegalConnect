import { ModerationReport, ModerationStats } from '../../../core/services/admin-moderation.service';

// Re-export shared platform utilities from core for backward compatibility & seamless reuse
export { formatMaskedIp, maskIp, PiiMaskState } from '../../../core/utils/security-utils';
export {
  getSeverityBadgeClass,
  getSeverityDotClass,
  getEntityTypeBadgeClass as getTypeBadgeClass,
  extractUserInitials
} from '../../../core/utils/ui-format.utils';

/**
 * Pure format and visual styling utilities for moderation records.
 */

export function isCriticalReport(report: Pick<ModerationReport, 'severity'> | null | undefined): boolean {
  if (!report?.severity) return false;
  return report.severity.toLowerCase() === 'critical';
}

export function isWarningReport(report: Pick<ModerationReport, 'severity' | 'status'> | null | undefined): boolean {
  if (!report || isCriticalReport(report)) return false;
  const sev = report.severity?.toLowerCase();
  const st = report.status?.toLowerCase();
  return sev === 'high' || st === 'pending';
}

export function getStatusBadgeClass(status: string | undefined): string {
  switch (status?.toLowerCase()) {
    case 'pending':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'investigating':
    case 'underreview':
      return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    case 'resolved':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'dismissed':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    default:
      return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  }
}

export function getStatusDotClass(status: string | undefined): string {
  switch (status?.toLowerCase()) {
    case 'pending':
      return 'bg-amber-400';
    case 'investigating':
    case 'underreview':
      return 'bg-sky-400 animate-pulse';
    case 'resolved':
      return 'bg-emerald-400';
    case 'dismissed':
      return 'bg-rose-400';
    default:
      return 'bg-slate-400';
  }
}

export function calculateDistributionPercent(type: string, stats: ModerationStats | null | undefined): number {
  if (!stats?.reportsByType) return 0;
  const count = stats.reportsByType[type] || 0;
  const total = Object.values(stats.reportsByType).reduce((acc, curr) => acc + curr, 0);
  return total > 0 ? Math.round((count / total) * 100) : 0;
}