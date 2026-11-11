import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import JudicialDecisionModel from '../../models/JudicialDecision';
import IngestionLogModel from '../../models/IngestionLog';

const router = Router();

// 1. GET /judicial/decisions - List landmark judgments with faceted filtering and search
router.get('/judicial/decisions', asyncHandler(async (req: Request, res: Response) => {
  const query = ((req.query['q'] as string) || '').trim();
  const court = ((req.query['court'] as string) || '').trim();
  const act = ((req.query['act'] as string) || '').trim();
  const section = ((req.query['section'] as string) || '').trim();
  const treatment = ((req.query['treatment'] as string) || '').trim();
  const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query['limit'] as string) || 20));

  const filter: any = {};

  if (court && court !== 'All') {
    filter.court = { $regex: new RegExp(`^${court.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') };
  }

  if (treatment && treatment !== 'All') {
    filter.treatment = treatment;
  }

  if (act) {
    const actRegex = new RegExp(act.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
    filter.connectedActs = { $in: [actRegex] };
  }

  if (section) {
    const secRegex = new RegExp(section.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
    filter.connectedSections = { $in: [secRegex] };
  }

  if (query) {
    const qRegex = new RegExp(query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
    filter.$or = [
      { title: qRegex },
      { citation: qRegex },
      { holding: qRegex },
      { ratioDecidendi: qRegex },
      { summary: qRegex },
      { connectedActs: { $in: [qRegex] } },
      { connectedSections: { $in: [qRegex] } }
    ];
  }

  const [total, decisions] = await Promise.all([
    JudicialDecisionModel.countDocuments(filter),
    JudicialDecisionModel.find(filter)
      .sort({ decisionDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
  ]);

  res.json({
    success: true,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    data: decisions
  });
}));

// 2. GET /judicial/decisions/:id - Retrieve detail of single judicial decision
router.get('/judicial/decisions/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params['id'] as string;

  const decision = await JudicialDecisionModel.findOne({
    $or: [{ caseId: id }, { citation: id }]
  }).lean();

  if (!decision) {
    res.status(404).json({ success: false, message: `Judicial decision "${id}" not found.` });
    return;
  }

  res.json({
    success: true,
    data: decision
  });
}));

// 3. GET /judicial/by-section/:act/:section - Landmark precedents citing a specific section
router.get('/judicial/by-section/:act/:section', asyncHandler(async (req: Request, res: Response) => {
  const act = req.params['act'] as string;
  const section = req.params['section'] as string;

  const actRegex = new RegExp(act.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
  const secRegex = new RegExp(`(section|sec|art|article)?\\s*${section.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');

  const precedents = await JudicialDecisionModel.find({
    $and: [
      { connectedActs: { $in: [actRegex] } },
      { connectedSections: { $in: [secRegex] } }
    ]
  }).sort({ decisionDate: -1 }).lean();

  res.json({
    success: true,
    count: precedents.length,
    act,
    section,
    data: precedents
  });
}));

// 4. GET /provenance/source-catalog - Authoritative source inventory, licensing & ingestion health
router.get('/provenance/source-catalog', asyncHandler(async (_req: Request, res: Response) => {
  const logs = await IngestionLogModel.find({}).sort({ retrievedAt: -1 }).limit(20).lean();

  const sourceCatalog = [
    {
      sourceAuthority: 'Legislative Department, Ministry of Law and Justice, Government of India',
      portalUrl: 'https://legislative.gov.in',
      repository: 'Official Central Acts & Constitutional Enactments',
      jurisdiction: 'Union of India',
      license: 'Government Open Data License (GODL-India)',
      redistributionPermitted: true,
      lastVerified: '2026-10-18',
      coverage: 'Central Bare Acts, Rules, Amendments, and Diglot Official Translations'
    },
    {
      sourceAuthority: 'India Code Digital Repository (NIC)',
      portalUrl: 'https://www.indiacode.nic.in',
      repository: 'Consolidated Central and State Acts Repository',
      jurisdiction: 'Union of India & 28 States / 8 UTs',
      license: 'Government Open Data License (GODL-India)',
      redistributionPermitted: true,
      lastVerified: '2026-10-18',
      coverage: '137,000+ codified sections with historical repeal notices and PDF bitstreams'
    },
    {
      sourceAuthority: 'Supreme Court of India & High Courts eCourts Portal',
      portalUrl: 'https://judgments.ecourts.gov.in/pdfsearch/',
      repository: 'Official National Judicial PDF Search System',
      jurisdiction: 'Supreme Court & 25 High Courts',
      license: 'Public Domain / Open Judicial Record',
      redistributionPermitted: true,
      lastVerified: '2026-10-18',
      coverage: 'Landmark Constitution Bench precedents and fundamental rights jurisprudence'
    },
    {
      sourceAuthority: 'Department of Consumer Affairs / Ministry of Electronics & IT (MeitY)',
      portalUrl: 'https://meity.gov.in',
      repository: 'DPDP Act 2023 Gazette & Consumer Protection Notifications',
      jurisdiction: 'Union of India',
      license: 'Government Open Data License (GODL-India)',
      redistributionPermitted: true,
      lastVerified: '2026-10-18',
      coverage: 'Digital Personal Data Protection Act 2023 & Consumer Redressal Mandates'
    },
    {
      sourceAuthority: 'National Legal Services Authority (NALSA)',
      portalUrl: 'https://nalsa.gov.in',
      repository: 'Free Legal Aid Schemes & Section 12 Eligibility SOPs',
      jurisdiction: 'National & State Legal Services Authorities',
      license: 'Public Service / Statutory Open Information',
      redistributionPermitted: true,
      lastVerified: '2026-10-18',
      coverage: 'Section 12 Legal Aid defense counsel procedures and ADR clinic guidelines'
    }
  ];

  res.json({
    success: true,
    sources: sourceCatalog,
    recentIngestionLogs: logs
  });
}));

export default router;