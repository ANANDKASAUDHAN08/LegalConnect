import mongoose, { Document, Schema } from 'mongoose';
import { IProvenance, ProvenanceSchema } from './Provenance';

export interface IPracticeArea extends Document {
  id: string; // e.g. 'criminal-law', 'property-disputes'
  name: string;
  name_hi?: string;
  icon: string;
  category: string;
  description: string;
  description_hi?: string;
  subfields: string[];
  relevantActs: string[];
  typicalForums: string[];
  popular: boolean;
  provenance: IProvenance;
  createdAt: Date;
  updatedAt: Date;
}

const PracticeAreaSchema = new Schema<IPracticeArea>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    name_hi: { type: String, default: '' },
    icon: { type: String, required: true, default: 'scale' },
    category: { type: String, required: true, index: true },
    description: { type: String, required: true },
    description_hi: { type: String, default: '' },
    subfields: { type: [String], default: [] },
    relevantActs: { type: [String], default: [] },
    typicalForums: { type: [String], default: [] },
    popular: { type: Boolean, default: false, index: true },
    provenance: { type: ProvenanceSchema, required: true }
  },
  { timestamps: true }
);

PracticeAreaSchema.index(
  {
    name: 'text',
    description: 'text',
    subfields: 'text',
    relevantActs: 'text'
  },
  {
    weights: {
      name: 10,
      relevantActs: 6,
      subfields: 4,
      description: 2
    },
    name: 'PracticeAreaTextIndex'
  }
);

export const PracticeAreaModel = mongoose.model<IPracticeArea>('PracticeArea', PracticeAreaSchema);
export default PracticeAreaModel;