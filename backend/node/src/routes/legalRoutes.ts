import { Router, Request, Response } from 'express';
import BareAct from '../models/BareAct';
import aiService from '../services/AiService';

const router = Router();

// GET /api/legal/search - Semantic/Keyword search across all laws
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Query parameter "q" is required.' });
    }

    // Using MongoDB $text index for fast full-text search
    // It will search actName, description, chapter titles, and section contents
    const results = await BareAct.find(
      { $text: { $search: query } },
      { score: { $meta: "textScore" } }
    ).sort({ score: { $meta: "textScore" } }).limit(10);

    // To make it more useful, we shouldn't return massive full Acts. We want to extract
    // snippets or just indicate which sections matched.
    // For simplicity right now, we return the acts that matched best, but strip large content
    const sanitizedResults = results.map(act => ({
      _id: act._id,
      actName: act.actName,
      shortName: act.shortName,
      year: act.year,
      description: act.description,
      // Just returning chapter/section metadata without full text
      chapters: act.chapters.map(ch => ({
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        sectionsCount: ch.sections.length
      }))
    }));

    res.json({ success: true, count: sanitizedResults.length, data: sanitizedResults });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/legal/acts - Get all acts (name, shortName, year only - no full data)
router.get('/acts', async (req: Request, res: Response) => {
  try {
    const acts = await BareAct.find({}, 'actName shortName year description');
    res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
    res.json({ success: true, count: acts.length, data: acts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/legal/acts/:shortName - Get a specific act by its shortName
router.get('/acts/:shortName', async (req: Request, res: Response) => {
  try {
    const act = await BareAct.findOne({ shortName: req.params.shortName });
    if (!act) {
      return res.status(404).json({ success: false, message: 'Act not found.' });
    }
    res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
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
        foundSection = { 
          chapter: chapter.title, 
          section_number: section.section_number, 
          title: section.title, 
          content: section.content,
          aiSummary: section.aiSummary 
        };
        break;
      }
    }

    if (!foundSection) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
    res.json({ success: true, data: foundSection });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/legal/acts/:shortName/sections/:sectionNumber/summary - Generate or get AI Summary
router.get('/acts/:shortName/sections/:sectionNumber/summary', async (req: Request, res: Response) => {
  try {
    const act = await BareAct.findOne({ shortName: req.params.shortName });
    if (!act) {
      return res.status(404).json({ success: false, message: 'Act not found.' });
    }

    let targetSection: any = null;
    let targetChapterIndex = -1;
    let targetSectionIndex = -1;

    for (let i = 0; i < act.chapters.length; i++) {
      for (let j = 0; j < act.chapters[i].sections.length; j++) {
        if (act.chapters[i].sections[j].section_number === req.params.sectionNumber) {
          targetSection = act.chapters[i].sections[j];
          targetChapterIndex = i;
          targetSectionIndex = j;
          break;
        }
      }
      if (targetSection) break;
    }

    if (!targetSection) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    // If summary already exists, return it from DB
    if (targetSection.aiSummary) {
      res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
      return res.json({ success: true, data: { summary: targetSection.aiSummary, cached: true } });
    }

    // Call AI Service
    const generatedSummary = await aiService.generateSectionSummary(act.actName, targetSection.title, targetSection.content);

    // Save back to DB
    act.chapters[targetChapterIndex].sections[targetSectionIndex].aiSummary = generatedSummary;
    // Mark modified for deeply nested arrays
    act.markModified(`chapters.${targetChapterIndex}.sections.${targetSectionIndex}.aiSummary`);
    await act.save();

    res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
    res.json({ success: true, data: { summary: generatedSummary, cached: false } });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
