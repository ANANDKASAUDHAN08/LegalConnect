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