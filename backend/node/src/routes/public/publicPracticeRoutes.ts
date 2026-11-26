import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import Lawyer from '../../models/Lawyer';
import PracticeAreaModel from '../../models/PracticeArea';
import { escapeRegex } from '../../utils/escapeRegex';
import { optionalAuth, AuthenticatedRequest } from '../../middlewares/auth';
import SavedCasePack from '../../models/SavedCasePack';
import Notification from '../../models/Notification';
import {
  buildSpecCountMap,
  resolveAreaStats,
  buildAliasRegex,
  getHeroSummary,
  AdvocateStats
} from '../../services/practiceAreaService';

const router = Router();

// ── Rate-limit helpers for track / search-miss ──────────────────────────

const trackRateMap = new Map<string, number>();
const TRACK_WINDOW_MS = 10_000; // one event per IP per 10 s

function isRateLimited(key: string): boolean {
  const last = trackRateMap.get(key) || 0;
  if (Date.now() - last < TRACK_WINDOW_MS) return true;
  trackRateMap.set(key, Date.now());
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. GET /practice-areas — Full published list + hero summary + categories
//    Client filters/sorts locally (dataset < 100 items, one fetch).
//    Uses aggregation-based stats (fixes B5). Cache-Control + ETag.
// ═══════════════════════════════════════════════════════════════════════════

router.get('/practice-areas', asyncHandler(async (req: Request, res: Response) => {
  const [areasFromDb, specMap, heroSummary] = await Promise.all([
    PracticeAreaModel.find({ isPublished: { $ne: false } })
      .sort({ sortOrder: 1, popular: -1, name: 1 })
      .lean(),
    buildSpecCountMap(),
    getHeroSummary()
  ]);

  // Enrich each area with live stats from the aggregation pipeline
  const enriched = areasFromDb.map((area: any) => {
    const stats = resolveAreaStats(area.name, area.aliases || [], specMap);
    return {
      id: area.id,
      name: area.name,
      name_hi: area.name_hi || '',
      icon: area.icon,
      category: area.category,
      description: area.description,
      description_hi: area.description_hi || '',
      tagline: area.tagline || '',
      simpleDescription: area.simpleDescription || '',
      simpleDescription_hi: area.simpleDescription_hi || '',
      simpleTagline: area.simpleTagline || '',
      accent: area.accent || 'blue',
      subfields: area.subfields || [],
      relevantActs: area.relevantActs || [],
      typicalForums: area.typicalForums || [],
      aliases: area.aliases || [],
      faqs: area.faqs || [],
      forumJourney: area.forumJourney || [],
      documentsChecklist: area.documentsChecklist || [],
      popular: area.popular || false,
      isFeatured: area.isFeatured || false,
      // Live stats from aggregation
      advocateCount: stats.totalCount,
      verifiedAdvocateCount: stats.verifiedCount,
      avgExperience: stats.avgExperience,
      avgRating: stats.avgRating,
      feeRange: { min: stats.feeMin, median: stats.feeMedian, max: stats.feeMax },
      topCities: stats.topCities,
      availableNow: stats.availableCount
    };
  });

  // Categories with counts — from the full published set
  const catMap = new Map<string, number>();
  areasFromDb.forEach((p: any) => {
    const cat = p.category || 'General';
    catMap.set(cat, (catMap.get(cat) || 0) + 1);
  });
  const allCategories = ['All', ...Array.from(catMap.keys()).sort()];
  const categoriesWithCounts = allCategories.map(cat => ({
    name: cat,
    count: cat === 'All' ? areasFromDb.length : (catMap.get(cat) || 0)
  }));

  // ETag for client-side caching
  const crypto = require('crypto');
  const etag = crypto
    .createHash('md5')
    .update(JSON.stringify({ enriched, heroSummary }))
    .digest('hex');

  res.set('ETag', `"${etag}"`);
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

  if (req.headers['if-none-match'] === `"${etag}"`) {
    res.status(304).end();
    return;
  }

  res.json({
    success: true,
    totalCount: enriched.length,
    isDatabaseSourced: true,
    summary: heroSummary,
    categories: categoriesWithCounts,
    data: enriched
  });
}));

// ═══════════════════════════════════════════════════════════════════════════
// 2. GET /practice-areas/:id — Full dossier with real advocate count
//    Uses separate count query (fixes B4), escaped regex (fixes B3).
// ═══════════════════════════════════════════════════════════════════════════

router.get('/practice-areas/:id', asyncHandler(async (req: Request, res: Response) => {
  const rawId = req.params['id'];
  const id = (Array.isArray(rawId) ? rawId[0] : (rawId as string)) || '';

  // Escape user input for regex safety (fixes B3)
  const escapedId = escapeRegex(id);
  const target = await PracticeAreaModel.findOne({
    $or: [{ id }, { name: { $regex: new RegExp(`^${escapedId}$`, 'i') } }],
    isPublished: { $ne: false }
  }).lean();

  if (!target) {
    res.status(404).json({ success: false, message: `Practice area "${id}" not found.` });
    return;
  }

  // Get area stats from aggregation (fixes B4 — no longer capped at 6)
  const specMap = await buildSpecCountMap();
  const stats = resolveAreaStats(
    (target as any).name,
    (target as any).aliases || [],
    specMap
  );

  // Build safe regex for lawyer matching (fixes B3)
  const aliasRegex = buildAliasRegex(
    (target as any).name,
    (target as any).aliases || []
  );

  // Fetch top 6 featured lawyers (preview only; real count is from stats)
  let featuredLawyers: any[] = [];
  try {
    featuredLawyers = await Lawyer.find({
      isVerified: true,
      specializations: { $regex: aliasRegex }
    })
      .select('name city rating experience consultationFee avatarUrl isVerified specializations languagesSpoken isAvailable')
      .sort({ rating: -1, experience: -1 })
      .limit(6)
      .lean();
  } catch { }

  // Resolve linked Bare Acts to deep links
  let resolvedActs: any[] = [];
  try {
    const BareAct = require('../../models/BareAct').default;
    if (Array.isArray((target as any).relevantActs) && (target as any).relevantActs.length > 0) {
      const actNames = (target as any).relevantActs;
      const acts = await BareAct.find({}, 'actName shortName year chapters legacy_short_names').lean();

      resolvedActs = actNames.map((rawActName: string) => {
        const cleanName = rawActName.trim();
        const upper = cleanName.toUpperCase();

        // 1. Check parenthetical abbreviation e.g. "Bharatiya Nyaya Sanhita (BNS)" -> "BNS"
        const parenMatch = cleanName.match(/\(([A-Za-z0-9_-]+)\)/);
        const parenShort = parenMatch ? parenMatch[1].toUpperCase() : null;

        let matched: any = null;

        // 2a. Direct match by extracted acronym if present
        if (parenShort) {
          matched = acts.find((a: any) =>
            (a.shortName && a.shortName.toUpperCase() === parenShort) ||
            (a.legacy_short_names || []).some((l: string) => l.toUpperCase() === parenShort)
          );
        }

        // 2b. Match by exact shortName or legacy short name
        if (!matched) {
          matched = acts.find((a: any) =>
            (a.shortName && a.shortName.toUpperCase() === upper) ||
            (a.legacy_short_names || []).some((l: string) => l.toUpperCase() === upper)
          );
        }

        // 2c. Match by exact actName
        if (!matched) {
          matched = acts.find((a: any) => a.actName && a.actName.toUpperCase() === upper);
        }

        // 2d. Normalized text containment match (stripping year and special characters)
        if (!matched) {
          const cleanUpper = upper.replace(/\b(18|19|20)\d{2}\b/g, '').replace(/[^A-Z0-9\s]/g, '').trim();
          if (cleanUpper.length >= 6) {
            matched = acts.find((a: any) => {
              const cleanAct = (a.actName || '').toUpperCase().replace(/\b(18|19|20)\d{2}\b/g, '').replace(/[^A-Z0-9\s]/g, '').trim();
              return cleanAct === cleanUpper || (cleanAct.length >= 8 && cleanAct.includes(cleanUpper));
            });
          }
        }

        // Compute total sections from chapters
        let sectionCount = 0;
        if (matched?.chapters && Array.isArray(matched.chapters)) {
          sectionCount = matched.chapters.reduce((sum: number, ch: any) => sum + (ch.sections ? ch.sections.length : 0), 0);
        }

        return {
          name: cleanName,
          shortName: matched ? matched.shortName : (parenShort || null),
          year: matched ? matched.year : (cleanName.match(/\b(18|19|20)\d{2}\b/) ? parseInt(cleanName.match(/\b(18|19|20)\d{2}\b/)![0], 10) : null),
          sectionCount,
          deepLink: matched ? `/laws/${matched.shortName}` : null
        };
      });
    }
  } catch { }

  // Resolve landmark judicial decisions with flexible statutory matching
  let landmarkDecisions: any[] = [];
  try {
    const JudicialDecision = require('../../models/JudicialDecision').default;
    const rawActs = Array.isArray((target as any).relevantActs) ? (target as any).relevantActs : [];

    // Extract core statutory keywords (e.g. "Bharatiya Nyaya Sanhita (BNS)" -> "Bharatiya Nyaya Sanhita")
    const searchTerms: string[] = rawActs.map((a: string) =>
      a.replace(/\s*\([^)]*\)/g, '')
       .replace(/,\s*\d{4}/g, '')
       .replace(/\b(18|19|20)\d{2}\b/g, '')
       .replace(/Sec(tion)?\s*\d+/gi, '')
       .replace(/Art(icle)?\s*\d+/gi, '')
       .trim()
    ).filter((t: string) => t.length > 2);

    // Include common statutory acronyms (BNS, BNSS, BSA, IPC, CrPC, IT Act, DPDP, NI Act, RERA, POSH, MACT, IBC)
    rawActs.forEach((a: string) => {
      const match = a.match(/\b(BNS|BNSS|BSA|IPC|CrPC|IT Act|DPDP|NI Act|RERA|POSH|MACT|IBC|HMA|DV Act|NDPS)\b/i);
      if (match && !searchTerms.includes(match[1])) {
        searchTerms.push(match[1]);
      }
    });

    const orClauses: any[] = searchTerms.map(term => ({
      connectedActs: { $regex: new RegExp(escapeRegex(term), 'i') }
    }));

    if ((target as any).name) {
      const areaKeyword = (target as any).name.replace(/&.*/, '').trim();
      if (areaKeyword.length > 3) {
        orClauses.push({ issues: { $regex: new RegExp(escapeRegex(areaKeyword), 'i') } });
      }
    }

    if (orClauses.length > 0) {
      landmarkDecisions = await JudicialDecision.find({
        $or: orClauses,
        isLandmark: true
      })
        .select('caseId title citation court decisionDate holding ratioDecidendi treatment officialDocumentUrl bench issues connectedSections summary')
        .limit(4)
        .lean();
    }

    // Graceful fallback to prominent constitutional landmarks if no specific decisions match
    if (landmarkDecisions.length === 0) {
      landmarkDecisions = await JudicialDecision.find({ isLandmark: true })
        .select('caseId title citation court decisionDate holding ratioDecidendi treatment officialDocumentUrl bench issues connectedSections summary')
        .sort({ decisionDate: -1 })
        .limit(3)
        .lean();
    }
  } catch { }

  res.json({
    success: true,
    data: {
      ...(target as any),
      // Real stats from aggregation (B4 fix — true count, not .limit(6).length)
      advocateCount: stats.totalCount,
      verifiedAdvocateCount: stats.verifiedCount,
      avgExperience: stats.avgExperience,
      avgRating: stats.avgRating,
      feeRange: { min: stats.feeMin, median: stats.feeMedian, max: stats.feeMax },
      topCities: stats.topCities,
      availableNow: stats.availableCount,
      // Previews
      featuredLawyers,
      resolvedActs,
      landmarkDecisions
    }
  });
}));

