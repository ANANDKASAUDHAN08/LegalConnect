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

/**
 * High-precision Centroid fallbacks covering Indian States, UTs & Major Cities
 */
export const GEO_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  // Metros & Major Cities
  'delhi': { lat: 28.6139, lng: 77.2090 },
  'new delhi': { lat: 28.6139, lng: 77.2090 },
  'central delhi': { lat: 28.6517, lng: 77.2219 },
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  'bengaluru': { lat: 12.9716, lng: 77.5946 },
  'bangalore': { lat: 12.9716, lng: 77.5946 },
  'hyderabad': { lat: 17.3850, lng: 78.4867 },
  'chennai': { lat: 13.0827, lng: 80.2707 },
  'kolkata': { lat: 22.5726, lng: 88.3639 },
  'ahmedabad': { lat: 23.0225, lng: 72.5714 },
  'pune': { lat: 18.5204, lng: 73.8567 },
  'jaipur': { lat: 26.9124, lng: 75.7873 },
  'lucknow': { lat: 26.8467, lng: 80.9462 },
  'patna': { lat: 25.5941, lng: 85.1376 },
  'chandigarh': { lat: 30.7333, lng: 76.7794 },
  'bhopal': { lat: 23.2599, lng: 77.4126 },
  'ranchi': { lat: 23.3441, lng: 85.3096 },
  'guwahati': { lat: 26.1445, lng: 91.7362 },
  'thiruvananthapuram': { lat: 8.5241, lng: 76.9366 },
  'kochi': { lat: 9.9312, lng: 76.2673 },
  'shimla': { lat: 31.1048, lng: 77.1734 },
  'dehradun': { lat: 30.3165, lng: 78.0322 },
  'bhubaneswar': { lat: 20.2961, lng: 85.8245 },
  'cuttack': { lat: 20.4625, lng: 85.8828 },
  'raipur': { lat: 21.2514, lng: 81.6296 },
  'srinagar': { lat: 34.0837, lng: 74.7973 },
  'jammu': { lat: 32.7266, lng: 74.8570 },
  'surat': { lat: 21.1702, lng: 72.8311 },
  'varanasi': { lat: 25.3176, lng: 82.9739 },
  'agra': { lat: 27.1767, lng: 78.0081 },
  'indore': { lat: 22.7196, lng: 75.8577 },
  'nagpur': { lat: 21.1458, lng: 79.0882 },
  'visakhapatnam': { lat: 17.6868, lng: 83.2185 },
  'amritsar': { lat: 31.6340, lng: 74.8723 },
  'ludhiana': { lat: 30.9010, lng: 75.8573 },
  'kanpur': { lat: 26.4499, lng: 80.3319 },
  'allahabad': { lat: 25.4358, lng: 81.8463 },
  'prayagraj': { lat: 25.4358, lng: 81.8463 },
  'meerut': { lat: 28.9845, lng: 77.7064 },
  'noida': { lat: 28.5355, lng: 77.3910 },
  'greater noida': { lat: 28.4744, lng: 77.5040 },
  'ghaziabad': { lat: 28.6692, lng: 77.4538 },
  'gurugram': { lat: 28.4595, lng: 77.0266 },
  'gurgaon': { lat: 28.4595, lng: 77.0266 },
  'faridabad': { lat: 28.4089, lng: 77.3178 },
  // States & UT Centroids
  'andhra pradesh': { lat: 15.9129, lng: 79.7400 },
  'arunachal pradesh': { lat: 28.2180, lng: 94.7278 },
  'assam': { lat: 26.2006, lng: 92.9376 },
  'bihar': { lat: 25.0961, lng: 85.3131 },
  'chhattisgarh': { lat: 21.2787, lng: 81.8661 },
  'goa': { lat: 15.2993, lng: 74.1240 },
  'gujarat': { lat: 22.2587, lng: 71.1924 },
  'haryana': { lat: 29.0588, lng: 76.0856 },
  'himachal pradesh': { lat: 31.1048, lng: 77.1734 },
  'jharkhand': { lat: 23.6102, lng: 85.2799 },
  'karnataka': { lat: 15.3173, lng: 75.7139 },
  'kerala': { lat: 10.8505, lng: 76.2711 },
  'madhya pradesh': { lat: 22.9734, lng: 78.6569 },
  'maharashtra': { lat: 19.7515, lng: 75.7139 },
  'manipur': { lat: 24.6637, lng: 93.9063 },
  'meghalaya': { lat: 25.4670, lng: 91.3662 },
  'mizoram': { lat: 23.1645, lng: 92.9376 },
  'nagaland': { lat: 26.1584, lng: 94.5624 },
  'odisha': { lat: 20.9517, lng: 85.0985 },
  'punjab': { lat: 31.1471, lng: 75.3412 },
  'rajasthan': { lat: 27.0238, lng: 74.2179 },
  'sikkim': { lat: 27.5330, lng: 88.5122 },
  'tamil nadu': { lat: 11.1271, lng: 78.6569 },
  'telangana': { lat: 18.1124, lng: 79.0193 },
  'tripura': { lat: 23.9408, lng: 91.9882 },
  'uttar pradesh': { lat: 26.8467, lng: 80.9462 },
  'uttarakhand': { lat: 30.0668, lng: 79.0193 },
  'west bengal': { lat: 22.9868, lng: 87.8550 },
  'andaman and nicobar islands': { lat: 11.7401, lng: 92.6586 },
  'ladakh': { lat: 34.1526, lng: 77.5771 },
  'jammu and kashmir': { lat: 33.7782, lng: 76.5762 },
  'puducherry': { lat: 11.9416, lng: 79.8083 }
};

/**
 * Resolves standard centroid coordinates for any Indian city or state
 */
export function resolveGeoCentroid(locationKey?: string): { lat: number; lng: number } {
  if (!locationKey) return { lat: 28.6139, lng: 77.2090 };
  const clean = locationKey.toLowerCase().trim();
  return GEO_CENTROIDS[clean] || { lat: 28.6139, lng: 77.2090 };
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

/**
 * Helper: Build regex pattern resolving canonical city aliases (e.g. Delhi / New Delhi)
 * and geocoded nearby city clusters.
 */
export function buildCityRegex(city: string, nearbyCities?: Set<string>): RegExp {
  const cleanedLoc = city.trim().toLowerCase();
  let cityPattern = `^${city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;

  if (cleanedLoc === 'delhi' || cleanedLoc === 'new delhi') {
    cityPattern = '^(delhi|new delhi)$';
  } else if (cleanedLoc === 'bengaluru' || cleanedLoc === 'bangalore') {
    cityPattern = '^(bengaluru|bangalore)$';
  } else if (cleanedLoc === 'gurgaon' || cleanedLoc === 'gurugram') {
    cityPattern = '^(gurgaon|gurugram)$';
  }

  if (nearbyCities && nearbyCities.size > 1) {
    const escaped = Array.from(nearbyCities).map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    cityPattern = `^(${escaped.join('|')})$`;
  }

  return new RegExp(cityPattern, 'i');
}