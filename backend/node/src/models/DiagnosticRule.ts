import mongoose, { Document, Schema } from 'mongoose';
import { IProvenance, ProvenanceSchema } from './Provenance';

export type DiagnosticStatus = 'VIOLATION_CONFIRMED' | 'PROCEDURAL_CLEARANCE' | 'REVIEW_REQUIRED';

export interface IDiagnosticRuleCondition {
  questionId: string;
  expectedAnswer: boolean;
}

export interface ILinkedSection {
  actName: string;
  shortAct: string;
  section: string;
}

export interface IDiagnosticRule extends Document {
  ruleId: string; // e.g. 'police-unlawful-arrest-under-3y'
  crisisId: string; // references DiagnosticCrisis.crisisId
  title: string;
  conditions: IDiagnosticRuleCondition[];
  triggerWhen: 'ANY_MATCH' | 'ALL_MATCH'; // whether any condition or all conditions trigger this rule
  status: DiagnosticStatus;
  confidenceScore: number;
  verdictTitle: string;
  verdictTitle_hi: string;
  verdictSubtitle: string;
  verdictSubtitle_hi: string;
  statutoryBasis: string;
  linkedSections: ILinkedSection[];
  whatToSay: string;
  whatToSay_hi: string;
  actionItems: string[];
  actionItems_hi: string[];
  helpline: string;
  helplineName: string;
  relatedRightId?: string;
  version: number;
  isActive: boolean;
  provenance: IProvenance;
  createdAt: Date;
  updatedAt: Date;
}

const DiagnosticRuleConditionSchema = new Schema<IDiagnosticRuleCondition>(
  {
    questionId: { type: String, required: true },
    expectedAnswer: { type: Boolean, required: true }
  },
  { _id: false }
);

const LinkedSectionSchema = new Schema<ILinkedSection>(
  {
    actName: { type: String, required: true },
    shortAct: { type: String, required: true },
    section: { type: String, required: true }
  },
  { _id: false }
);

const DiagnosticRuleSchema = new Schema<IDiagnosticRule>(
  {
    ruleId: { type: String, required: true, unique: true, index: true },
    crisisId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    conditions: { type: [DiagnosticRuleConditionSchema], required: true },
    triggerWhen: { type: String, enum: ['ANY_MATCH', 'ALL_MATCH'], default: 'ANY_MATCH' },
    status: {
      type: String,
      enum: ['VIOLATION_CONFIRMED', 'PROCEDURAL_CLEARANCE', 'REVIEW_REQUIRED'],
      required: true
    },
    confidenceScore: { type: Number, required: true, min: 0, max: 100 },
    verdictTitle: { type: String, required: true },
    verdictTitle_hi: { type: String, required: true },
    verdictSubtitle: { type: String, required: true },
    verdictSubtitle_hi: { type: String, required: true },
    statutoryBasis: { type: String, required: true },
    linkedSections: { type: [LinkedSectionSchema], default: [] },
    whatToSay: { type: String, required: true },
    whatToSay_hi: { type: String, required: true },
    actionItems: { type: [String], required: true },
    actionItems_hi: { type: [String], required: true },
    helpline: { type: String, required: true },
    helplineName: { type: String, required: true },
    relatedRightId: { type: String },
    version: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true, index: true },
    provenance: { type: ProvenanceSchema, required: true }
  },
  { timestamps: true }
);

export const DiagnosticRuleModel = mongoose.model<IDiagnosticRule>('DiagnosticRule', DiagnosticRuleSchema);
export default DiagnosticRuleModel;