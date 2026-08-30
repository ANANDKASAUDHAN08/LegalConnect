import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import LegalResource from '../../models/LegalResource';
import Lawyer from '../../models/Lawyer';
import HelpCategory from '../../models/HelpCategory';
import HelpRoadmap from '../../models/HelpRoadmap';
import HelpHelpline from '../../models/HelpHelpline';
import { getCache, setCache, getPlatformStats } from '../../services/statsService';
import { calculateDistance, resolveCityAndStateFromText, resolveGeoCentroid, buildCityRegex, GEO_CENTROIDS } from '../../utils/geoUtils';
import {
  VALID_RESOURCE_TYPES,
  VALID_FEE_TYPES,
  VALID_OPERATING_DAYS,
  VALID_SUBMITTER_ROLES,
  isValidResourceType,
  isValidFeeType,
  isValidOperatingDays,
  isValidSubmitterRole,
  LEGAL_STOP_WORDS,
  getCategorySpecializationRegex,
  RESOURCE_VALIDATION_RULES
} from '../../utils/legalDomainUtils';

const router = Router();

// ── Input Sanitization Helper ───────────────────────────────────────────────

/** Strip HTML tags and clamp string length to prevent XSS and oversized payloads */
function sanitizeString(str: unknown, maxLength: number): string {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLength);
}

// GET /help/stats — Fetch platform counts with Redis cache
router.get('/help/stats', asyncHandler(async (req: Request, res: Response) => {
  const stats = await getPlatformStats();
  res.set('Cache-Control', 'public, max-age=600, must-revalidate');
  res.json({ success: true, data: stats });
}));

// GET /help/categories - Fetch all legal help categories with dynamic counts (Batch-Optimized 200%+)
router.get('/help/categories', asyncHandler(async (req: Request, res: Response) => {
  const locationStr = (req.query.location as string || 'New Delhi').trim();
  const latVal = (req.query.lat && req.query.lat !== 'null' && req.query.lat !== 'undefined') ? Number(req.query.lat) : null;
  const lngVal = (req.query.lng && req.query.lng !== 'null' && req.query.lng !== 'undefined') ? Number(req.query.lng) : null;
  const latParamStr = latVal !== null ? latVal.toFixed(4) : '';
  const lngParamStr = lngVal !== null ? lngVal.toFixed(4) : '';
  const cacheKey = `legal:help:categories:${locationStr.toLowerCase()}:${latParamStr}:${lngParamStr}`;

  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    res.set('Cache-Control', 'public, max-age=300, must-revalidate');
    return res.json({ success: true, data: cachedData, fromCache: true });
  }

  // Fetch all HelpCategory records
  const dbCategories = await HelpCategory.find({}).lean();
  if (!dbCategories || dbCategories.length === 0) {
    return res.json({ success: true, data: [] });
  }

  // Resolve city from coordinates if available
  let resolvedCity = locationStr;
  const nearbyCities = new Set<string>();
  let coordsResolved = false;

  if (latVal !== null && lngVal !== null && !isNaN(latVal) && !isNaN(lngVal)) {
    const delta = 0.8;
    const nearbyResources = await LegalResource.find({
      'coordinates.lat': { $gte: latVal - delta, $lte: latVal + delta },
      'coordinates.lng': { $gte: lngVal - delta, $lte: lngVal + delta }
    }).select('city coordinates').lean();

    if (nearbyResources.length > 0) {
      let minDistance = Infinity;
      let closestResource: any = null;
      for (const res of nearbyResources) {
        if (res.coordinates && typeof res.coordinates.lat === 'number' && typeof res.coordinates.lng === 'number') {
          const dist = calculateDistance(latVal, lngVal, res.coordinates.lat, res.coordinates.lng);
          if (res.city) nearbyCities.add(res.city);
          if (dist < minDistance) {
            minDistance = dist;
            closestResource = res;
          }
        }
      }
      if (closestResource) {
        resolvedCity = closestResource.city;
        coordsResolved = true;
      }
    }
  }

  if (!coordsResolved) {
    const textRes = await resolveCityAndStateFromText(locationStr);
    resolvedCity = textRes.city;
    if (textRes.lat && textRes.lng) {
      const delta = 0.8;
      const nearbyResources = await LegalResource.find({
        'coordinates.lat': { $gte: textRes.lat - delta, $lte: textRes.lat + delta },
        'coordinates.lng': { $gte: textRes.lng - delta, $lte: textRes.lng + delta }
      }).select('city').lean();
      for (const res of nearbyResources) {
        if (res.city) nearbyCities.add(res.city);
      }
    }
  }

  const cityRegexp = buildCityRegex(resolvedCity, nearbyCities);

  // --- PERFORMANCE ELEVATION: Single Batch Queries ---
  // Drop DB query count from 40 down to 3, achieving massive speedups and reducing server CPU load!
  const [matchingResources, matchingLawyers, matchingHelplines] = await Promise.all([
    LegalResource.find({ city: { $regex: cityRegexp }, status: 'approved' }).select('type categories').lean(),
    Lawyer.find({ city: { $regex: cityRegexp }, isVerified: true }).select('specializations').lean(),
    HelpHelpline.find({}).select('category').lean()
  ]);

  // Compute active counts for the given location in memory
  const categoriesWithCounts = dbCategories.map((cat) => {
    const specQuery = getCategorySpecializationRegex(cat.id);

    // In-memory counts for resources
    let legalAid = 0;
    let courts = 0;
    let govOffices = 0;

    matchingResources.forEach((res) => {
      const matchesCategory = res.categories.includes(cat.name) || res.categories.includes('General');
      if (!matchesCategory) return;

      if (res.type === 'LegalAid') {
        legalAid++;
      } else if (res.type === 'Court') {
        courts++;
      } else if (res.type === 'GovernmentOffice' || res.type === 'PoliceStation') {
        govOffices++;
      }
    });

    // In-memory counts for lawyers
    const lawyers = matchingLawyers.filter((l) =>
      l.specializations.some((spec) => specQuery.test(spec))
    ).length;

    // In-memory counts for helplines
    const helplines = matchingHelplines.filter((h) =>
      h.category === cat.id || h.category === 'General'
    ).length;

    const totalCount = legalAid + courts + govOffices + lawyers + helplines;

    return {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      description: cat.description,
      subcategories: cat.subcategories,
      resourceCount: totalCount,
      breakdown: {
        legalAid,
        courts,
        govOffices,
        helplines,
        lawyers
      }
    };
  });

  await setCache(cacheKey, categoriesWithCounts, 300);

  res.set('Cache-Control', 'public, max-age=300, must-revalidate');
  res.json({ success: true, data: categoriesWithCounts });
}));

