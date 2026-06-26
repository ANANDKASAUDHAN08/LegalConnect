import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import Draft from '../models/Draft';
import CustomTemplate from '../models/CustomTemplate';

const router = Router();

// --- DRAFTS CRUD ENDPOINTS ---

// GET /api/legal/drafts - Retrieve all drafts for the authenticated user
router.get('/drafts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const drafts = await Draft.find({ userId: req.userId }).sort({ updatedAt: -1 });
    // Convert to client-friendly format
    const formattedDrafts = drafts.map(d => ({
      id: d.draftId,
      templateId: d.templateId,
      title: d.title,
      values: Object.fromEntries(d.values || new Map()),
      customBody: d.customBody,
      updatedAt: d.updatedAt.toISOString()
    }));
    return res.json({ success: true, count: formattedDrafts.length, data: formattedDrafts });
  } catch (error: any) {
    console.error('Error fetching drafts:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/legal/drafts - Save or update a draft (upsert by client draftId + userId)
router.post('/drafts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, templateId, title, values, customBody } = req.body;

    if (!id || !templateId || !title) {
      return res.status(400).json({ success: false, message: 'id, templateId, and title are required in request body.' });
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
    );

    return res.json({
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
  } catch (error: any) {
    console.error('Error saving draft:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/legal/drafts/:draftId - Delete a specific draft
router.delete('/drafts/:draftId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { draftId } = req.params;
    const result = await Draft.findOneAndDelete({ draftId, userId: req.userId });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Draft not found or unauthorized.' });
    }

    return res.json({ success: true, message: 'Draft deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting draft:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/legal/drafts - Wipe all drafts for the user
router.delete('/drafts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await Draft.deleteMany({ userId: req.userId });
    return res.json({ success: true, message: 'All drafts deleted successfully.' });
  } catch (error: any) {
    console.error('Error wiping drafts:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});


// --- CUSTOM TEMPLATES CRUD ENDPOINTS ---

// GET /api/legal/templates - Retrieve all custom templates for the authenticated user
router.get('/templates', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const templates = await CustomTemplate.find({ userId: req.userId }).sort({ createdAt: -1 });
    // Convert to client-friendly format
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
  } catch (error: any) {
    console.error('Error fetching custom templates:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/legal/templates - Save or update a custom template (upsert by client templateId + userId)
router.post('/templates', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, title, actRef, category, description, fields, body } = req.body;

    if (!id || !title || !body) {
      return res.status(400).json({ success: false, message: 'id, title, and body are required in request body.' });
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
    );

    return res.json({
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
  } catch (error: any) {
    console.error('Error saving custom template:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/legal/templates/:templateId - Delete a custom template
router.delete('/templates/:templateId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { templateId } = req.params;
    const result = await CustomTemplate.findOneAndDelete({ templateId, userId: req.userId });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Custom template not found or unauthorized.' });
    }

    return res.json({ success: true, message: 'Custom template deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting custom template:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;