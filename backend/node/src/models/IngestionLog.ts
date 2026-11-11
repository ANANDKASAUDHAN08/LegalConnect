import mongoose, { Document, Schema } from 'mongoose';

export interface IIngestionLog extends Document {
  sourceAuthority: string; // e.g. "India Code (Legislative Department)", "Supreme Court of India"
  sourceUrl: string;
  actCode?: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  recordsProcessed: number;
  recordsImported: number;
  recordsSkipped: number;
  documentHash?: string;
  license: string;
  notes?: string;
  errorDetails?: string;
  durationMs: number;
  retrievedAt: Date;
  createdAt: Date;
}

const IngestionLogSchema = new Schema<IIngestionLog>(
  {
    sourceAuthority: { type: String, required: true, index: true },
    sourceUrl: { type: String, required: true },
    actCode: { type: String, index: true },
    status: { type: String, enum: ['SUCCESS', 'PARTIAL', 'FAILED'], required: true, index: true },
    recordsProcessed: { type: Number, default: 0 },
    recordsImported: { type: Number, default: 0 },
    recordsSkipped: { type: Number, default: 0 },
    documentHash: { type: String },
    license: { type: String, default: 'Government Open Data License (GODL-India)' },
    notes: { type: String },
    errorDetails: { type: String },
    durationMs: { type: Number, default: 0 },
    retrievedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

export const IngestionLogModel = mongoose.model<IIngestionLog>('IngestionLog', IngestionLogSchema);
export default IngestionLogModel;