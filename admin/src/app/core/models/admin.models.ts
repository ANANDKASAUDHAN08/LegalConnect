export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages?: number;
}

export interface AdminUser {
  id: number;
  fullName: string;
  email: string;
  role: 'Admin' | 'Lawyer' | 'Client' | string;
  phone?: string;
  clientCity?: string;
  clientState?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  isTwoFactorEnabled?: boolean;
  mustChangePassword?: boolean;
  authProvider?: string;
  lastLoginAt?: string | Date;
  lastIpAddress?: string;
  createdAt: string;
}

export interface UserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminLawyerProfile {
  id: number;
  userId?: number;
  fullName: string;
  email: string;
  phone?: string;
  barCouncilNumber?: string;
  barCouncilId?: string;
  specialization: string;
  experienceYears: number;
  city: string;
  state?: string;
  consultationFee?: number;
  inPersonFee?: number;
  isVerified: boolean;
  isAvailable?: boolean;
  rating?: number;
  reviewCount?: number;
  createdAt?: string;
}

export type LawyerProfile = AdminLawyerProfile;

export interface LawyerListResponse {
  lawyers: LawyerProfile[];
  total: number;
  page: number;
  limit: number;
}

export interface DashboardOverview {
  totalUsers: number;
  usersThisMonth?: number;
  totalLawyers: number;
  verifiedLawyers: number;
  pendingLawyerVerifications?: number;
  totalConsultations?: number;
  activeConsultations?: number;
  pendingReviews?: number;
  totalHelplines?: number;
  totalResources?: number;
  systemStatus?: string;
  activeSessions?: number;
  totalContacts?: number;
  newContacts?: number;
}

export type AdminDashboardOverview = DashboardOverview;

export interface ContactSubmissionItem {
  id: number | string;
  fullName: string;
  email: string;
  phone?: string;
  subject: string;
  userEmail?: string;
  message: string;
  status: 'New' | 'Read' | 'In Progress' | 'Escalated to DPO' | 'Resolved' | 'Archived' | string;
  priority?: 'Urgent' | 'High' | 'Normal' | 'Low' | string;
  category?: 'General' | 'Lawyer Verification' | 'Billing' | 'Technical Bug' | 'DPDP Grievance' | string;
  assignedAgent?: string;
  slaDueDate?: string;
  slaTarget?: string;
  createdAt: string;
  source?: string;
  resolutionNote?: string;
  internalNotesJson?: string;
  internalNotes?: Array<{ text: string; date: string; author: string }>;
}

export type SupportTicketItem = ContactSubmissionItem;

export interface SystemAnnouncementItem {
  id: number;
  _id?: any;
  version?: string;
  title: string;
  summary?: string;
  message?: string;
  detailsMarkdown?: string;
  type: number;
  isModalTrigger?: boolean;
  isActive: boolean;
  publishedAt?: string;
  createdAt?: string;
  expiresAt?: string;
}

export type AnnouncementItem = SystemAnnouncementItem;

export interface ActiveSessionItem {
  id: number;
  userId: number;
  userEmail: string;
  userName: string;
  userRole: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastActive: string;
}

export interface LoginHistoryItem {
  id: number;
  userId?: number;
  userName?: string;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
  status: string;
  failureReason?: string;
  loginTime: string;
}

export interface AdminReviewItem {
  id: number;
  targetId?: number;
  targetName?: string;
  targetType?: string;
  lawyerId?: number;
  lawyerName?: string;
  userName: string;
  userRole?: string;
  rating: number;
  comment?: string;
  content?: string;
  moderationStatus?: 'Approved' | 'Pending' | 'Flagged' | 'Hidden' | string;
  flagReason?: string;
  advocateReply?: string;
  advocateReplyStatus?: string;
  isVerifiedClient?: boolean;
  isApproved?: boolean;
  consultationId?: number;
  ipAddress?: string;
  riskScore?: number;
  redactedContent?: string;
  lastEditedAt?: string;
  originalContent?: string;
  isDisputeRequested?: boolean;
  disputeReason?: string;
  disputeRequestedAt?: string;
  createdAt: string;
}

export type ReviewItem = AdminReviewItem;

export interface HelplineItem {
  id: string | number;
  name: string;
  number: string;
  category: string;
  location: string;
  description?: string;
  is24x7: boolean;
}

export interface ResourceItem {
  id: string | number;
  title: string;
  category: string;
  description: string;
  linkUrl?: string;
  contactNumber?: string;
  address?: string;
  city?: string;
  state?: string;
}

export interface ConsultationItem {
  id: number;
  client?: string;
  clientUser?: string;
  phone?: string;
  lawyer?: string;
  sla?: string;
  priority?: string;
  message?: string;
  lawyerName?: string;
  clientName?: string;
  lawyerEmail?: string;
  clientEmail?: string;
  lawyerPhone?: string;
  clientPhone?: string;
  specialization?: string;
  consultationType?: 'online' | 'in_person' | 'phone' | string;
  scheduledAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  status: string;
  fee?: number;
  paymentStatus?: 'paid' | 'pending' | 'refunded' | 'failed' | string;
  duration?: number;
  notes?: string;
  adminRemark?: string;
  rating?: number;
  createdAt?: string;
  auditLog?: Array<{ action: string; timestamp: string; actor: string; details?: string }>;
  auditLogJson?: string;
}

// ---------------------------------------------------------------
// Generic API Response Wrapper
// ---------------------------------------------------------------

/** Standard paginated API response envelope */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: Pagination;
  metrics?: any;
}

/** Standard list API response with total count */
export interface ApiListResponse<T> {
  success: boolean;
  data: T[];
  total?: number;
  pagination?: Pagination;
}

// ---------------------------------------------------------------
// Template Models
// ---------------------------------------------------------------

export interface TemplateItem {
  _id: string;
  title: string;
  category: string;
  description?: string;
  actRef?: string;
  body?: string;
  fields?: Array<{ label?: string; type?: string; name?: string; required?: boolean }>;
  content?: string;
  language?: string;
  downloadCount?: number;
  viewCount?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplateStats {
  totalTemplates: number;
  totalDrafts?: number;
  totalDownloads?: number;
  totalViews?: number;
  categoryCounts?: Record<string, number>;
  categoryStats?: Array<{ _id: string; count?: number; countDocs?: number }>;
}

// ---------------------------------------------------------------
// Notification Models
// ---------------------------------------------------------------

export interface NotificationItem {
  id: number;
  userId?: number;
  userName?: string;
  type: string;
  title: string;
  message: string;
  channel?: 'push' | 'email' | 'sms' | 'in_app' | string;
  status?: 'sent' | 'delivered' | 'failed' | 'pending' | string;
  isRead?: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------
// Moderation Models
// ---------------------------------------------------------------

export interface ModerationReport {
  id: number;
  reportRef?: string;
  targetId: number;
  targetType: 'Review' | 'Lawyer' | 'LegalResource' | 'Helpline' | 'BareActSection' | string;
  targetName?: string;
  reason: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  status: 'Pending' | 'Resolved' | 'Dismissed' | string;
  reporterName?: string;
  reporterIp?: string;
  duplicateCount?: number;
  moderatorNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionAction?: string;
  createdAt: string;
}

export interface ModerationStats {
  totalReports: number;
  pendingCount: number;
  resolvedCount: number;
  criticalPendingCount: number;
  reportsByType?: Record<string, number>;
  reportsBySeverity?: Record<string, number>;
}