import { Router, Request, Response } from 'express';
import Lawyer from '../models/Lawyer';

const router = Router();

// GET /api/lawyers - Get all lawyers with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { specialization, city, q } = req.query;

    const filter: any = { isVerified: true };

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

// PUT /api/lawyers/sync - Sync advocate profile from .NET Core API (MySQL) to MongoDB
router.put('/sync', async (req: Request, res: Response) => {
  try {
    const {
      name,
      specializations,
      city,
      experience,
      bio,
      phone,
      email,
      isVerified,
      consultationFee,
      inPersonFee,
      casesCompleted,
      successRate,
      officeAddress,
      education,
      languagesSpoken,
      isAvailable,
      avatarUrl,
      bannerUrl,
      // Premium fields
      activeCourts,
      responseTime,
      workingHours,
      socialLinks,
      faqs,
      accolades,
      casesList,
      availableTimeSlots
    } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required for synchronization.' });
    }

    const updatedLawyer = await Lawyer.findOneAndUpdate(
      { email: { $regex: new RegExp(`^${email}$`, 'i') } },
      {
        name,
        specializations,
        city,
        experience: Number(experience),
        bio,
        phone,
        email,
        rating: Number(req.body.rating || 4.5),
        isVerified: true,
        consultationFee: Number(consultationFee || 0),
        inPersonFee: Number(inPersonFee || 0),
        casesCompleted: Number(casesCompleted || 150),
        successRate: Number(successRate || 95),
        officeAddress: officeAddress || '',
        education: education || '',
        languagesSpoken: languagesSpoken || [],
        isAvailable: isAvailable !== false,
        avatarUrl: avatarUrl || '',
        bannerUrl: bannerUrl || '',
        // Premium fields sync
        activeCourts: activeCourts || [],
        responseTime: responseTime || 'Responds within 24 hours',
        workingHours: workingHours || { days: 'Mon - Fri', hours: '9:00 AM - 6:00 PM' },
        socialLinks: socialLinks || { linkedin: '', website: '', barAssociation: '' },
        faqs: faqs || [],
        accolades: accolades || [],
        casesList: casesList || [],
        availableTimeSlots: availableTimeSlots || []
      },
      { returnDocument: 'after', upsert: true }
    );

    res.json({ success: true, message: 'Lawyer profile synchronized successfully.', data: updatedLawyer });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/lawyers/sync/:email - Purge synced advocate from MongoDB
router.delete('/sync/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }
    const result = await Lawyer.deleteOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    res.json({ success: true, message: 'Synchronized lawyer profile deleted.', result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;