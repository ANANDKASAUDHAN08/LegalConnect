import mongoose, { Document, Schema } from 'mongoose';

export type JurisdictionLevel = 'National' | 'State' | 'District' | 'Taluka' | 'SpecialTribunal';

export interface ILegalResourceFacilities {
  hasEfiling: boolean;
  hasLADCS: boolean;
  hasVCRoom: boolean;
  hasLegalAidClinic: boolean;
  isWheelchairAccessible: boolean;
}

export type LegalResourceType =
  | 'LegalAid'
  | 'Court'
  | 'GovernmentOffice'
  | 'PoliceStation'
  | 'Helpline'
  | 'Notary'
  | 'LokAdalat'
  | 'MediationCenter'
  | 'BarAssociation';

export interface IResourceFeedbackReason {
  reason: string;
  count: number;
}

export interface IResourceFeedback {
  upvotes: number;
  downvotes: number;
  helpfulnessScore: number;
  reasons: IResourceFeedbackReason[];
}

export interface IResourceChangeLog {
  timestamp: Date;
  adminEmail: string;
  action: string;
  diff?: Record<string, any>;
}

export interface IResourceSubmitter {
  name: string;
  email?: string;
  phone?: string;
  role: 'Advocate' | 'CourtOfficial' | 'NGO' | 'Citizen';
  isGuest: boolean;
  userId?: string;
}

export type ResourceFeeType =
  | 'FreeLegalAid'
  | 'ProBono'
  | 'StatutoryNotary'
  | 'Subsidized'
  | 'StandardGovt';

export type OperatingDaysType =
  | 'Mon-Fri'
  | 'Mon-Sat'
  | 'AllWeek'
  | 'WeekendsOnly'
  | '24x7Emergency';

export interface ILegalResource extends Document {
  name: string;
  name_hi?: string;
  type: LegalResourceType;
  categories: string[];
  subcategories: string[];
  city: string;
  district?: string;
  state?: string;
  pincode?: string;
  pincodeCoverage?: string[];
  address: string;
  address_hi?: string;
  alternateAddress?: string;
  contactNumber?: string[];
  faxNumber?: string[];
  email?: string[];
  website?: string;
  operatingHours?: string;
  operatingHours_hi?: string;
  operatingDays?: OperatingDaysType;
  lunchBreak?: string;
  description_hi?: string;
  isOpenNow: boolean;
  isVerified: boolean;
  is24x7Emergency?: boolean;
  feeType?: ResourceFeeType;
  targetBeneficiaries?: string[];
  signboardImageUrl?: string;
  submitter?: IResourceSubmitter;
  languages: string[];
  coordinates: {
    lat: number;
    lng: number;
  };
  source?: string;
  status: 'approved' | 'pending';
  // Enterprise Jurisdiction Hierarchy
  jurisdictionLevel?: JurisdictionLevel;
  parentAuthorityId?: string;
  // Institutional Facilities & Infrastructure
  facilities: ILegalResourceFacilities;
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
  // Audit Verification Lifecycle
  lastAuditDate?: Date;
  verificationExpiry?: Date;
  verifiedByAdmin?: string;
  auditNotes?: string;
  // Phase 5 Enterprise Extensions
  feedback?: IResourceFeedback;
  viewsCount?: number;
  lastViewedAt?: Date;
  changeLog?: IResourceChangeLog[];
}

