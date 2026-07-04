import mongoose, { Document, Schema } from 'mongoose';

export interface IHelpHelpline extends Document {
  name: string;
  number: string;
  description: string;
  category: string; // 'General' or matches HelpCategory id
}

const HelpHelplineSchema = new Schema<IHelpHelpline>({
  name: { type: String, required: true },
  number: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true, default: 'General' }
}, {
  timestamps: true
});

HelpHelplineSchema.index({ category: 1 });

export default mongoose.model<IHelpHelpline>('HelpHelpline', HelpHelplineSchema);
