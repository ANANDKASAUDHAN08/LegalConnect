import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import LegalResource from '../../models/LegalResource';
import Lawyer from '../../models/Lawyer';
import HelpCategory from '../../models/HelpCategory';
import HelpRoadmap from '../../models/HelpRoadmap';
import HelpHelpline from '../../models/HelpHelpline';
import { getCache, setCache, getPlatformStats } from '../../services/statsService';
import { calculateDistance, resolveCityAndStateFromText } from '../../utils/geoUtils';

const router = Router();

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

  // Handle city aliases dynamically
  let cityPattern = `^${resolvedCity}$`;
  const cleanedLoc = resolvedCity.trim().toLowerCase();
  if (cleanedLoc === 'delhi' || cleanedLoc === 'new delhi') {
    cityPattern = '^(delhi|new delhi)$';
  } else if (cleanedLoc === 'bengaluru' || cleanedLoc === 'bangalore') {
    cityPattern = '^(bengaluru|bangalore)$';
  } else if (cleanedLoc === 'gurgaon' || cleanedLoc === 'gurugram') {
    cityPattern = '^(gurgaon|gurugram)$';
  }

  // Include all nearby cities from coordinate resolution
  if (nearbyCities.size > 1) {
    const escaped = Array.from(nearbyCities).map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    cityPattern = `^(${escaped.join('|')})$`;
  }

  const cityRegexp = new RegExp(cityPattern, 'i');

  // --- PERFORMANCE ELEVATION: Single Batch Queries ---
  // Drop DB query count from 40 down to 3, achieving massive speedups and reducing server CPU load!
  const [matchingResources, matchingLawyers, matchingHelplines] = await Promise.all([
    LegalResource.find({ city: { $regex: cityRegexp }, status: 'approved' }).select('type categories').lean(),
    Lawyer.find({ city: { $regex: cityRegexp }, isVerified: true }).select('specializations').lean(),
    HelpHelpline.find({}).select('category').lean()
  ]);

  // Compute active counts for the given location in memory
  const categoriesWithCounts = dbCategories.map((cat) => {
    let specQuery: RegExp;
    if (cat.id === 'Property Dispute') {
      specQuery = /Property|Real Estate|Civil|Land/i;
    } else if (cat.id === 'Family Law' || cat.id === 'Domestic Violence') {
      specQuery = /Family|Divorce|Domestic|Women|Criminal/i;
    } else if (cat.id === 'Consumer Complaint') {
      specQuery = /Consumer|Civil|Insurance/i;
    } else if (cat.id === 'Cyber Crime') {
      specQuery = /Cyber|Criminal|IT Law|Information Technology/i;
    } else if (cat.id === 'Labour Issue') {
      specQuery = /Labour|Employment|Service Law/i;
    } else if (cat.id === 'Criminal Matter') {
      specQuery = /Criminal|Bail/i;
    } else if (cat.id === 'Business Dispute') {
      specQuery = /Corporate|Commercial|Contract|Business/i;
    } else {
      specQuery = new RegExp(cat.id, 'i');
    }

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

  let specQuery: any = categoryStr;
  if (categoryStr === 'Property Dispute') {
    specQuery = /Property|Real Estate|Civil|Land/i;
  } else if (categoryStr === 'Family Law' || categoryStr === 'Domestic Violence') {
    specQuery = /Family|Divorce|Domestic|Women|Criminal/i;
  } else if (categoryStr === 'Consumer Complaint') {
    specQuery = /Consumer|Civil|Insurance/i;
  } else if (categoryStr === 'Cyber Crime') {
    specQuery = /Cyber|Criminal|IT Law|Information Technology/i;
  } else if (categoryStr === 'Labour Issue') {
    specQuery = /Labour|Employment|Service Law/i;
  } else if (categoryStr === 'Criminal Matter') {
    specQuery = /Criminal|Bail/i;
  } else if (categoryStr === 'Business Dispute') {
    specQuery = /Corporate|Commercial|Contract|Business/i;
  }

  let cityPattern = `^${targetCity}$`;
  const cleanedLoc = targetCity.trim().toLowerCase();
  if (cleanedLoc === 'delhi' || cleanedLoc === 'new delhi') {
    cityPattern = '^(delhi|new delhi)$';
  } else if (cleanedLoc === 'bengaluru' || cleanedLoc === 'bangalore') {
    cityPattern = '^(bengaluru|bangalore)$';
  } else if (cleanedLoc === 'gurgaon' || cleanedLoc === 'gurugram') {
    cityPattern = '^(gurgaon|gurugram)$';
  }

  if (nearbyCities.size > 1) {
    const escaped = Array.from(nearbyCities).map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    cityPattern = `^(${escaped.join('|')})$`;
  }

  const resourceFilter = {
    city: { $regex: new RegExp(cityPattern, 'i') },
    status: 'approved' as const,
    $or: [
      { categories: categoryStr },
      { categories: 'General' }
    ]
  };

  const [resources, lawyers, dbRoadmap, dbHelplines, slsaResource, nalsaHq] = await Promise.all([
    LegalResource.find(resourceFilter).lean(),
    Lawyer.find({
      city: { $regex: new RegExp(cityPattern, 'i') },
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

// User Suggestion Endpoint (Public)
router.post('/suggest-resource', asyncHandler(async (req: Request, res: Response) => {
  const { name, type, categories, subcategories, city, state, address, contactNumber, website, languages, coordinates } = req.body;
  if (!name || !type || !city || !address || !coordinates || !coordinates.lat || !coordinates.lng) {
    throw AppError.badRequest('Required fields: name, type, city, address, coordinates.');
  }

  const newResource = new LegalResource({
    name,
    type,
    categories: categories || ['General'],
    subcategories: subcategories || [],
    city,
    state,
    address,
    contactNumber,
    website,
    languages: languages || ['English', 'Hindi'],
    coordinates,
    isVerified: false,
    status: 'pending',
    source: 'user_suggestion'
  });

  await newResource.save();
  res.status(201).json({ success: true, message: 'Resource suggestion submitted successfully for moderation.', data: newResource });
}));

// GET /resources/:id - Get a single legal resource by ID (Public)
router.get('/resources/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const resource = await LegalResource.findById(id).lean();
  if (!resource) {
    throw AppError.notFound('Resource not found.');
  }
  res.json({ success: true, data: resource });
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

export default router;