// GET /help-near-me - Find resources, lawyers, helplines & customized roadmap
router.get('/help-near-me', asyncHandler(async (req: Request, res: Response) => {
  const { category, location, state } = req.query;

  if (!category || !location) {
    throw AppError.badRequest('Parameters "category" and "location" are required.');
  }

  const categoryStr = category as string;
  const locationStr = location as string;
  const stateParam = state as string;

  const latParamStr = req.query.lat ? String(req.query.lat) : '';
  const lngParamStr = req.query.lng ? String(req.query.lng) : '';
  const cacheKey = `legal:help-near-me:${categoryStr.toLowerCase()}:${locationStr.toLowerCase()}:${(stateParam || '').toLowerCase()}:${latParamStr}:${lngParamStr}`;

  const cachedResult = await getCache(cacheKey);
  if (cachedResult) {
    res.set('Cache-Control', 'public, max-age=300, must-revalidate');
    return res.json({ ...cachedResult, fromCache: true });
  }

  let targetCity = locationStr.trim();
  let resolvedState = stateParam;

  const latVal = (req.query.lat && req.query.lat !== 'null' && req.query.lat !== 'undefined') ? Number(req.query.lat) : null;
  const lngVal = (req.query.lng && req.query.lng !== 'null' && req.query.lng !== 'undefined') ? Number(req.query.lng) : null;
  let coordsResolved = false;

  const nearbyCities = new Set<string>();
  if (latVal !== null && lngVal !== null && !isNaN(latVal) && !isNaN(lngVal)) {
    const delta = 0.8;
    const nearbyResources = await LegalResource.find({
      'coordinates.lat': { $gte: latVal - delta, $lte: latVal + delta },
      'coordinates.lng': { $gte: lngVal - delta, $lte: lngVal + delta }
    }).select('city coordinates state').lean();

    if (nearbyResources.length > 0) {
      let minDistance = Infinity;
      let closestResource: any = null;
      for (const r of nearbyResources) {
        if (r.coordinates && typeof r.coordinates.lat === 'number' && typeof r.coordinates.lng === 'number') {
          const dist = calculateDistance(latVal, lngVal, r.coordinates.lat, r.coordinates.lng);
          if (r.city) {
            nearbyCities.add(r.city);
          }
          if (dist < minDistance) {
            minDistance = dist;
            closestResource = r;
          }
        }
      }
      if (closestResource) {
        targetCity = closestResource.city;
        resolvedState = closestResource.state || resolvedState;
        coordsResolved = true;
      }
    }
  }

  if (!coordsResolved) {
    const textRes = await resolveCityAndStateFromText(locationStr);
    targetCity = textRes.city;
    resolvedState = textRes.state || resolvedState;
    if (textRes.lat && textRes.lng) {
      const delta = 0.8;
      const nearbyResources = await LegalResource.find({
        'coordinates.lat': { $gte: textRes.lat - delta, $lte: textRes.lat + delta },
        'coordinates.lng': { $gte: textRes.lng - delta, $lte: textRes.lng + delta }
      }).select('city').lean();
      for (const r of nearbyResources) {
        if (r.city) nearbyCities.add(r.city);
      }
    }
  }

  const specQuery = getCategorySpecializationRegex(categoryStr);
  const cityRegexp = buildCityRegex(targetCity, nearbyCities);

  const resourceFilter = {
    city: { $regex: cityRegexp },
    status: 'approved' as const,
    $or: [
      { categories: categoryStr },
      { categories: 'General' }
    ]
  };

  const [resources, lawyers, dbRoadmap, dbHelplines, slsaResource, nalsaHq] = await Promise.all([
    LegalResource.find(resourceFilter).lean(),
    Lawyer.find({
      city: { $regex: cityRegexp },
      specializations: { $regex: specQuery },
      isVerified: true
    }).sort({ rating: -1 }).limit(10).lean(),
    HelpRoadmap.findOne({ category: categoryStr }).lean(),
    HelpHelpline.find({
      $or: [
        { category: categoryStr },
        { category: 'General' }
      ]
    }).lean(),
    resolvedState ? LegalResource.findOne({
      isStateAuthority: true,
      state: { $regex: new RegExp(`^${resolvedState}$`, 'i') }
    }).lean().exec() : Promise.resolve(null),
    LegalResource.findOne({
      isNationalAuthority: true
    }).lean().exec()
  ]);

  const combinedResources: any[] = [...resources];
  if (slsaResource && !combinedResources.some(r => r._id.toString() === slsaResource._id.toString())) {
    combinedResources.unshift(slsaResource);
  }
  if (nalsaHq && !combinedResources.some(r => r._id.toString() === nalsaHq._id.toString())) {
    combinedResources.unshift(nalsaHq);
  }

  const roadmap = dbRoadmap || {
    steps: [
      { title: 'Seek Legal Advice', detail: 'Consult a legal aid center or hire a verified attorney to evaluate your rights.' },
      { title: 'Draft a Written Narrative', detail: 'Write a chronological summary of what happened, detailing names, dates, and witnesses.' },
      { title: 'Gather Supporting Documents', detail: 'Collect all contracts, identity documents, bills, and communications.' }
    ],
    documents: ['Government Issued Photo ID', 'Relevant Contracts/Agreements', 'Correspondence history (emails/letters)'],
    onlineLinks: [
      { name: 'e-Courts Services Portal', url: 'https://ecourts.gov.in' }
    ],
    lokAdalatGuidance: 'Civil suits and minor compoundable offenses can be settled in Lok Adalats to save costs, stress, and time.'
  };

  const helplines = dbHelplines && dbHelplines.length > 0 ? dbHelplines : [
    {
      name: 'National Legal Aid Helpline (NALSA)',
      number: '15100',
      description: 'Free legal aid services and counseling available 24/7 across India.'
    }
  ];

  const result = {
    success: true,
    category: categoryStr,
    location: locationStr,
    roadmap,
    helplines,
    resources: combinedResources,
    lawyers
  };

  await setCache(cacheKey, result, 300);

  res.set('Cache-Control', 'public, max-age=300, must-revalidate');
  res.json(result);
}));

