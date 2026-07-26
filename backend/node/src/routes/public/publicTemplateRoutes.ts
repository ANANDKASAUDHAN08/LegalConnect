import { Router, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import { requireAuth, AuthenticatedRequest } from '../../middlewares/auth';
import Draft from '../../models/Draft';
import CustomTemplate from '../../models/CustomTemplate';

const router = Router();

const defaultPublicTemplates = [
  { id: 'tmpl-1', title: 'RERA Delay Complaint Draft', category: 'Property', downloads: 1420 },
  { id: 'tmpl-2', title: 'Mutual Consent Divorce Petition Format', category: 'Family', downloads: 980 },
  { id: 'tmpl-3', title: 'Unpaid Salary Legal Notice Draft', category: 'Labour', downloads: 2150 },
  { id: 'tmpl-4', title: 'e-Daakhil Consumer Complaint Draft', category: 'Consumer', downloads: 1840 }
];

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
    { upsert: true, new: true }
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

// --- CUSTOM & PUBLIC TEMPLATES CRUD ENDPOINTS ---

// GET /api/legal/templates - Retrieve templates (custom if authenticated, public default if not)
router.get('/templates', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // If authorization header is provided, fetch custom templates for user
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      requireAuth(req, res, () => { });
      if (req.userId) {
        const templates = await CustomTemplate.find({ userId: req.userId }).sort({ createdAt: -1 }).lean();
        const formattedTemplates = templates.map(t => ({
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
        return res.json({ success: true, count: formattedTemplates.length, data: formattedTemplates });
      }
    } catch (e) {
      // Fallback to public default templates
    }
  }

  res.json({ success: true, count: defaultPublicTemplates.length, data: defaultPublicTemplates });
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
    { upsert: true, new: true }
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