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
  inPersonFee: number;
  casesCompleted: number;
  successRate: number;
  officeAddress: string;
  education: string;
  languagesSpoken: string[];
  isAvailable: boolean;
  avatarUrl?: string;
  bannerUrl?: string;
  gender?: string;

  // Premium additions
  activeCourts: string[];
  responseTime: string;
  faqs: { question: string; answer: string }[];
  accolades: { year: string; title: string; description: string }[];
  casesList: { title: string; outcome: string; description: string }[];
  availableTimeSlots: { day: string; time: string; isBooked: boolean }[];
  workingHours?: { days: string; hours: string };
  socialLinks?: { linkedin?: string; website?: string; barAssociation?: string; bannerFit?: string; bannerPosition?: string };
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
  inPersonFee: { type: Number, default: 0 },
  casesCompleted: { type: Number, default: 150 },
  successRate: { type: Number, default: 95 },
  officeAddress: { type: String, default: '' },
  education: { type: String, default: '' },
  languagesSpoken: [{ type: String }],
  isAvailable: { type: Boolean, default: true },
  avatarUrl: { type: String },
  bannerUrl: { type: String },
  gender: { type: String, default: 'Male' },

  // Premium schema properties
  activeCourts: [{ type: String }],
  responseTime: { type: String, default: 'Responds within 24 hours' },
  faqs: [{
    question: { type: String },
    answer: { type: String }
  }],
  accolades: [{
    year: { type: String },
    title: { type: String },
    description: { type: String }
  }],
  casesList: [{
    title: { type: String },
    outcome: { type: String },
    description: { type: String }
  }],
  availableTimeSlots: [{
    day: { type: String },
    time: { type: String },
    isBooked: { type: Boolean, default: false }
  }],
  workingHours: {
    days: { type: String, default: 'Mon - Fri' },
    hours: { type: String, default: '9:00 AM - 6:00 PM' }
  },
  socialLinks: {
    linkedin: { type: String, default: '' },
    website: { type: String, default: '' },
    barAssociation: { type: String, default: '' },
    bannerFit: { type: String, default: 'cover' },
    bannerPosition: { type: String, default: 'center' }
  }
}, {
  timestamps: true
});

LawyerSchema.index({ name: 'text', specializations: 'text', city: 'text', bio: 'text' });
LawyerSchema.index({ city: 1 });

export default mongoose.model<ILawyer>('Lawyer', LawyerSchema);