import mongoose from 'mongoose';
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import BareAct, { SectionModel } from '../../models/BareAct';
import { normalizeActInfo, classifyActCategory, generateHierarchicalId } from '../../utils/actNormalizer';
import actRegistry from '../../services/actRegistry';
import AiService from '../../services/AiService';

const router = Router();

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET all acts with section/chapter stats
router.get('/acts', asyncHandler(async (req: Request, res: Response) => {
  if (actRegistry.initialized) {
    const directory = actRegistry.getActDirectory();
    return res.json({ success: true, count: directory.length, data: directory });
  }

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

  const category = classifyActCategory(normalized.actName);
  const hierarchical_id = generateHierarchicalId(normalized.shortName, year, category);

  const newAct = await BareAct.create({
    actName: normalized.actName,
    shortName: normalized.shortName,
    year: Number(year),
    description: description ? description.trim() : '',
    hierarchical_id,
    act_code: normalized.shortName,
    category,
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

  // Invalidate in-memory registry map
  await actRegistry.invalidate();

  res.status(201).json({ success: true, message: `Act '${newAct.actName}' created successfully.`, data: newAct });
}));

// PUT update act metadata
router.put('/acts/:shortName', asyncHandler(async (req: Request, res: Response) => {
  const shortName = String(req.params['shortName']);
  const updateData = req.body;
  const registryEntry = actRegistry.resolveAct(shortName);
  const targetId = registryEntry ? registryEntry._id : null;

  let act;
  if (targetId) {
    act = await BareAct.findByIdAndUpdate(targetId, updateData, { new: true }).lean();
  } else {
    const safeShortName = escapeRegExp(shortName);
    act = await BareAct.findOneAndUpdate({ shortName: new RegExp(`^${safeShortName}$`, 'i') }, updateData, { new: true }).lean();
  }

  if (!act) {
    throw AppError.notFound(`Act ${shortName} not found.`);
  }

  await actRegistry.invalidate();

  res.json({ success: true, message: `Act ${shortName} updated.`, data: act });
}));

// PUT update section content
router.put('/sections/:sectionId', asyncHandler(async (req: Request, res: Response) => {
  const sectionId = String(req.params['sectionId']);
  const { shortName, title, title_hi, content, content_hi, clean_title, clean_title_hi, introduction_text, introduction_text_hi, section_number } = req.body;

  const shortNameStr = String(shortName || '').trim();
  const safeShortName = escapeRegExp(shortNameStr);
  const act = await BareAct.findOne({ shortName: new RegExp(`^${safeShortName}$`, 'i') });
  if (!act) {
    throw AppError.notFound(`Act ${shortNameStr} not found.`);
  }

  const secNum = String(section_number || '').trim();

  // 1. Update standalone SectionModel document (where full section content is stored & queried)
  let sectionDoc = null;
  if (mongoose.Types.ObjectId.isValid(sectionId)) {
    sectionDoc = await SectionModel.findById(sectionId);
  }
  if (!sectionDoc) {
    sectionDoc = await SectionModel.findOne({
      actShortName: new RegExp(`^${safeShortName}$`, 'i'),
      section_number: secNum || sectionId
    });
  }

  if (sectionDoc) {
    if (title !== undefined) sectionDoc.title = title;
    if (clean_title !== undefined) sectionDoc.clean_title = clean_title;
    if (title_hi !== undefined) sectionDoc.title_hi = title_hi;
    if (clean_title_hi !== undefined) sectionDoc.clean_title_hi = clean_title_hi;
    if (content !== undefined) sectionDoc.content = content;
    else if (introduction_text !== undefined) sectionDoc.content = introduction_text;
    if (content_hi !== undefined) sectionDoc.content_hi = content_hi;
    else if (introduction_text_hi !== undefined) sectionDoc.content_hi = introduction_text_hi;
    if (introduction_text !== undefined) sectionDoc.introduction_text = introduction_text;
    if (introduction_text_hi !== undefined) sectionDoc.introduction_text_hi = introduction_text_hi;
    await sectionDoc.save();
  }

  // 2. Update embedded section outline in BareAct chapters
  let actUpdated = false;
  const targetSecNum = secNum || (sectionDoc ? sectionDoc.section_number : sectionId);

  for (const chapter of act.chapters) {
    const section: any = chapter.sections.find((s: any) =>
      (s._id && s._id.toString() === sectionId) ||
      (s.section_number && s.section_number.toString() === targetSecNum)
    );
    if (section) {
      if (title !== undefined) section.title = title;
      if (clean_title !== undefined) section.clean_title = clean_title;
      if (title_hi !== undefined) section.title_hi = title_hi;
      if (clean_title_hi !== undefined) section.clean_title_hi = clean_title_hi;
      if (content !== undefined) section.content = content;
      if (content_hi !== undefined) section.content_hi = content_hi;
      if (introduction_text !== undefined) section.introduction_text = introduction_text;
      if (introduction_text_hi !== undefined) section.introduction_text_hi = introduction_text_hi;
      actUpdated = true;
      break;
    }
  }

  if (!sectionDoc && !actUpdated) {
    throw AppError.notFound(`Section ${sectionId} not found in ${shortNameStr}.`);
  }

  if (actUpdated) {
    await act.save();
  }

  await actRegistry.invalidate();
  res.json({ success: true, message: `Section ${targetSecNum} updated successfully.` });
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
  await actRegistry.invalidate();
  res.json({ success: true, message: `Act metadata updated.`, data: { actName: act.actName, shortName: act.shortName, year: act.year, description: act.description } });
}));

// DELETE an act entirely (irreversible)
router.delete('/acts/:shortName', asyncHandler(async (req: Request, res: Response) => {
  const shortName = String(req.params['shortName']);
  const registryEntry = actRegistry.resolveAct(shortName);

  let act;
  if (registryEntry) {
    act = await BareAct.findByIdAndDelete(registryEntry._id);
  } else {
    const safeShortName = escapeRegExp(shortName);
    act = await BareAct.findOneAndDelete({ shortName: new RegExp(`^${safeShortName}$`, 'i') });
  }

  if (!act) {
    throw AppError.notFound(`Act ${shortName} not found.`);
  }

  // Also cleanup sections for this act
  await SectionModel.deleteMany({ actShortName: act.shortName });

  await actRegistry.invalidate();

  res.json({ success: true, message: `Act '${act.actName}' (${shortName}) has been permanently deleted.` });
}));

// GET /favorites - Get user favorited act shortNames
router.get('/favorites', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: actRegistry.getFavorites() });
}));

