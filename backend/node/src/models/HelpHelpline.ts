import mongoose, { Document, Schema } from 'mongoose';

export type HelplinePriorityTier = 'P0_CRITICAL' | 'P1_URGENT' | 'P2_ADVISORY';

export interface IHelpHelpline extends Document {
  name: string;
  number: string;
  description: string;
  category: string; // 'General' or matches HelpCategory id
  priorityTier: HelplinePriorityTier;
  isActive: boolean;
  is24x7: boolean;
  operatingHours: string;
  operatingDays?: string[];
  languages: string[];
  state: string; // 'All India' or specific State / UT
  tollFree: boolean;
  alternateNumbers: string[];
  lastVerifiedAt?: Date;
  verifiedBy?: string;
  verificationNotes?: string;
}

const HelpHelplineSchema = new Schema<IHelpHelpline>({
  name: { type: String, required: true },
  number: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true, default: 'General' },
  priorityTier: {
    type: String,
    enum: ['P0_CRITICAL', 'P1_URGENT', 'P2_ADVISORY'],
    default: 'P2_ADVISORY'
  },
  isActive: { type: Boolean, default: true },
  is24x7: { type: Boolean, default: true },
  operatingHours: { type: String, default: '24 Hours / 7 Days' },
  operatingDays: [{ type: String }],
  languages: [{ type: String, default: ['English', 'Hindi'] }],
  state: { type: String, default: 'All India' },
  tollFree: { type: Boolean, default: true },
  alternateNumbers: [{ type: String }],
  lastVerifiedAt: { type: Date, default: Date.now },
  verifiedBy: { type: String, default: 'System Administrator' },
  verificationNotes: { type: String }
}, {
  timestamps: true
});

HelpHelplineSchema.index({ category: 1 });
HelpHelplineSchema.index({ priorityTier: 1 });
HelpHelplineSchema.index({ state: 1 });
HelpHelplineSchema.index({ isActive: 1 });
HelpHelplineSchema.index({ name: 'text', description: 'text', number: 'text' });

export default mongoose.model<IHelpHelpline>('HelpHelpline', HelpHelplineSchema);