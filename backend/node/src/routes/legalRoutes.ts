import { Router, Request, Response } from 'express';
import BareAct from '../models/BareAct';

const router = Router();

// GET /api/legal/acts - Get all acts (name, shortName, year only - no full data)
router.get('/acts', async (req: Request, res: Response) => {
  try {
    const acts = await BareAct.find({}, 'actName shortName year description');
    res.json({ success: true, count: acts.length, data: acts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/legal/acts/:shortName - Get a specific act by its shortName (e.g., "BNS", "Constitution")
router.get('/acts/:shortName', async (req: Request, res: Response) => {
  try {
    const act = await BareAct.findOne({ shortName: req.params.shortName });
    if (!act) {
      return res.status(404).json({ success: false, message: 'Act not found.' });
    }
    res.json({ success: true, data: act });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/legal/acts/:shortName/sections/:sectionNumber - Get a specific section
router.get('/acts/:shortName/sections/:sectionNumber', async (req: Request, res: Response) => {
  try {
    const act = await BareAct.findOne({ shortName: req.params.shortName });
    if (!act) {
      return res.status(404).json({ success: false, message: 'Act not found.' });
    }

    let foundSection = null;
    for (const chapter of act.chapters) {
      const section = chapter.sections.find(s => s.section_number === req.params.sectionNumber);
      if (section) {
        foundSection = { chapter: chapter.title, section_number: section.section_number, title: section.title, content: section.content };
        break;
      }
    }

    if (!foundSection) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    res.json({ success: true, data: foundSection });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
