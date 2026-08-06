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
  lawyerName: string;
  clientName: string;
  scheduledAt: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | string;
  fee: number;
}