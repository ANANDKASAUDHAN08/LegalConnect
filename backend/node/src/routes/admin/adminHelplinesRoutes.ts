import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import HelpHelpline from '../../models/HelpHelpline';

const router = Router();

// GET all helplines
router.get('/helplines', asyncHandler(async (req: Request, res: Response) => {
  const helplines = await HelpHelpline.find().lean();
  res.json({ success: true, count: helplines.length, data: helplines });
}));

// POST create helpline
router.post('/helplines', asyncHandler(async (req: Request, res: Response) => {
  const helpline = new HelpHelpline(req.body);
  await helpline.save();
  res.status(201).json({ success: true, message: 'Helpline created.', data: helpline });
}));

// PUT update helpline
router.put('/helplines/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const helpline = await HelpHelpline.findByIdAndUpdate(id, req.body, { new: true }).lean();
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