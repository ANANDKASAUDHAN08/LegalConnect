import mongoose, { Document, Schema } from 'mongoose';

export interface IRoadmapStep {
  title: string;
  detail: string;
}

export interface IRoadmapLink {
  name: string;
  url: string;
}

export interface IHelpRoadmap extends Document {
  category: string; // matches HelpCategory id
  steps: IRoadmapStep[];
  documents: string[];
  onlineLinks: IRoadmapLink[];
  lokAdalatGuidance: string;
}

const HelpRoadmapSchema = new Schema<IHelpRoadmap>({
  category: { type: String, required: true, unique: true },
  steps: [{
    title: { type: String, required: true },
    detail: { type: String, required: true }
  }],
  documents: [{ type: String }],
  onlineLinks: [{
    name: { type: String, required: true },
    url: { type: String, required: true }
  }],
  lokAdalatGuidance: { type: String, default: '' }
}, {
  timestamps: true
});

export default mongoose.model<IHelpRoadmap>('HelpRoadmap', HelpRoadmapSchema);