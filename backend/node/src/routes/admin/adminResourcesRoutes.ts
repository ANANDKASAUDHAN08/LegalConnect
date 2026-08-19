import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import LegalResource from '../../models/LegalResource';

const router = Router();

// GET all legal resources with advanced filtering, search, and pagination
router.get('/resources', asyncHandler(async (req: Request, res: Response) => {
  const {
    status,
    state,
    district,
    city,
    type,
    jurisdictionLevel,
    facility,
    search,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = '1',
    limit = '10'
  } = req.query;

  const filter: any = {};

  if (status) filter.status = status;
  if (state && state !== 'All') {
    filter.state = { $regex: new RegExp(`^${(state as string).trim()}$`, 'i') };
  }
  if (district && district !== 'All') {
    filter.district = { $regex: new RegExp((district as string).trim(), 'i') };
  }
  if (city && city !== 'All') {
    filter.city = { $regex: new RegExp((city as string).trim(), 'i') };
  }
  if (type && type !== 'All') {
    filter.type = type;
  }
  if (jurisdictionLevel && jurisdictionLevel !== 'All') {
    filter.jurisdictionLevel = jurisdictionLevel;
  }

  // Date range filter
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate as string);
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  // Facility flags filtering
  if (facility) {
    if (facility === 'hasEfiling') filter['facilities.hasEfiling'] = true;
    else if (facility === 'hasLADCS') filter['facilities.hasLADCS'] = true;
    else if (facility === 'hasVCRoom') filter['facilities.hasVCRoom'] = true;
    else if (facility === 'hasLegalAidClinic') filter['facilities.hasLegalAidClinic'] = true;
    else if (facility === 'isWheelchairAccessible') filter['facilities.isWheelchairAccessible'] = true;
  }

  if (search) {
    const q = (search as string).trim();
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: new RegExp(escaped, 'i') } },
      { address: { $regex: new RegExp(escaped, 'i') } },
      { city: { $regex: new RegExp(escaped, 'i') } },
      { state: { $regex: new RegExp(escaped, 'i') } },
      { district: { $regex: new RegExp(escaped, 'i') } },
      { pincode: { $regex: new RegExp(escaped, 'i') } }
    ];
  }

  const pageNum = parseInt(page as string, 10) || 1;
  const limitNum = parseInt(limit as string, 10) || 10;
  const skip = (pageNum - 1) * limitNum;

  // Sorting
  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const sortOptions: any = {};
  const sortField = (sortBy as string) || 'createdAt';
  sortOptions[sortField] = sortDirection;

  const [
    resources,
    total,
    verifiedCount,
    courtsCount,
    legalAidCount,
    policeCount,
    efilingCount,
    ladcsCount,
    pendingCount,
    uniqueStates
  ] = await Promise.all([
    LegalResource.find(filter).sort(sortOptions).skip(skip).limit(limitNum).lean(),
    LegalResource.countDocuments(filter),
    LegalResource.countDocuments({ $or: [{ isVerified: true }, { status: 'approved' }] }),
    LegalResource.countDocuments({ type: 'Court' }),
    LegalResource.countDocuments({ type: 'LegalAid' }),
    LegalResource.countDocuments({ type: 'PoliceStation' }),
    LegalResource.countDocuments({ 'facilities.hasEfiling': true }),
    LegalResource.countDocuments({ 'facilities.hasLADCS': true }),
    LegalResource.countDocuments({ status: 'pending' }),
    LegalResource.distinct('state')
  ]);

  res.json({
    success: true,
    data: resources,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum) || 1
    },
    metrics: {
      total,
      verified: verifiedCount,
      courts: courtsCount,
      legalAid: legalAidCount,
      policeStations: policeCount,
      efilingEnabled: efilingCount,
      ladcsActive: ladcsCount,
      pending: pendingCount,
      coveredStatesCount: uniqueStates.filter(Boolean).length
    }
  });
}));

