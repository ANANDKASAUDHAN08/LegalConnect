import jwt from 'jsonwebtoken';

export interface EntityInteractionPayload {
  count: number;
  liked: boolean;
  saved: boolean;
}

const DOTNET_API_URL = process.env.DOTNET_API_URL || 'http://localhost:5001';

// Short in-memory cache to avoid duplicate calls during burst navigation (15 second TTL)
interface CacheEntry {
  data: EntityInteractionPayload;
  expiry: number;
}
const cache = new Map<string, CacheEntry>();

/**
 * Enriches an entity with interaction stats (likesCount, isLiked, isBookmarked)
 * by fetching directly from .NET Core API in a single internal trip.
 */
export async function enrichEntityWithInteractions(
  targetType: 'Lawyer' | 'LegalResource' | 'BareActSection',
  targetId: string,
  authHeader?: string
): Promise<EntityInteractionPayload> {
  const defaultPayload: EntityInteractionPayload = { count: 0, liked: false, saved: false };
  if (!targetType || !targetId) return defaultPayload;

  // Extract user ID if JWT authorization header is present
  let userId: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded: any = jwt.decode(token);
      if (decoded) {
        userId = decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ||
          decoded.sub || decoded.nameid || decoded.id || null;
      }
    } catch { /* Ignore token decode errors */ }
  }

  const cacheKey = `${targetType}:${targetId}:${userId || 'guest'}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  try {
    let url = `${DOTNET_API_URL}/api/interaction/enrich?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`;
    if (userId) {
      url += `&userId=${encodeURIComponent(userId)}`;
    }

    const headers: Record<string, string> = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s fast fail-safe

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const result: any = await response.json();
      const payload: EntityInteractionPayload = {
        count: Number(result.count) || 0,
        liked: Boolean(result.liked),
        saved: Boolean(result.saved)
      };

      // Cache for 15 seconds
      cache.set(cacheKey, { data: payload, expiry: Date.now() + 15000 });
      return payload;
    }
  } catch (err: any) {
    // Fail-safe: if .NET is temporarily warming up, return defaults without breaking entity loading
  }

  return defaultPayload;
}