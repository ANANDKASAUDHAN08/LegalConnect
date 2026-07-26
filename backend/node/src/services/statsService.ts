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

const inMemoryCache: Record<string, { data: any; expiry: number }> = {};

export async function getCache(key: string): Promise<any> {
  if (isRedisConnected && redisClient) {
    try {
      const data = await redisClient.get(key);
      if (data) return JSON.parse(data);
    } catch (err) {
      console.warn(`Redis getCache error for key ${key}:`, err);
    }
  }
  const item = inMemoryCache[key];
  if (item && item.expiry > Date.now()) {
    return item.data;
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
  inMemoryCache[key] = {
    data,
    expiry: Date.now() + (ttlSeconds * 1000)
  };
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
  const item = inMemoryCache[key];
  if (!item || item.expiry <= now) {
    const expiry = now + (windowSeconds * 1000);
    inMemoryCache[key] = { data: 1, expiry };
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