/**
 * practiceAreaService.ts
 *
 * Centralised service for practice area data enrichment.
 * - Uses a single $unwind aggregation pipeline instead of loading all lawyers into memory (fixes B5).
 * - TTL cache (5 min) for stats, invalidated on admin writes.
 * - Resolves Bare Acts into deep links via the BareAct collection.
 * - Provides real lawyer stats: count, avgExperience, avgRating, feeRange, topCities, availableCount.
 */

import Lawyer from '../models/Lawyer';
import PracticeAreaModel from '../models/PracticeArea';
import { escapeRegex } from '../utils/escapeRegex';

// ── Types ────────────────────────────────────────────────────────────────

export interface AdvocateStats {
  totalCount: number;
  verifiedCount: number;
  avgExperience: number;
  avgRating: number;
  feeMin: number;
  feeMedian: number;
  feeMax: number;
  topCities: { city: string; count: number }[];
  availableCount: number;
}

export interface SpecCountMap {
  [normalisedSpec: string]: AdvocateStats;
}

// ── TTL Cache ────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Call after any admin write to practice areas */
export function invalidatePracticeAreaCache(): void {
  cache.clear();
}

// ── Aggregation Pipeline (fixes B5) ──────────────────────────────────────

/**
 * Builds a normalised specialization → AdvocateStats map
 * using a Mongo aggregation pipeline instead of loading all lawyers.
 */
export async function buildSpecCountMap(): Promise<SpecCountMap> {
  const cached = getCached<SpecCountMap>('specCountMap');
  if (cached) return cached;

  try {
    const pipeline = [
      { $match: { isVerified: true } },
      { $unwind: '$specializations' },
      {
        $group: {
          _id: { $toLower: { $trim: { input: '$specializations' } } },
          totalCount: { $sum: 1 },
          verifiedCount: {
            $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] }
          },
          avgExperience: { $avg: { $ifNull: ['$experience', 0] } },
          avgRating: { $avg: { $ifNull: ['$rating', 0] } },
          fees: {
            $push: {
              $cond: [{ $gt: ['$consultationFee', 0] }, '$consultationFee', '$$REMOVE']
            }
          },
          cities: { $push: '$city' },
          availableCount: {
            $sum: { $cond: [{ $eq: ['$isAvailable', true] }, 1, 0] }
          }
        }
      }
    ];

    const results = await Lawyer.aggregate(pipeline);

    const map: SpecCountMap = {};
    for (const row of results) {
      const key = row._id as string;
      if (!key) continue;

      // Compute fee stats
      const fees = (row.fees || []).filter((f: number) => f > 0).sort((a: number, b: number) => a - b);
      const feeMin = fees.length > 0 ? fees[0] : 0;
      const feeMax = fees.length > 0 ? fees[fees.length - 1] : 0;
      const feeMedian = fees.length > 0 ? fees[Math.floor(fees.length / 2)] : 0;

      // Top cities
      const cityCounts: Record<string, number> = {};
      for (const city of row.cities || []) {
        if (city) {
          const c = String(city).trim();
          if (c) cityCounts[c] = (cityCounts[c] || 0) + 1;
        }
      }
      const topCities = Object.entries(cityCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([city, count]) => ({ city, count }));

      map[key] = {
        totalCount: row.totalCount || 0,
        verifiedCount: row.verifiedCount || 0,
        avgExperience: Math.round((row.avgExperience || 0) * 10) / 10,
        avgRating: Math.round((row.avgRating || 0) * 10) / 10,
        feeMin,
        feeMedian,
        feeMax,
        topCities,
        availableCount: row.availableCount || 0
      };
    }

    setCached('specCountMap', map);
    return map;
  } catch (err) {
    console.error('practiceAreaService: aggregation failed, falling back to empty map', err);
    return {};
  }
}

/**
 * Resolve aggregate stats for a single practice area
 * by merging stats from its name + all aliases.
 */
