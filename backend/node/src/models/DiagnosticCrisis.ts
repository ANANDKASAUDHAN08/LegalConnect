import mongoose, { Document, Schema } from 'mongoose';
import { IProvenance, ProvenanceSchema } from './Provenance';

export interface IDiagnosticQuestion {
  id: string;
  question: string;
  question_hi: string;
  hint: string;
  hint_hi: string;
  relevantAct?: string;
  relevantSection?: string;
  sortOrder?: number;
}

export interface IDiagnosticCrisis extends Document {
  crisisId: string; // e.g. 'police', 'traffic', 'tenant', 'banking', 'hospital', 'workplace'
  title: string;
  title_hi: string;
  icon: string;
  color: string;
  summary: string;
  summary_hi: string;
  sortOrder: number;
  isActive: boolean;
  questions: IDiagnosticQuestion[];
  provenance: IProvenance;
  createdAt: Date;
  updatedAt: Date;
}

const DiagnosticQuestionSchema = new Schema<IDiagnosticQuestion>(
  {
    id: { type: String, required: true },
    question: { type: String, required: true },
    question_hi: { type: String, required: true },
    hint: { type: String, required: true },
    hint_hi: { type: String, required: true },
    relevantAct: { type: String, default: '' },
    relevantSection: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 }
  },
  { _id: false }
);

const DiagnosticCrisisSchema = new Schema<IDiagnosticCrisis>(
  {
    crisisId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    title_hi: { type: String, required: true },
    icon: { type: String, required: true, default: 'shield' },
    color: { type: String, required: true, default: 'blue' },
    summary: { type: String, required: true },
    summary_hi: { type: String, required: true },
    sortOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    questions: { type: [DiagnosticQuestionSchema], default: [] },
    provenance: { type: ProvenanceSchema, required: true }
  },
  { timestamps: true }
);

export const DiagnosticCrisisModel = mongoose.model<IDiagnosticCrisis>('DiagnosticCrisis', DiagnosticCrisisSchema);
export default DiagnosticCrisisModel;