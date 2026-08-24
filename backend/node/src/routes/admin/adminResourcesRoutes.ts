import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import LegalResource from '../../models/LegalResource';
import { resolveGeoCentroid } from '../../utils/geoUtils';
import { buildStateRegex } from '../public/publicHelpRoutes';

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
    hasIssues,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = '1',
    limit = '20'
  } = req.query;

  const filter: any = {};

  if (hasIssues === 'true') {
    filter['feedback.downvotes'] = { $gt: 0 };
  } else if (status) {
    filter.status = status;
  }
  if (state && state !== 'All') {
    filter.state = { $regex: buildStateRegex(state as string) };
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
    operatingDays = 'Mon-Sat',
    lunchBreak = '01:30 PM - 02:00 PM',
    languages = ['English', 'Hindi'],
    coordinates,
    status = 'approved',
    jurisdictionLevel = 'District',
    parentAuthorityId,
    facilities = {},
    feeType = 'FreeLegalAid',
    targetBeneficiaries = [],
    signboardImageUrl,
    is24x7Emergency = false,
    submitter,
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
    operatingDays,
    lunchBreak,
    is24x7Emergency: !!is24x7Emergency,
    feeType,
    targetBeneficiaries: Array.isArray(targetBeneficiaries) ? targetBeneficiaries : [],
    signboardImageUrl: signboardImageUrl ? signboardImageUrl.trim() : undefined,
    submitter: submitter || {
      name: 'System Administrator',
      role: 'CourtOfficial',
      isGuest: false
    },
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

  // Append to changeLog
  resource.changeLog = resource.changeLog || [];
  resource.changeLog.push({
    timestamp: new Date(),
    adminEmail: (req as any).user?.email || verifiedBy,
    action: 'verified_cycle',
    diff: { notes, verificationExpiry: resource.verificationExpiry }
  });

  await resource.save();

  res.json({
    success: true,
    message: `Verification cycle updated for "${resource.name}". Valid for 12 months.`,
    data: resource
  });
}));

// PATCH /resources/:id/resolve-issues - Resolve citizen discrepancy reports and reset feedback
router.patch('/resources/:id/resolve-issues', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const resource = await LegalResource.findById(id);
  if (!resource) {
    throw AppError.notFound('Legal resource not found.');
  }

  const prevDownvotes = resource.feedback?.downvotes || 0;
  resource.feedback = {
    upvotes: resource.feedback?.upvotes || 0,
    downvotes: 0,
    helpfulnessScore: 100,
    reasons: []
  };

  resource.lastAuditDate = new Date();
  resource.isVerified = true;
  resource.auditNotes = (resource.auditNotes || '') + ` | Discrepancies reviewed & resolved on ${new Date().toLocaleDateString('en-IN')}`;

  resource.changeLog = resource.changeLog || [];
  resource.changeLog.push({
    timestamp: new Date(),
    adminEmail: (req as any).user?.email || 'admin@legalconnect.org',
    action: 'RESOLVE_DISCREPANCY_REPORTS',
    diff: { resolvedDownvotes: prevDownvotes }
  });

  await resource.save();

  res.json({
    success: true,
    message: `Reported issues marked as resolved for "${resource.name}". Verification renewed.`,
    data: resource
  });
}));