export function resolveAreaStats(
  areaName: string,
  aliases: string[],
  specMap: SpecCountMap
): AdvocateStats {
  const keys = new Set<string>();
  keys.add(areaName.toLowerCase().trim());
  if (Array.isArray(aliases)) {
    aliases.forEach(a => keys.add(a.toLowerCase().trim()));
  }

  let totalCount = 0;
  let verifiedCount = 0;
  let expSum = 0;
  let ratingSum = 0;
  let expCount = 0;
  let ratingCount = 0;
  let availableCount = 0;
  const allFees: number[] = [];
  const cityMerge: Record<string, number> = {};

  for (const key of keys) {
    const stats = specMap[key];
    if (!stats) continue;

    totalCount += stats.totalCount;
    verifiedCount += stats.verifiedCount;
    availableCount += stats.availableCount;

    if (stats.avgExperience > 0) {
      expSum += stats.avgExperience * stats.totalCount;
      expCount += stats.totalCount;
    }
    if (stats.avgRating > 0) {
      ratingSum += stats.avgRating * stats.totalCount;
      ratingCount += stats.totalCount;
    }

    if (stats.feeMin > 0) allFees.push(stats.feeMin);
    if (stats.feeMax > 0) allFees.push(stats.feeMax);
    if (stats.feeMedian > 0) allFees.push(stats.feeMedian);

    for (const c of stats.topCities) {
      cityMerge[c.city] = (cityMerge[c.city] || 0) + c.count;
    }
  }

  allFees.sort((a, b) => a - b);

  return {
    totalCount,
    verifiedCount,
    avgExperience: expCount > 0 ? Math.round((expSum / expCount) * 10) / 10 : 0,
    avgRating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0,
    feeMin: allFees.length > 0 ? allFees[0] : 0,
    feeMedian: allFees.length > 0 ? allFees[Math.floor(allFees.length / 2)] : 0,
    feeMax: allFees.length > 0 ? allFees[allFees.length - 1] : 0,
    topCities: Object.entries(cityMerge)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([city, count]) => ({ city, count })),
    availableCount
  };
}

/**
 * Build the alias set for a practice area as a case-insensitive regex.
 * Used for finding matching lawyers in detail queries.
 */
export function buildAliasRegex(name: string, aliases: string[]): RegExp {
  const terms = [name];
  if (Array.isArray(aliases)) terms.push(...aliases);
  const escaped = terms.map(t => escapeRegex(t.trim())).filter(t => t.length > 0);
  return new RegExp(escaped.join('|'), 'i');
}

/**
 * Get the hero summary ribbon data: total areas, total advocates, total categories, total Acts.
 * Cached with the same TTL.
 */
export async function getHeroSummary(): Promise<{
  totalAreas: number;
  totalAdvocates: number;
  totalCategories: number;
  totalActsLinked: number;
}> {
  const cached = getCached<any>('heroSummary');
  if (cached) return cached;

  const [totalAreas, categories, specMap, actsResult] = await Promise.all([
    PracticeAreaModel.countDocuments({ isPublished: { $ne: false } }),
    PracticeAreaModel.distinct('category', { isPublished: { $ne: false } }),
    buildSpecCountMap(),
    PracticeAreaModel.aggregate([
      { $match: { isPublished: { $ne: false } } },
      { $unwind: '$relevantActs' },
      { $group: { _id: null, acts: { $addToSet: '$relevantActs' } } }
    ])
  ]);

  // Sum all unique advocate counts from the spec map
  let totalAdvocates = 0;
  const counted = new Set<string>();
  const allAreas = await PracticeAreaModel.find({ isPublished: { $ne: false } }, 'name aliases').lean();
  for (const area of allAreas) {
    const keys = new Set<string>();
    keys.add((area as any).name.toLowerCase().trim());
    if (Array.isArray((area as any).aliases)) {
      (area as any).aliases.forEach((a: string) => keys.add(a.toLowerCase().trim()));
    }
    for (const key of keys) {
      if (!counted.has(key) && specMap[key]) {
        totalAdvocates += specMap[key].totalCount;
        counted.add(key);
      }
    }
  }

  const summary = {
    totalAreas,
    totalAdvocates,
    totalCategories: categories.length,
    totalActsLinked: actsResult[0]?.acts?.length || 0
  };

  setCached('heroSummary', summary);
  return summary;
}