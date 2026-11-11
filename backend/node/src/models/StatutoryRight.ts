import mongoose, { Document, Schema } from 'mongoose';
import { IProvenance, ProvenanceSchema } from './Provenance';

export interface IStatutoryBasis {
  actName: string;
  shortAct: string;
  sections: string[];
  actUrl: string;
  landmarkCases?: string[];
}

export interface IEmergencyHelpline {
  name: string;
  number: string;
  description: string;
  portalUrl?: string;
}

export interface IStatutoryRightFAQ {
  question: string;
  answer: string;
}

export interface IStatutoryRight extends Document {
  id: string; // unique slug identifier e.g. 'arrest-detainment-safeguards'
  slug: string;
  title: string;
  category: string;
  icon: string;
  summary: string;
  statutoryBasis: IStatutoryBasis;
  keyProtections: string[];
  actionableSteps: string[];
  legalRemedy: string;
  emergencyHelpline?: IEmergencyHelpline;
  penaltiesForViolation?: string;
  frequentlyAskedQuestions?: IStatutoryRightFAQ[];
  tags: string[];
  scenarioTag?: string; // e.g. 'police-stop', 'cyber-scam', 'tenant-eviction', 'medical-emergency'
  whatToSay?: string; // authoritative confrontation script
  dos?: string[]; // best practice action items
  donts?: string[]; // actions to avoid under duress
  title_hi?: string; // Hindi title
  summary_hi?: string; // Hindi plain explanation
  whatToSay_hi?: string; // Hindi verbal confrontation script
  dos_hi?: string[]; // Hindi dos
  donts_hi?: string[]; // Hindi donts
  verifiedDate: string;
  verifiedBy: string;
  version?: number;
  provenance?: IProvenance;
  isPopular: boolean;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StatutoryBasisSchema = new Schema<IStatutoryBasis>(
  {
    actName: { type: String, required: true },
    shortAct: { type: String, required: true },
    sections: { type: [String], required: true, default: [] },
    actUrl: { type: String, required: true },
    landmarkCases: { type: [String], default: [] }
  },
  { _id: false }
);

const EmergencyHelplineSchema = new Schema<IEmergencyHelpline>(
  {
    name: { type: String, required: true },
    number: { type: String, required: true },
    description: { type: String, required: true },
    portalUrl: { type: String, default: '' }
  },
  { _id: false }
);

const StatutoryRightFAQSchema = new Schema<IStatutoryRightFAQ>(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true }
  },
  { _id: false }
);

const StatutoryRightSchema = new Schema<IStatutoryRight>(
  {
    id: { type: String, required: true, unique: true, index: true },
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, index: true },
    icon: { type: String, required: true, default: 'scale' },
    summary: { type: String, required: true },
    statutoryBasis: { type: StatutoryBasisSchema, required: true },
    keyProtections: { type: [String], required: true, default: [] },
    actionableSteps: { type: [String], required: true, default: [] },
    legalRemedy: { type: String, required: true },
    emergencyHelpline: { type: EmergencyHelplineSchema },
    penaltiesForViolation: { type: String, default: '' },
    frequentlyAskedQuestions: { type: [StatutoryRightFAQSchema], default: [] },
    tags: { type: [String], default: [] },
    scenarioTag: { type: String, default: '', index: true },
    whatToSay: { type: String, default: '' },
    dos: { type: [String], default: [] },
    donts: { type: [String], default: [] },
    title_hi: { type: String, default: '' },
    summary_hi: { type: String, default: '' },
    whatToSay_hi: { type: String, default: '' },
    dos_hi: { type: [String], default: [] },
    donts_hi: { type: [String], default: [] },
    verifiedDate: { type: String, default: '2026-08-15' },
    verifiedBy: { type: String, default: 'LegalConnect Statutory Review Directorate' },
    version: { type: Number, default: 1 },
    provenance: { type: ProvenanceSchema },
    isPopular: { type: Boolean, default: false, index: true },
    isPublished: { type: Boolean, default: true, index: true }
  },
  {
    timestamps: true
  }
);

// Compound text index for high-performance search across title, summary, protections, and sections
StatutoryRightSchema.index(
  {
    title: 'text',
    summary: 'text',
    'statutoryBasis.actName': 'text',
    keyProtections: 'text',
    legalRemedy: 'text',
    tags: 'text'
  },
  {
    weights: {
      title: 10,
      'statutoryBasis.actName': 6,
      summary: 5,
      keyProtections: 4,
      legalRemedy: 3,
      tags: 2
    },
    name: 'StatutoryRightTextIndex'
  }
);

export const StatutoryRightModel = mongoose.model<IStatutoryRight>('StatutoryRight', StatutoryRightSchema);
export default StatutoryRightModel;