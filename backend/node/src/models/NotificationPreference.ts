import mongoose, { Document, Schema } from 'mongoose';

/**
 * Per-user notification delivery preferences.
 *
 * Persisted in MongoDB so preferences survive server restarts.
 * Keyed by `userId` (from auth token) or `sessionId` for anonymous users.
 */

export interface IChannelPreference {
  inApp: boolean;
  email: boolean;
  push: boolean;
  whatsapp?: boolean;
}

export interface IQuietHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  allowUrgent: boolean;
}

export interface INotificationPreference extends Document {
  userId: string;
  system: IChannelPreference;
  legal: IChannelPreference;
  case: IChannelPreference;
  lawyer: IChannelPreference;
  review: IChannelPreference;
  profile: IChannelPreference;
  security: IChannelPreference;
  verification: IChannelPreference;
  quietHours?: IQuietHours;
  soundProfile?: string;
  soundVolume?: number;
  hapticFeedback?: boolean;
  targetRole?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChannelSchema = {
  inApp: { type: Boolean, default: true },
  email: { type: Boolean, default: true },
  push: { type: Boolean, default: false },
  whatsapp: { type: Boolean, default: false }
};

const NotificationPreferenceSchema = new Schema<INotificationPreference>({
  userId: { type: String, required: true, unique: true, index: true },
  system: { type: ChannelSchema, default: () => ({ inApp: true, email: true, push: false, whatsapp: false }) },
  legal: { type: ChannelSchema, default: () => ({ inApp: true, email: true, push: true, whatsapp: true }) },
  case: { type: ChannelSchema, default: () => ({ inApp: true, email: true, push: true, whatsapp: true }) },
  lawyer: { type: ChannelSchema, default: () => ({ inApp: true, email: true, push: true, whatsapp: true }) },
  review: { type: ChannelSchema, default: () => ({ inApp: true, email: false, push: false, whatsapp: false }) },
  profile: { type: ChannelSchema, default: () => ({ inApp: true, email: true, push: false, whatsapp: false }) },
  security: { type: ChannelSchema, default: () => ({ inApp: true, email: true, push: true, whatsapp: true }) },
  verification: { type: ChannelSchema, default: () => ({ inApp: true, email: true, push: true, whatsapp: false }) },
  quietHours: {
    enabled: { type: Boolean, default: false },
    startTime: { type: String, default: '22:00' },
    endTime: { type: String, default: '07:30' },
    allowUrgent: { type: Boolean, default: true }
  },
  soundProfile: { type: String, default: 'gavel' },
  soundVolume: { type: Number, default: 80, min: 0, max: 100 },
  hapticFeedback: { type: Boolean, default: true },
  targetRole: { type: String, default: 'All' }
}, {
  timestamps: true,
  strict: false
});

export default mongoose.model<INotificationPreference>('NotificationPreference', NotificationPreferenceSchema);