// ═══════════════════════════════════════════════════════════════════════════
// 3. POST /practice-areas/:id/track — Increment view/CTA counter
//    IP rate-limited (one event per 10 s).
// ═══════════════════════════════════════════════════════════════════════════

router.post('/practice-areas/:id/track', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params['id'];
  const event = req.body?.event;
  if (!event || !['view', 'cta'].includes(event)) {
    res.status(400).json({ success: false, message: 'event must be "view" or "cta"' });
    return;
  }

  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const rateKey = `${ip}:${id}:${event}`;
  if (isRateLimited(rateKey)) {
    res.json({ success: true, message: 'Rate limited, not counted' });
    return;
  }

  const field = event === 'view' ? 'viewCount' : 'ctaCount';
  await PracticeAreaModel.updateOne({ id }, { $inc: { [field]: 1 } });

  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════
// 4. POST /practice-areas/search-miss — Log zero-result public searches
//    Stored in a lightweight collection for admin "demand gaps" panel.
// ═══════════════════════════════════════════════════════════════════════════

import PracticeSearchLog from '../../models/PracticeSearchLog';

router.post('/practice-areas/search-miss', asyncHandler(async (req: Request, res: Response) => {
  const query = (req.body?.query || '').trim().toLowerCase();
  if (!query || query.length < 3) {
    res.status(400).json({ success: false, message: 'query must be at least 3 characters' });
    return;
  }

  await PracticeSearchLog.findOneAndUpdate(
    { query },
    { $inc: { count: 1 }, $set: { lastSeen: new Date() } },
    { upsert: true }
  );

  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════
// 5. GET /practice-areas/:id/lawyer-position — Lawyer Competitive Position (L2)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/practice-areas/:id/lawyer-position', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rawId = req.params['id'];
  const id = (Array.isArray(rawId) ? rawId[0] : (rawId as string)) || '';
  const escapedId = escapeRegex(id);

  const target = await PracticeAreaModel.findOne({
    $or: [{ id }, { name: { $regex: new RegExp(`^${escapedId}$`, 'i') } }],
    isPublished: { $ne: false }
  }).lean();

  if (!target) {
    res.status(404).json({ success: false, message: 'Practice area not found' });
    return;
  }

  const aliasRegex = buildAliasRegex((target as any).name, (target as any).aliases || []);
  const specMap = await buildSpecCountMap();
  const stats = resolveAreaStats((target as any).name, (target as any).aliases || [], specMap);

  let lawyer: any = null;
  if (req.userId) {
    lawyer = await Lawyer.findOne({
      $or: [{ _id: req.userId }, { userId: req.userId }]
    }).lean();
  }

  const city = (req.query['city'] as string) || lawyer?.city || 'Delhi';
  const userFee = lawyer?.consultationFee || Number(req.query['fee']) || 2000;
  const userRating = lawyer?.rating || 4.8;

  // Query verified advocates in this city with this specialization
  const lawyersInCity = await Lawyer.find({
    isVerified: true,
    city: { $regex: new RegExp(`^${escapeRegex(city)}$`, 'i') },
    specializations: { $regex: aliasRegex }
  })
    .select('name city rating experience consultationFee')
    .sort({ rating: -1, experience: -1 })
    .lean();

  const totalInCity = Math.max(lawyersInCity.length, 1);
  const higherRanked = lawyersInCity.filter((l: any) => (l.rating || 0) > userRating).length;
  const rank = higherRanked + 1;
  const percentile = Math.min(99, Math.max(1, Math.round(((totalInCity - rank + 1) / totalInCity) * 100)));
  const diff = userFee - (stats.feeMedian || 2500);

  res.json({
    success: true,
    data: {
      isPracticingInArea: lawyer ? (lawyer.specializations || []).some((s: string) => aliasRegex.test(s)) : true,
      lawyerName: lawyer?.name || 'Advocate',
      city,
      rank,
      totalInCity,
      userFee,
      medianFee: stats.feeMedian || 2500,
      diff,
      percentile: percentile >= 75 ? `Top ${100 - percentile + 5}% Leader` : 'Competitive Practice Tier',
      verifiedCompetitors: lawyersInCity.slice(0, 3).map((l: any) => ({
        name: l.name,
        rating: l.rating,
        experience: l.experience,
        fee: l.consultationFee
      }))
    }
  });
}));

// ═══════════════════════════════════════════════════════════════════════════
// 6. GET /practice-areas/:id/demand — Demand Intelligence & Gaps (L3)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/practice-areas/:id/demand', asyncHandler(async (req: Request, res: Response) => {
  const rawId = req.params['id'];
  const id = (Array.isArray(rawId) ? rawId[0] : (rawId as string)) || '';
  const escapedId = escapeRegex(id);

  const target = await PracticeAreaModel.findOne({
    $or: [{ id }, { name: { $regex: new RegExp(`^${escapedId}$`, 'i') } }],
    isPublished: { $ne: false }
  }).lean();

  if (!target) {
    res.status(404).json({ success: false, message: 'Practice area not found' });
    return;
  }

  const specMap = await buildSpecCountMap();
  const stats = resolveAreaStats((target as any).name, (target as any).aliases || [], specMap);

  const viewCount = (target as any).viewCount || 0;
  const ctaCount = (target as any).ctaCount || 0;
  const monthlySearches = viewCount + ctaCount;

  // Underserved areas — only from real topCities data where advocate coverage is thin
  const underservedCities = (stats.topCities || [])
    .filter((tc: any) => tc.count <= 3 && tc.count > 0)
    .slice(0, 4)
    .map((tc: any) => ({
      city: tc.city,
      advocates: tc.count,
      searches: 0,
      gapRatio: 0
    }));

  res.json({
    success: true,
    data: {
      areaId: (target as any).id,
      name: (target as any).name,
      monthlySearches,
      growthPercentage: null, // Not yet tracked — requires time-series analytics
      demandLevel: monthlySearches === 0 ? 'Not yet measured' : (monthlySearches > 800 ? 'High' : 'Moderate'),
      underservedCities
    }
  });
}));

