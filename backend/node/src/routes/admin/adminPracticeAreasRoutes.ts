import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import PracticeAreaModel from '../../models/PracticeArea';
import ContentEditLogModel from '../../models/ContentEditLog';
import Lawyer from '../../models/Lawyer';
import PracticeSearchLog from '../../models/PracticeSearchLog';
import { escapeRegex } from '../../utils/escapeRegex';
import { invalidatePracticeAreaCache, buildSpecCountMap } from '../../services/practiceAreaService';

const router = Router();

// ─── 1. GET /api/admin/practice-areas — List all practice areas (including unpublished) ───
router.get(
  '/practice-areas',
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string) || 50));
    const search = ((req.query['search'] as string) || '').trim();
    const category = (req.query['category'] as string) || '';

    const filter: any = {};
    if (category && category !== 'All') {
      filter.category = category;
    }
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { name: regex },
        { description: regex },
        { category: regex },
        { id: regex },
        { subfields: { $in: [regex] } },
        { relevantActs: { $in: [regex] } },
        { aliases: { $in: [regex] } }
      ];
    }

    const total = await PracticeAreaModel.countDocuments(filter);
    const areas = await PracticeAreaModel.find(filter)
      .sort({ sortOrder: 1, popular: -1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Live advocate counts from aggregation pipeline (fixes B5)
    let specMap: any = {};
    try {
      specMap = await buildSpecCountMap();
    } catch { }

    const enriched = areas.map((a: any) => {
      const keys = new Set<string>();
      keys.add(a.name.toLowerCase().trim());
      if (Array.isArray(a.aliases)) {
        a.aliases.forEach((al: string) => keys.add(al.toLowerCase().trim()));
      }
      let cnt = 0;
      for (const k of keys) {
        if (specMap[k]) cnt += specMap[k].totalCount || 0;
      }
      return { ...a, advocateCount: cnt };
    });

    // Distinct categories
    const allCats = await PracticeAreaModel.distinct('category');

    res.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      categories: ['All', ...allCats.sort()],
      data: enriched
    });
  })
);

// ─── 2. GET /api/admin/practice-areas/analytics — Summary stats ───
router.get(
  '/practice-areas/analytics',
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, published, popular, featured] = await Promise.all([
      PracticeAreaModel.countDocuments(),
      PracticeAreaModel.countDocuments({ isPublished: true }),
      PracticeAreaModel.countDocuments({ popular: true }),
      PracticeAreaModel.countDocuments({ isFeatured: true })
    ]);

    const areas = await PracticeAreaModel.find({}, 'category popular isPublished isFeatured').lean();
    const catCounts: Record<string, number> = {};
    for (const a of areas) {
      catCounts[a.category] = (catCounts[a.category] || 0) + 1;
    }

    // Unmatched lawyer specializations → areas without aliases
    const lawyers = await Lawyer.find({ isVerified: true }, 'specializations').lean();
    const lawyerSpecs = new Set<string>();
    lawyers.forEach((l: any) => {
      if (Array.isArray(l.specializations)) {
        l.specializations.forEach((s: string) => lawyerSpecs.add(s.trim().toLowerCase()));
      }
    });

    const allAliases = new Set<string>();
    const allAreas = await PracticeAreaModel.find({}, 'name aliases').lean();
    allAreas.forEach((a: any) => {
      allAliases.add(a.name.toLowerCase().trim());
      if (Array.isArray(a.aliases)) {
        a.aliases.forEach((al: string) => allAliases.add(al.toLowerCase().trim()));
      }
    });

    const unmatchedSpecs: string[] = [];
    for (const spec of lawyerSpecs) {
      if (!allAliases.has(spec)) {
        unmatchedSpecs.push(spec);
      }
    }

    res.json({
      success: true,
      data: {
        summary: {
          total,
          published,
          drafts: total - published,
          popular,
          featured
        },
        categoryCounts: catCounts,
        lawyerSpecializationCount: lawyerSpecs.size,
        unmatchedSpecializations: unmatchedSpecs
      }
    });
  })
);

// ─── 3. GET /api/admin/practice-areas/demand-gaps — Zero-result search tracking ───
router.get(
  '/practice-areas/demand-gaps',
  asyncHandler(async (_req: Request, res: Response) => {
    const gaps = await PracticeSearchLog.find().sort({ count: -1, lastSeen: -1 }).limit(30).lean();
    res.json({
      success: true,
      total: gaps.length,
      data: gaps
    });
  })
);

