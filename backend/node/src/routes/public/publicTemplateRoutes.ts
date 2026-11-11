import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../../middlewares/auth';
import Draft from '../../models/Draft';
import CustomTemplate from '../../models/CustomTemplate';
import LegalTemplateModel from '../../models/LegalTemplate';

const router = Router();

// --- DRAFTS CRUD ENDPOINTS (Protected) ---

// GET /api/legal/drafts - Retrieve all drafts for the authenticated user
router.get('/drafts', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const drafts = await Draft.find({ userId: req.userId }).sort({ updatedAt: -1 }).lean();
  const formattedDrafts = drafts.map(d => ({
    id: d.draftId,
    templateId: d.templateId,
    title: d.title,
    values: Object.fromEntries(d.values || new Map()),
    customBody: d.customBody,
    updatedAt: d.updatedAt.toISOString()
  }));
  res.json({ success: true, count: formattedDrafts.length, data: formattedDrafts });
}));

// POST /api/legal/drafts - Save or update a draft
router.post('/drafts', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id, templateId, title, values, customBody } = req.body;

  if (!id || !templateId || !title) {
    throw AppError.badRequest('id, templateId, and title are required in request body.');
  }

  const draft = await Draft.findOneAndUpdate(
    { draftId: id, userId: req.userId },
    {
      templateId,
      title,
      values: new Map(Object.entries(values || {})),
      customBody,
      updatedAt: new Date()
    },
    { upsert: true, returnDocument: 'after' }
  ).lean();

  res.json({
    success: true,
    message: 'Draft saved successfully.',
    data: {
      id: draft.draftId,
      templateId: draft.templateId,
      title: draft.title,
      values: Object.fromEntries(draft.values),
      customBody: draft.customBody,
      updatedAt: draft.updatedAt.toISOString()
    }
  });
}));

// DELETE /api/legal/drafts/:draftId - Delete a specific draft
router.delete('/drafts/:draftId', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { draftId } = req.params;
  const result = await Draft.findOneAndDelete({ draftId, userId: req.userId }).lean();

  if (!result) {
    throw AppError.notFound('Draft not found or unauthorized.');
  }

  res.json({ success: true, message: 'Draft deleted successfully.' });
}));

// DELETE /api/legal/drafts - Wipe all drafts for the user
router.delete('/drafts', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await Draft.deleteMany({ userId: req.userId });
  res.json({ success: true, message: 'All drafts deleted successfully.' });
}));

// --- SYSTEM & CUSTOM LEGAL TEMPLATES ENDPOINTS ---

// GET /api/legal/templates - Retrieve all published system templates + user custom templates
router.get('/templates', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { category, search, q } = req.query;
  const keyword = (search || q) as string;

  // 1. Fetch published standard system templates from MongoDB
  const systemFilter: any = { isPublished: true };
  if (category && category !== 'all') {
    systemFilter.category = category;
  }
  if (keyword) {
    systemFilter.$or = [
      { title: { $regex: keyword, $options: 'i' } },
      { description: { $regex: keyword, $options: 'i' } },
      { actRef: { $regex: keyword, $options: 'i' } }
    ];
  }

  const systemTemplates = await LegalTemplateModel.find(systemFilter)
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  const formattedSystem = systemTemplates.map(t => ({
    id: t.templateId,
    title: t.title,
    actRef: t.actRef,
    category: t.category,
    description: t.description,
    fields: t.fields.map(f => ({
      key: f.key,
      label: f.label,
      placeholder: f.placeholder,
      type: f.type,
      defaultValue: f.defaultValue,
      helpTip: f.helpTip
    })),
    body: t.body,
    isCustom: false,
    sortOrder: t.sortOrder,
    downloadsCount: t.downloadsCount || 0
  }));

  // 2. Fetch authenticated user's custom templates
  let formattedCustom: any[] = [];
  if (req.userId) {
    try {
      const customFilter: any = { userId: req.userId };
      if (category && category !== 'all') {
        customFilter.category = category;
      }
      if (keyword) {
        customFilter.$or = [
          { title: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } },
          { actRef: { $regex: keyword, $options: 'i' } }
        ];
      }
      const templates = await CustomTemplate.find(customFilter).sort({ createdAt: -1 }).lean();
      formattedCustom = templates.map(t => ({
        id: t.templateId,
        title: t.title,
        actRef: t.actRef,
        category: t.category,
        description: t.description,
        fields: t.fields.map(f => ({
          key: f.key,
          label: f.label,
          placeholder: f.placeholder,
          type: f.type,
          defaultValue: f.defaultValue,
          helpTip: f.helpTip
        })),
        body: t.body,
        isCustom: true
      }));
    } catch (e) {
      // Non-fatal if custom templates query errors
    }
  }

  const allTemplates = [...formattedSystem, ...formattedCustom];

  // Modern HTTP caching: client/CDN can cache for 2 mins, stale-while-revalidate for 24h
  res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=86400');
  res.json({
    success: true,
    count: allTemplates.length,
    systemCount: formattedSystem.length,
    customCount: formattedCustom.length,
    data: allTemplates
  });
}));

