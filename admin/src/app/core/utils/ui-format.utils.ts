/**
 * Platform-Wide UI Design Tokens & Badge Format Utilities
 * 
 * Provides unified, consistent visual styling across all admin modules
 * (Moderation, Support, Reviews, Lawyers, Resources, Audit Trails).
 */

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Maps standard 4-tier severity levels to consistent Tailwind badge tokens.
 */
export function getSeverityBadgeClass(severity: string | undefined): string {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30 shadow-sm shadow-rose-950/50';
    case 'high':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'medium':
      return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    case 'low':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    default:
      return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  }
}

/**
 * Maps standard severity levels to indicator dot styling.
 */
export function getSeverityDotClass(severity: string | undefined): string {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'bg-rose-400 animate-pulse';
    case 'high':
      return 'bg-amber-400';
    case 'medium':
      return 'bg-sky-400';
    case 'low':
      return 'bg-emerald-400';
    default:
      return 'bg-slate-400';
  }
}

/**
 * Maps platform domain entities to standard taxonomy badge colors.
 */
export function getEntityTypeBadgeClass(type: string | undefined): string {
  switch (type?.toLowerCase()) {
    case 'review':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'lawyer':
      return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    case 'legalresource':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'helpline':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    case 'bareactsection':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    case 'user':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'consultation':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  }
}

/**
 * Robust extractor for 2-character avatar initials from an email address, full name, or username.
 * e.g. "john.doe@lawfirm.com" -> "JD"
 * e.g. "Advocate Sharma" -> "AS"
 * e.g. "admin" -> "AD"
 */
export function extractUserInitials(identifier?: string | null): string {
  if (!identifier || typeof identifier !== 'string') return 'AD';
  const trimmed = identifier.trim();
  if (!trimmed) return 'AD';

  // If email address, extract name part before @
  const localPart = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;

  // Split by common delimiters (spaces, dots, underscores, hyphens)
  const parts = localPart.split(/[\s._-]+/).filter(p => p.length > 0);

  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  // Single word: take first 2 letters
  return localPart.substring(0, 2).toUpperCase();
}