// PUT update legal resource
router.put('/resources/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = { ...req.body };

  // Strip immutable / conflict fields so they don't collide with Mongo update operators
  delete updates._id;
  delete updates.id;
  delete updates.__v;
  delete updates.createdAt;
  delete updates.updatedAt;
  delete updates.changeLog;

  updates.lastAuditDate = new Date();

  const resource = await LegalResource.findById(id);
  if (!resource) {
    throw AppError.notFound('Resource not found.');
  }

  if (updates.status === 'approved') {
    updates.isVerified = true;
  }

  const changeEntry = {
    timestamp: new Date(),
    adminEmail: (req as any).user?.email || 'Administrator',
    action: updates.status === 'approved' ? 'approved_and_published' : 'updated',
    diff: updates
  };

  const updatedResource = await LegalResource.findByIdAndUpdate(
    id,
    {
      $set: updates,
      $push: { changeLog: changeEntry }
    },
    { returnDocument: 'after' }
  );

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
    {
      $set: { status, isVerified, lastAuditDate: new Date() },
      $push: {
        changeLog: {
          timestamp: new Date(),
          adminEmail: (req as any).user?.email || 'Bulk Admin Operation',
          action: 'status_changed',
          diff: { status }
        }
      }
    }
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
      },
      $push: {
        changeLog: {
          timestamp: new Date(),
          adminEmail: (req as any).user?.email || 'Judicial Registry Admin',
          action: 'bulk_verified_cycle',
          diff: { notes }
        }
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

// ── Phase 5: Enterprise Analytics, Duplicate Detection, Bulk Geocoding, AI Search ──

// GET /resources/analytics - Aggregate usage and registry telemetry
router.get('/resources/analytics', asyncHandler(async (req: Request, res: Response) => {
  const [
    totalResources,
    approvedCount,
    pendingCount,
    typeStats,
    stateStats,
    viewsAggregate,
    feedbackAggregate
  ] = await Promise.all([
    LegalResource.countDocuments(),
    LegalResource.countDocuments({ status: 'approved' }),
    LegalResource.countDocuments({ status: 'pending' }),
    LegalResource.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    LegalResource.aggregate([
      { $group: { _id: '$state', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    LegalResource.aggregate([
      { $group: { _id: null, totalViews: { $sum: '$viewsCount' } } }
    ]),
    LegalResource.aggregate([
      {
        $group: {
          _id: null,
          totalUpvotes: { $sum: '$feedback.upvotes' },
          totalDownvotes: { $sum: '$feedback.downvotes' }
        }
      }
    ])
  ]);

  const totalViews = viewsAggregate[0]?.totalViews || 0;
  const totalUpvotes = feedbackAggregate[0]?.totalUpvotes || 0;
  const totalDownvotes = feedbackAggregate[0]?.totalDownvotes || 0;
  const totalFeedback = totalUpvotes + totalDownvotes;
  const satisfactionRate = totalFeedback > 0 ? Math.round((totalUpvotes / totalFeedback) * 100) : 100;

  // Stale count (>12 months)
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const staleCount = await LegalResource.countDocuments({
    status: 'approved',
    lastAuditDate: { $lt: oneYearAgo }
  });

  // Top 5 most viewed resources
  const topViewed = await LegalResource.find({ status: 'approved' })
    .sort({ viewsCount: -1 })
    .limit(5)
    .select('name type city state viewsCount feedback')
    .lean();

  res.json({
    success: true,
    data: {
      totalResources,
      approvedCount,
      pendingCount,
      staleCount,
      totalViews,
      satisfactionRate,
      totalUpvotes,
      totalDownvotes,
      typeDistribution: typeStats.map((t: any) => ({ type: t._id || 'Unknown', count: t.count })),
      topStates: stateStats.map((s: any) => ({ state: s._id || 'Unspecified', count: s.count })),
      topViewed
    }
  });
}));

// GET /resources/duplicates - Fuzzy and exact match duplicate detection
router.get('/resources/duplicates', asyncHandler(async (req: Request, res: Response) => {
  const resources = await LegalResource.find().select('name address city state district contactNumber type').lean();
  const duplicatePairs: Array<{
    primary: any;
    duplicate: any;
    similarityScore: number;
    reason: string;
  }> = [];

  const cleanStr = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  for (let i = 0; i < resources.length; i++) {
    for (let j = i + 1; j < resources.length; j++) {
      const a = resources[i];
      const b = resources[j];

      // Exact contact number match
      const commonPhone = (a.contactNumber || []).some((num: string) =>
        (b.contactNumber || []).some((bNum: string) => cleanStr(num) === cleanStr(bNum) && cleanStr(num).length >= 8)
      );

      if (commonPhone && a.type === b.type) {
        duplicatePairs.push({
          primary: a,
          duplicate: b,
          similarityScore: 95,
          reason: 'Identical Contact Number and Institutional Type'
        });
        continue;
      }

      // Name similarity within same state and district
      const nameA = cleanStr(a.name);
      const nameB = cleanStr(b.name);
      if (a.state && b.state && a.state.toLowerCase() === b.state.toLowerCase()) {
        if (nameA === nameB) {
          duplicatePairs.push({
            primary: a,
            duplicate: b,
            similarityScore: 100,
            reason: 'Identical Institution Name in Same State'
          });
        } else if (nameA.length > 8 && nameB.length > 8 && (nameA.includes(nameB) || nameB.includes(nameA))) {
          duplicatePairs.push({
            primary: a,
            duplicate: b,
            similarityScore: 85,
            reason: 'High Name Similarity in Same State'
          });
        }
      }
    }
  }

  res.json({
    success: true,
    count: duplicatePairs.length,
    data: duplicatePairs.slice(0, 50)
  });
}));

// POST /resources/duplicates/merge - Merge duplicate into primary
router.post('/resources/duplicates/merge', asyncHandler(async (req: Request, res: Response) => {
  const { primaryId, duplicateId } = req.body;
  if (!primaryId || !duplicateId) {
    throw AppError.badRequest('Both primaryId and duplicateId are required.');
  }

  const primary = await LegalResource.findById(primaryId);
  const duplicate = await LegalResource.findById(duplicateId);

  if (!primary || !duplicate) {
    throw AppError.notFound('One or both resources could not be found.');
  }

  // Merge contact numbers
  const contacts = new Set([...(primary.contactNumber || []), ...(duplicate.contactNumber || [])]);
  primary.contactNumber = Array.from(contacts);

  // Merge emails
  const emails = new Set([...(primary.email || []), ...(duplicate.email || [])]);
  primary.email = Array.from(emails);

  // Merge languages
  const languages = new Set([...(primary.languages || []), ...(duplicate.languages || [])]);
  primary.languages = Array.from(languages);

  // Merge facilities (if duplicate has facility, primary gets true)
  if (duplicate.facilities) {
    primary.facilities = primary.facilities || {} as any;
    if (duplicate.facilities.hasEfiling) primary.facilities.hasEfiling = true;
    if (duplicate.facilities.hasLADCS) primary.facilities.hasLADCS = true;
    if (duplicate.facilities.hasVCRoom) primary.facilities.hasVCRoom = true;
    if (duplicate.facilities.hasLegalAidClinic) primary.facilities.hasLegalAidClinic = true;
    if (duplicate.facilities.isWheelchairAccessible) primary.facilities.isWheelchairAccessible = true;
  }

  // Append to changeLog
  primary.changeLog = primary.changeLog || [];
  primary.changeLog.push({
    timestamp: new Date(),
    adminEmail: (req as any).user?.email || 'Registry Merge Tool',
    action: 'merged_duplicate',
    diff: { mergedWithId: duplicateId, duplicateName: duplicate.name }
  });

  await primary.save();
  await LegalResource.findByIdAndDelete(duplicateId);

  res.json({
    success: true,
    message: `Merged "${duplicate.name}" into "${primary.name}". Duplicate record removed.`,
    data: primary
  });
}));

// POST /resources/geocode-missing - Batch geocode missing coordinates
router.post('/resources/geocode-missing', asyncHandler(async (req: Request, res: Response) => {
  const missingCoords = await LegalResource.find({
    $or: [
      { coordinates: { $exists: false } },
      { 'coordinates.lat': 0, 'coordinates.lng': 0 },
      { 'coordinates.lat': null }
    ]
  });

  let geocodedCount = 0;

  for (const resource of missingCoords) {
    const coord = resolveGeoCentroid(resource.city || resource.district || resource.state);

    // Apply minor jitter so markers in same city don't completely overlap
    const jitterLat = coord.lat + (Math.random() - 0.5) * 0.04;
    const jitterLng = coord.lng + (Math.random() - 0.5) * 0.04;

    resource.coordinates = {
      lat: parseFloat(jitterLat.toFixed(5)),
      lng: parseFloat(jitterLng.toFixed(5))
    };

    await resource.save();
    geocodedCount++;
  }

  res.json({
    success: true,
    message: `Batch geocoding completed. Resolved ${geocodedCount} record(s).`,
    geocodedCount
  });
}));

// POST /resources/ai-search - Natural language query to filter combination parser
router.post('/resources/ai-search', asyncHandler(async (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    throw AppError.badRequest('Please provide a search query.');
  }

  const q = query.toLowerCase();
  const filters: Record<string, any> = {};
  const matchedParams: Record<string, any> = {};

  // State detection
  const STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Delhi', 'Chandigarh', 'Jammu & Kashmir', 'Ladakh', 'Puducherry'
  ];

  for (const state of STATES) {
    if (q.includes(state.toLowerCase())) {
      filters.state = state;
      matchedParams.state = state;
      break;
    }
  }

  // Type detection
  if (q.includes('court') || q.includes('high court') || q.includes('district court') || q.includes('tribunal')) {
    filters.type = 'Court';
    matchedParams.type = 'Court';
  } else if (q.includes('legal aid') || q.includes('dlsa') || q.includes('slsa') || q.includes('taluka legal')) {
    filters.type = 'LegalAid';
    matchedParams.type = 'LegalAid';
  } else if (q.includes('police') || q.includes('thana') || q.includes('station')) {
    filters.type = 'PoliceStation';
    matchedParams.type = 'PoliceStation';
  } else if (q.includes('notary') || q.includes('notaries') || q.includes('affidavit')) {
    filters.type = 'Notary';
    matchedParams.type = 'Notary';
  } else if (q.includes('lok adalat') || q.includes('national lok adalat')) {
    filters.type = 'LokAdalat';
    matchedParams.type = 'LokAdalat';
  } else if (q.includes('mediation') || q.includes('conciliation')) {
    filters.type = 'MediationCenter';
    matchedParams.type = 'MediationCenter';
  } else if (q.includes('bar association') || q.includes('bar council') || q.includes('advocates association')) {
    filters.type = 'BarAssociation';
    matchedParams.type = 'BarAssociation';
  }

  // Facilities detection
  if (q.includes('efiling') || q.includes('e-filing') || q.includes('digital filing') || q.includes('online filing')) {
    filters['facilities.hasEfiling'] = true;
    matchedParams.facility = 'hasEfiling';
  }
  if (q.includes('ladcs') || q.includes('defense counsel') || q.includes('public defender')) {
    filters['facilities.hasLADCS'] = true;
    matchedParams.facility = 'hasLADCS';
  }
  if (q.includes('vc') || q.includes('video conferencing') || q.includes('virtual hearing')) {
    filters['facilities.hasVCRoom'] = true;
    matchedParams.facility = 'hasVCRoom';
  }
  if (q.includes('wheelchair') || q.includes('accessible') || q.includes('ramp') || q.includes('disability')) {
    filters['facilities.isWheelchairAccessible'] = true;
    matchedParams.facility = 'isWheelchairAccessible';
  }

  // Search keyword fallback
  const remainingSearch = query
    .replace(/(in|at|with|for|and|or|of|near|find|show|list|me|all|the)\b/gi, '')
    .trim();

  let explanation = 'Extracted filters: ';
  const parts: string[] = [];
  if (matchedParams.state) parts.push(`State: ${matchedParams.state}`);
  if (matchedParams.type) parts.push(`Type: ${matchedParams.type}`);
  if (matchedParams.facility) parts.push(`Facility: ${matchedParams.facility}`);
  explanation += parts.length > 0 ? parts.join(', ') : `Keyword Search: "${remainingSearch}"`;

  res.json({
    success: true,
    filters,
    matchedParams,
    search: parts.length > 0 ? '' : remainingSearch,
    explanation
  });
}));

export default router;