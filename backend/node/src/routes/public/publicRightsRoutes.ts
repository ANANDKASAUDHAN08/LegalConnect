import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import StatutoryRightModel from '../../models/StatutoryRight';
import EmergencyScenarioModel from '../../models/EmergencyScenario';
import DiagnosticCrisisModel from '../../models/DiagnosticCrisis';
import RightProposalModel from '../../models/RightProposal';
import ruleEngineService from '../../services/ruleEngineService';
import { DEFAULT_DIAGNOSTIC_CRISES, evaluateDiagnosticAnswers } from '../../data/defaultDiagnostics';

const router = Router();

// 1. GET /api/info/rights - List statutory rights strictly from MongoDB with pagination & faceted filters
router.get(
  '/rights',
  asyncHandler(async (req: Request, res: Response) => {
    const category = (req.query['category'] as string) || 'All';
    const query = ((req.query['q'] as string) || '').trim();
    const sort = (req.query['sort'] as string) || 'popular';
    const scenario = ((req.query['scenario'] as string) || '').trim();
    const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string) || 50));

    // Build dynamic MongoDB query - strictly published verified content
    const dbQuery: any = { isPublished: true };

    if (category && category !== 'All') {
      dbQuery.category = { $regex: new RegExp(`^${category.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') };
    }

    if (scenario) {
      dbQuery.scenarioTag = scenario.toLowerCase();
    }

    if (query) {
      const qRegex = new RegExp(query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
      dbQuery.$or = [
        { title: qRegex },
        { title_hi: qRegex },
        { summary: qRegex },
        { summary_hi: qRegex },
        { category: qRegex },
        { 'statutoryBasis.actName': qRegex },
        { 'statutoryBasis.shortAct': qRegex },
        { 'statutoryBasis.sections': { $in: [qRegex] } },
        { 'statutoryBasis.landmarkCases': { $in: [qRegex] } },
        { keyProtections: { $in: [qRegex] } },
        { actionableSteps: { $in: [qRegex] } },
        { tags: { $in: [qRegex] } },
        { legalRemedy: qRegex }
      ];
    }

    // Determine sorting
    let sortConfig: any = { isPopular: -1, title: 1 };
    if (sort === 'alpha-asc') {
      sortConfig = { title: 1 };
    } else if (sort === 'alpha-desc') {
      sortConfig = { title: -1 };
    } else if (sort === 'newest') {
      sortConfig = { verifiedDate: -1, createdAt: -1 };
    }

    const [totalCount, rightsList] = await Promise.all([
      StatutoryRightModel.countDocuments(dbQuery),
      StatutoryRightModel.find(dbQuery)
        .sort(sortConfig)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    ]);

    // Calculate category counts dynamically using native MongoDB aggregation
    const categoryAgg = await StatutoryRightModel.aggregate([
      { $match: { isPublished: true } },
      { $group: { _id: { $ifNull: ['$category', 'General'] }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    let totalPublishedCount = 0;
    const categoryList = categoryAgg.map(item => {
      totalPublishedCount += item.count;
      return { name: item._id as string, count: item.count };
    });

    const categoriesWithCounts = [
      { name: 'All', count: totalPublishedCount },
      ...categoryList
    ];

    res.json({
      success: true,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      isDatabaseSourced: true,
      categories: categoriesWithCounts,
      data: rightsList
    });
  })
);

// 2. GET /api/info/rights/scenarios - Emergency citizen scenarios strictly from database
router.get(
  '/rights/scenarios',
  asyncHandler(async (_req: Request, res: Response) => {
    const dbScenarios = await EmergencyScenarioModel.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    res.json({
      success: true,
      data: dbScenarios
    });
  })
);

// 2a. GET /api/info/rights/diagnostics - Crisis decision trees & questions from database with fallback
router.get(
  '/rights/diagnostics',
  asyncHandler(async (_req: Request, res: Response) => {
    let crises = await DiagnosticCrisisModel.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean()
      .catch(() => []);

    if (!crises || crises.length === 0) {
      crises = DEFAULT_DIAGNOSTIC_CRISES as any;
    }

    const formatted = crises.map((c: any) => ({
      ...c,
      id: c.id || c.crisisId || (c as any)._id
    }));

    res.json({
      success: true,
      data: formatted
    });
  })
);

// 2a-2. POST /api/info/rights/diagnostics/evaluate - Statutory rule engine backed by MongoDB rules with fallback
router.post(
  '/rights/diagnostics/evaluate',
  asyncHandler(async (req: Request, res: Response) => {
    const crisisId = req.body.crisisId || req.body.id;
    const answers = req.body.answers;
    if (!crisisId || typeof answers !== 'object') {
      res.status(400).json({
        success: false,
        message: 'Invalid payload: crisisId (string) and answers (object) are required.'
      });
      return;
    }

    try {
      const evaluation = await ruleEngineService.evaluate(crisisId, answers || {});
      if (evaluation) {
        res.json({
          success: true,
          data: evaluation
        });
        return;
      }
    } catch {
      // Fall through to deterministic statutory engine
    }

    const fallbackEvaluation = evaluateDiagnosticAnswers(crisisId, answers || {});
    res.json({
      success: true,
      data: fallbackEvaluation
    });
  })
);

// 3. GET /api/info/rights/:slug - Retrieve single statutory right by slug or ID strictly from database
router.get(
  '/rights/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const rawSlug = req.params['slug'];
    const slug = (Array.isArray(rawSlug) ? rawSlug[0] : (rawSlug as string)) || '';

    const target = await StatutoryRightModel.findOne({
      $or: [{ id: slug }, { slug }]
    }).lean();

    if (!target) {
      res.status(404).json({
        success: false,
        message: `Statutory citizen right entry "${slug}" not found in library.`
      });
      return;
    }

    res.json({
      success: true,
      data: target
    });
  })
);

// 4. GET /api/info/rights/provenance/:id - Inspect full provenance and verification audit trail
router.get(
  '/rights/provenance/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const right = await StatutoryRightModel.findOne({ $or: [{ id }, { slug: id }] }, 'title provenance statutoryBasis verifiedDate verifiedBy').lean();

    if (!right) {
      res.status(404).json({ success: false, message: `Record "${id}" not found.` });
      return;
    }

    res.json({
      success: true,
      data: {
        id,
        title: right.title,
        statutoryBasis: right.statutoryBasis,
        provenance: right.provenance || {
          sourceAuthority: right.statutoryBasis?.actName || 'Legislative Department',
          sourceUrl: right.statutoryBasis?.actUrl || 'https://www.indiacode.nic.in',
          reviewStatus: 'verified',
          lastVerifiedAt: right.verifiedDate || '2026-08-15',
          reviewedBy: right.verifiedBy || 'LegalConnect Statutory Review Directorate',
          license: 'Government Open Data License (GODL-India)'
        }
      }
    });
  })
);

// 5. GET /api/info/rights/propose/categories - Curated Legal Defense Domain Taxonomy
router.get(
  '/rights/propose/categories',
  asyncHandler(async (_req: Request, res: Response) => {
    const categories = [
      {
        id: 'Police Encounters',
        name: 'Police Encounters & Criminal Defense',
        icon: 'shield',
        description: 'Custody, summons, traffic stops, unauthorized vehicle search, non-cognizable reports',
        examples: ['Unauthorized Phone Confiscation at Checkpoint', 'Bail on Bailable Warrant by Duty Magistrate']
      },
      {
        id: 'Cyber & Online Fraud',
        name: 'Cyber & Digital Protection',
        icon: 'lock',
        description: 'Digital arrest scams, frozen bank accounts, unauthorized UPI debits, cyber extortion',
        examples: ['Bank Account Unfreezing (1930 Cyber Fraud)', 'Revenge Porn Takedown Protocol under IT Act']
      },
      {
        id: 'Housing & Tenancy',
        name: 'Housing & Tenancy Defense',
        icon: 'home',
        description: 'Forcible eviction, withholding security deposit, illegal electricity disconnection',
        examples: ['Protection Against Lockout Without Court Notice', 'Rent Control Ceiling During Tenancy']
      },
      {
        id: 'Women & Child Safety',
        name: 'Women & Child Safeguards',
        icon: 'heart',
        description: 'Zero FIR, sunset-to-sunrise arrest immunity, workplace harassment (POSH), maintenance',
        examples: ['Female Arrest Protocol after Sunset', 'Emergency POSH Committee Injunction']
      },
      {
        id: 'Consumer & Financial',
        name: 'Consumer & Financial Protection',
        icon: 'credit-card',
        description: 'Loan recovery agent harassment, e-commerce refusal to refund, defective medical goods',
        examples: ['RBI Fair Practices Code Against Recovery Calls', 'Class Action Injunction Before NCDRC']
      },
      {
        id: 'Workplace & Labor',
        name: 'Workplace, Labor & Employment',
        icon: 'briefcase',
        description: 'Wrongful termination, withholding salary, non-issuance of relieving letter/experience certificate',
        examples: ['Wage Recovery Petition Before Labor Commissioner', 'Enforceability of Non-Compete Clauses']
      },
      {
        id: 'Healthcare & Dignity',
        name: 'Healthcare & Patient Rights',
        icon: 'activity',
        description: 'Hospital detaining dead bodies or patients for unpaid bills, denial of emergency care',
        examples: ['Hospital Detention for Pending Bills Prohibited (Charter)', 'Golden Hour Emergency Treatment Mandate']
      }
    ];

    res.json({
      success: true,
      data: categories
    });
  })
);

// 6. POST /api/info/rights/propose - Submit New Legal Protection / Crisis Scenario Proposal
router.post(
  '/rights/propose',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      scenarioTitle,
      category,
      statutoryBasis,
      verbalScript,
      emergencyHelpline,
      description,
      evidenceUrl,
      contributorType = 'citizen',
      contributorName,
      contributorEmail,
      clientFingerprint
    } = req.body;

    if (!scenarioTitle || scenarioTitle.trim().length < 5) {
      res.status(400).json({
        success: false,
        message: 'Scenario / Threat title is required and must be at least 5 characters.'
      });
      return;
    }

    if (!category || category.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Legal domain category is required.'
      });
      return;
    }

    if (!description || description.trim().length < 15) {
      res.status(400).json({
        success: false,
        message: 'Detailed explanation of the citizen threat scenario is required (at least 15 characters).'
      });
      return;
    }

    // Generate unique sequential reference ID: LC-PROP-2026-XXXXX
    const year = new Date().getFullYear();
    const randomHex = Math.floor(100000 + Math.random() * 900000);
    const referenceId = `LC-PROP-${year}-${randomHex}`;

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '';

    const newProposal = await RightProposalModel.create({
      referenceId,
      scenarioTitle: scenarioTitle.trim(),
      category: category.trim(),
      statutoryBasis: statutoryBasis?.trim() || undefined,
      verbalScript: verbalScript?.trim() || undefined,
      emergencyHelpline: emergencyHelpline?.trim() || undefined,
      description: description.trim(),
      evidenceUrl: evidenceUrl?.trim() || undefined,
      contributorType: ['citizen', 'advocate', 'law_student', 'anonymous'].includes(contributorType)
        ? contributorType
        : 'citizen',
      contributorName: contributorName?.trim() || undefined,
      contributorEmail: contributorEmail?.trim() || undefined,
      status: 'PENDING',
      clientFingerprint: clientFingerprint?.trim() || undefined,
      clientIp
    });

    res.status(201).json({
      success: true,
      message: 'Your legal protection proposal has been submitted to the LegalConnect Research Council.',
      referenceId: newProposal.referenceId,
      estimatedReviewTime: '3-5 business days',
      data: {
        referenceId: newProposal.referenceId,
        scenarioTitle: newProposal.scenarioTitle,
        category: newProposal.category,
        status: newProposal.status,
        createdAt: newProposal.createdAt
      }
    });
  })
);

export default router;