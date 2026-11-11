import mongoose, { Document, Schema } from 'mongoose';
import { IProvenance, ProvenanceSchema } from './Provenance';

export interface IFaq extends Document {
  faqId: string; // unique slug e.g. 'faq-bns-transition'
  category: string; // e.g. 'general', 'advocate', 'security', 'library'
  badge: string; // e.g. 'Updated 2026 Acts', 'DPDP Act 2023'
  question: string;
  question_hi?: string;
  answer: string;
  answer_hi?: string;
  sourceAct?: string;
  sourceSection?: string;
  isPublished: boolean;
  sortOrder: number;
  provenance: IProvenance;
  createdAt: Date;
  updatedAt: Date;
}

const FaqSchema = new Schema<IFaq>(
  {
    faqId: { type: String, required: true, unique: true, index: true },
    category: { type: String, required: true, index: true },
    badge: { type: String, required: true },
    question: { type: String, required: true, trim: true },
    question_hi: { type: String, default: '' },
    answer: { type: String, required: true },
    answer_hi: { type: String, default: '' },
    sourceAct: { type: String, default: '' },
    sourceSection: { type: String, default: '' },
    isPublished: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, index: true },
    provenance: { type: ProvenanceSchema, required: true }
  },
  { timestamps: true }
);

FaqSchema.index(
  {
    question: 'text',
    answer: 'text',
    badge: 'text',
    sourceAct: 'text'
  },
  {
    weights: {
      question: 10,
      answer: 5,
      badge: 3
    },
    name: 'FaqTextIndex'
  }
);

export const FaqModel = mongoose.model<IFaq>('Faq', FaqSchema);
export default FaqModel;