// POST create legal resource
router.post('/resources', asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    type = 'LegalAid',
    categories = ['General'],
    subcategories = [],
    city,
    district,
    state,
    pincode,
    pincodeCoverage = [],
    address,
    alternateAddress,
    contactNumber = [],
    faxNumber = [],
    email = [],
    website,
    operatingHours = '09:30 AM - 05:00 PM (Mon-Sat)',
    lunchBreak = '01:30 PM - 02:00 PM',
    languages = ['English', 'Hindi'],
    coordinates,
    status = 'approved',
    jurisdictionLevel = 'District',
    parentAuthorityId,
    facilities = {},
    executiveChairman,
    memberSecretary,
    patronInChief,
    sclscChairman,
    sclscSecretary,
    sclscAddress,
    additionalStaff = [],
    tags = []
  } = req.body;

  if (!name || !city || !address || !coordinates || coordinates.lat === undefined || coordinates.lng === undefined) {
    throw AppError.badRequest('Required fields: name, city, address, coordinates (lat & lng).');
  }

  const newResource = new LegalResource({
    name,
    type,
    categories,
    subcategories,
    city,
    district: district || city,
    state: state || 'Delhi',
    pincode: pincode || '',
    pincodeCoverage,
    address,
    alternateAddress,
    contactNumber: Array.isArray(contactNumber) ? contactNumber : [contactNumber].filter(Boolean),
    faxNumber: Array.isArray(faxNumber) ? faxNumber : [faxNumber].filter(Boolean),
    email: Array.isArray(email) ? email : [email].filter(Boolean),
    website,
    operatingHours,
    lunchBreak,
    languages,
    coordinates: {
      lat: Number(coordinates.lat) || 28.6139,
      lng: Number(coordinates.lng) || 77.2090
    },
    isVerified: status === 'approved',
    status,
    source: 'admin_dashboard',
    jurisdictionLevel,
    parentAuthorityId,
    facilities: {
      hasEfiling: !!facilities.hasEfiling,
      hasLADCS: !!facilities.hasLADCS,
      hasVCRoom: !!facilities.hasVCRoom,
      hasLegalAidClinic: facilities.hasLegalAidClinic !== undefined ? !!facilities.hasLegalAidClinic : true,
      isWheelchairAccessible: facilities.isWheelchairAccessible !== undefined ? !!facilities.isWheelchairAccessible : true
    },
    executiveChairman,
    memberSecretary,
    patronInChief,
    sclscChairman,
    sclscSecretary,
    sclscAddress,
    additionalStaff,
    tags,
    lastAuditDate: new Date(),
    verificationExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 Year validity
    verifiedByAdmin: req.body.verifiedByAdmin || 'System Administrator',
    auditNotes: 'Initial onboarding inspection completed'
  });

  await newResource.save();
  res.status(201).json({ success: true, message: 'Resource onboarded successfully.', data: newResource });
}));