// ─── 4. GET /api/admin/practice-areas/export — JSON export of all practice areas ───
router.get(
  '/practice-areas/export',
  asyncHandler(async (_req: Request, res: Response) => {
    const areas = await PracticeAreaModel.find().sort({ sortOrder: 1, name: 1 }).lean();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="practice-areas-catalog.json"');
    res.json(areas);
  })
);

// ─── 5. POST /api/admin/practice-areas/import — Bulk JSON import ───
router.post(
  '/practice-areas/import',
  asyncHandler(async (req: Request, res: Response) => {
    const items = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'Expected a non-empty array of practice areas' });
      return;
    }

    let upserted = 0;
    for (const item of items) {
      if (item.name && item.category) {
        const id =
          item.id ||
          item.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');
        await PracticeAreaModel.findOneAndUpdate(
          { id },
          { $set: { ...item, id, version: (item.version || 1) + 1 } },
          { upsert: true }
        );
        upserted++;
      }
    }

    invalidatePracticeAreaCache();
    res.json({
      success: true,
      message: `Successfully imported / updated ${upserted} practice areas.`
    });
  })
);

// ─── 6. PATCH /api/admin/practice-areas/reorder — Bulk update sort order ───
router.patch(
  '/practice-areas/reorder',
  asyncHandler(async (req: Request, res: Response) => {
    const items: { id: string; sortOrder: number }[] = req.body?.items || [];
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'items array is required' });
      return;
    }

    const ops = items.map(item => ({
      updateOne: {
        filter: { id: item.id },
        update: { $set: { sortOrder: item.sortOrder } }
      }
    }));

    await PracticeAreaModel.bulkWrite(ops);
    invalidatePracticeAreaCache();

    res.json({
      success: true,
      message: `Reordered ${items.length} practice areas.`
    });
  })
);

// ─── 7. PATCH /api/admin/practice-areas/backfill-aliases — One-time alias backfill ───
router.patch(
  '/practice-areas/backfill-aliases',
  asyncHandler(async (_req: Request, res: Response) => {
    const defaultAliases: Record<string, string[]> = {
      'criminal-law': ['Criminal Law', 'Criminal Defense', 'Criminal Litigation'],
      'bail-matters': ['Bail Matters', 'Bail', 'Anticipatory Bail', 'Default Bail'],
      'ndps-cases': ['NDPS Cases', 'NDPS', 'Narcotics', 'Drug Cases'],
      'cyber-crime': ['Cyber Crime', 'Cybercrime', 'IT Law', 'Data Privacy', 'Online Fraud'],
      'property-disputes': ['Property Disputes', 'Property Law', 'Land Disputes', 'Real Estate Law'],
      'rera-compliance': ['RERA', 'Builder Disputes', 'Real Estate'],
      'civil-litigation': ['Civil Law', 'Civil Litigation', 'Contract Law', 'Contracts'],
      'arbitration-adr': ['Arbitration', 'Mediation', 'ADR', 'Alternative Dispute Resolution'],
      'corporate-law': ['Corporate Law', 'Company Law', 'Corporate Governance'],
      'mergers-acquisitions': ['Mergers & Acquisitions', 'M&A', 'Mergers and Acquisitions'],
      'family-law': ['Family Law', 'Domestic Relations'],
      'family-matrimonial': ['Divorce', 'Matrimonial', 'Family Law', 'Domestic Violence'],
      'child-custody': ['Child Custody', 'Guardianship'],
      'consumer-protection': ['Consumer Law', 'Consumer Disputes', 'Consumer Protection'],
      'right-to-information': ['RTI', 'Right to Information'],
      'labour-law': ['Labour Law', 'Labor Law', 'Industrial Law'],
      'labour-employment': ['Employment Disputes', 'Employment Law', 'POSH', 'Wrongful Termination'],
      'employment-disputes': ['Employment Disputes', 'Employment Contracts'],
      'intellectual-property': ['Intellectual Property', 'IPR', 'Trademark', 'Copyright', 'Patent'],
      'data-privacy': ['Data Privacy', 'DPDP', 'Privacy Law'],
      'tax-law': ['Tax Law', 'Income Tax', 'Direct Tax', 'Income Tax Disputes'],
      'gst-indirect-tax': ['GST', 'Indirect Tax', 'Customs', 'Excise'],
      'immigration-law': ['Immigration Law', 'Citizenship', 'Visa Matters', 'Immigration'],
      'insolvency-bankruptcy': ['Insolvency', 'Bankruptcy', 'IBC', 'SARFAESI'],
      'public-interest-litigation': ['PIL', 'Public Interest Litigation', 'Constitutional Law', 'Writ Petition'],
      'cheque-bounce-ni-act': ['Cheque Bounce', 'NI Act', 'Section 138', 'Negotiable Instruments'],
      'motor-accident-claims': ['Motor Accident', 'MACT', 'Road Accident', 'Vehicle Insurance']
    };

    let updated = 0;
    for (const [areaId, aliases] of Object.entries(defaultAliases)) {
      const result = await PracticeAreaModel.updateOne(
        { id: areaId, $or: [{ aliases: { $exists: false } }, { aliases: { $size: 0 } }] },
        { $set: { aliases } }
      );
      if (result.modifiedCount > 0) updated++;
    }

    if (updated > 0) invalidatePracticeAreaCache();

    res.json({
      success: true,
      message: `Backfilled aliases for ${updated} practice areas.`,
      updatedCount: updated
    });
  })
);

