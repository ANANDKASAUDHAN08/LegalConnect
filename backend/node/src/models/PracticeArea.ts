import mongoose, { Document, Schema } from 'mongoose';
import { IProvenance, ProvenanceSchema } from './Provenance';

export interface IPracticeAreaFaq {
  q: string;
  a: string;
  q_hi?: string;
  a_hi?: string;
}

export interface IPracticeAreaForumStage {
  stage: string;
  forum: string;
  note?: string;
}

export interface IPracticeArea extends Document {
  id: string; // e.g. 'criminal-law', 'property-disputes'
  name: string;
  name_hi?: string;
  icon: string;
  category: string;
  description: string;
  description_hi?: string;
  tagline?: string;
  simpleDescription?: string;
  simpleDescription_hi?: string;
  simpleTagline?: string;
  accent?: string; // colour token, e.g. 'blue', 'emerald'
  subfields: string[];
  relevantActs: string[];
  typicalForums: string[];
  aliases: string[];
  faqs: IPracticeAreaFaq[];
  forumJourney: IPracticeAreaForumStage[];
  documentsChecklist: string[];
  popular: boolean;
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: number;
  viewCount: number;
  ctaCount: number;
  version: number;
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
    tagline: { type: String, default: '' },
    simpleDescription: { type: String, default: '' },
    simpleDescription_hi: { type: String, default: '' },
    simpleTagline: { type: String, default: '' },
    accent: { type: String, default: 'blue' },
    subfields: { type: [String], default: [] },
    relevantActs: { type: [String], default: [] },
    typicalForums: { type: [String], default: [] },
    aliases: { type: [String], default: [], index: true },
    faqs: {
      type: [{
        q: { type: String, required: true },
        a: { type: String, required: true },
        q_hi: { type: String, default: '' },
        a_hi: { type: String, default: '' }
      }],
      default: []
    },
    forumJourney: {
      type: [{
        stage: { type: String, required: true },
        forum: { type: String, required: true },
        note: { type: String, default: '' }
      }],
      default: []
    },
    documentsChecklist: { type: [String], default: [] },
    popular: { type: Boolean, default: false, index: true },
    isPublished: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    sortOrder: { type: Number, default: 0, index: true },
    viewCount: { type: Number, default: 0 },
    ctaCount: { type: Number, default: 0 },
    version: { type: Number, default: 1 },
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