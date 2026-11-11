import mongoose, { Document, Schema } from 'mongoose';
import { IProvenance, ProvenanceSchema } from './Provenance';

export interface IEmergencyScenario extends Document {
  tag: string;
  label: string;
  label_hi?: string;
  icon: string;
  color: string;
  description: string;
  description_hi?: string;
  subtext?: string;
  subtext_hi?: string;
  badge?: string;
  filterKeywords: string[];
  sortOrder: number;
  isActive: boolean;
  provenance?: IProvenance;
  createdAt: Date;
  updatedAt: Date;
}

const EmergencyScenarioSchema = new Schema<IEmergencyScenario>(
  {
    tag: { type: String, required: true, unique: true, index: true, trim: true },
    label: { type: String, required: true, trim: true },
    label_hi: { type: String, default: '', trim: true },
    icon: { type: String, required: true, default: 'shield' },
    color: { type: String, required: true, default: 'blue' },
    description: { type: String, required: true },
    description_hi: { type: String, default: '' },
    subtext: { type: String, default: '' },
    subtext_hi: { type: String, default: '' },
    badge: { type: String, default: '' },
    filterKeywords: { type: [String], default: [] },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    provenance: { type: ProvenanceSchema }
  },
  { timestamps: true }
);

export const EmergencyScenarioModel = mongoose.model<IEmergencyScenario>('EmergencyScenario', EmergencyScenarioSchema);
export default EmergencyScenarioModel;