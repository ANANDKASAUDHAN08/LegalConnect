import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomTemplateField {
  key: string;
  label: string;
  placeholder: string;
  type: string;
  defaultValue: string;
  helpTip?: string;
}

export interface ICustomTemplate extends Document {
  templateId: string;
  userId: string;
  title: string;
  actRef: string;
  category: string;
  description: string;
  fields: ICustomTemplateField[];
  body: string;
  updatedAt: Date;
}

const CustomTemplateFieldSchema = new Schema<ICustomTemplateField>({
  key: { type: String, required: true },
  label: { type: String, required: true },
  placeholder: { type: String, required: true },
  type: { type: String, required: true, default: 'text' },
  defaultValue: { type: String, default: '' },
  helpTip: { type: String }
}, { _id: false });

const CustomTemplateSchema = new Schema<ICustomTemplate>({
  templateId: { type: String, required: true },
  userId: { type: String, required: true },
  title: { type: String, required: true },
  actRef: { type: String, default: 'Custom Template' },
  category: { type: String, default: 'commercial' },
  description: { type: String },
  fields: [CustomTemplateFieldSchema],
  body: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

CustomTemplateSchema.index({ templateId: 1, userId: 1 }, { unique: true });
CustomTemplateSchema.index({ userId: 1 });

export default mongoose.model<ICustomTemplate>('CustomTemplate', CustomTemplateSchema);