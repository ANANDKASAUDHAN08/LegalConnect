import mongoose, { Document, Schema } from 'mongoose';

export interface IContactTicket extends Document {
  ticketId: string;
  name: string;
  email: string;
  role?: string;
  subject: string;
  message: string;
  type: string; // 'ticket' | 'callback' | 'grievance'
  status: string; // 'Open' | 'Scheduled' | 'Acknowledged (DPO Desk)' | 'Resolved'
  slaTarget: string;
  notes: Array<{ text: string; date: Date; sender: string }>;
  timestamp: Date;
}

const ContactTicketSchema = new Schema<IContactTicket>({
  ticketId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, index: true },
  role: { type: String, default: '' },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'ticket', index: true },
  status: { type: String, default: 'Open' },
  slaTarget: { type: String, default: '24 Hours' },
  notes: [{
    text: { type: String, required: true },
    date: { type: Date, default: Date.now },
    sender: { type: String, default: 'user' }
  }],
  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: true
});

export default mongoose.model<IContactTicket>('ContactTicket', ContactTicketSchema);