import mongoose, { Document, Schema } from 'mongoose';

export interface ILegalResource extends Document {
  name: string;
  type: 'LegalAid' | 'Court' | 'GovernmentOffice' | 'PoliceStation' | 'Helpline';
  categories: string[];
  subcategories: string[];
  city: string;
  address: string;
  contactNumber?: string;
  website?: string;
  operatingHours?: string;
  isOpenNow: boolean;
  isVerified: boolean;
  languages: string[];
  coordinates: {
    lat: number;
    lng: number;
  };
}

const LegalResourceSchema = new Schema<ILegalResource>({
  name: { type: String, required: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['LegalAid', 'Court', 'GovernmentOffice', 'PoliceStation', 'Helpline'] 
  },
  categories: [{ type: String, required: true }],
  subcategories: [{ type: String }],
  city: { type: String, required: true },
  address: { type: String, required: true },
  contactNumber: { type: String },
  website: { type: String },
  operatingHours: { type: String },
  isOpenNow: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: true },
  languages: [{ type: String, default: ['English', 'Hindi'] }],
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  }
}, {
  timestamps: true
});

// Create text index for easy search on name and city
LegalResourceSchema.index({ name: 'text', city: 'text', address: 'text' });

export default mongoose.model<ILegalResource>('LegalResource', LegalResourceSchema);
