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
  role: 'Admin' | 'Lawyer' | 'Client';
  phone?: string;
  clientCity?: string;
  clientState?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  isTwoFactorEnabled: boolean;
  createdAt: string;
}

export interface AdminLawyerProfile {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  barCouncilNumber: string;
  specialization: string;
  experienceYears: number;
  city: string;
  consultationFee: number;
  inPersonFee: number;
  isVerified: boolean;
  isAvailable: boolean;
  createdAt: string;
}

export interface AdminDashboardOverview {
  totalUsers: number;
  usersThisMonth: number;
  totalLawyers: number;
  verifiedLawyers: number;
  pendingLawyerVerifications: number;
  totalConsultations: number;
  activeSessions: number;
  totalContacts: number;
  newContacts: number;
}

export interface ContactSubmissionItem {
  id: number | string;
  fullName: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'New' | 'Read' | 'Replied' | 'Archived' | string;
  createdAt: string;
  source?: string;
}

export interface SystemAnnouncementItem {
  id: number;
  version: string;
  title: string;
  summary: string;
  detailsMarkdown?: string;
  type: number;
  isModalTrigger: boolean;
  isActive: boolean;
  publishedAt: string;
}

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
  lawyerId: number;
  lawyerName: string;
  userName: string;
  userRole: string;
  rating: number;
  comment: string;
  createdAt: string;
}