import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import Notification from '../../models/Notification';
import NotificationPreference from '../../models/NotificationPreference';
import { optionalAuth, AuthenticatedRequest } from '../../middlewares/auth';

const router = Router();
router.use(optionalAuth);

// ─────────────────────────────────────────────────────────────────
// Types (shared with frontend — kept here for backwards compat)
// ─────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'system'
  | 'legal'
  | 'case'
  | 'lawyer'
  | 'review'
  | 'profile'
  | 'security'
  | 'verification';

export interface EnterpriseNotification {
  id: string;
  type: NotificationType;
  title: string;
  summary: string;
  details?: string;
  icon: string;
  actionUrl: string;
  actionLabel?: string;
  isRead: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: string;
  recipientUserId?: string;
  metadata?: Record<string, any>;
}

// Default preferences (used as fallback when no DB record exists)
const DEFAULT_PREFERENCES = {
  system: { inApp: true, email: true, push: false, whatsapp: false },
  legal: { inApp: true, email: true, push: true, whatsapp: true },
  case: { inApp: true, email: true, push: true, whatsapp: true },
  lawyer: { inApp: true, email: true, push: true, whatsapp: true },
  review: { inApp: true, email: false, push: false, whatsapp: false },
  profile: { inApp: true, email: true, push: false, whatsapp: false },
  security: { inApp: true, email: true, push: true, whatsapp: true },
  verification: { inApp: true, email: true, push: true, whatsapp: false },
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '07:30',
    allowUrgent: true
  },
  soundProfile: 'gavel',
  hapticFeedback: true,
  targetRole: 'All'
};

// Helper: Extract userId from auth headers (JWT, cookie, or header)
function getUserId(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  const cookieUserId = (req as any).userId;
  const headerUserId = req.headers['x-user-id'] as string;
  const queryUserId = req.query['userId'] as string;
  return authReq.userId || cookieUserId || headerUserId || queryUserId || 'anonymous';
}

// Helper: Map a Mongoose document to the frontend EnterpriseNotification shape
function toEnterpriseNotification(doc: any): EnterpriseNotification {
  return {
    id: doc.notifId,
    type: doc.type,
    title: doc.title,
    summary: doc.summary,
    details: doc.details || undefined,
    icon: doc.icon,
    actionUrl: doc.actionUrl,
    actionLabel: doc.actionLabel || undefined,
    isRead: doc.isRead,
    priority: doc.priority,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    recipientUserId: doc.recipientUserId || undefined,
    metadata: doc.metadata || undefined
  };
}

// ─────────────────────────────────────────────────────────────────
// SSE (Server-Sent Events) Real-time Stream Infrastructure
// ─────────────────────────────────────────────────────────────────
interface SseClient {
  res: Response;
  userId: string;
}

const sseClients = new Set<SseClient>();

export function broadcastNotificationEvent(event: string, data: any): void {
  const targetUserId = data?.notification?.recipientUserId;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      // If targeted notification, only send to recipient; otherwise send to all
      if (targetUserId && client.userId && client.userId !== 'anonymous' && client.userId !== String(targetUserId)) {
        continue;
      }
      client.res.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// 0. GET /api/info/notifications/stream
//    High-performance, low-latency Server-Sent Events (SSE) real-time feed
// ─────────────────────────────────────────────────────────────────
router.get('/notifications/stream', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*'
  });

  res.write(`: LegalConnect SSE notification stream connected\n\n`);
  const client: SseClient = { res, userId: getUserId(req) };
  sseClients.add(client);

  // Send periodic 25-second keepalive comment to avoid reverse proxy timeouts
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeatTimer);
      sseClients.delete(client);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    sseClients.delete(client);
  });
});

