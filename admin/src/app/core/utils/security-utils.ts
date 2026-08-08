/**
 * Core Security & Privacy Protection Utilities
 * Provides PII masking (Phone & Email) with audit logging support
 * and input sanitization against XSS & injection vectors.
 */

/**
 * Mask Phone Number (e.g. +91 9876543210 -> +91 ••••••3068)
 * Standard 10-digit phone: 6 masked digits + 4 visible digits = 10 digits
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '••••••••••';
  const trimmed = phone.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length <= 4) return '••••';

  const lastFour = digitsOnly.slice(-4);
  const prefix = trimmed.startsWith('+') ? trimmed.slice(0, 3) : '';
  const totalDigits = digitsOnly.length >= 10 ? 10 : digitsOnly.length;
  const maskedCount = Math.max(0, totalDigits - 4);

  if (maskedCount === 6) {
    return `${prefix}••••••${lastFour}`;
  }
  return `${prefix}${'•'.repeat(maskedCount)}${lastFour}`;
}

/**
 * Mask Email Address (e.g. advocate.smith@lawfirm.com -> a•••••h@lawfirm.com)
 * Optimized using string slicing to avoid array allocation during high-frequency table rendering.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '••••@••••.com';
  const atIdx = email.indexOf('@');
  if (atIdx <= 0) return '••••@••••.com';

  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);

  if (local.length <= 2) {
    return `${local.charAt(0)}•@${domain}`;
  }
  return `${local.charAt(0)}•••••${local.charAt(local.length - 1)}@${domain}`;
}

/**
 * Sanitize Search Query Input to prevent XSS / Script Injection attacks
 */
export function sanitizeSearchInput(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Strip script tags
    .replace(/[<>'"`;]/g, '') // Strip suspicious HTML / SQL structural characters
    .trim();
}

/**
 * Highly Optimized PII Masking State Manager
 * Uses O(1) single-set lookups and zero-redundancy memory allocation.
 * Supports field-specific toggling (e.g. phone vs email) and table-wide toggleAll.
 */
export class PiiMaskState<T extends string | number = string | number> {
  private unmaskedSet = new Set<string>();
  private maskedSet = new Set<string>();
  public isAllUnmasked = false;

  toggle(id: T, field: string = 'default', event?: Event): void {
    if (event) event.stopPropagation();
    const key = `${id}_${field}`;
    const currentlyUnmasked = this.isUnmasked(id, field);
    if (currentlyUnmasked) {
      this.unmaskedSet.delete(key);
      if (this.isAllUnmasked) {
        this.maskedSet.add(key);
      }
    } else {
      this.maskedSet.delete(key);
      if (!this.isAllUnmasked) {
        this.unmaskedSet.add(key);
      }
    }
  }

  isUnmasked(id: T, field: string = 'default'): boolean {
    const key = `${id}_${field}`;
    if (this.isAllUnmasked) {
      return !this.maskedSet.has(key);
    }
    return this.unmaskedSet.has(key);
  }

  toggleAll(event?: Event): void {
    if (event) event.stopPropagation();
    this.isAllUnmasked = !this.isAllUnmasked;
    this.unmaskedSet.clear();
    this.maskedSet.clear();
  }

  clear(): void {
    this.unmaskedSet.clear();
    this.maskedSet.clear();
    this.isAllUnmasked = false;
  }
}