// ─── 8. POST /api/admin/practice-areas — Create new practice area ───
router.post(
  '/practice-areas',
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body;

    if (!body.name || !body.category || !body.description) {
      res.status(400).json({
        success: false,
        message: 'name, category, and description are required.'
      });
      return;
    }

    const id =
      body.id ||
      body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

    const existing = await PracticeAreaModel.findOne({ id });
    if (existing) {
      res.status(409).json({
        success: false,
        message: `Practice area "${id}" already exists.`
      });
      return;
    }

    const created = await PracticeAreaModel.create({
      ...body,
      id,
      icon: body.icon || 'scale',
      accent: body.accent || 'blue',
      aliases: body.aliases || [],
      subfields: body.subfields || [],
      relevantActs: body.relevantActs || [],
      typicalForums: body.typicalForums || [],
      faqs: body.faqs || [],
      forumJourney: body.forumJourney || [],
      documentsChecklist: body.documentsChecklist || [],
      popular: body.popular || false,
      isFeatured: body.isFeatured || false,
      isPublished: body.isPublished !== false,
      sortOrder: body.sortOrder || 0,
      version: 1,
      provenance: body.provenance || {
        sourceAuthority: 'LegalConnect Admin',
        sourceUrl: '',
        jurisdiction: 'Union of India',
        documentType: 'Practice Area Taxonomy',
        retrievedAt: new Date(),
        lastVerifiedAt: new Date(),
        contentVersion: 1,
        sourceHash: '',
        extractionMethod: 'manual_review',
        reviewStatus: 'verified',
        reviewedBy: 'LegalConnect Admin',
        license: 'Government Open Data License (GODL-India)'
      }
    });

    invalidatePracticeAreaCache();

    res.status(201).json({
      success: true,
      message: 'Practice area created successfully.',
      data: created
    });
  })
);

// ─── 9. GET /api/admin/practice-areas/:id — Single practice area for editing ───
router.get(
  '/practice-areas/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const rawId = req.params['id'];
    const id = (Array.isArray(rawId) ? rawId[0] : (rawId as string)) || '';
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    const area = await PracticeAreaModel.findOne({
      $or: [{ id }, { ...(isObjectId ? { _id: id } : {}) }]
    }).lean();

    if (!area) {
      res.status(404).json({ success: false, message: 'Practice area not found.' });
      return;
    }

    res.json({ success: true, data: area });
  })
);

// ─── 10. PUT /api/admin/practice-areas/:id — Update with audit trail ───
router.put(
  '/practice-areas/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const rawId = req.params['id'];
    const id = (Array.isArray(rawId) ? rawId[0] : (rawId as string)) || '';
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const updatePayload = req.body;

    const existing = await PracticeAreaModel.findOne({
      $or: [{ id }, { ...(isObjectId ? { _id: id } : {}) }]
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Practice area not found.' });
      return;
    }

    // Audit trail
    const adminUser = (req as any).userId || (req as any).user?.email || 'admin';
    const fieldsToTrack = [
      'name', 'name_hi', 'description', 'description_hi', 'tagline', 'accent',
      'simpleDescription', 'simpleDescription_hi', 'simpleTagline',
      'category', 'icon', 'subfields', 'relevantActs', 'typicalForums', 'aliases',
      'faqs', 'forumJourney', 'documentsChecklist', 'popular', 'isFeatured',
      'isPublished', 'sortOrder'
    ];
    const logs: any[] = [];
    const newVersion = ((existing as any).version || 1) + 1;

    for (const field of fieldsToTrack) {
      if (
        updatePayload[field] !== undefined &&
        JSON.stringify(updatePayload[field]) !== JSON.stringify((existing as any)[field])
      ) {
        logs.push({
          entityType: 'PracticeArea',
          entityId: existing.id || id,
          editedBy: adminUser,
          editedAt: new Date(),
          fieldChanged: field,
          previousValue: (existing as any)[field],
          newValue: updatePayload[field],
          version: newVersion,
          changeNote: updatePayload.changeNote || 'Admin editorial update'
        });
      }
    }

    if (logs.length > 0) {
      await ContentEditLogModel.insertMany(logs).catch(() => { });
    }

    updatePayload.version = newVersion;
    const updated = await PracticeAreaModel.findOneAndUpdate(
      { _id: existing._id },
      { $set: updatePayload },
      { new: true, runValidators: true }
    );

    invalidatePracticeAreaCache();

    res.json({
      success: true,
      message: 'Practice area updated successfully.',
      data: updated
    });
  })
);

