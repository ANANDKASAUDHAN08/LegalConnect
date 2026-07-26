import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import SavedCasePack from '../../models/SavedCasePack';
import { requireAuth } from '../../middlewares/auth';

const router = Router();

// GET /case-packs — Get all synced Case Packs for logged-in user
router.get('/case-packs', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  if (!userId) {
    throw AppError.unauthorized('User not authenticated.');
  }

  const packs = await SavedCasePack.find({ userId }).sort({ savedAt: -1 }).lean();
  res.json({ success: true, data: packs });
}));

// POST /case-packs/sync — Upsert an array of offline Case Packs for user
router.post('/case-packs/sync', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  if (!userId) {
    throw AppError.unauthorized('User not authenticated.');
  }

  const { packs } = req.body;
  if (!Array.isArray(packs) || packs.length === 0) {
    throw AppError.badRequest('"packs" must be a non-empty array.');
  }

  let synced = 0;
  for (const pack of packs) {
    if (!pack.category || !pack.location) continue;
    await SavedCasePack.findOneAndUpdate(
      { userId, category: pack.category, location: pack.location },
      {
        userId,
        category: pack.category,
        location: pack.location,
        roadmap: pack.roadmap || {},
        helplines: pack.helplines || [],
        resources: pack.resources || [],
        savedAt: pack.savedAt ? new Date(pack.savedAt) : new Date()
      },
      { upsert: true, new: true }
    );
    synced++;
  }

  res.json({ success: true, synced, message: `${synced} Case Pack(s) synced to your account.` });
}));

// DELETE /case-packs/:id — Remove a specific synced Case Pack
router.delete('/case-packs/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  if (!userId) {
    throw AppError.unauthorized('User not authenticated.');
  }

  const result = await SavedCasePack.findOneAndDelete({ _id: req.params.id, userId });
  if (!result) {
    throw AppError.notFound('Case Pack not found or not owned by user.');
  }
  res.json({ success: true, message: 'Case Pack removed from account.' });
}));

export default router;