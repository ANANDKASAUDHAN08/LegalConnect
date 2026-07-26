import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import BareAct from '../../models/BareAct';

const router = Router();

// GET all acts with section/chapter stats
router.get('/acts', asyncHandler(async (req: Request, res: Response) => {
  const acts = await BareAct.find().select('shortName name title year description status chapters').lean();
  const stats = acts.map((act: any) => ({
    id: act._id,
    shortName: act.shortName,
    name: act.name || act.title,
    year: act.year,
    description: act.description,
    chapterCount: act.chapters ? act.chapters.length : 0,
    sectionCount: act.chapters ? act.chapters.reduce((acc: number, ch: any) => acc + (ch.sections ? ch.sections.length : 0), 0) : 0
  }));
  res.json({ success: true, count: stats.length, data: stats });
}));

// PUT update act metadata
router.put('/acts/:shortName', asyncHandler(async (req: Request, res: Response) => {
  const { shortName } = req.params;
  const updateData = req.body;
  const act = await BareAct.findOneAndUpdate({ shortName: new RegExp(`^${shortName}$`, 'i') }, updateData, { new: true }).lean();
  if (!act) {
    throw AppError.notFound(`Act ${shortName} not found.`);
  }
  res.json({ success: true, message: `Act ${shortName} updated.`, data: act });
}));

// PUT update section content
router.put('/sections/:sectionId', asyncHandler(async (req: Request, res: Response) => {
  const { sectionId } = req.params;
  const { shortName, title, title_hi, content, content_hi } = req.body;

  const act = await BareAct.findOne({ shortName: new RegExp(`^${shortName}$`, 'i') });
  if (!act) {
    throw AppError.notFound(`Act ${shortName} not found.`);
  }

  let updated = false;
  for (const chapter of act.chapters) {
    const section: any = chapter.sections.find((s: any) => (s._id && s._id.toString() === sectionId) || s.section_number.toString() === sectionId);
    if (section) {
      if (title !== undefined) section.title = title;
      if (title_hi !== undefined) section.title_hi = title_hi;
      if (content !== undefined) section.content = content;
      if (content_hi !== undefined) section.content_hi = content_hi;
      updated = true;
      break;
    }
  }

  if (!updated) {
    throw AppError.notFound(`Section ${sectionId} not found in ${shortName}.`);
  }

  await act.save();
  res.json({ success: true, message: `Section ${sectionId} updated successfully.` });
}));

export default router;