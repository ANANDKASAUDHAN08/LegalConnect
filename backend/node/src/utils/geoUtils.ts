import LegalResource from '../models/LegalResource';
import { getShortNameMap } from './actNormalizer';

const _shortNameMap = getShortNameMap();

export function normalizeActShortName(shortName: string): string {
  if (!shortName) return shortName;
  const trimmed = shortName.trim();
  // Check the comprehensive map first
  if (_shortNameMap[trimmed]) return _shortNameMap[trimmed];
  // Check uppercase variant
  const upper = trimmed.toUpperCase();
  if (_shortNameMap[upper]) return _shortNameMap[upper];
  // Legacy compat
  if (upper === 'CPA') return 'CP';
  if (upper === 'ITA') return 'IT';
  return shortName;
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function resolveCityAndStateFromText(locationStr: string): Promise<{ city: string; state: string | null; lat?: number; lng?: number }> {
  const cleanLoc = locationStr.toLowerCase().trim();

  try {
    // Get all unique cities from database dynamically
    const dbCities = await LegalResource.distinct('city');
    // Sort by length descending to match longer names first (e.g. "New Delhi" before "Delhi")
    dbCities.sort((a, b) => b.length - a.length);

    for (const city of dbCities) {
      if (city && cleanLoc.includes(city.toLowerCase())) {
        // Find the state for this city from the database
        const sample = await LegalResource.findOne({
          city: { $regex: new RegExp(`^${city}$`, 'i') },
          state: { $exists: true }
        }).lean();

        // Find coordinates of any resource in this city to assist proximity mapping
        const coordSample = await LegalResource.findOne({
          city: { $regex: new RegExp(`^${city}$`, 'i') },
          'coordinates.lat': { $exists: true }
        }).lean();

        return {
          city: city,
          state: (sample && sample.state) ? sample.state : null,
          lat: coordSample?.coordinates?.lat || undefined,
          lng: coordSample?.coordinates?.lng || undefined
        };
      }
    }
  } catch (err) {
    console.error('Failed to query distinct cities from DB:', err);
  }

  // Comma-separated address fallback
  if (locationStr.includes(',')) {
    const parts = locationStr.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      const cityCandidate = parts[parts.length - 3];
      try {
        const sample = await LegalResource.findOne({
          city: { $regex: new RegExp(`^${cityCandidate}$`, 'i') }
        }).lean();
        if (sample) {
          return {
            city: sample.city,
            state: sample.state || null,
            lat: sample.coordinates?.lat || undefined,
            lng: sample.coordinates?.lng || undefined
          };
        }
      } catch (err) { }
    } else if (parts.length >= 2) {
      const cityCandidate = parts[parts.length - 2];
      try {
        const sample = await LegalResource.findOne({
          city: { $regex: new RegExp(`^${cityCandidate}$`, 'i') }
        }).lean();
        if (sample) {
          return {
            city: sample.city,
            state: sample.state || null,
            lat: sample.coordinates?.lat || undefined,
            lng: sample.coordinates?.lng || undefined
          };
        }
      } catch (err) { }
    }
  }

  // If no city from DB matches, capitalize and clean original location string
  const cleanTarget = locationStr.replace(/\b\d{5,}\b/g, '').replace(/,?\s*india/i, '').trim();
  return { city: cleanTarget || locationStr, state: null };
}