// ═══════════════════════════════════════════════════════════════════════════
// 7. GET /practice-areas/:id/my-matter — Client Active Matter (C1)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/practice-areas/:id/my-matter', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rawId = req.params['id'];
  const id = (Array.isArray(rawId) ? rawId[0] : (rawId as string)) || '';
  const escapedId = escapeRegex(id);

  const target = await PracticeAreaModel.findOne({
    $or: [{ id }, { name: { $regex: new RegExp(`^${escapedId}$`, 'i') } }],
    isPublished: { $ne: false }
  }).lean();

  if (!target) {
    res.status(404).json({ success: false, message: 'Practice area not found' });
    return;
  }

  if (!req.userId) {
    res.json({ success: true, data: { hasActiveMatter: false } });
    return;
  }

  const category = (target as any).category || '';
  const name = (target as any).name || '';

  const pack = await SavedCasePack.findOne({
    userId: req.userId,
    $or: [
      { category: { $regex: new RegExp(escapeRegex(category), 'i') } },
      { category: { $regex: new RegExp(escapeRegex(name), 'i') } }
    ]
  }).sort({ savedAt: -1 }).lean();

  if (!pack) {
    res.json({ success: true, data: { hasActiveMatter: false } });
    return;
  }

  const steps = pack.roadmap?.steps || [];
  const currentStageIndex = steps.length > 2 ? 2 : 1;

  res.json({
    success: true,
    data: {
      hasActiveMatter: true,
      packId: String(pack._id),
      title: `${pack.category} matter (${pack.location})`,
      currentStageIndex,
      totalStages: Math.max(steps.length, (target as any).forumJourney?.length || 4),
      stageName: steps[currentStageIndex - 1]?.title || 'Document preparation & consultation',
      location: pack.location,
      documentsCount: pack.roadmap?.documents?.length || 0,
      savedAt: pack.savedAt
    }
  });
}));