// POST /favorites/toggle - Toggle favorite pin status for an act
router.post('/favorites/toggle', asyncHandler(async (req: Request, res: Response) => {
  const { shortName } = req.body;
  if (!shortName) {
    throw AppError.badRequest('shortName is required.');
  }
  const result = actRegistry.toggleFavorite(shortName);
  res.json({ success: true, message: result.isFavorite ? `Pinned '${shortName}' to favorites.` : `Unpinned '${shortName}' from favorites.`, ...result });
}));

// GET /acts/:shortName/pinned-sections - Get pinned sections for an act
router.get('/acts/:shortName/pinned-sections', asyncHandler(async (req: Request, res: Response) => {
  const shortName = String(req.params['shortName']);
  const pinnedSections = actRegistry.getPinnedSections(shortName);
  res.json({ success: true, data: pinnedSections });
}));

// POST /acts/:shortName/pinned-sections/toggle - Toggle pinned status for a section in an act
router.post('/acts/:shortName/pinned-sections/toggle', asyncHandler(async (req: Request, res: Response) => {
  const shortName = String(req.params['shortName']);
  const { sectionId } = req.body;
  if (!sectionId) {
    throw AppError.badRequest('sectionId is required.');
  }
  const result = actRegistry.togglePinnedSection(shortName, String(sectionId));
  res.json({
    success: true,
    message: result.isPinned ? `Pinned Section § ${sectionId} to dossier.` : `Unpinned Section § ${sectionId}.`,
    ...result
  });
}));

// POST /acts/:shortName/pinned-sections/sync - Bulk sync local pinned sections to backend
router.post('/acts/:shortName/pinned-sections/sync', asyncHandler(async (req: Request, res: Response) => {
  const shortName = String(req.params['shortName']);
  const { sectionIds } = req.body;
  const result = actRegistry.syncPinnedSections(shortName, Array.isArray(sectionIds) ? sectionIds : []);
  res.json({
    success: true,
    message: 'Pinned sections synced successfully with cloud.',
    ...result
  });
}));

// POST /ai/translate-section - High-precision Hindi translation for statutory sections
router.post('/ai/translate-section', asyncHandler(async (req: Request, res: Response) => {
  const { actName, shortName, section_number, title, introduction_text } = req.body;

  if (!introduction_text && !title) {
    throw AppError.badRequest('English title or introduction_text is required to translate.');
  }

  const result = await AiService.translateSectionToHindi(
    String(actName || shortName || 'Indian Bare Act'),
    String(section_number || ''),
    String(title || ''),
    String(introduction_text || '')
  );

  res.json({ success: true, data: result });
}));

// POST /ai/enhance-section - Proofread and format English statutory section
router.post('/ai/enhance-section', asyncHandler(async (req: Request, res: Response) => {
  const { actName, shortName, section_number, title, introduction_text } = req.body;

  if (!introduction_text && !title) {
    throw AppError.badRequest('English title or introduction_text is required to enhance.');
  }

  const result = await AiService.enhanceSectionEnglish(
    String(actName || shortName || 'Indian Bare Act'),
    String(section_number || ''),
    String(title || ''),
    String(introduction_text || '')
  );

  res.json({ success: true, data: result });
}));

export default router;