// GET /all-authorities - Returns all SLSA (state) and NALSA (national) authority records
router.get('/all-authorities', asyncHandler(async (req: Request, res: Response) => {
  const cacheKey = 'legal:all-authorities';
  const cached = await getCache(cacheKey);
  if (cached) {
    res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
    return res.json({ success: true, data: cached, fromCache: true });
  }

  const authorities = await LegalResource.find({
    $or: [{ isStateAuthority: true }, { isNationalAuthority: true }],
    status: 'approved'
  }).lean();

  await setCache(cacheKey, authorities, 3600);
  res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
  res.json({ success: true, data: authorities });
}));

// ── In-Memory Directory Metrics Cache (10-minute TTL) ──
interface DirectoryMetricsCache {
  stateMetrics: Record<string, number>;
  typeMetrics: Record<string, number>;
  total: number;
  coveredStates: number;
  lastUpdated: number;
}

let cachedMetrics: DirectoryMetricsCache | null = null;
const METRICS_CACHE_TTL_MS = 10 * 60 * 1000;

export async function getDirectoryMetrics(forceRefresh = false): Promise<DirectoryMetricsCache> {
  const now = Date.now();
  if (!forceRefresh && cachedMetrics && (now - cachedMetrics.lastUpdated < METRICS_CACHE_TTL_MS)) {
    return cachedMetrics;
  }

  const [stateAggregation, typeAggregation] = await Promise.all([
    LegalResource.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$state', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    LegalResource.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ])
  ]);

  const stateMetrics: Record<string, number> = {};
  stateAggregation.forEach((s: any) => {
    if (s._id) stateMetrics[s._id] = s.count;
  });

  const typeMetrics: Record<string, number> = {};
  typeAggregation.forEach((t: any) => {
    if (t._id) typeMetrics[t._id] = t.count;
  });

  cachedMetrics = {
    stateMetrics,
    typeMetrics,
    total: stateAggregation.reduce((sum: number, s: any) => sum + s.count, 0),
    coveredStates: Object.keys(stateMetrics).length,
    lastUpdated: now
  };

  return cachedMetrics;
}

// Invalidate cache helper
export function invalidateDirectoryMetrics(): void {
  cachedMetrics = null;
}

// Haversine distance: use the imported calculateDistance from geoUtils (removed local duplicate)

