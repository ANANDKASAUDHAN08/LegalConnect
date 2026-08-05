/**
 * Shared Utility Functions for URL and Media Resource Normalization
 */

/**
 * Normalizes relative/absolute media URLs to ensure proper resolution.
 */
export function normalizeMediaUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return url.startsWith('/') ? url : `/${url}`;
}

/**
 * Mutates an object's URL properties in place using normalizeMediaUrl.
 */
export function normalizeObjectMediaUrls<T extends Record<string, any>>(obj: T, fields: (keyof T)[]): T {
  if (!obj) return obj;
  for (const field of fields) {
    const val = obj[field];
    if (typeof val === 'string') {
      obj[field] = normalizeMediaUrl(val) as any;
    }
  }
  return obj;
}