import mongoose, { Document, Schema } from 'mongoose';
import { IProvenance, ProvenanceSchema } from './Provenance';

export interface ITemplateField {
  key: string;
  label: string;
  placeholder: string;
  type: string; // 'text' | 'textarea' | 'date'
  defaultValue: string;
  helpTip?: string;
}

export interface ILegalTemplate extends Document {
  templateId: string;
  title: string;
  actRef: string;
  category: string; // 'commercial' | 'family' | 'civil' | 'transport' | 'rights'
  description: string;
  fields: ITemplateField[];
  body: string;
  sortOrder: number;
  isPublished: boolean;
  downloadsCount: number;
  provenance: IProvenance;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateFieldSchema = new Schema<ITemplateField>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    placeholder: { type: String, required: true },
    type: { type: String, required: true, default: 'text' },
    defaultValue: { type: String, default: '' },
    helpTip: { type: String }
  },
  { _id: false }
);

const LegalTemplateSchema = new Schema<ILegalTemplate>(
  {
    templateId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    actRef: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: ['commercial', 'family', 'civil', 'transport', 'rights'],
      default: 'commercial',
      index: true
    },
    description: { type: String, required: true },
    fields: [TemplateFieldSchema],
    body: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true, index: true },
    downloadsCount: { type: Number, default: 0 },
    provenance: { type: ProvenanceSchema, required: true }
  },
  {
    timestamps: true
  }
);

LegalTemplateSchema.index({ category: 1, isPublished: 1 });
LegalTemplateSchema.index({ title: 'text', description: 'text', actRef: 'text' });

export const LegalTemplateModel = mongoose.model<ILegalTemplate>('LegalTemplate', LegalTemplateSchema);
export default LegalTemplateModel;