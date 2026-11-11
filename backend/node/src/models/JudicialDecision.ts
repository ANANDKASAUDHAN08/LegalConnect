import mongoose, { Document, Schema } from 'mongoose';
import { IProvenance, ProvenanceSchema } from './Provenance';

export type JudicialTreatment = 'Good Law' | 'Overruled' | 'Distinguished' | 'Clarified' | 'Pending Review';

export interface IJudicialDecision extends Document {
  caseId: string; // unique slug e.g. 'maneka-gandhi-v-uoi-1978'
  title: string; // e.g. 'Maneka Gandhi vs. Union of India'
  citation: string; // e.g. '1978 AIR 597, 1978 SCR (2) 621'
  court: string; // 'Supreme Court of India' | 'High Court of Delhi' | etc.
  bench: string; // 'M.H. Beg (CJI), Y.V. Chandrachud, P.N. Bhagwati, V.R. Krishna Iyer, N.L. Untwalia, S. Murtaza Fazal Ali, P.S. Kailasam'
  decisionDate: string; // '1978-01-25'
  connectedActs: string[]; // e.g. ['Constitution of India', 'Passports Act, 1967']
  connectedSections: string[]; // e.g. ['Article 21', 'Article 14', 'Article 19']
  issues: string[]; // key legal questions
  holding: string; // core ruling summary
  ratioDecidendi: string; // legal principle established
  treatment: JudicialTreatment;
  officialDocumentUrl?: string; // official eCourts / Supreme Court PDF link
  summary: string;
  summary_hi?: string;
  isLandmark: boolean;
  provenance: IProvenance;
  createdAt: Date;
  updatedAt: Date;
}

const JudicialDecisionSchema = new Schema<IJudicialDecision>(
  {
    caseId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    citation: { type: String, required: true, index: true },
    court: { type: String, required: true, index: true, default: 'Supreme Court of India' },
    bench: { type: String, default: '' },
    decisionDate: { type: String, required: true, index: true },
    connectedActs: { type: [String], default: [], index: true },
    connectedSections: { type: [String], default: [], index: true },
    issues: { type: [String], default: [] },
    holding: { type: String, required: true },
    ratioDecidendi: { type: String, required: true },
    treatment: {
      type: String,
      enum: ['Good Law', 'Overruled', 'Distinguished', 'Clarified', 'Pending Review'],
      default: 'Good Law',
      index: true
    },
    officialDocumentUrl: { type: String, default: '' },
    summary: { type: String, required: true },
    summary_hi: { type: String, default: '' },
    isLandmark: { type: Boolean, default: true, index: true },
    provenance: { type: ProvenanceSchema, required: true }
  },
  { timestamps: true }
);

JudicialDecisionSchema.index(
  {
    title: 'text',
    citation: 'text',
    holding: 'text',
    ratioDecidendi: 'text',
    summary: 'text',
    connectedActs: 'text',
    connectedSections: 'text'
  },
  {
    weights: {
      title: 10,
      citation: 10,
      connectedSections: 8,
      connectedActs: 6,
      holding: 4,
      summary: 2
    },
    name: 'JudicialDecisionTextIndex'
  }
);

export const JudicialDecisionModel = mongoose.model<IJudicialDecision>('JudicialDecision', JudicialDecisionSchema);
export default JudicialDecisionModel;