// POST dry-run validate batch of resources before importing
router.post('/resources/batch-validate', asyncHandler(async (req: Request, res: Response) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    throw AppError.badRequest('Please provide an array of resource records to validate.');
  }

  // Pre-fetch existing names to check for duplicates
  const candidateNames = items.map(i => i.name).filter(Boolean);
  const existingDocs = await LegalResource.find(
    { name: { $in: candidateNames } },
    'name state district city'
  ).lean();

  const existingKeys = new Set(
    existingDocs.map(r => `${r.name.toLowerCase().trim()}_${(r.state || r.district || r.city || '').toLowerCase().trim()}`)
  );
  const existingNamesOnly = new Set(existingDocs.map(r => r.name.toLowerCase().trim()));

  const validatedItems: any[] = [];
  let errorCount = 0;
  let warningCount = 0;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const errors: string[] = [];
    const warnings: string[] = [];
    const validationNotes: string[] = [];

    const name = item.name ? String(item.name).trim() : '';
    const address = item.address ? String(item.address).trim() : '';
    const city = item.city ? String(item.city).trim() : '';
    const state = item.state ? String(item.state).trim() : 'Delhi';
    const district = item.district ? String(item.district).trim() : (city || state);

    if (!name) errors.push('Missing institution name');
    if (!address) errors.push('Missing street / physical address');
    if (!city) errors.push('Missing city');

    // Geo Bounds Validation
    const lat = item.coordinates?.lat !== undefined ? Number(item.coordinates.lat) : (item.lat !== undefined ? Number(item.lat) : NaN);
    const lng = item.coordinates?.lng !== undefined ? Number(item.coordinates.lng) : (item.lng !== undefined ? Number(item.lng) : NaN);

    if (isNaN(lat) || isNaN(lng) || lat < 6 || lat > 38 || lng < 68 || lng > 98) {
      warnings.push(`Coordinates (${isNaN(lat) ? 'N/A' : lat}, ${isNaN(lng) ? 'N/A' : lng}) outside Indian territorial bounds; default assigned`);
    } else {
      validationNotes.push('GPS Coordinates verified in bounds');
    }

    // Postal Code & Contact Validation
    if (item.pincode && !/^\d{6}$/.test(String(item.pincode).trim())) {
      warnings.push(`Postal code "${item.pincode}" is not standard 6-digit Indian PIN`);
    }

    if (item.email) {
      const emailStr = Array.isArray(item.email) ? item.email[0] : String(item.email);
      if (emailStr && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr.trim())) {
        warnings.push(`Official email "${emailStr}" has non-standard format`);
      }
    }

    // Duplicate Detection Key Check
    const nameKey = name.toLowerCase().trim();
    const compositeKey = `${nameKey}_${(state || district || city).toLowerCase().trim()}`;

    if (nameKey && (existingKeys.has(compositeKey) || existingNamesOnly.has(nameKey))) {
      warnings.push('Similar institution already indexed in target jurisdiction');
    }

    if (errors.length === 0 && warnings.length === 0) {
      validationNotes.push('Schema fully compliant & ready for atomic insertion');
    }

    if (errors.length > 0) errorCount++;
    if (warnings.length > 0) warningCount++;

    validatedItems.push({
      index: idx + 1,
      name: name,
      type: item.type || 'Court',
      jurisdictionLevel: item.jurisdictionLevel || 'District',
      city: city,
      state: state,
      district: district,
      address: address,
      pincode: item.pincode ? String(item.pincode).trim() : '',
      lat: (lat !== undefined && !isNaN(lat)) ? lat : undefined,
      lng: (lng !== undefined && !isNaN(lng)) ? lng : undefined,
      contactNumber: item.contactNumber || item.phone || '',
      email: item.email || '',
      website: item.website || '',
      status: errors.length > 0 ? 'INVALID' : (warnings.length > 0 ? 'WARNING' : 'VALID'),
      errors,
      warnings,
      validationNotes
    });
  }

  res.json({
    success: true,
    totalCount: items.length,
    validCount: items.length - errorCount,
    errorCount,
    warningCount,
    items: validatedItems
  });
}));

