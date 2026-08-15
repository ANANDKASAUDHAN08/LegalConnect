import LegalResource from '../models/LegalResource';
import Lawyer from '../models/Lawyer';
import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL;
let redisClient: any = null;
let isRedisConnected = false;

if (redisUrl) {
  redisClient = createClient({ url: redisUrl });
  redisClient.on('error', (err: any) => {
    console.error('Redis client error:', err.message);
    isRedisConnected = false;
  });
  redisClient.on('connect', () => {
    console.log('✅ Redis connected successfully.');
    isRedisConnected = true;
  });
  redisClient.connect().catch((err: any) => {
    console.warn('⚠️ Failed to connect to Redis. Falling back to in-memory cache.', err.message);
    isRedisConnected = false;
  });
}

const MAX_CACHE_SIZE = 500;
const inMemoryCache: Map<string, { data: any; expiry: number }> = new Map();

/** Evict oldest entries when cache exceeds max size (simple LRU approximation) */
function evictIfNeeded(): void {
  if (inMemoryCache.size <= MAX_CACHE_SIZE) return;
  const now = Date.now();
  // First pass: remove expired entries
  for (const [key, item] of inMemoryCache) {
    if (item.expiry <= now) {
      inMemoryCache.delete(key);
    }
  }
  // Second pass: if still over limit, remove oldest entries
  if (inMemoryCache.size > MAX_CACHE_SIZE) {
    const excess = inMemoryCache.size - MAX_CACHE_SIZE;
    const keysToRemove = Array.from(inMemoryCache.keys()).slice(0, excess);
    for (const key of keysToRemove) {
      inMemoryCache.delete(key);
    }
  }
}

export async function getCache(key: string): Promise<any> {
  if (isRedisConnected && redisClient) {
    try {
      const data = await redisClient.get(key);
      if (data) return JSON.parse(data);
    } catch (err) {
      console.warn(`Redis getCache error for key ${key}:`, err);
    }
  }
  const item = inMemoryCache.get(key);
  if (item && item.expiry > Date.now()) {
    return item.data;
  }
  if (item) {
    inMemoryCache.delete(key); // Clean up expired
  }
  return null;
}

export async function setCache(key: string, data: any, ttlSeconds: number = 600): Promise<void> {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(data));
      return;
    } catch (err) {
      console.warn(`Redis setCache error for key ${key}:`, err);
    }
  }
  inMemoryCache.set(key, {
    data,
    expiry: Date.now() + (ttlSeconds * 1000)
  });
  evictIfNeeded();
}

export async function incrRateLimitKey(key: string, windowSeconds: number): Promise<{ count: number; ttlSeconds: number }> {
  if (isRedisConnected && redisClient) {
    try {
      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, windowSeconds);
      }
      const ttl = await redisClient.ttl(key);
      return { count, ttlSeconds: ttl > 0 ? ttl : windowSeconds };
    } catch (err) {
      console.warn(`Redis rate limit error for key ${key}:`, err);
    }
  }

  // In-memory fallback
  const now = Date.now();
  const item = inMemoryCache.get(key);
  if (!item || item.expiry <= now) {
    const expiry = now + (windowSeconds * 1000);
    inMemoryCache.set(key, { data: 1, expiry });
    return { count: 1, ttlSeconds: windowSeconds };
  }
  item.data += 1;
  const ttlSeconds = Math.max(1, Math.ceil((item.expiry - now) / 1000));
  return { count: item.data, ttlSeconds };
}

export interface PlatformStats {
  legalClinics: number;
  distCourts: number;
  verifiedLawyers: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const cacheKey = 'legal:help:stats';
  const cached = await getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const [legalClinics, distCourts, verifiedLawyers] = await Promise.all([
    LegalResource.countDocuments({ type: 'LegalAid' }),
    LegalResource.countDocuments({ type: 'Court' }),
    Lawyer.countDocuments({ isVerified: true })
  ]);

  const stats: PlatformStats = {
    legalClinics,
    distCourts,
    verifiedLawyers
  };

  await setCache(cacheKey, stats, 600);
  return stats;
}