// ─────────────────────────────────────────────────────────────────
// 1. GET /api/info/notifications
//    List notifications with type/status/search filters, pagination, and counts
// ─────────────────────────────────────────────────────────────────
router.get('/notifications', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const type = (req.query['type'] as string) || 'all';
  const status = (req.query['status'] as string) || 'all';
  const query = (req.query['q'] as string) || '';
  const page = Math.max(1, parseInt((req.query['page'] as string) || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query['limit'] as string) || '20', 10)));

  // Recipient scoping: public broadcasts + directed notifications for this user
  const recipientCondition = (userId && userId !== 'anonymous')
    ? {
        $or: [
          { recipientUserId: null },
          { recipientUserId: { $exists: false } },
          { recipientUserId: userId }
        ]
      }
    : {
        $or: [
          { recipientUserId: null },
          { recipientUserId: { $exists: false } }
        ]
      };

  // Build MongoDB query conditions
  const conditions: any[] = [recipientCondition];

  if (type !== 'all') {
    conditions.push({ type });
  }

  if (status === 'unread') {
    conditions.push({ isRead: false });
  } else if (status === 'read') {
    conditions.push({ isRead: true });
  }

  if (query.trim()) {
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    conditions.push({
      $or: [
        { title: { $regex: escaped, $options: 'i' } },
        { summary: { $regex: escaped, $options: 'i' } },
        { details: { $regex: escaped, $options: 'i' } },
        { type: { $regex: escaped, $options: 'i' } }
      ]
    });
  }

  const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };

  // Execute paginated query + total count in parallel
  const [docs, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter)
  ]);

  const notifications = docs.map(toEnterpriseNotification);

  // Group by date
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  const grouped: { today: EnterpriseNotification[]; yesterday: EnterpriseNotification[]; earlier: EnterpriseNotification[] } = {
    today: [],
    yesterday: [],
    earlier: []
  };

  notifications.forEach(item => {
    const itemDate = new Date(item.createdAt).toDateString();
    if (itemDate === todayStr) {
      grouped.today.push(item);
    } else if (itemDate === yesterdayStr) {
      grouped.yesterday.push(item);
    } else {
      grouped.earlier.push(item);
    }
  });

  // Aggregate type counts efficiently via a single pipeline scoped to user
  const [countResult, unreadCount, allCount] = await Promise.all([
    Notification.aggregate([
      { $match: recipientCondition },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]),
    Notification.countDocuments({ ...recipientCondition, isRead: false }),
    Notification.countDocuments(recipientCondition)
  ]);

  const countsByType: Record<string, number> = {
    all: allCount,
    unread: unreadCount
  };
  countResult.forEach((row: { _id: string; count: number }) => {
    countsByType[row._id] = row.count;
  });

  res.json({
    success: true,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    unreadCount,
    countsByType,
    grouped,
    notifications
  });
}));

// ─────────────────────────────────────────────────────────────────
// 2. POST /api/info/notifications/:id/read
//    Mark a single notification as read
// ─────────────────────────────────────────────────────────────────
router.post('/notifications/:id/read', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params['id'] as string;

  const result = await Notification.findOneAndUpdate(
    { notifId: id },
    { $set: { isRead: true } },
    { new: true }
  );

  if (!result) {
    throw AppError.notFound('Notification not found.');
  }

  const unreadCount = await Notification.countDocuments({ isRead: false });

  broadcastNotificationEvent('notification_read', {
    id,
    isRead: true,
    unreadCount,
    notification: toEnterpriseNotification(result)
  });

  res.json({
    success: true,
    message: 'Notification marked as read.',
    unreadCount,
    notification: toEnterpriseNotification(result)
  });
}));

// ─────────────────────────────────────────────────────────────────
// 3. POST /api/info/notifications/mark-all-read
//    Mark all (or specific type) notifications as read
// ─────────────────────────────────────────────────────────────────
router.post('/notifications/mark-all-read', asyncHandler(async (req: Request, res: Response) => {
  const { type } = req.body;

  const filter: Record<string, any> = { isRead: false };
  if (type && type !== 'all') {
    filter.type = type;
  }

  const result = await Notification.updateMany(filter, { $set: { isRead: true } });
  const unreadCount = await Notification.countDocuments({ isRead: false });

  broadcastNotificationEvent('notification_all_read', {
    type: type || 'all',
    unreadCount
  });

  res.json({
    success: true,
    message: `Marked ${result.modifiedCount} notification(s) as read.`,
    unreadCount
  });
}));

// ─────────────────────────────────────────────────────────────────
// 4. DELETE /api/info/notifications/:id
//    Delete a single notification
// ─────────────────────────────────────────────────────────────────
router.delete('/notifications/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params['id'] as string;

  const result = await Notification.findOneAndDelete({ notifId: id });

  if (!result) {
    throw AppError.notFound('Notification not found.');
  }

  const unreadCount = await Notification.countDocuments({ isRead: false });

  broadcastNotificationEvent('notification_deleted', {
    id,
    unreadCount
  });

  res.json({
    success: true,
    message: 'Notification deleted successfully.',
    unreadCount
  });
}));

