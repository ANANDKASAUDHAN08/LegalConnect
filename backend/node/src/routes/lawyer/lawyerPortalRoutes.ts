import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import {
  searchLawyers,
  getLawyerMeta,
  getLawyersByIds,
  getLawyerById,
  syncLawyerProfile,
  deleteSyncedLawyer
} from '../../services/lawyerService';
import { enrichEntityWithInteractions } from '../../services/interactionEnrichmentService';

const router = Router();

// GET /api/lawyers - Get all lawyers with optional filters
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { specialization, city, q } = req.query;
  const lawyers = await searchLawyers({
    specialization: specialization as string,
    city: city as string,
    q: q as string
  });
  res.json({ success: true, count: lawyers.length, data: lawyers });
}));

// GET /api/lawyers/meta - Get unique cities and specializations for filter UI
router.get('/meta', asyncHandler(async (req: Request, res: Response) => {
  const meta = await getLawyerMeta();
  res.json({ success: true, data: meta });
}));

// POST /api/lawyers/batch - Fetch metadata for a list of lawyer IDs
router.post('/batch', asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    throw AppError.badRequest('ids must be an array.');
  }
  const lawyers = await getLawyersByIds(ids);
  res.json({ success: true, count: lawyers.length, data: lawyers });
}));

// GET /api/lawyers/:id - Get a single lawyer by ID (enriched with interaction stats)
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const lawyer: any = await getLawyerById(id);
  if (!lawyer) {
    throw AppError.notFound('Lawyer not found.');
  }

  // Convert to plain object if Mongoose document
  const lawyerObj = lawyer.toObject ? lawyer.toObject() : { ...lawyer };

  // Server-Side Enrichment: fetch like count, isLiked, isBookmarked in a single pass
  const interaction = await enrichEntityWithInteractions('Lawyer', id, req.headers.authorization);
  lawyerObj.interaction = interaction;

  res.json({ success: true, data: lawyerObj });
}));

// PUT /api/lawyers/sync - Sync advocate profile from .NET Core API (MySQL) to MongoDB
router.put('/sync', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    throw AppError.badRequest('Email is required for synchronization.');
  }
  const updatedLawyer = await syncLawyerProfile(email, req.body);
  res.json({ success: true, message: 'Lawyer profile synchronized successfully.', data: updatedLawyer });
}));

// DELETE /api/lawyers/sync/:email - Purge synced advocate from MongoDB
router.delete('/sync/:email', asyncHandler(async (req: Request, res: Response) => {
  const email = req.params.email as string;
  if (!email) {
    throw AppError.badRequest('Email is required.');
  }
  const result = await deleteSyncedLawyer(email);
  res.json({ success: true, message: 'Synchronized lawyer profile deleted.', result });
}));

export default router;