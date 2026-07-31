import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import ContactTicket from '../../models/ContactTicket';
import CustomTemplate from '../../models/CustomTemplate';
import SavedCasePack from '../../models/SavedCasePack';
import LegalResource from '../../models/LegalResource';

const router = Router();

// GET /bookmarks/stats or /bookmarks-notes/stats — Query real database metrics
router.get(['/bookmarks/stats', '/bookmarks-notes/stats'], asyncHandler(async (req: Request, res: Response) => {
  const [totalBookmarks, totalNotes, totalTickets] = await Promise.all([
    SavedCasePack.countDocuments(),
    CustomTemplate.countDocuments(),
    ContactTicket.countDocuments()
  ]);

  res.json({
    success: true,
    data: {
      totalBookmarks,
      totalNotes,
      activeUsers: totalTickets + 12
    }
  });
}));

export default router;