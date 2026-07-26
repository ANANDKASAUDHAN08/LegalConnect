import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import LegalResource from '../../models/LegalResource';
import {
  createResource,
  updateResource,
  deleteResource
} from '../../services/resourceService';

const router = Router();

// GET all legal resources with advanced filtering, search, and pagination
router.get('/resources', asyncHandler(async (req: Request, res: Response) => {
  const { status, city, type, search, page = '1', limit = '10' } = req.query;
  const filter: any = {};

  if (status) filter.status = status;
  if (city) filter.city = { $regex: new RegExp(city as string, 'i') };
  if (type) filter.type = type;
  if (search) {
    filter.$or = [
      { name: { $regex: new RegExp(search as string, 'i') } },
      { address: { $regex: new RegExp(search as string, 'i') } }
    ];
  }

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const [resources, total, verifiedCount, courtsCount, pendingCount] = await Promise.all([
    LegalResource.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    LegalResource.countDocuments(filter),
    LegalResource.countDocuments({ $or: [{ isVerified: true }, { status: 'approved' }] }),
    LegalResource.countDocuments({ type: 'Court' }),
    LegalResource.countDocuments({ status: 'pending' })
  ]);

  res.json({
    success: true,
    data: resources,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    },
    metrics: {
      total,
      verified: verifiedCount,
      courts: courtsCount,
      pending: pendingCount
    }
  });
}));

// POST create legal resource
router.post('/resources', asyncHandler(async (req: Request, res: Response) => {
  const { name, type, categories, subcategories, city, state, address, contactNumber, website, languages, coordinates, status } = req.body;
  if (!name || !type || !city || !address || !coordinates || !coordinates.lat || !coordinates.lng) {
    throw AppError.badRequest('Required fields: name, type, city, address, coordinates.');
  }

  const newResource = new LegalResource({
    name,
    type,
    categories: categories || ['General'],
    subcategories: subcategories || [],
    city,
    state,
    address,
    contactNumber,
    website,
    languages: languages || ['English', 'Hindi'],
    coordinates,
    isVerified: true,
    status: status || 'approved',
    source: 'admin_dashboard'
  });

  await newResource.save();
  res.status(201).json({ success: true, message: 'Resource created successfully.', data: newResource });
}));

// PUT update legal resource
router.put('/resources/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  const resource = await LegalResource.findById(id);
  if (!resource) {
    throw AppError.notFound('Resource not found.');
  }

  if (updates.status === 'approved') {
    updates.isVerified = true;
  }

  const updatedResource = await LegalResource.findByIdAndUpdate(id, updates, { new: true });
  res.json({ success: true, message: 'Resource updated successfully.', data: updatedResource });
}));

// DELETE legal resource
router.delete('/resources/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const resource = await LegalResource.findByIdAndDelete(id);
  if (!resource) {
    throw AppError.notFound('Resource not found.');
  }
  res.json({ success: true, message: 'Resource deleted successfully.' });
}));

export default router;