// POST batch import validated resources with enterprise duplicate strategy resolution
router.post('/resources/batch-import', asyncHandler(async (req: Request, res: Response) => {
  const { items, duplicateStrategy = 'skip' } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    throw AppError.badRequest('Please provide an array of resource records.');
  }

  const startTime = Date.now();
  const batchId = 'BATCH-ETL-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  // Normalize full document schema without hardcoded fallbacks
  const documentsToProcess = items.map(item => {
    const lat = item.lat !== undefined ? Number(item.lat) : (item.coordinates?.lat !== undefined ? Number(item.coordinates.lat) : undefined);
    const lng = item.lng !== undefined ? Number(item.lng) : (item.coordinates?.lng !== undefined ? Number(item.coordinates.lng) : undefined);
    const hasCoordinates = lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng);

    // Normalize phone numbers to string[]
    const phones: string[] = [];
    if (Array.isArray(item.contactNumber)) {
      phones.push(...item.contactNumber.map((p: any) => String(p).trim()).filter(Boolean));
    } else if (item.contactNumber || item.phone) {
      phones.push(...String(item.contactNumber || item.phone).split(/[,;/]/).map(p => p.trim()).filter(Boolean));
    }

    // Normalize email addresses to string[]
    const emails: string[] = [];
    if (Array.isArray(item.email)) {
      emails.push(...item.email.map((e: any) => String(e).trim()).filter(Boolean));
    } else if (item.email) {
      emails.push(...String(item.email).split(/[,;/]/).map(e => e.trim()).filter(Boolean));
    }

    // Map facilities cleanly from payload
    const rawFac = item.facilities || {};
    const facilities = {
      hasEfiling: rawFac.hasEfiling !== undefined ? !!rawFac.hasEfiling : (item.hasEfiling !== undefined ? !!item.hasEfiling : false),
      hasLADCS: rawFac.hasLADCS !== undefined ? !!rawFac.hasLADCS : (item.hasLADCS !== undefined ? !!item.hasLADCS : false),
      hasVCRoom: rawFac.hasVCRoom !== undefined ? !!rawFac.hasVCRoom : (item.hasVCRoom !== undefined ? !!item.hasVCRoom : false),
      hasLegalAidClinic: rawFac.hasLegalAidClinic !== undefined ? !!rawFac.hasLegalAidClinic : (item.hasLegalAidClinic !== undefined ? !!item.hasLegalAidClinic : false),
      isWheelchairAccessible: rawFac.isWheelchairAccessible !== undefined ? !!rawFac.isWheelchairAccessible : (item.isWheelchairAccessible !== undefined ? !!item.isWheelchairAccessible : false)
    };

    const doc: any = {
      name: String(item.name || '').trim(),
      type: item.type || 'Court',
      jurisdictionLevel: item.jurisdictionLevel || 'District',
      categories: Array.isArray(item.categories) && item.categories.length > 0 ? item.categories : ['General'],
      subcategories: Array.isArray(item.subcategories) ? item.subcategories : [],
      city: String(item.city || '').trim(),
      district: String(item.district || item.city || item.state || '').trim(),
      state: String(item.state || '').trim(),
      address: String(item.address || '').trim(),
      pincode: item.pincode ? String(item.pincode).trim() : '',
      contactNumber: phones,
      email: emails,
      website: item.website ? String(item.website).trim() : '',
      operatingHours: item.operatingHours ? String(item.operatingHours).trim() : undefined,
      facilities,
      isVerified: true,
      status: 'approved' as const,
      source: 'batch_import_pipeline',
      lastAuditDate: new Date(),
      verificationExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      verifiedByAdmin: (req as any).user?.name || (req as any).user?.email || 'System Administrator',
      auditNotes: `Imported via ${batchId} with ${duplicateStrategy} strategy`
    };

    if (hasCoordinates) {
      doc.coordinates = { lat: Number(lat), lng: Number(lng) };
    }

    return doc;
  });

  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const failureReasons: string[] = [];

  try {
    if (duplicateStrategy === 'upsert') {
      // Execute MongoDB bulkWrite with upsert
      const bulkOps = documentsToProcess.map(doc => ({
        updateOne: {
          filter: {
            name: { $regex: new RegExp(`^${doc.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            state: { $regex: new RegExp(`^${doc.state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          },
          update: { $set: doc },
          upsert: true
        }
      }));

      const bulkRes = await (LegalResource as any).bulkWrite(bulkOps as any[], { ordered: false });
      importedCount = bulkRes.upsertedCount || 0;
      updatedCount = bulkRes.modifiedCount || 0;
    } else if (duplicateStrategy === 'skip') {
      // Find matching institutions and filter them out
      const existing = await LegalResource.find(
        { name: { $in: documentsToProcess.map(d => d.name) } },
        'name state'
      ).lean();

      const existingSet = new Set(
        existing.map(e => `${e.name.toLowerCase().trim()}_${(e.state || '').toLowerCase().trim()}`)
      );

      const nonDuplicates = documentsToProcess.filter(
        d => !existingSet.has(`${d.name.toLowerCase().trim()}_${(d.state || '').toLowerCase().trim()}`)
      );

      skippedCount = documentsToProcess.length - nonDuplicates.length;

      if (nonDuplicates.length > 0) {
        const insertRes = await LegalResource.insertMany(nonDuplicates, { ordered: false });
        importedCount = insertRes.length;
      }
    } else {
      // 'new' strategy: Ingest all as independent documents
      const insertRes = await LegalResource.insertMany(documentsToProcess, { ordered: false });
      importedCount = insertRes.length;
    }
  } catch (err: any) {
    // Graceful error recovery for MongoDB BulkWrite errors
    if (err.name === 'MongoBulkWriteError' || err.name === 'BulkWriteError') {
      importedCount = err.result?.nInserted || err.insertedDocs?.length || 0;
      failedCount = (err.writeErrors?.length || 0);
      if (err.writeErrors && err.writeErrors.length > 0) {
        failureReasons.push(...err.writeErrors.slice(0, 5).map((we: any) => `Row index ${we.index}: ${we.errmsg}`));
      }
    } else {
      throw err;
    }
  }

  const durationMs = Date.now() - startTime;

  res.json({
    success: true,
    message: `Batch Pipeline completed. ${importedCount} created, ${updatedCount} updated, ${skippedCount} skipped in ${durationMs}ms.`,
    batchId,
    importedCount,
    updatedCount,
    skippedCount,
    failedCount,
    durationMs,
    timestamp: new Date()
  });
}));

// PATCH update verification audit cycle
router.patch('/resources/:id/verify-cycle', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { notes = 'Annual institutional roster re-verification completed', verifiedBy = 'Administrator' } = req.body;

  const resource = await LegalResource.findById(id);
  if (!resource) {
    throw AppError.notFound('Legal resource not found.');
  }

  resource.isVerified = true;
  resource.status = 'approved';
  resource.lastAuditDate = new Date();
  resource.verificationExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // +1 Year
  resource.verifiedByAdmin = verifiedBy;
  resource.auditNotes = notes;
  await resource.save();

  res.json({
    success: true,
    message: `Verification cycle updated for "${resource.name}". Valid for 12 months.`,
    data: resource
  });
}));

