import mongoose, { Document, Schema } from 'mongoose';

export interface IHelpCategory extends Document {
  id: string; // Slug key e.g. 'Property Dispute'
  name: string;
  icon: string;
  description: string;
  subcategories: string[];
}

const HelpCategorySchema = new Schema<IHelpCategory>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  icon: { type: String, required: true },
  description: { type: String, required: true },
  subcategories: [{ type: String }]
}, {
  timestamps: true
});

export default mongoose.model<IHelpCategory>('HelpCategory', HelpCategorySchema);