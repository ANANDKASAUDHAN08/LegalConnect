import { Router, Request, Response } from 'express';
import Lawyer from '../models/Lawyer';

const router = Router();

// GET /api/lawyers - Get all lawyers with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { specialization, city, q } = req.query;

    const filter: any = {};

    if (specialization) {
      filter.specializations = { $regex: specialization as string, $options: 'i' };
    }
    if (city) {
      filter.city = { $regex: city as string, $options: 'i' };
    }
    if (q) {
      filter.$or = [
        { name: { $regex: q as string, $options: 'i' } },
        { specializations: { $regex: q as string, $options: 'i' } },
        { city: { $regex: q as string, $options: 'i' } },
        { bio: { $regex: q as string, $options: 'i' } }
      ];
    }

    const lawyers = await Lawyer.find(filter).sort({ rating: -1 });
    res.json({ success: true, count: lawyers.length, data: lawyers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/lawyers/meta - Get unique cities and specializations for filter UI
router.get('/meta', async (req: Request, res: Response) => {
  try {
    const cities = await Lawyer.distinct('city');
    const specializations = await Lawyer.distinct('specializations');
    res.json({ success: true, data: { cities: cities.sort(), specializations: specializations.sort() } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/lawyers/:id - Get a single lawyer by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const lawyer = await Lawyer.findById(req.params.id);
    if (!lawyer) return res.status(404).json({ success: false, message: 'Lawyer not found.' });
    res.json({ success: true, data: lawyer });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