// GET /resources/districts — Get distinct districts for a state
router.get('/resources/districts', asyncHandler(async (req: Request, res: Response) => {
  const { state } = req.query;
  const match: any = { status: 'approved' };
  if (state && state !== 'All') {
    match.state = { $regex: new RegExp(`^${(state as string).trim()}$`, 'i') };
  }
  const districts = await LegalResource.aggregate([
    { $match: match },
    { $project: { effectiveDistrict: { $ifNull: ['$district', '$city'] } } },
    { $match: { effectiveDistrict: { $exists: true, $nin: ['', null] } } },
    { $group: { _id: '$effectiveDistrict', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  res.set('Cache-Control', 'public, max-age=600, must-revalidate');
  res.json({
    success: true,
    data: districts.map(d => ({ district: d._id, count: d.count }))
  });
}));

// Resilient state regex helper that matches variations like '&' vs 'and', optional 'Islands' / 'UT'
export function buildStateRegex(stateStr: string): RegExp {
  const trimmed = (stateStr || '').trim();
  const pattern = trimmed
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\b(and|&)\b/gi, '(&|and)')
    .replace(/(\s*islands)?$/i, '(\\s*Islands)?')
    .replace(/(\s*ut)?$/i, '(\\s*UT)?');
  return new RegExp(`^${pattern}$`, 'i');
}

// GET /resources/directory — Paginated, filterable public directory (for /legal-resources page)
router.get('/resources/directory', asyncHandler(async (req: Request, res: Response) => {
  const {
    state,
    district,
    type,
    jurisdictionLevel,
    facility,
    search,
    pincode,
    lat,
    lng,
    radiusKm,
    sortBy = 'name',
    sortOrder = 'asc',
    page = '1',
    limit = '20'
  } = req.query;

  // Always filter to approved resources only
  const filter: any = { status: 'approved' };
  const andClauses: any[] = [];

  if (state && state !== 'All') {
    filter.state = { $regex: buildStateRegex(state as string) };
  }

  if (district && district !== 'All') {
    const distEscaped = (district as string).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const distRegex = new RegExp(distEscaped, 'i');
    andClauses.push({
      $or: [
        { district: { $regex: distRegex } },
        { city: { $regex: distRegex } },
        { address: { $regex: distRegex } }
      ]
    });
  }

  if (type && type !== 'All') {
    filter.type = type;
  }
  if (jurisdictionLevel && jurisdictionLevel !== 'All') {
    filter.jurisdictionLevel = jurisdictionLevel;
  }

  // Facility flags filtering
  if (facility) {
    if (facility === 'hasEfiling') filter['facilities.hasEfiling'] = true;
    else if (facility === 'hasLADCS') filter['facilities.hasLADCS'] = true;
    else if (facility === 'hasVCRoom') filter['facilities.hasVCRoom'] = true;
    else if (facility === 'hasLegalAidClinic') filter['facilities.hasLegalAidClinic'] = true;
    else if (facility === 'isWheelchairAccessible') filter['facilities.isWheelchairAccessible'] = true;
  }

  if (pincode) {
    const pin = (pincode as string).trim();
    andClauses.push({
      $or: [
        { pincode: { $regex: new RegExp(pin, 'i') } },
        { pincodeCoverage: { $in: [pin] } }
      ]
    });
  } else if (search) {
    const q = (search as string).trim();
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    andClauses.push({
      $or: [
        { name: { $regex: new RegExp(escaped, 'i') } },
        { address: { $regex: new RegExp(escaped, 'i') } },
        { city: { $regex: new RegExp(escaped, 'i') } },
        { state: { $regex: new RegExp(escaped, 'i') } },
        { district: { $regex: new RegExp(escaped, 'i') } },
        { pincode: { $regex: new RegExp(escaped, 'i') } },
        { pincodeCoverage: { $in: [q] } }
      ]
    });
  }

  if (andClauses.length > 0) {
    filter.$and = andClauses;
  }

  const userLat = lat ? parseFloat(lat as string) : null;
  const userLng = lng ? parseFloat(lng as string) : null;
  const isNearMe = userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng);

  const pageNum = parseInt(page as string, 10) || 1;
  const limitNum = Math.min(parseInt(limit as string, 10) || 20, 50); // Cap at 50 per page
  const skip = (pageNum - 1) * limitNum;

  // Sorting
  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const sortConfig: any = {};
  const sortField = (sortBy as string) || 'name';
  sortConfig[sortField] = sortDirection;

  // Selected Lean Projections for maximum performance & bandwidth optimization
  const fieldsToSelect = 'name name_hi type categories city district state pincode pincodeCoverage address address_hi contactNumber email website operatingHours operatingHours_hi lunchBreak isOpenNow isVerified facilities jurisdictionLevel parentAuthorityId isStateAuthority isNationalAuthority lastAuditDate coordinates viewsCount feedback';

  let resources: any[];
  let allMapPins: any[];
  let total: number;

  if (isNearMe && sortBy === 'distance') {
    // 100% Generic Pre-Pagination Geospatial Distance Sorting
    const [allMatchingRaw, metrics, allMapPinsRaw] = await Promise.all([
      LegalResource.find(filter).select(fieldsToSelect).lean(),
      getDirectoryMetrics(),
      LegalResource.find(filter).select('name name_hi type city district state address contactNumber facilities isVerified lastAuditDate coordinates').lean()
    ]);

    total = allMatchingRaw.length;

    // Compute precise distance for all matching resources
    const allWithDistance = allMatchingRaw.map((r: any) => {
      if (r.coordinates?.lat !== undefined && r.coordinates?.lng !== undefined && !isNaN(r.coordinates.lat) && !isNaN(r.coordinates.lng)) {
        const dist = calculateDistance(userLat!, userLng!, r.coordinates.lat, r.coordinates.lng);
        return { ...r, distanceKm: parseFloat(dist.toFixed(2)) };
      }
      return { ...r, distanceKm: 99999 };
    });

    // Sort by distance (nearest first for asc)
    allWithDistance.sort((a: any, b: any) => {
      const distA = a.distanceKm ?? 99999;
      const distB = b.distanceKm ?? 99999;
      return sortDirection === 1 ? distA - distB : distB - distA;
    });

    // Paginate after global distance sorting
    resources = allWithDistance.slice(skip, skip + limitNum);

    // Compute distance for all map pins
    allMapPins = allMapPinsRaw.map((r: any) => {
      if (r.coordinates?.lat !== undefined && r.coordinates?.lng !== undefined && !isNaN(r.coordinates.lat) && !isNaN(r.coordinates.lng)) {
        const dist = calculateDistance(userLat!, userLng!, r.coordinates.lat, r.coordinates.lng);
        return { ...r, distanceKm: parseFloat(dist.toFixed(2)) };
      }
      return r;
    });

    res.set('Cache-Control', 'public, max-age=60, must-revalidate');
    return res.json({
      success: true,
      data: resources,
      mapPins: allMapPins,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1
      },
      metrics: {
        total: metrics.total,
        stateMetrics: metrics.stateMetrics,
        typeMetrics: metrics.typeMetrics,
        coveredStates: metrics.coveredStates
      }
    });
  }

  // Standard non-distance queries (e.g. sorted by name, type, recently audited)
  const [resourcesRaw, totalCount, metrics, allMapPinsRaw] = await Promise.all([
    LegalResource.find(filter).select(fieldsToSelect).sort(sortConfig).skip(skip).limit(limitNum).lean(),
    LegalResource.countDocuments(filter),
    getDirectoryMetrics(),
    LegalResource.find(filter).select('name name_hi type city district state address contactNumber facilities isVerified lastAuditDate coordinates').lean()
  ]);

  total = totalCount;
  resources = resourcesRaw;
  allMapPins = allMapPinsRaw;

  // If user coordinates provided on non-distance sort, attach distance telemetry
  if (isNearMe) {
    resources = resources.map((r: any) => {
      if (r.coordinates?.lat !== undefined && r.coordinates?.lng !== undefined && !isNaN(r.coordinates.lat) && !isNaN(r.coordinates.lng)) {
        const dist = calculateDistance(userLat!, userLng!, r.coordinates.lat, r.coordinates.lng);
        return { ...r, distanceKm: parseFloat(dist.toFixed(2)) };
      }
      return r;
    });

    allMapPins = allMapPins.map((r: any) => {
      if (r.coordinates?.lat !== undefined && r.coordinates?.lng !== undefined && !isNaN(r.coordinates.lat) && !isNaN(r.coordinates.lng)) {
        const dist = calculateDistance(userLat!, userLng!, r.coordinates.lat, r.coordinates.lng);
        return { ...r, distanceKm: parseFloat(dist.toFixed(2)) };
      }
      return r;
    });
  }

  res.set('Cache-Control', 'public, max-age=180, must-revalidate');
  res.json({
    success: true,
    data: resources,
    mapPins: allMapPins,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum) || 1
    },
    metrics: {
      total: metrics.total,
      stateMetrics: metrics.stateMetrics,
      typeMetrics: metrics.typeMetrics,
      coveredStates: metrics.coveredStates
    }
  });
}));

