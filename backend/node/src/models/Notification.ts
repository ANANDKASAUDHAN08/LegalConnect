import mongoose, { Document, Schema } from 'mongoose';

/**
 * Enterprise Notification — persistent MongoDB model.
 *
 * Stores user-facing notifications from all sources:
 *   - Admin broadcasts (synced from .NET SystemAnnouncements)
 *   - Legal/Act amendment alerts
 *   - Case & consultation updates
 *   - Security & session events
 *   - Profile & verification updates
 *   - System platform releases
 */

export type NotificationType =
  | 'system'
  | 'legal'
  | 'case'
  | 'lawyer'
  | 'review'
  | 'profile'
  | 'security'
  | 'verification';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface INotification extends Document {
  notifId: string;
  type: NotificationType;
  title: string;
  summary: string;
  details?: string;
  icon: string;
  actionUrl: string;
  actionLabel?: string;
  isRead: boolean;
  priority: NotificationPriority;
  /** Optional: target a specific user by ID; null = broadcast to all */
  recipientUserId?: string | null;
  /** Source system that generated this notification */
  source?: string;
  /** For admin-broadcast bridging: ID from .NET AdminNotification / SystemAnnouncement */
  externalId?: string | null;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  notifId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['system', 'legal', 'case', 'lawyer', 'review', 'profile', 'security', 'verification'],
    index: true
  },
  title: { type: String, required: true },
  summary: { type: String, required: true },
  details: { type: String, default: '' },
  icon: { type: String, required: true },
  actionUrl: { type: String, default: '' },
  actionLabel: { type: String, default: '' },
  isRead: { type: Boolean, default: false, index: true },
  priority: {
    type: String,
    required: true,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  recipientUserId: { type: String, default: null, index: true },
  source: { type: String, default: 'system' },
  externalId: { type: String, default: null, sparse: true, index: true },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Compound indexes for common query patterns
NotificationSchema.index({ isRead: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, createdAt: -1 });
NotificationSchema.index({ recipientUserId: 1, createdAt: -1 });

// Text index for full-text search across title, summary, details, type
NotificationSchema.index(
  { title: 'text', summary: 'text', details: 'text', type: 'text' },
  { weights: { title: 10, summary: 5, details: 2, type: 1 }, name: 'notification_text_search' }
);

export default mongoose.model<INotification>('Notification', NotificationSchema);