import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import BareAct from '../../models/BareAct';
import { normalizeActInfo } from '../../utils/actNormalizer';

const router = Router();

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET all acts with section/chapter stats
router.get('/acts', asyncHandler(async (req: Request, res: Response) => {
  const acts = await BareAct.find().select('actName shortName name title year description status chapters').lean();
  const stats = acts.map((act: any) => {
    const rawTitle = act.actName || act.name || act.title;
    const normalized = normalizeActInfo(rawTitle, act.shortName, act.year);
    return {
      id: act._id,
      shortName: normalized.shortName,
      actName: normalized.actName,
      name: normalized.actName,
      year: act.year,
      description: act.description,
      chapterCount: act.chapters ? act.chapters.length : 0,
      sectionCount: act.chapters ? act.chapters.reduce((acc: number, ch: any) => acc + (ch.sections ? ch.sections.length : 0), 0) : 0,
      chapters: act.chapters || []
    };
  });
  res.json({ success: true, count: stats.length, data: stats });
}));

// POST create a new Act
router.post('/acts', asyncHandler(async (req: Request, res: Response) => {
  const { actName, shortName, year, description, chapters } = req.body;

  if (!actName || !shortName || !year) {
    throw AppError.badRequest('actName, shortName, and year are required.');
  }

  const normalized = normalizeActInfo(actName, shortName, year);
  const safeShortName = escapeRegExp(normalized.shortName);
  const existing = await BareAct.findOne({ shortName: new RegExp(`^${safeShortName}$`, 'i') });
  if (existing) {
    throw AppError.badRequest(`Act with short code '${normalized.shortName}' already exists.`);
  }

  const newAct = await BareAct.create({
    actName: normalized.actName,
    shortName: normalized.shortName,
    year: Number(year),
    description: description ? description.trim() : '',
    chapters: Array.isArray(chapters) && chapters.length > 0 ? chapters : [
      {
        chapterNumber: 'I',
        title: 'PRELIMINARY',
        sections: [
          {
            section_number: '1',
            title: 'Short title, extent and commencement.',
            clean_title: 'Short title, extent and commencement.',
            introduction_text: `This Act may be called the ${actName.trim()}, ${year}.`
          }
        ]
      }
    ]
  });

  res.status(201).json({ success: true, message: `Act '${newAct.actName}' created successfully.`, data: newAct });
}));

// PUT update act metadata
router.put('/acts/:shortName', asyncHandler(async (req: Request, res: Response) => {
  const shortName = String(req.params['shortName']);
  const updateData = req.body;
  const safeShortName = escapeRegExp(shortName);
  const act = await BareAct.findOneAndUpdate({ shortName: new RegExp(`^${safeShortName}$`, 'i') }, updateData, { new: true }).lean();
  if (!act) {
    throw AppError.notFound(`Act ${shortName} not found.`);
  }
  res.json({ success: true, message: `Act ${shortName} updated.`, data: act });
}));

// PUT update section content
router.put('/sections/:sectionId', asyncHandler(async (req: Request, res: Response) => {
  const sectionId = String(req.params['sectionId']);
  const { shortName, title, title_hi, content, content_hi, clean_title, clean_title_hi, introduction_text, introduction_text_hi } = req.body;

  const shortNameStr = String(shortName || '');
  const safeShortName = escapeRegExp(shortNameStr);
  const act = await BareAct.findOne({ shortName: new RegExp(`^${safeShortName}$`, 'i') });
  if (!act) {
    throw AppError.notFound(`Act ${shortNameStr} not found.`);
  }

  let updated = false;
  for (const chapter of act.chapters) {
    const section: any = chapter.sections.find((s: any) => (s._id && s._id.toString() === sectionId) || s.section_number.toString() === sectionId);
    if (section) {
      if (title !== undefined) section.title = title;
      if (clean_title !== undefined) section.clean_title = clean_title;
      if (title_hi !== undefined) section.title_hi = title_hi;
      if (clean_title_hi !== undefined) section.clean_title_hi = clean_title_hi;
      if (content !== undefined) section.content = content;
      if (content_hi !== undefined) section.content_hi = content_hi;
      if (introduction_text !== undefined) section.introduction_text = introduction_text;
      if (introduction_text_hi !== undefined) section.introduction_text_hi = introduction_text_hi;
      updated = true;
      break;
    }
  }

  if (!updated) {
    throw AppError.notFound(`Section ${sectionId} not found in ${shortNameStr}.`);
  }

  await act.save();
  res.json({ success: true, message: `Section ${sectionId} updated successfully.` });
}));

// PATCH update act metadata (name, shortName, year, description) for admin corrections
router.patch('/acts/:shortName/metadata', asyncHandler(async (req: Request, res: Response) => {
  const shortName = String(req.params['shortName']);
  const { actName, newShortName, year, description } = req.body;
  const safeShortName = escapeRegExp(shortName);
  const act = await BareAct.findOne({ shortName: new RegExp(`^${safeShortName}$`, 'i') });
  if (!act) {
    throw AppError.notFound(`Act ${shortName} not found.`);
  }

  if (actName !== undefined) act.actName = actName.trim();
  if (year !== undefined) act.year = Number(year);
  if (description !== undefined) act.description = description.trim();
  if (newShortName !== undefined && newShortName.trim() !== shortName) {
    const newCode = newShortName.trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
    const safeNewCode = escapeRegExp(newCode);
    const existing = await BareAct.findOne({ shortName: new RegExp(`^${safeNewCode}$`, 'i') });
    if (existing && existing._id.toString() !== act._id.toString()) {
      throw AppError.badRequest(`Short code '${newCode}' is already used by another act.`);
    }
    act.shortName = newCode;
  }

  await act.save();
  res.json({ success: true, message: `Act metadata updated.`, data: { actName: act.actName, shortName: act.shortName, year: act.year, description: act.description } });
}));

// DELETE an act entirely (irreversible)
router.delete('/acts/:shortName', asyncHandler(async (req: Request, res: Response) => {
  const shortName = String(req.params['shortName']);
  const safeShortName = escapeRegExp(shortName);
  const act = await BareAct.findOneAndDelete({ shortName: new RegExp(`^${safeShortName}$`, 'i') });
  if (!act) {
    throw AppError.notFound(`Act ${shortName} not found.`);
  }
  res.json({ success: true, message: `Act '${act.actName}' (${shortName}) has been permanently deleted.` });
}));

export default router;