// Anti-Spam Rate Limiter: Max 20 suggestions per IP in 10 minutes
const suggestionRateMap = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const maxLimit = 20;

  const timestamps = (suggestionRateMap.get(ip) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxLimit) {
    return false;
  }
  timestamps.push(now);
  suggestionRateMap.set(ip, timestamps);
  return true;
}

// Periodic cleanup of stale rate-limit entries (every 5 minutes) to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  for (const [ip, timestamps] of suggestionRateMap.entries()) {
    const active = timestamps.filter(t => now - t < windowMs);
    if (active.length === 0) {
      suggestionRateMap.delete(ip);
    } else {
      suggestionRateMap.set(ip, active);
    }
  }
}, 5 * 60 * 1000);



// GET /check-duplicate-resource - High-precision duplicate check
router.get('/check-duplicate-resource', asyncHandler(async (req: Request, res: Response) => {
  const name = sanitizeString(req.query.name as string, 200);
  const city = sanitizeString(req.query.city as string || req.query.district as string, 100);
  const state = sanitizeString(req.query.state as string, 60);

  if (!name || name.length < 3) {
    return res.json({ success: true, data: { hasDuplicate: false, count: 0, matches: [] } });
  }

  // 1. Extract distinctive non-stop words
  const distinctiveWords = name
    .toLowerCase()
    .split(/[\s,.\-_/]+/)
    .filter(w => w.length >= 3 && !LEGAL_STOP_WORDS.has(w));

  let filter: any;

  if (distinctiveWords.length === 0) {
    // If user only entered generic words (e.g. "Police Station" or "Court"), only match exact name
    filter = {
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    };
  } else {
    // Search by distinctive keyword patterns (e.g. "Tis Hazari", "Saket", "Kinauli")
    const regexPattern = distinctiveWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    filter = {
      name: { $regex: new RegExp(regexPattern, 'i') }
    };
  }

  // 2. Geographic Boundary Isolation (Prioritize local matches)
  if (city) {
    filter.$or = [
      { city: { $regex: new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
      { district: { $regex: new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }
    ];
  } else if (state) {
    filter.state = { $regex: buildStateRegex(state) };
  }

  const matches = await LegalResource.find(filter)
    .select('_id name type city district state address isVerified status')
    .limit(3)
    .lean();

  res.json({
    success: true,
    data: {
      hasDuplicate: matches.length > 0,
      count: matches.length,
      matches
    }
  });
}));

// POST /suggest-resource - User & Guest Suggestion Endpoint (Public, Sanitized)
router.post('/suggest-resource', asyncHandler(async (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    throw AppError.badRequest('Rate limit exceeded. Please wait a few minutes before submitting another suggestion.');
  }

  const {
    categories,
    subcategories,
    pincodeCoverage,
    contactNumber,
    email,
    facilities,
    languages,
    coordinates,
    targetBeneficiaries,
    signboardImageUrl,
    is24x7Emergency,
    submitter,
    auditNotes
  } = req.body;

  // ── Server-Side Input Sanitization (XSS prevention + length caps) ──
  const name = sanitizeString(req.body.name, RESOURCE_VALIDATION_RULES.name.max);
  const type = sanitizeString(req.body.type, RESOURCE_VALIDATION_RULES.type.max);
  const city = sanitizeString(req.body.city, RESOURCE_VALIDATION_RULES.city.max);
  const district = sanitizeString(req.body.district, RESOURCE_VALIDATION_RULES.district.max);
  const state = sanitizeString(req.body.state, RESOURCE_VALIDATION_RULES.state.max);
  const pincode = sanitizeString(req.body.pincode, RESOURCE_VALIDATION_RULES.pincode.length);
  const address = sanitizeString(req.body.address, RESOURCE_VALIDATION_RULES.address.max);
  const website = sanitizeString(req.body.website, RESOURCE_VALIDATION_RULES.website.max);
  const operatingHours = sanitizeString(req.body.operatingHours, RESOURCE_VALIDATION_RULES.operatingHours.max);
  const operatingDays = sanitizeString(req.body.operatingDays, RESOURCE_VALIDATION_RULES.operatingDays.max);
  const lunchBreak = sanitizeString(req.body.lunchBreak, RESOURCE_VALIDATION_RULES.lunchBreak.max);
  const feeType = sanitizeString(req.body.feeType, RESOURCE_VALIDATION_RULES.feeType.max);
  const notes = sanitizeString(req.body.notes, RESOURCE_VALIDATION_RULES.notes.max);

  const resolvedCity = (city || district || '').trim();
  const resolvedDistrict = (district || city || '').trim();
  const resolvedState = (state || 'Delhi').trim();

  // ── Required Fields Validation ──
  if (!name || !type || !resolvedCity || !address) {
    throw AppError.badRequest('Required fields: name, type, city, address.');
  }

  // ── Enum Validation (reject unknown values) ──
  if (!isValidResourceType(type)) {
    throw AppError.badRequest(`Invalid resource type: "${type}". Allowed: ${VALID_RESOURCE_TYPES.join(', ')}`);
  }
  if (feeType && !isValidFeeType(feeType)) {
    throw AppError.badRequest(`Invalid fee type: "${feeType}". Allowed: ${VALID_FEE_TYPES.join(', ')}`);
  }
  if (operatingDays && !isValidOperatingDays(operatingDays)) {
    throw AppError.badRequest(`Invalid operating days: "${operatingDays}". Allowed: ${VALID_OPERATING_DAYS.join(', ')}`);
  }

  // ── Format Validation ──
  if (pincode && !/^\d{6}$/.test(pincode)) {
    throw AppError.badRequest('PIN code must be exactly 6 digits.');
  }

  // Validate email format if provided (sanitized array or single string)
  const emailArr = Array.isArray(email) ? email : (email ? [email] : []);
  for (const e of emailArr) {
    if (typeof e === 'string' && e.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())) {
      throw AppError.badRequest(`Invalid email format: "${sanitizeString(e, 50)}"`);
    }
  }

  // Validate coordinates bounds if provided
  if (coordinates && coordinates.lat !== undefined && coordinates.lng !== undefined) {
    const lat = Number(coordinates.lat);
    const lng = Number(coordinates.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw AppError.badRequest('Coordinates out of valid range (lat: -90..90, lng: -180..180).');
      }
    }
  }

  // Validate submitter role if provided
  if (submitter?.role && !isValidSubmitterRole(submitter.role)) {
    throw AppError.badRequest(`Invalid submitter role: "${sanitizeString(submitter.role, 20)}". Allowed: ${VALID_SUBMITTER_ROLES.join(', ')}`);
  }

  // 1. High-Accuracy Coordinates Resolution (GPS -> City Centroid -> State Centroid)
  let finalCoords: { lat: number; lng: number };

  if (coordinates && coordinates.lat && coordinates.lng && !isNaN(Number(coordinates.lat)) && !isNaN(Number(coordinates.lng)) && (Number(coordinates.lat) !== 0 || Number(coordinates.lng) !== 0)) {
    finalCoords = {
      lat: parseFloat(Number(coordinates.lat).toFixed(6)),
      lng: parseFloat(Number(coordinates.lng).toFixed(6))
    };
  } else {
    // Dynamic Geocoding centroid fallback with slight realistic spatial jitter (~1km)
    const cityKey = resolvedCity.toLowerCase().trim();
    const stateKey = resolvedState.toLowerCase().trim();
    const centroid = GEO_CENTROIDS[cityKey] || GEO_CENTROIDS[stateKey] || { lat: 28.6139, lng: 77.2090 };

    const jitterLat = (Math.random() - 0.5) * 0.02;
    const jitterLng = (Math.random() - 0.5) * 0.02;

    finalCoords = {
      lat: parseFloat((centroid.lat + jitterLat).toFixed(6)),
      lng: parseFloat((centroid.lng + jitterLng).toFixed(6))
    };
  }

  // 2. Submitter Profile Metadata & Verification Context
  const isGuest = submitter ? !!submitter.isGuest : true;
  const submitterRole = submitter?.role || (isGuest ? 'Citizen' : 'Advocate');
  const submitterName = submitter?.name?.trim() || (isGuest ? 'Guest Contributor' : 'Verified Member');
  const submitterEmail = submitter?.email?.trim() || undefined;
  const submitterPhone = submitter?.phone?.trim() || undefined;
  const submitterUserId = submitter?.userId || undefined;

  // 3. Construct LegalResource Document
  // Sanitize submitter fields
  const sanitizedSubmitterName = sanitizeString(submitter?.name, 100) || (isGuest ? 'Guest Contributor' : 'Verified Member');
  const sanitizedSubmitterEmail = sanitizeString(submitter?.email, 100) || undefined;
  const sanitizedSubmitterPhone = sanitizeString(submitter?.phone, 20) || undefined;

  const newResource = new LegalResource({
    name: name,
    type: type || 'LegalAid',
    categories: categories && categories.length ? categories : ['General Legal Assistance'],
    subcategories: subcategories || [],
    city: resolvedCity,
    district: resolvedDistrict,
    state: resolvedState,
    pincode: pincode ? pincode.trim() : '',
    pincodeCoverage: Array.isArray(pincodeCoverage) ? pincodeCoverage : (pincodeCoverage ? [pincodeCoverage] : []),
    address: address.trim(),
    contactNumber: Array.isArray(contactNumber) ? contactNumber : (contactNumber ? [contactNumber] : []),
    email: Array.isArray(email) ? email : (email ? [email] : []),
    website: website ? website.trim() : '',
    operatingHours: operatingHours || '09:30 AM - 05:00 PM',
    operatingDays: operatingDays || 'Mon-Sat',
    lunchBreak: lunchBreak || '01:30 PM - 02:00 PM',
    is24x7Emergency: !!is24x7Emergency,
    feeType: feeType || 'FreeLegalAid',
    targetBeneficiaries: Array.isArray(targetBeneficiaries) ? targetBeneficiaries : [],
    signboardImageUrl: signboardImageUrl ? signboardImageUrl.trim() : undefined,
    submitter: {
      name: sanitizedSubmitterName,
      email: sanitizedSubmitterEmail,
      phone: sanitizedSubmitterPhone,
      role: submitterRole,
      isGuest,
      userId: submitterUserId
    },
    facilities: {
      hasEfiling: facilities?.hasEfiling ?? false,
      hasLADCS: facilities?.hasLADCS ?? false,
      hasVCRoom: facilities?.hasVCRoom ?? false,
      hasLegalAidClinic: facilities?.hasLegalAidClinic ?? true,
      isWheelchairAccessible: facilities?.isWheelchairAccessible ?? false
    },
    languages: languages && languages.length ? languages : ['English', 'Hindi'],
    coordinates: finalCoords,
    isVerified: false,
    status: 'pending',
    source: isGuest ? 'guest_suggestion' : 'user_suggestion',
    auditNotes: auditNotes || (notes ? `Public Suggestion: ${notes.trim()}` : `Submitted by ${submitterName} (${submitterRole}${isGuest ? ' - Guest' : ''}) on ${new Date().toLocaleDateString('en-IN')}`)
  });

  await newResource.save();

  res.status(201).json({
    success: true,
    message: isGuest
      ? 'Thank you! Your suggestion has been queued for verification by the legal registry team.'
      : 'Thank you! Your resource contribution has been recorded in the verification pipeline.',
    data: newResource
  });
}));