// GET /api/legal/templates/:templateId - Fetch single template by ID
router.get('/templates/:templateId', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { templateId } = req.params;

  // Check system template first
  const system = await LegalTemplateModel.findOne({ templateId, isPublished: true }).lean();
  if (system) {
    return res.json({
      success: true,
      data: {
        id: system.templateId,
        title: system.title,
        actRef: system.actRef,
        category: system.category,
        description: system.description,
        fields: system.fields,
        body: system.body,
        isCustom: false,
        sortOrder: system.sortOrder,
        downloadsCount: system.downloadsCount || 0
      }
    });
  }

  // Check user custom template
  if (req.userId) {
    const custom = await CustomTemplate.findOne({ templateId, userId: req.userId }).lean();
    if (custom) {
      return res.json({
        success: true,
        data: {
          id: custom.templateId,
          title: custom.title,
          actRef: custom.actRef,
          category: custom.category,
          description: custom.description,
          fields: custom.fields,
          body: custom.body,
          isCustom: true
        }
      });
    }
  }

  throw AppError.notFound(`Legal template '${templateId}' not found.`);
}));

// POST /api/legal/templates/:templateId/download - Track template download count
router.post('/templates/:templateId/download', asyncHandler(async (req: Request, res: Response) => {
  const { templateId } = req.params;
  await LegalTemplateModel.updateOne({ templateId }, { $inc: { downloadsCount: 1 } });
  res.json({ success: true, message: 'Template usage recorded.' });
}));

// POST /api/legal/templates - Save or update a custom template (Protected)
router.post('/templates', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id, title, actRef, category, description, fields, body } = req.body;

  if (!id || !title || !body) {
    throw AppError.badRequest('id, title, and body are required in request body.');
  }

  const template = await CustomTemplate.findOneAndUpdate(
    { templateId: id, userId: req.userId },
    {
      title,
      actRef: actRef || 'Custom Template',
      category: category || 'commercial',
      description,
      fields: fields || [],
      body,
      updatedAt: new Date()
    },
    { upsert: true, returnDocument: 'after' }
  ).lean();

  res.json({
    success: true,
    message: 'Custom template saved successfully.',
    data: {
      id: template.templateId,
      title: template.title,
      actRef: template.actRef,
      category: template.category,
      description: template.description,
      fields: template.fields.map(f => ({
        key: f.key,
        label: f.label,
        placeholder: f.placeholder,
        type: f.type,
        defaultValue: f.defaultValue,
        helpTip: f.helpTip
      })),
      body: template.body,
      isCustom: true
    }
  });
}));

// DELETE /api/legal/templates/:templateId - Delete a custom template (Protected)
router.delete('/templates/:templateId', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { templateId } = req.params;
  const result = await CustomTemplate.findOneAndDelete({ templateId, userId: req.userId }).lean();

  if (!result) {
    throw AppError.notFound('Custom template not found or unauthorized.');
  }

  res.json({ success: true, message: 'Custom template deleted successfully.' });
}));

export default router;