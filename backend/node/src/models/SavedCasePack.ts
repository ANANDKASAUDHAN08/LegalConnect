import mongoose, { Document, Schema } from 'mongoose';

export interface ISavedCasePack extends Document {
  userId: mongoose.Types.ObjectId;
  category: string;
  location: string;
  roadmap: {
    steps: { title: string; detail: string }[];
    documents: string[];
    onlineLinks: { name: string; url: string }[];
    lokAdalatGuidance: string;
  };
  helplines: any[];
  resources: any[];
  savedAt: Date;
}

const SavedCasePackSchema = new Schema<ISavedCasePack>({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  category: { type: String, required: true },
  location: { type: String, required: true },
  roadmap: {
    steps: [{ title: String, detail: String }],
    documents: [String],
    onlineLinks: [{ name: String, url: String }],
    lokAdalatGuidance: String
  },
  helplines: { type: Schema.Types.Mixed, default: [] },
  resources: { type: Schema.Types.Mixed, default: [] },
  savedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Unique per user + category + location
SavedCasePackSchema.index({ userId: 1, category: 1, location: 1 }, { unique: true });

export default mongoose.model<ISavedCasePack>('SavedCasePack', SavedCasePackSchema);