// GET /resources/:id - Get a single legal resource by ID (Public)
router.get('/resources/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const resource: any = await LegalResource.findById(id).lean();
  if (!resource) {
    throw AppError.notFound('Resource not found.');
  }
  if (!resource.feedback) {
    resource.feedback = { upvotes: 0, downvotes: 0, helpfulnessScore: 100, reasons: [] };
  }

  // Populate Parent Authority if hierarchical link exists
  if (resource.parentAuthorityId) {
    const parent = await LegalResource.findById(resource.parentAuthorityId)
      .select('name type city state jurisdictionLevel address contactNumber')
      .lean();
    if (parent) {
      resource.parentAuthority = parent;
    }
  }

  res.json({ success: true, data: resource });
}));

// POST /resources/:id/feedback - Record user helpful/not helpful feedback
router.post('/resources/:id/feedback', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isHelpful, reason } = req.body;
  const resource = await LegalResource.findById(id);
  if (!resource) {
    throw AppError.notFound('Resource not found.');
  }

  if (!resource.feedback) {
    resource.feedback = { upvotes: 0, downvotes: 0, helpfulnessScore: 100, reasons: [] };
  }

  if (isHelpful) {
    resource.feedback.upvotes = (resource.feedback.upvotes || 0) + 1;
  } else {
    resource.feedback.downvotes = (resource.feedback.downvotes || 0) + 1;
    if (reason) {
      const existingReason = resource.feedback.reasons?.find((r: any) => r.reason === reason);
      if (existingReason) {
        existingReason.count = (existingReason.count || 0) + 1;
      } else {
        resource.feedback.reasons = resource.feedback.reasons || [];
        resource.feedback.reasons.push({ reason, count: 1 });
      }
    }
  }

  const totalVotes = (resource.feedback.upvotes || 0) + (resource.feedback.downvotes || 0);
  resource.feedback.helpfulnessScore = totalVotes > 0
    ? Math.round(((resource.feedback.upvotes || 0) / totalVotes) * 100)
    : 100;

  await resource.save();
  res.json({ success: true, message: 'Feedback submitted successfully', feedback: resource.feedback });
}));

