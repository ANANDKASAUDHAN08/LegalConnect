/**
 * Shared utility functions for Profile and Account modules.
 */

/** Shared security score calculator */
export function calculateSecurityScore(profile: {
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  isTwoFactorEnabled?: boolean;
} | null | undefined): number {
  if (!profile) return 40;
  let score = 40;
  if (profile.isEmailVerified) score += 20;
  if (profile.isPhoneVerified) score += 20;
  if (profile.isTwoFactorEnabled) score += 20;
  return score;
}

export function getSecurityRating(score: number): 'Strong' | 'Moderate' | 'Weak' {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Moderate';
  return 'Weak';
}

/** Shared phone masking (e.g. +91 ••••• ••1234) */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const clean = phone.trim();
  if (clean.length <= 4) return clean;
  const last4 = clean.slice(-4);
  return `+91 •••••••${last4}`;
}

/** Shared clipboard copy helper */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** Shared relative time formatter */
export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}