import { Router, Request, Response } from 'express';
import CustomTemplate from '../../models/CustomTemplate';
import Draft from '../../models/Draft';

const router = Router();

// GET /api/legal/admin/templates/stats - Aggregate Template & Draft metrics
router.get('/templates/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const totalTemplates = await CustomTemplate.countDocuments();
    const totalDrafts = await Draft.countDocuments();

    // Group templates by category
    const categoryStats = await CustomTemplate.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Group templates by actRef
    const actStats = await CustomTemplate.aggregate([
      { $group: { _id: '$actRef', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]);

    // Popular templates by draft usage count
    const popularTemplates = await Draft.aggregate([
      { $group: { _id: '$templateId', draftCount: { $sum: 1 } } },
      { $sort: { draftCount: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        totalTemplates,
        totalDrafts,
        categoryStats,
        actStats,
        popularTemplates
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/legal/admin/templates - List custom templates with search and filters
router.get('/templates', async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, category, page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const filter: any = {};
    if (category) {
      filter.category = category;
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { actRef: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await CustomTemplate.countDocuments(filter);
    const templates = await CustomTemplate.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      data: templates,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/legal/admin/templates/:id - Moderate/Delete custom template
router.get('/templates/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const template = await CustomTemplate.findById(req.params.id);
    if (!template) {
      res.status(404).json({ success: false, message: 'Template not found' });
      return;
    }
    res.json({ success: true, data: template });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/templates/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await CustomTemplate.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Template not found for deletion' });
      return;
    }
    res.json({ success: true, message: `Template "${deleted.title}" deleted successfully by admin.` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;