// POST /resources/:id/view - Record resource view telemetry
router.post('/resources/:id/view', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await LegalResource.findByIdAndUpdate(id, {
    $inc: { viewsCount: 1 },
    $set: { lastViewedAt: new Date() }
  });
  res.json({ success: true, message: 'View telemetry recorded' });
}));

// GET /helplinesAll - Fetch all emergency helplines (Public)
router.get('/helplinesAll', asyncHandler(async (req: Request, res: Response) => {
  const helplines = await HelpHelpline.find({}).lean();
  res.json({ success: true, data: helplines });
}));

// GET /resourcesAll - Fetch all legal aid resources/courts (Public)
router.get('/resourcesAll', asyncHandler(async (req: Request, res: Response) => {
  const resources = await LegalResource.find({ status: 'approved' }).lean();
  res.json({ success: true, data: resources });
}));

// POST /helplines/batch - Fetch helplines details for an array of IDs
router.post('/helplines/batch', asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    throw AppError.badRequest('ids must be an array.');
  }
  const helplines = await HelpHelpline.find({ _id: { $in: ids } }).lean();
  res.json({ success: true, data: helplines });
}));

// POST /resources/batch - Fetch resources details for an array of IDs
router.post('/resources/batch', asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    throw AppError.badRequest('ids must be an array.');
  }
  const resources = await LegalResource.find({ _id: { $in: ids } }).lean();
  res.json({ success: true, data: resources });
}));

