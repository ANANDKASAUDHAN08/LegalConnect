import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import IngestionLogModel from '../../models/IngestionLog';
import JudicialDecisionModel from '../../models/JudicialDecision';
import { AppError } from '../../utils/AppError';

const router = Router();

// 1. GET /contributions - List crowdsourced community & advocate contributions for review
router.get('/contributions', asyncHandler(async (req: Request, res: Response) => {
  const status = (req.query['status'] as string) || 'PARTIAL';
  const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string) || 20));

  const filter: any = {
    sourceUrl: { $regex: /^\/laws\// }
  };

  if (status && status !== 'ALL') {
    filter.status = status;
  }

  const [total, contributions] = await Promise.all([
    IngestionLogModel.countDocuments(filter),
    IngestionLogModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
  ]);

  res.json({
    success: true,
    data: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      contributions
    }
  });
}));

// 2. GET /contributions/stats - Contribution review metrics & breakdown
router.get('/contributions/stats', asyncHandler(async (_req: Request, res: Response) => {
  const [total, pending, approved, rejected, advocateCount] = await Promise.all([
    IngestionLogModel.countDocuments({ sourceUrl: { $regex: /^\/laws\// } }),
    IngestionLogModel.countDocuments({ sourceUrl: { $regex: /^\/laws\// }, status: 'PARTIAL' }),
    IngestionLogModel.countDocuments({ sourceUrl: { $regex: /^\/laws\// }, status: 'SUCCESS' }),
    IngestionLogModel.countDocuments({ sourceUrl: { $regex: /^\/laws\// }, status: 'FAILED' }),
    IngestionLogModel.countDocuments({ sourceUrl: { $regex: /^\/laws\// }, sourceAuthority: { $regex: /^Advocate/ } })
  ]);

  res.json({
    success: true,
    data: {
      total,
      pending,
      approved,
      rejected,
      advocateCount
    }
  });
}));

// 3. PUT /contributions/:id/verify - Approve or reject an editorial contribution
router.put('/contributions/:id/verify', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, reviewerNotes } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    throw AppError.badRequest('Action must be either "approve" or "reject".');
  }

  const contribution = await IngestionLogModel.findById(id);
  if (!contribution) {
    throw AppError.notFound('Contribution record not found.');
  }

  if (action === 'approve') {
    contribution.status = 'SUCCESS';
    contribution.recordsImported = 1;
    contribution.notes = `${contribution.notes || ''} [APPROVED by Legal Editor: ${reviewerNotes || 'Verified authentic legal context'}]`;

    // If contribution is a case citation, auto-index into JudicialDecisionModel
    if (contribution.notes && contribution.notes.includes('Citations:')) {
      const citationMatch = contribution.notes.match(/Citations:\s*([^.]+)/i);
      const citation = citationMatch ? citationMatch[1].trim() : '';
      const actParts = (contribution.actCode || '').split(':');
      const actShortName = actParts[0] || 'GENERAL';
      const sectionNum = actParts[1] || '';

      if (citation) {
        const caseSlug = citation.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        await JudicialDecisionModel.updateOne(
          { caseId: caseSlug },
          {
            $set: {
              caseId: caseSlug,
              title: citation,
              citation,
              court: 'Supreme Court of India / High Court (Peer Verified)',
              decisionDate: new Date().toISOString().split('T')[0],
              connectedActs: [actShortName],
              connectedSections: sectionNum ? [`Section ${sectionNum} ${actShortName}`, sectionNum] : [actShortName],
              issues: ['Statutory interpretation of procedural safeguard'],
              holding: contribution.notes.split('Text:')[1]?.trim() || 'Peer-contributed judicial precedent',
              ratioDecidendi: contribution.notes.split('Text:')[1]?.trim() || 'Binding precedent on procedural safeguard',
              treatment: 'Good Law',
              summary: contribution.notes.split('Text:')[1]?.trim() || citation,
              isLandmark: false,
              provenance: {
                sourceAuthority: contribution.sourceAuthority,
                sourceUrl: contribution.sourceUrl,
                jurisdiction: 'India',
                documentType: 'Peer-Reviewed Statutory Contribution',
                publicationDate: new Date().toISOString().split('T')[0],
                retrievedAt: new Date(),
                lastVerifiedAt: new Date(),
                contentVersion: 1,
                extractionMethod: 'crowdsourced_advocate_review',
                reviewStatus: 'verified',
                reviewedBy: 'LegalConnect Senior Editorial Board',
                license: 'Creative Commons Attribution-ShareAlike (CC BY-SA 4.0)'
              }
            }
          },
          { upsert: true }
        );
      }
    }
  } else {
    contribution.status = 'FAILED';
    contribution.recordsSkipped = 1;
    contribution.notes = `${contribution.notes || ''} [REJECTED by Legal Editor: ${reviewerNotes || 'Does not meet judicial accuracy standards'}]`;
  }

  await contribution.save();

  res.json({
    success: true,
    message: `Contribution has been successfully ${action === 'approve' ? 'approved and merged into LegalPedia' : 'rejected'}.`,
    data: contribution
  });
}));

export default router;