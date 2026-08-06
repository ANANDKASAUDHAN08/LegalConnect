/**
 * Core Security & Privacy Protection Utilities
 * Provides PII masking (Phone & Email) with audit logging support
 * and input sanitization against XSS & injection vectors.
 */

/**
 * Mask Phone Number (e.g. +91 9876543210 -> +91 ••••• •3068)
 * Standard 10-digit phone: 6 masked digits (5 dots + space + 1 dot) + 4 visible digits = 10 digits
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '••••••••••';
  const trimmed = phone.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length <= 4) return '••••';

  const lastFour = digitsOnly.slice(-4);
  const prefix = trimmed.startsWith('+') ? trimmed.slice(0, 3) + ' ' : '';
  const totalDigits = digitsOnly.length >= 10 ? 10 : digitsOnly.length;
  const maskedCount = Math.max(0, totalDigits - 4);

  if (maskedCount === 6) {
    return `${prefix}••••••${lastFour}`;
  }
  return `${prefix}${'•'.repeat(maskedCount)}${lastFour}`;
}

/**
 * Mask Email Address (e.g. advocate.smith@lawfirm.com -> a•••••••h@lawfirm.com)
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '••••@••••.com';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local.charAt(0)}•@${domain}`;
  const maskedLocal = `${local.charAt(0)}•••••${local.charAt(local.length - 1)}`;
  return `${maskedLocal}@${domain}`;
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
 * Reusable PII Masking State Manager (matches TableSelection pattern)
 * Supports field-specific unmasking (e.g. phone vs email) and table-wide toggleAll.
 */
export class PiiMaskState<T extends string | number = string | number> {
  private unmaskedSet = new Set<string>();
  public isAllUnmasked = false;

  toggle(id: T, field: string = 'default', event?: Event): void {
    if (event) event.stopPropagation();
    const key = `${id}_${field}`;
    if (this.unmaskedSet.has(key)) {
      this.unmaskedSet.delete(key);
    } else {
      this.unmaskedSet.add(key);
    }
  }

  isUnmasked(id: T, field: string = 'default'): boolean {
    if (this.isAllUnmasked) return true;
    const key = `${id}_${field}`;
    return this.unmaskedSet.has(key);
  }

  toggleAll(event?: Event): void {
    if (event) event.stopPropagation();
    this.isAllUnmasked = !this.isAllUnmasked;
    if (!this.isAllUnmasked) {
      this.unmaskedSet.clear();
    }
  }

  clear(): void {
    this.unmaskedSet.clear();
    this.isAllUnmasked = false;
  }
}