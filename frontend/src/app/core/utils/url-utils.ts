/**
 * Shared Utility Functions for URL and Media Resource Normalization
 */

/**
 * Normalizes relative/absolute media URLs to ensure proper resolution.
 */
export function normalizeMediaUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  let cleanUrl = url.trim();

  // Strip hardcoded localhost / dev gateway ports (like http://localhost:8888, http://localhost:5001)
  // so requests always route relatively via Angular proxy or production domain
  if (cleanUrl.includes('/uploads/')) {
    const uploadsIndex = cleanUrl.indexOf('/uploads/');
    cleanUrl = cleanUrl.substring(uploadsIndex);
  }

  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    return cleanUrl;
  }
  return cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;
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