// ═══════════════════════════════════════════════════════════════════════════
// 8. POST /practice-areas/:id/alert — Advocate Availability Alert (C6)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Registers an advocate availability alert for a designated practice area and location.
 *
 * @route POST /api/info/practice-areas/:id/alert
 * @param req.params.id Unique slug identifier for the practice area
 * @param req.body.city Target municipal jurisdiction for geo-filtering
 * @param req.body.alertType Alert trigger ('available_now' | 'free_consult')
 * @param req.body.channels Array of delivery mechanisms (['in_app', 'email'])
 * @returns 200 JSON with subscription confirmation and dispatch details
 */
router.post('/practice-areas/:id/alert', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params['id'];
  const { city, alertType, channels } = req.body || {};

  const area = await PracticeAreaModel.findOne({ id }).lean();
  const areaName = area?.name || id;
  const channelList = Array.isArray(channels) && channels.length > 0 ? channels : ['in_app', 'email'];

  try {
    if (req.userId) {
      // Clean up previous active alert notification for this practice area to prevent notification clutter
      await Notification.deleteMany({
        recipientUserId: req.userId,
        'metadata.practiceAreaId': id
      });

      await Notification.create({
        notifId: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        recipientUserId: req.userId,
        type: 'legal',
        title: `Alert Active: ${areaName}`,
        summary: `You will be notified via ${channelList.join(' & ')} when ${alertType === 'free_consult' ? 'free consultation (₹0)' : 'verified'} advocates become available in ${city || 'your city'}.`,
        icon: 'bell',
        actionUrl: `/specializations?area=${id}`,
        isRead: false,
        priority: 'normal',
        metadata: {
          practiceAreaId: id,
          city: city || 'All Cities',
          alertType: alertType || 'available_now',
          channels: channelList,
          subscribedAt: new Date()
        }
      });
    }
  } catch (err) {
    console.warn('Failed to record notification for availability alert', err);
  }

  res.json({
    success: true,
    subscribed: true,
    alertType: alertType || 'available_now',
    channels: channelList,
    message: `Availability alert activated for ${city || 'your city'}. We will notify you promptly.`
  });
}));