// PUT update legal resource
router.put('/resources/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = { ...req.body, lastAuditDate: new Date() };

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

// POST bulk status update (approved, pending, suspended)
router.post('/resources/bulk-status', asyncHandler(async (req: Request, res: Response) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw AppError.badRequest('Please provide an array of resource IDs.');
  }

  const isVerified = status === 'approved';
  const result = await LegalResource.updateMany(
    { _id: { $in: ids } },
    { $set: { status, isVerified, lastAuditDate: new Date() } }
  );

  res.json({
    success: true,
    message: `Updated status for ${result.modifiedCount} institutional record(s).`,
    modifiedCount: result.modifiedCount
  });
}));

// POST bulk verification cycle renewal (+12 months)
router.post('/resources/bulk-verify', asyncHandler(async (req: Request, res: Response) => {
  const { ids, notes = 'Bulk annual compliance re-verification completed by Judicial Registry Admin' } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw AppError.badRequest('Please provide an array of resource IDs.');
  }

  const result = await LegalResource.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        isVerified: true,
        status: 'approved',
        lastAuditDate: new Date(),
        verificationExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        verifiedByAdmin: 'Judicial Registry Admin',
        auditNotes: notes
      }
    }
  );

  res.json({
    success: true,
    message: `Renewed verification cycle for ${result.modifiedCount} institutional record(s).`,
    modifiedCount: result.modifiedCount
  });
}));

// POST bulk delete resources
router.post('/resources/bulk-delete', asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw AppError.badRequest('Please provide an array of resource IDs to delete.');
  }

  const result = await LegalResource.deleteMany({ _id: { $in: ids } });

  res.json({
    success: true,
    message: `Deleted ${result.deletedCount} institutional record(s) from registry.`,
    deletedCount: result.deletedCount
  });
}));

export default router;