import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import HelpHelpline from '../../models/HelpHelpline';

const router = Router();

// GET all helplines with advanced filtering, search, and telemetry metrics
router.get('/helplines', asyncHandler(async (req: Request, res: Response) => {
  const { priorityTier, state, category, isActive, search, page, limit } = req.query;
  const filter: any = {};

  if (priorityTier) filter.priorityTier = priorityTier;
  if (category) filter.category = category;
  if (state && state !== 'All') {
    if (state === 'National') {
      filter.state = 'All India';
    } else {
      filter.state = { $regex: new RegExp(state as string, 'i') };
    }
  }
  if (isActive !== undefined && isActive !== '') {
    filter.isActive = String(isActive).toLowerCase() === 'true';
  }

  if (search) {
    const q = (search as string).trim();
    filter.$or = [
      { name: { $regex: new RegExp(q, 'i') } },
      { number: { $regex: new RegExp(q, 'i') } },
      { description: { $regex: new RegExp(q, 'i') } },
      { category: { $regex: new RegExp(q, 'i') } }
    ];
  }

  const [
    helplines,
    total,
    activeCount,
    p0Count,
    p1Count,
    p2Count,
    nationalCount,
    offlineCount
  ] = await Promise.all([
    HelpHelpline.find(filter).sort({ priorityTier: 1, createdAt: -1 }).lean(),
    HelpHelpline.countDocuments(),
    HelpHelpline.countDocuments({ isActive: true }),
    HelpHelpline.countDocuments({ priorityTier: 'P0_CRITICAL' }),
    HelpHelpline.countDocuments({ priorityTier: 'P1_URGENT' }),
    HelpHelpline.countDocuments({ priorityTier: 'P2_ADVISORY' }),
    HelpHelpline.countDocuments({ state: 'All India' }),
    HelpHelpline.countDocuments({ isActive: false })
  ]);

  res.json({
    success: true,
    count: helplines.length,
    data: helplines,
    metrics: {
      total,
      active: activeCount,
      p0Critical: p0Count,
      p1Urgent: p1Count,
      p2Advisory: p2Count,
      national: nationalCount,
      offline: offlineCount
    }
  });
}));

// POST create helpline
router.post('/helplines', asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    number,
    description,
    category = 'General',
    priorityTier = 'P2_ADVISORY',
    isActive = true,
    is24x7 = true,
    operatingHours = '24 Hours / 7 Days',
    operatingDays,
    languages = ['English', 'Hindi'],
    state = 'All India',
    tollFree = true,
    alternateNumbers = []
  } = req.body;

  if (!name || !number) {
    throw AppError.badRequest('Helpline title and contact number are required.');
  }

  const helpline = new HelpHelpline({
    name,
    number,
    description: description || 'Emergency helpline and advisory service.',
    category,
    priorityTier,
    isActive,
    is24x7,
    operatingHours,
    operatingDays: operatingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    languages,
    state,
    tollFree,
    alternateNumbers,
    lastVerifiedAt: new Date(),
    verifiedBy: req.body.verifiedBy || 'System Administrator',
    verificationNotes: 'Initial registry onboarding verification'
  });

  await helpline.save();
  res.status(201).json({ success: true, message: 'Helpline registered successfully.', data: helpline });
}));

// POST verify / ping helpline line status
router.post('/helplines/:id/verify-ping', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { notes = 'Operational line test verified by admin', verifiedBy = 'Administrator' } = req.body;

  const helpline = await HelpHelpline.findById(id);
  if (!helpline) {
    throw AppError.notFound('Helpline record not found.');
  }

  helpline.lastVerifiedAt = new Date();
  helpline.verifiedBy = verifiedBy;
  helpline.verificationNotes = notes;
  await helpline.save();

  res.json({
    success: true,
    message: `Line verification ping recorded for "${helpline.name}".`,
    data: helpline
  });
}));

// POST bulk update helpline status (Active / Offline)
router.post('/helplines/bulk-status', asyncHandler(async (req: Request, res: Response) => {
  const { ids, isActive } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw AppError.badRequest('Please provide an array of helpline IDs.');
  }

  await HelpHelpline.updateMany(
    { _id: { $in: ids } },
    { $set: { isActive: !!isActive, lastVerifiedAt: new Date() } }
  );

  res.json({
    success: true,
    message: `Successfully updated status to ${isActive ? 'Active' : 'Offline'} for ${ids.length} helpline(s).`
  });
}));

// PUT update helpline
router.put('/helplines/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = { ...req.body, lastVerifiedAt: new Date() };

  const helpline = await HelpHelpline.findByIdAndUpdate(id, updates, { new: true }).lean();
  if (!helpline) {
    throw AppError.notFound('Helpline not found.');
  }
  res.json({ success: true, message: 'Helpline updated.', data: helpline });
}));

// DELETE helpline
router.delete('/helplines/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const helpline = await HelpHelpline.findByIdAndDelete(id).lean();
  if (!helpline) {
    throw AppError.notFound('Helpline not found.');
  }
  res.json({ success: true, message: 'Helpline deleted.' });
}));

export default router;