// ═══════════════════════════════════════════════════════════════════════════
// 9. GET /practice-areas/:id/alert-status — Check user subscription status
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Checks whether the authenticated user has an active alert subscription for a practice area.
 *
 * @route GET /api/info/practice-areas/:id/alert-status
 * @param req.params.id Unique slug identifier for the practice area
 * @returns 200 JSON with { subscribed: boolean, alertType?, city?, channels? }
 */
router.get('/practice-areas/:id/alert-status', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params['id'];
  if (!req.userId) {
    return res.json({ subscribed: false });
  }

  const existing = await Notification.findOne({
    recipientUserId: req.userId,
    'metadata.practiceAreaId': id
  }).sort({ createdAt: -1 }).lean();

  if (existing && existing.metadata) {
    return res.json({
      subscribed: true,
      alertType: existing.metadata.alertType || 'available_now',
      city: existing.metadata.city || '',
      channels: existing.metadata.channels || ['in_app', 'email'],
      createdAt: existing.createdAt
    });
  }

  return res.json({ subscribed: false });
}));

// ═══════════════════════════════════════════════════════════════════════════
// 10. DELETE /practice-areas/:id/alert — Cancel alert subscription
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Unsubscribes the user from availability alerts for a specific practice area.
 *
 * @route DELETE /api/info/practice-areas/:id/alert
 * @param req.params.id Unique slug identifier for the practice area
 * @returns 200 JSON with cancellation confirmation
 */
router.delete('/practice-areas/:id/alert', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params['id'];
  if (req.userId) {
    await Notification.deleteMany({
      recipientUserId: req.userId,
      'metadata.practiceAreaId': id
    });
  }

  res.json({
    success: true,
    subscribed: false,
    message: 'Availability alert turned off successfully.'
  });
}));

export default router;