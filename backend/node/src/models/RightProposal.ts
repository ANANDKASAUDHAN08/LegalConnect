import mongoose, { Document, Schema } from 'mongoose';

/**
 * RightProposal Model — Crowdsourced Citizen Legal Proposals & New Safeguard Submissions
 *
 * Adheres to SOLID Single Responsibility Principle:
 * Completely separate from Moderation/Dispute reporting.
 * Handles the citizen ingestion pipeline for new legal protections, emerging threat scenarios,
 * and missing statutes to be reviewed by the Legal Research Council.
 */
export interface IRightProposal extends Document {
  referenceId: string;
  scenarioTitle: string;
  category: string;
  statutoryBasis?: string;
  verbalScript?: string;
  emergencyHelpline?: string;
  description: string;
  evidenceUrl?: string;
  contributorType: 'citizen' | 'advocate' | 'law_student' | 'anonymous';
  contributorName?: string;
  contributorEmail?: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  adminNotes?: string;
  clientFingerprint?: string;
  clientIp?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RightProposalSchema = new Schema<IRightProposal>(
  {
    referenceId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    scenarioTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    statutoryBasis: {
      type: String,
      trim: true,
      maxlength: 300
    },
    verbalScript: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    emergencyHelpline: {
      type: String,
      trim: true,
      maxlength: 150
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000
    },
    evidenceUrl: {
      type: String,
      trim: true
    },
    contributorType: {
      type: String,
      enum: ['citizen', 'advocate', 'law_student', 'anonymous'],
      default: 'citizen'
    },
    contributorName: {
      type: String,
      trim: true,
      maxlength: 120
    },
    contributorEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 180
    },
    status: {
      type: String,
      enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true
    },
    adminNotes: {
      type: String,
      trim: true
    },
    clientFingerprint: {
      type: String,
      trim: true
    },
    clientIp: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes for administrative review and query optimization
RightProposalSchema.index({ status: 1, createdAt: -1 });
RightProposalSchema.index({ category: 1, createdAt: -1 });

export default mongoose.model<IRightProposal>('RightProposal', RightProposalSchema);