// ═══════════════════════════════════════════════════════════════
//  BOOKMARK RECONCILIATION — Cross-Database Consistency
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/legal/bookmarks/validate
 * Validates whether bookmarked MongoDB entities still exist.
 * Used by the Saved Workbench to detect dangling references after
 * admin deletions or name changes in MongoDB.
 *
 * Request: { targetType: "LegalResource" | "Helpline", targetIds: ["id1", "id2"] }
 * Response: { "id1": { exists: true, currentName: "..." }, "id2": { exists: false } }
 */
router.post('/bookmarks/validate', asyncHandler(async (req: Request, res: Response) => {
  const { targetType, targetIds } = req.body;

  if (!targetType || !Array.isArray(targetIds) || targetIds.length === 0) {
    throw AppError.badRequest('targetType and targetIds array are required.');
  }

  // Cap to 100 IDs per request to prevent abuse
  const ids = targetIds.slice(0, 100);
  const result: Record<string, { exists: boolean; currentName?: string }> = {};

  if (targetType === 'LegalResource') {
    const resources = await LegalResource.find(
      { _id: { $in: ids } },
      { _id: 1, title: 1, name: 1 }
    ).lean();

    const found = new Map(resources.map((r: any) => [r._id.toString(), r.title || r.name || 'Untitled']));

    for (const id of ids) {
      if (found.has(id)) {
        result[id] = { exists: true, currentName: found.get(id)! };
      } else {
        result[id] = { exists: false };
      }
    }
  } else if (targetType === 'Helpline') {
    const helplines = await HelpHelpline.find(
      { _id: { $in: ids } },
      { _id: 1, name: 1, title: 1 }
    ).lean();

    const found = new Map(helplines.map((h: any) => [h._id.toString(), h.name || h.title || 'Untitled']));

    for (const id of ids) {
      if (found.has(id)) {
        result[id] = { exists: true, currentName: found.get(id)! };
      } else {
        result[id] = { exists: false };
      }
    }
  } else {
    // Unknown targetType — mark all as unknown
    for (const id of ids) {
      result[id] = { exists: true };
    }
  }

  res.json(result);
}));

export default router;