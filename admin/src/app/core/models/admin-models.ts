export interface DashboardOverview {
  totalUsers: number;
  totalLawyers: number;
  verifiedLawyers: number;
  activeConsultations: number;
  pendingReviews: number;
  totalHelplines: number;
  totalResources: number;
  systemStatus: string;
}

export interface AdminUser {
  id: string | number;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
}

export interface UserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

export interface LawyerProfile {
  id: string | number;
  fullName: string;
  email: string;
  phone?: string;
  specialization: string;
  experienceYears: number;
  city: string;
  state: string;
  barCouncilId?: string;
  isVerified: boolean;
  rating: number;
  reviewCount: number;
}

export interface LawyerListResponse {
  lawyers: LawyerProfile[];
  total: number;
  page: number;
  limit: number;
}

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

export interface AnnouncementItem {
  id: string | number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical' | 'update';
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface SupportTicketItem {
  id: string | number;
  subject: string;
  userEmail: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
}

export interface ReviewItem {
  id: string | number;
  lawyerName: string;
  userName: string;
  rating: number;
  comment: string;
  isApproved: boolean;
  createdAt: string;
}

export interface ConsultationItem {
  id: string | number;
  lawyerName: string;
  clientName: string;
  scheduledAt: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  fee: number;
}