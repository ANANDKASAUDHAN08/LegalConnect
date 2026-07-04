import mongoose, { Document, Schema } from 'mongoose';

export interface ILegalResource extends Document {
  name: string;
  type: 'LegalAid' | 'Court' | 'GovernmentOffice' | 'PoliceStation' | 'Helpline';
  categories: string[];
  subcategories: string[];
  city: string;
  state?: string;
  address: string;
  alternateAddress?: string;
  contactNumber?: string[];
  faxNumber?: string[];
  email?: string[];
  website?: string;
  operatingHours?: string;
  isOpenNow: boolean;
  isVerified: boolean;
  languages: string[];
  coordinates: {
    lat: number;
    lng: number;
  };
  source?: string;
  status: 'approved' | 'pending';
  // SLSA / State Authority extended fields
  isStateAuthority?: boolean;
  isNationalAuthority?: boolean;
  executiveChairman?: string;
  memberSecretary?: string;
  patronInChief?: string;
  sclscChairman?: string;
  sclscSecretary?: string;
  sclscAddress?: string;
  additionalStaff?: Array<{ name: string; role: string }>;
  tags?: string[];
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
  state: { type: String },
  address: { type: String, required: true },
  alternateAddress: { type: String },
  contactNumber: [{ type: String }],
  faxNumber: [{ type: String }],
  email: [{ type: String }],
  website: { type: String },
  operatingHours: { type: String },
  isOpenNow: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: true },
  languages: [{ type: String, default: ['English', 'Hindi'] }],
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  source: { type: String },
  status: { type: String, enum: ['approved', 'pending'], default: 'approved' },
  // SLSA extended fields
  isStateAuthority: { type: Boolean, default: false },
  isNationalAuthority: { type: Boolean, default: false },
  executiveChairman: { type: String },
  memberSecretary: { type: String },
  patronInChief: { type: String },
  sclscChairman: { type: String },
  sclscSecretary: { type: String },
  sclscAddress: { type: String },
  additionalStaff: [{ name: { type: String }, role: { type: String } }],
  tags: [{ type: String }],
}, {
  timestamps: true
});

// Create text index for easy search on name and city
LegalResourceSchema.index({ name: 'text', city: 'text', address: 'text' });
LegalResourceSchema.index({ city: 1 });
LegalResourceSchema.index({ state: 1 });
LegalResourceSchema.index({ status: 1 });
LegalResourceSchema.index({ isStateAuthority: 1 });
LegalResourceSchema.index({ isNationalAuthority: 1 });

export default mongoose.model<ILegalResource>('LegalResource', LegalResourceSchema);