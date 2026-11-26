import mongoose, { Schema, Document } from 'mongoose';

export interface IPracticeSearchLog extends Document {
  query: string;
  count: number;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PracticeSearchLogSchema = new Schema<IPracticeSearchLog>(
  {
    query: { type: String, required: true, index: true },
    count: { type: Number, default: 1 },
    lastSeen: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.models['PracticeSearchLog'] ||
  mongoose.model<IPracticeSearchLog>('PracticeSearchLog', PracticeSearchLogSchema);