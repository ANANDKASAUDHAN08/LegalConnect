import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import Lawyer from '../../models/Lawyer';
import PracticeAreaModel, { IPracticeArea } from '../../models/PracticeArea';

const router = Router();

// Re-export interface for backwards compatibility
export interface PracticeAreaItem {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  subfields: string[];
  relevantActs: string[];
  typicalForums: string[];
  popular?: boolean;
}

// 1. GET /api/info/practice-areas - Retrieve practice areas strictly from MongoDB with live lawyer counts
router.get('/practice-areas', asyncHandler(async (req: Request, res: Response) => {
  const category = (req.query['category'] as string) || 'All';
  const query = ((req.query['q'] as string) || '').trim();
  const sort = (req.query['sort'] as string) || 'popular';

  // Compute live lawyer counts from MongoDB
  const countMap: Record<string, number> = {};
  try {
    const lawyers = await Lawyer.find({}, 'specializations').lean();
    lawyers.forEach(l => {
      if (Array.isArray(l.specializations)) {
        l.specializations.forEach(s => {
          const clean = s.trim();
          countMap[clean] = (countMap[clean] || 0) + 1;
        });
      }
    });
  } catch (err) {
    // Non-fatal
  }

  // Build MongoDB query
  const dbFilter: any = {};
  if (category && category !== 'All') {
    dbFilter.category = { $regex: new RegExp(`^${category.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') };
  }

  if (query) {
    const qRegex = new RegExp(query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
    dbFilter.$or = [
      { name: qRegex },
      { description: qRegex },
      { category: qRegex },
      { subfields: { $in: [qRegex] } },
      { relevantActs: { $in: [qRegex] } }
    ];
  }

  const areasFromDb = await PracticeAreaModel.find(dbFilter).lean();

  // Enrich with live lawyer counts
  const enriched = areasFromDb.map((item: any) => {
    let count = countMap[item.name] || 0;
    if (count === 0) {
      Object.keys(countMap).forEach(key => {
        if (key.toLowerCase().includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(key.toLowerCase())) {
          count += countMap[key];
        }
      });
    }
    return {
      ...item,
      advocateCount: count
    };
  });

  // Sort
  if (sort === 'alpha-asc') {
    enriched.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'alpha-desc') {
    enriched.sort((a, b) => b.name.localeCompare(a.name));
  } else if (sort === 'advocates') {
    enriched.sort((a, b) => (b.advocateCount || 0) - (a.advocateCount || 0));
  } else {
    // popular default: popular items first, then by advocate count
    enriched.sort((a, b) => {
      if (a.popular && !b.popular) return -1;
      if (!a.popular && b.popular) return 1;
      return (b.advocateCount || 0) - (a.advocateCount || 0);
    });
  }

  // Categories list with counts calculated dynamically from DB
  const allDbAreas = await PracticeAreaModel.find({}, 'category').lean();
  const catMap = new Map<string, number>();
  allDbAreas.forEach((p: any) => {
    const cat = p.category || 'General';
    catMap.set(cat, (catMap.get(cat) || 0) + 1);
  });
  const allCategories = ['All', ...Array.from(catMap.keys()).sort()];
  const categoriesWithCounts = allCategories.map(cat => ({
    name: cat,
    count: cat === 'All' ? allDbAreas.length : (catMap.get(cat) || 0)
  }));

  res.json({
    success: true,
    totalCount: enriched.length,
    isDatabaseSourced: true,
    categories: categoriesWithCounts,
    data: enriched
  });
}));

// 2. GET /api/info/practice-areas/:id - Retrieve detail of single practice area from DB
router.get('/practice-areas/:id', asyncHandler(async (req: Request, res: Response) => {
  const rawId = req.params['id'];
  const id = (Array.isArray(rawId) ? rawId[0] : (rawId as string)) || '';

  const target = await PracticeAreaModel.findOne({
    $or: [{ id }, { name: { $regex: new RegExp(`^${id}$`, 'i') } }]
  }).lean();

  if (!target) {
    res.status(404).json({ success: false, message: `Practice area "${id}" not found.` });
    return;
  }

  // Fetch verified advocates for this area
  let matchedLawyers: any[] = [];
  try {
    matchedLawyers = await Lawyer.find({
      specializations: { $regex: new RegExp(target.name, 'i') }
    })
      .select('name city rating experience consultationFee avatarUrl isVerified specializations')
      .limit(6)
      .lean();
  } catch { }

  res.json({
    success: true,
    data: {
      ...target,
      advocateCount: matchedLawyers.length,
      featuredLawyers: matchedLawyers
    }
  });
}));

export default router;