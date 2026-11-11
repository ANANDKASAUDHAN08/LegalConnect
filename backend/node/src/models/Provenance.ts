import { Schema } from 'mongoose';

export type ReviewStatus =
  | 'imported'
  | 'extraction_pending'
  | 'needs_verification'
  | 'verified'
  | 'published'
  | 'superseded'
  | 'withdrawn';

export type ExtractionMethod =
  | 'official_feed'
  | 'gazette_extract'
  | 'curated_statute'
  | 'manual_review'
  | 'court_order_digest';

export interface IProvenance {
  sourceAuthority: string; // e.g. "Legislative Department, Ministry of Law and Justice", "India Code", "Supreme Court of India"
  sourceUrl: string; // e.g. "https://www.indiacode.nic.in/handle/123456789/20062"
  jurisdiction: string; // "Union of India" | "State of ..." | "Supreme Court"
  documentType: string; // "Central Act" | "State Act" | "Ordinance" | "Gazette Notification" | "Supreme Court Judgment" | "Citizen Safeguard" | "Statutory Rule"
  publicationDate?: string;
  commencementDate?: string;
  retrievedAt: Date;
  lastVerifiedAt: Date;
  contentVersion: number;
  sourceHash?: string; // SHA-256 hash of original text
  extractionMethod: ExtractionMethod;
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  license: string; // "Government Open Data License (GODL-India)" / "Public Domain"
  supersededBy?: string;
}

export const ProvenanceSchema = new Schema<IProvenance>(
  {
    sourceAuthority: { type: String, required: true, default: 'Legislative Department, Government of India' },
    sourceUrl: { type: String, required: true, default: 'https://www.indiacode.nic.in' },
    jurisdiction: { type: String, required: true, default: 'Union of India' },
    documentType: { type: String, required: true, default: 'Central Act' },
    publicationDate: { type: String },
    commencementDate: { type: String },
    retrievedAt: { type: Date, default: Date.now },
    lastVerifiedAt: { type: Date, default: Date.now },
    contentVersion: { type: Number, default: 1 },
    sourceHash: { type: String },
    extractionMethod: {
      type: String,
      enum: ['official_feed', 'gazette_extract', 'curated_statute', 'manual_review', 'court_order_digest'],
      default: 'curated_statute'
    },
    reviewStatus: {
      type: String,
      enum: ['imported', 'extraction_pending', 'needs_verification', 'verified', 'published', 'superseded', 'withdrawn'],
      default: 'verified',
      index: true
    },
    reviewedBy: { type: String, default: 'LegalConnect Legal Information Directorate' },
    license: { type: String, default: 'Government Open Data License (GODL-India)' },
    supersededBy: { type: String }
  },
  { _id: false }
);