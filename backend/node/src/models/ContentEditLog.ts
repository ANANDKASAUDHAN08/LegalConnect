import mongoose, { Document, Schema } from 'mongoose';

export interface IContentEditLog extends Document {
  entityType: 'StatutoryRight' | 'EmergencyScenario' | 'DiagnosticCrisis' | 'DiagnosticRule';
  entityId: string;
  editedBy: string;
  editedAt: Date;
  fieldChanged: string;
  previousValue: any;
  newValue: any;
  version: number;
  changeNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContentEditLogSchema = new Schema<IContentEditLog>(
  {
    entityType: {
      type: String,
      required: true,
      enum: ['StatutoryRight', 'EmergencyScenario', 'DiagnosticCrisis', 'DiagnosticRule'],
      index: true
    },
    entityId: { type: String, required: true, index: true },
    editedBy: { type: String, required: true, default: 'admin' },
    editedAt: { type: Date, default: Date.now, index: true },
    fieldChanged: { type: String, required: true },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    version: { type: Number, default: 1 },
    changeNote: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.models.ContentEditLog ||
  mongoose.model<IContentEditLog>('ContentEditLog', ContentEditLogSchema);