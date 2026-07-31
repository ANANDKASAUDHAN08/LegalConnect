import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AvatarService {
  private readonly PALETTE = [
    'bg-gradient-to-tr from-purple-600 via-indigo-600 to-indigo-500 border border-purple-400/30 text-white shadow-purple-500/20',
    'bg-gradient-to-tr from-blue-600 via-sky-600 to-cyan-500 border border-blue-400/30 text-white shadow-blue-500/20',
    'bg-gradient-to-tr from-emerald-600 via-teal-600 to-teal-400 border border-emerald-400/30 text-white shadow-emerald-500/20',
    'bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 border border-amber-400/30 text-white shadow-amber-500/20',
    'bg-gradient-to-tr from-rose-600 via-pink-600 to-pink-500 border border-rose-400/30 text-white shadow-rose-500/20',
    'bg-gradient-to-tr from-indigo-600 via-violet-600 to-sky-400 border border-indigo-400/30 text-white shadow-indigo-500/20',
    'bg-gradient-to-tr from-fuchsia-600 via-pink-600 to-rose-500 border border-fuchsia-400/30 text-white shadow-fuchsia-500/20',
    'bg-gradient-to-tr from-cyan-600 via-teal-600 to-blue-500 border border-cyan-400/30 text-white shadow-cyan-500/20',
    'bg-gradient-to-tr from-violet-600 via-purple-600 to-indigo-500 border border-violet-400/30 text-white shadow-violet-500/20',
    'bg-gradient-to-tr from-teal-600 via-emerald-600 to-emerald-400 border border-teal-400/30 text-white shadow-teal-500/20',
    'bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-500 border border-sky-400/30 text-white shadow-sky-500/20',
    'bg-gradient-to-tr from-orange-600 via-amber-600 to-amber-400 border border-orange-400/30 text-white shadow-orange-500/20'
  ];

  // High-performance microsecond O(1) Memoization Cache
  private initialCache = new Map<string, string>();
  private colorCache = new Map<string, string>();

  /**
   * Cleans title honorifics (Adv., Adv, Advocate, Dr., Dr, Mr., Mrs., Ms., Prof., Justice)
   * and returns the true first name initial letter with O(1) memoization.
   */
  getInitial(fullName: string, fallback = 'U'): string {
    if (!fullName) return fallback;
    const cacheKey = `${fullName}_${fallback}`;
    if (this.initialCache.has(cacheKey)) {
      return this.initialCache.get(cacheKey)!;
    }

    const clean = fullName.replace(/^(Adv|Advocate|Dr|Mr|Mrs|Ms|Prof|Justice)\.?\s+/i, '').trim();
    const initial = clean.charAt(0).toUpperCase() || fallback;
    this.initialCache.set(cacheKey, initial);
    return initial;
  }

  /**
   * Returns a consistent, vibrant gradient CSS class based on name initial with O(1) memoization.
   */
  getColorClass(fullName: string, fallback = 'U'): string {
    if (!fullName) return this.PALETTE[0];
    const cacheKey = `${fullName}_${fallback}`;
    if (this.colorCache.has(cacheKey)) {
      return this.colorCache.get(cacheKey)!;
    }

    const initial = this.getInitial(fullName, fallback);
    const charCode = initial.charCodeAt(0) || 65;
    const index = charCode % this.PALETTE.length;
    const colorClass = this.PALETTE[index];
    this.colorCache.set(cacheKey, colorClass);
    return colorClass;
  }
}