// ─── 11. DELETE /api/admin/practice-areas/:id ───
router.delete(
  '/practice-areas/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const rawId = req.params['id'];
    const id = (Array.isArray(rawId) ? rawId[0] : (rawId as string)) || '';
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    const deleted = await PracticeAreaModel.findOneAndDelete({
      $or: [{ id }, { ...(isObjectId ? { _id: id } : {}) }]
    });

    if (!deleted) {
      res.status(404).json({ success: false, message: 'Practice area not found.' });
      return;
    }

    invalidatePracticeAreaCache();

    res.json({
      success: true,
      message: 'Practice area deleted successfully.'
    });
  })
);

// ─── 12. PATCH /api/admin/practice-areas/:id/toggle-popular ───
router.patch(
  '/practice-areas/:id/toggle-popular',
  asyncHandler(async (req: Request, res: Response) => {
    const rawId = req.params['id'];
    const id = (Array.isArray(rawId) ? rawId[0] : (rawId as string)) || '';
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    const area = await PracticeAreaModel.findOne({
      $or: [{ id }, { ...(isObjectId ? { _id: id } : {}) }]
    });

    if (!area) {
      res.status(404).json({ success: false, message: 'Practice area not found.' });
      return;
    }

    area.popular = !area.popular;
    await area.save();

    invalidatePracticeAreaCache();

    res.json({
      success: true,
      message: `Practice area "${area.name}" is now ${area.popular ? 'popular' : 'not popular'}.`,
      data: { popular: area.popular }
    });
  })
);

// ─── 13. PATCH /api/admin/practice-areas/:id/toggle-publish ───
router.patch(
  '/practice-areas/:id/toggle-publish',
  asyncHandler(async (req: Request, res: Response) => {
    const rawId = req.params['id'];
    const id = (Array.isArray(rawId) ? rawId[0] : (rawId as string)) || '';
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    const area = await PracticeAreaModel.findOne({
      $or: [{ id }, { ...(isObjectId ? { _id: id } : {}) }]
    });

    if (!area) {
      res.status(404).json({ success: false, message: 'Practice area not found.' });
      return;
    }

    area.isPublished = !area.isPublished;
    await area.save();

    invalidatePracticeAreaCache();

    res.json({
      success: true,
      message: `Practice area "${area.name}" is now ${area.isPublished ? 'published' : 'unpublished'}.`,
      data: { isPublished: area.isPublished }
    });
  })
);

// ─── 14. PATCH /api/admin/practice-areas/:id/aliases — One-click alias add ───
router.patch(
  '/practice-areas/:id/aliases',
  asyncHandler(async (req: Request, res: Response) => {
    const rawId = req.params['id'];
    const id = (Array.isArray(rawId) ? rawId[0] : (rawId as string)) || '';
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const { alias } = req.body;

    if (!alias || typeof alias !== 'string') {
      res.status(400).json({ success: false, message: 'alias string is required.' });
      return;
    }

    const cleanAlias = alias.trim();
    const updated = await PracticeAreaModel.findOneAndUpdate(
      { $or: [{ id }, { ...(isObjectId ? { _id: id } : {}) }] },
      { $addToSet: { aliases: cleanAlias } },
      { new: true }
    );

    if (!updated) {
      res.status(404).json({ success: false, message: 'Practice area not found.' });
      return;
    }

    invalidatePracticeAreaCache();

    res.json({
      success: true,
      message: `Added alias "${cleanAlias}" to ${updated.name}.`,
      data: updated
    });
  })
);

// ─── 15. GET /api/admin/practice-areas/:id/history — Audit trail ───
router.get(
  '/practice-areas/:id/history',
  asyncHandler(async (req: Request, res: Response) => {
    const rawId = req.params['id'];
    const id = (Array.isArray(rawId) ? rawId[0] : (rawId as string)) || '';

    const logs = await ContentEditLogModel.find({
      entityType: 'PracticeArea',
      entityId: id
    }).sort({ editedAt: -1 }).lean();

    res.json({
      success: true,
      total: logs.length,
      data: logs
    });
  })
);

export default router;
