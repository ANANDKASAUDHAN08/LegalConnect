import { ModerationReport } from '../../../core/services/admin-moderation.service';

export interface SlaStatusResult {
  label: string;
  isBreached: boolean;
  isNearBreach: boolean;
  hoursLeft: number;
  badgeClass: string;
}

/**
 * Pure domain utility to calculate SLA timeline, breach status, and badge styles.
 * SLA Target Thresholds:
 * - Critical: 4 hours
 * - High: 24 hours
 * - Medium: 48 hours
 * - Low: 72 hours
 */
export function calculateSlaStatus(
  report: Pick<ModerationReport, 'status' | 'severity' | 'createdAt'> | null | undefined
): SlaStatusResult {
  if (!report || report.status === 'Resolved' || report.status === 'Dismissed') {
    return {
      label: 'Completed',
      isBreached: false,
      isNearBreach: false,
      hoursLeft: 0,
      badgeClass: 'sla-completed'
    };
  }

  const slaHours: Record<string, number> = {
    Critical: 4,
    High: 24,
    Medium: 48,
    Low: 72
  };

  const targetHours = slaHours[report.severity] || 48;
  const createdAt = new Date(report.createdAt).getTime();
  const now = Date.now();
  const elapsedMinutes = Math.floor((now - createdAt) / (1000 * 60));
  const totalSlaMinutes = targetHours * 60;
  const remainingMinutes = totalSlaMinutes - elapsedMinutes;

  if (remainingMinutes <= 0) {
    const overdueMinutes = Math.abs(remainingMinutes);
    const overdueStr = overdueMinutes >= 60
      ? `${Math.floor(overdueMinutes / 60)}h overdue`
      : `${overdueMinutes}m overdue`;
    return {
      label: `Breached (${overdueStr})`,
      isBreached: true,
      isNearBreach: false,
      hoursLeft: 0,
      badgeClass: 'sla-breached'
    };
  }

  const hours = Math.floor(remainingMinutes / 60);
  const mins = remainingMinutes % 60;
  const isNearBreach =
    remainingMinutes <= 60 ||
    (targetHours <= 4 && remainingMinutes <= 60) ||
    remainingMinutes <= totalSlaMinutes * 0.2;
  const label = hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;

  return {
    label,
    isBreached: false,
    isNearBreach,
    hoursLeft: hours,
    badgeClass: isNearBreach ? 'sla-warning' : 'sla-ok'
  };
}