// ─────────────────────────────────────────────────────────────────
// 5. POST /api/info/notifications/bulk
//    Bulk action (markRead or delete) by IDs
// ─────────────────────────────────────────────────────────────────
router.post('/notifications/bulk', asyncHandler(async (req: Request, res: Response) => {
  const { action, ids } = req.body;

  if (!action || !Array.isArray(ids) || ids.length === 0) {
    throw AppError.badRequest('Valid action ("markRead" or "delete") and array of IDs required.');
  }

  if (action === 'markRead') {
    await Notification.updateMany(
      { notifId: { $in: ids } },
      { $set: { isRead: true } }
    );
    const unreadCount = await Notification.countDocuments({ isRead: false });

    broadcastNotificationEvent('notification_bulk', {
      action: 'markRead',
      ids,
      unreadCount
    });

    res.json({
      success: true,
      message: `Marked ${ids.length} notifications as read.`,
      unreadCount
    });
  } else if (action === 'delete') {
    await Notification.deleteMany({ notifId: { $in: ids } });
    const unreadCount = await Notification.countDocuments({ isRead: false });

    broadcastNotificationEvent('notification_bulk', {
      action: 'delete',
      ids,
      unreadCount
    });

    res.json({
      success: true,
      message: `Deleted ${ids.length} notifications.`,
      unreadCount
    });
  } else {
    throw AppError.badRequest('Invalid action specified.');
  }
}));

// ─────────────────────────────────────────────────────────────────
// 6. GET /api/info/notifications/preferences
//    Retrieve user notification preferences (from MongoDB)
// ─────────────────────────────────────────────────────────────────
router.get('/notifications/preferences', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);

  const prefs = await NotificationPreference.findOne({ userId }).lean();

  res.json({
    success: true,
    data: prefs ? {
      system: prefs.system,
      legal: prefs.legal,
      case: prefs.case,
      lawyer: prefs.lawyer,
      review: prefs.review,
      profile: prefs.profile,
      security: prefs.security,
      verification: prefs.verification,
      quietHours: prefs.quietHours || DEFAULT_PREFERENCES.quietHours,
      soundProfile: prefs.soundProfile || DEFAULT_PREFERENCES.soundProfile,
      hapticFeedback: prefs.hapticFeedback ?? DEFAULT_PREFERENCES.hapticFeedback,
      targetRole: prefs.targetRole || DEFAULT_PREFERENCES.targetRole
    } : DEFAULT_PREFERENCES
  });
}));

// ─────────────────────────────────────────────────────────────────
// 7. PUT /api/info/notifications/preferences
//    Upsert user notification preferences (persisted in MongoDB)
// ─────────────────────────────────────────────────────────────────
router.put('/notifications/preferences', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const incoming = req.body;

  if (!incoming || typeof incoming !== 'object') {
    throw AppError.badRequest('Preferences payload must be a valid object.');
  }

  const updated = await NotificationPreference.findOneAndUpdate(
    { userId },
    { $set: { ...incoming, userId } },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  res.json({
    success: true,
    message: 'Notification preferences updated successfully.',
    data: updated ? {
      system: updated.system,
      legal: updated.legal,
      case: updated.case,
      lawyer: updated.lawyer,
      review: updated.review,
      profile: updated.profile,
      security: updated.security,
      verification: updated.verification,
      quietHours: updated.quietHours,
      soundProfile: updated.soundProfile,
      hapticFeedback: updated.hapticFeedback,
      targetRole: updated.targetRole
    } : incoming
  });
}));

// ─────────────────────────────────────────────────────────────────
// 8. POST /api/info/notifications/ingest
//    Bridge endpoint: accepts notifications from external sources
//    (e.g. .NET admin broadcasts, background workers, webhook events)
//    Designed so other services can push into the user notification feed.
// ─────────────────────────────────────────────────────────────────
router.post('/notifications/ingest', asyncHandler(async (req: Request, res: Response) => {
  const {
    type = 'system',
    title,
    summary,
    details,
    icon = 'bell',
    actionUrl = '',
    actionLabel = '',
    priority = 'normal',
    source = 'external',
    externalId,
    recipientUserId,
    metadata
  } = req.body;

  if (!title || !summary) {
    throw AppError.badRequest('Title and summary are required to ingest a notification.');
  }

  // Idempotency: Skip if an external notification with the same externalId already exists
  if (externalId) {
    const existing = await Notification.findOne({ externalId });
    if (existing) {
      return res.json({
        success: true,
        message: 'Notification already exists (idempotent).',
        notification: toEnterpriseNotification(existing)
      });
    }
  }

  const notifId = `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const doc = await Notification.create({
    notifId,
    type,
    title,
    summary,
    details: details || '',
    icon,
    actionUrl,
    actionLabel,
    isRead: false,
    priority,
    source,
    externalId: externalId || null,
    recipientUserId: recipientUserId || null,
    metadata: metadata || {}
  });

  const formatted = toEnterpriseNotification(doc);
  const unreadCount = await Notification.countDocuments({ isRead: false });

  // Broadcast in real-time over SSE to all connected users (<50ms latency)
  broadcastNotificationEvent('notification_created', {
    notification: formatted,
    unreadCount
  });

  res.status(201).json({
    success: true,
    message: 'Notification ingested successfully.',
    notification: formatted
  });
}));

export default router;