import mongoose, { Document, Schema } from 'mongoose';

export interface IDraft extends Document {
  draftId: string;
  userId: string;
  templateId: string;
  title: string;
  values: Map<string, string>;
  customBody?: string;
  updatedAt: Date;
}

const DraftSchema = new Schema<IDraft>({
  draftId: { type: String, required: true },
  userId: { type: String, required: true },
  templateId: { type: String, required: true },
  title: { type: String, required: true },
  values: { type: Map, of: String, default: {} },
  customBody: { type: String },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index draftId + userId combination for unique operations
DraftSchema.index({ draftId: 1, userId: 1 }, { unique: true });
DraftSchema.index({ userId: 1 });

export default mongoose.model<IDraft>('Draft', DraftSchema);