const LegalResourceSchema = new Schema<ILegalResource>({
  name: { type: String, required: true },
  name_hi: { type: String },
  type: {
    type: String,
    required: true,
    enum: [
      'LegalAid',
      'Court',
      'GovernmentOffice',
      'PoliceStation',
      'Helpline',
      'Notary',
      'LokAdalat',
      'MediationCenter',
      'BarAssociation'
    ]
  },
  categories: [{ type: String, required: true }],
  subcategories: [{ type: String }],
  city: { type: String, required: true },
  district: { type: String },
  state: { type: String },
  pincode: { type: String },
  pincodeCoverage: [{ type: String }],
  address: { type: String, required: true },
  address_hi: { type: String },
  alternateAddress: { type: String },
  contactNumber: [{ type: String }],
  faxNumber: [{ type: String }],
  email: [{ type: String }],
  website: { type: String },
  operatingHours: { type: String, default: '09:30 AM - 05:00 PM (Mon-Sat)' },
  operatingHours_hi: { type: String },
  operatingDays: {
    type: String,
    enum: ['Mon-Fri', 'Mon-Sat', 'AllWeek', 'WeekendsOnly', '24x7Emergency'],
    default: 'Mon-Sat'
  },
  lunchBreak: { type: String, default: '01:30 PM - 02:00 PM' },
  description_hi: { type: String },
  isOpenNow: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: true },
  is24x7Emergency: { type: Boolean, default: false },
  feeType: {
    type: String,
    enum: ['FreeLegalAid', 'ProBono', 'StatutoryNotary', 'Subsidized', 'StandardGovt'],
    default: 'FreeLegalAid'
  },
  targetBeneficiaries: [{ type: String }],
  signboardImageUrl: { type: String },
  submitter: {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    role: {
      type: String,
      enum: ['Advocate', 'CourtOfficial', 'NGO', 'Citizen'],
      default: 'Citizen'
    },
    isGuest: { type: Boolean, default: false },
    userId: { type: String }
  },
  languages: [{ type: String, default: ['English', 'Hindi'] }],
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  source: { type: String, default: 'institutional_registry' },
  status: { type: String, enum: ['approved', 'pending'], default: 'approved' },
  // Jurisdiction
  jurisdictionLevel: {
    type: String,
    enum: ['National', 'State', 'District', 'Taluka', 'SpecialTribunal'],
    default: 'District'
  },
  parentAuthorityId: { type: String },
  // Facilities
  facilities: {
    hasEfiling: { type: Boolean, default: false },
    hasLADCS: { type: Boolean, default: false },
    hasVCRoom: { type: Boolean, default: false },
    hasLegalAidClinic: { type: Boolean, default: true },
    isWheelchairAccessible: { type: Boolean, default: true }
  },
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
  // Audit Verification Lifecycle
  lastAuditDate: { type: Date, default: Date.now },
  verificationExpiry: { type: Date },
  verifiedByAdmin: { type: String, default: 'System Administrator' },
  auditNotes: { type: String },
  // Phase 5 Enterprise Extensions
  feedback: {
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    helpfulnessScore: { type: Number, default: 100 },
    reasons: [{ reason: { type: String }, count: { type: Number, default: 0 } }]
  },
  viewsCount: { type: Number, default: 0 },
  lastViewedAt: { type: Date },
  changeLog: [{
    timestamp: { type: Date, default: Date.now },
    adminEmail: { type: String, required: true },
    action: { type: String, required: true },
    diff: { type: Schema.Types.Mixed }
  }]
}, {
  timestamps: true
});

// Create text index for search across name, city, state, district and address
LegalResourceSchema.index({ name: 'text', city: 'text', state: 'text', district: 'text', address: 'text' });
LegalResourceSchema.index({ city: 1 });
LegalResourceSchema.index({ state: 1 });
LegalResourceSchema.index({ district: 1 });
LegalResourceSchema.index({ type: 1 });
LegalResourceSchema.index({ status: 1 });
LegalResourceSchema.index({ feeType: 1 });
LegalResourceSchema.index({ 'submitter.role': 1 });
LegalResourceSchema.index({ targetBeneficiaries: 1 });
LegalResourceSchema.index({ jurisdictionLevel: 1 });
LegalResourceSchema.index({ isStateAuthority: 1 });
LegalResourceSchema.index({ isNationalAuthority: 1 });
LegalResourceSchema.index({ 'facilities.hasEfiling': 1 });
LegalResourceSchema.index({ 'facilities.hasLADCS': 1 });

export default mongoose.model<ILegalResource>('LegalResource', LegalResourceSchema);