import mongoose, { Document, Schema } from 'mongoose';

export interface ILawyer extends Document {
  name: string;
  specializations: string[];
  city: string;
  experience: number;
  rating: number;
  bio: string;
  phone: string;
  email: string;
  isVerified?: boolean;
  consultationFee: number;
  officeAddress: string;
  education: string;
  languagesSpoken: string[];
  isAvailable: boolean;
}

const LawyerSchema = new Schema<ILawyer>({
  name: { type: String, required: true },
  specializations: [{ type: String, required: true }],
  city: { type: String, required: true },
  experience: { type: Number, required: true },
  rating: { type: Number, required: true, min: 0, max: 5 },
  bio: { type: String, required: true },
  phone: { type: String },
  email: { type: String },
  isVerified: { type: Boolean, default: false },
  consultationFee: { type: Number, default: 0 },
  officeAddress: { type: String, default: '' },
  education: { type: String, default: '' },
  languagesSpoken: [{ type: String }],
  isAvailable: { type: Boolean, default: true }
}, {
  timestamps: true
});

LawyerSchema.index({ name: 'text', specializations: 'text', city: 'text', bio: 'text' });

export default mongoose.model<ILawyer>('Lawyer', LawyerSchema);
