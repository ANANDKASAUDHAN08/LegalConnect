import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { normalizeMediaUrl, normalizeObjectMediaUrls } from '../core/utils/url-utils';

export interface Lawyer {
  _id: string;
  name: string;
  specializations: string[];
  city: string;
  experience: number;
  rating: number;
  bio: string;
  phone: string;
  email: string;
  consultationFee?: number;
  inPersonFee?: number;
  casesCompleted?: number;
  successRate?: number;
  officeAddress?: string;
  education?: string;
  languagesSpoken?: string[];
  isAvailable?: boolean;
  avatarUrl?: string;
  bannerUrl?: string;
  isVerified?: boolean;
  barCouncilNumber?: string;
  // Premium properties
  activeCourts?: string[];
  responseTime?: string;
  faqs?: { question: string; answer: string }[];
  accolades?: { year: string; title: string; description: string }[];
  casesList?: { title: string; outcome: string; description: string }[];
  availableTimeSlots?: { day: string; time: string; isBooked: boolean }[];
  workingHours?: { days: string; hours: string };
  socialLinks?: { linkedin?: string; website?: string; barAssociation?: string; bannerFit?: string; bannerPosition?: string };
}

export interface LawyerMeta {
  cities: string[];
  specializations: string[];
}

export interface LawyerApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
}

export interface Consultation {
  id: number;
  clientId?: number;
  clientName: string;
  clientEmail: string;
  lawyerId: number;
  lawyerName?: string;
  lawyerEmail?: string;
  message: string;
  status: string;
  createdAt: string;
}

export interface LawyerProfileData {
  userId?: number;
  fullName?: string;
  email?: string;
  barCouncilNumber: string;
  specialization: string;
  experienceYears: number;
  isVerified?: boolean;
  city: string;
  bio: string;
  phone: string;
  consultationFee: number;
  inPersonFee: number;
  casesCompleted: number;
  successRate: number;
  officeAddress: string;
  education: string;
  languagesSpoken: string;
  isAvailable: boolean;
  // Premium properties
  activeCourts?: string;
  responseTime?: string;
  workingHours?: string;
  faqsJson?: string;
  accoladesJson?: string;
  casesJson?: string;
  timeSlotsJson?: string;
  socialLinksJson?: string;
  bannerUrl?: string;
  updatedAt?: string;
}

export interface AdvocateTrajectoryPoint {
  label: string;
  actual: number;
  projected: number;
  views: number;
  inquiries: number;
}

export interface PracticeCategorySplit {
  category: string;
  count: number;
  percentage: number;
}

export interface FunnelMetrics {
  impressions: number;
  impressionsDelta: number;
  inquiries: number;
  inquiriesDelta: number;
  consultationsHeld: number;
  retainersSigned: number;
  conversionRate: number;
}

export interface SlaAndReputationMetrics {
  avgResponseMinutes: number;
  peerAvgResponseMinutes: number;
  responseGrade: string;
  averageRating: number;
  totalReviews: number;
  starBreakdown: { stars: number; count: number; percentage: number }[];
}

export interface AdvocateInsightsData {
  period: string;
  grossEarned: number;
  projectedRetainers: number;
  revenueDeltaPct: number;
  trajectory: AdvocateTrajectoryPoint[];
  practiceBreakdown: PracticeCategorySplit[];
  funnel: FunnelMetrics;
  slaAndReputation: SlaAndReputationMetrics;
  recentInquiries: { id: number; clientName: string; status: string; createdAt: string; estimatedFee: number }[];
}

export interface ClientSpendMilestone {
  title: string;
  amount: number;
  status: string;
  date: string;
}

export interface CasePipelineStep {
  step: number;
  title: string;
  desc: string;
  status: string;
  completedAt: string;
}

export interface DocumentReadiness {
  totalRequired: number;
  verifiedCount: number;
  pendingCount: number;
  readinessPercentage: number;
  statusLabel: string;
  missingDocuments: string[];
}

export interface CounselSlaMetrics {
  advocateName: string;
  avgResponseTime: string;
  responseGrade: string;
  daysEngaged: number;
  activeMattersCount: number;
}

export interface ClientInsightsData {
  totalSpend: number;
  budgetCap: number;
  isBudgetUserSet: boolean;
  inEscrow: number;
  remainingBudget: number;
  spendDeltaPct: number;
  spendMilestones: ClientSpendMilestone[];
  casePipeline: CasePipelineStep[];
  documentReadiness: DocumentReadiness;
  counselSla: CounselSlaMetrics;
}

@Injectable({ providedIn: 'root' })
export class LawyerService {
  private apiUrl = '/api/lawyers';
  private lawyerApiUrl = '/api/lawyer';
  private consultationApiUrl = '/api/consultation';
  private reviewApiUrl = '/api/review';

  constructor(private http: HttpClient) { }

  private transformLawyerUrls(lawyer: Lawyer): Lawyer {
    return normalizeObjectMediaUrls(lawyer, ['avatarUrl', 'bannerUrl']);
  }

  getLawyers(filters?: { specialization?: string; city?: string; q?: string }): Observable<LawyerApiResponse<Lawyer[]>> {
    const params: any = {};
    if (filters?.specialization) params.specialization = filters.specialization;
    if (filters?.city) params.city = filters.city;
    if (filters?.q) params.q = filters.q;
    return this.http.get<LawyerApiResponse<Lawyer[]>>(this.apiUrl, { params }).pipe(
      map(res => {
        if (res.success && Array.isArray(res.data)) {
          res.data.forEach(lawyer => this.transformLawyerUrls(lawyer));
        }
        return res;
      })
    );
  }

  getLawyerById(id: string): Observable<LawyerApiResponse<Lawyer>> {
    return this.http.get<LawyerApiResponse<Lawyer>>(`${this.apiUrl}/${id}`).pipe(
      map(res => {
        if (res.success && res.data) {
          this.transformLawyerUrls(res.data);
        }
        return res;
      })
    );
  }

  getLawyersByIds(ids: string[]): Observable<LawyerApiResponse<Lawyer[]>> {
    if (!ids || ids.length === 0) {
      return of({ success: true, count: 0, data: [] });
    }
    return this.http.post<LawyerApiResponse<Lawyer[]>>(`${this.apiUrl}/batch`, { ids }).pipe(
      map(res => {
        if (res.success && Array.isArray(res.data)) {
          res.data.forEach(lawyer => this.transformLawyerUrls(lawyer));
        }
        return res;
      })
    );
  }

  getMeta(): Observable<LawyerApiResponse<LawyerMeta>> {
    return this.http.get<LawyerApiResponse<LawyerMeta>>(`${this.apiUrl}/meta`);
  }

  // --- Lawyer Profile endpoints (MySQL backend) ---
  getProfile(): Observable<LawyerProfileData> {
    return this.http.get<LawyerProfileData>(`${this.lawyerApiUrl}/profile`, { withCredentials: true }).pipe(
      map(profile => {
        if (profile?.bannerUrl) {
          profile.bannerUrl = normalizeMediaUrl(profile.bannerUrl);
        }
        return profile;
      })
    );
  }

  updateProfile(data: any): Observable<any> {
    return this.http.put<any>(`${this.lawyerApiUrl}/profile`, data, { withCredentials: true });
  }

  // --- Consultation endpoints (MySQL backend) ---
  sendInquiry(data: { clientName: string; clientEmail: string; lawyerEmail: string; message: string }): Observable<any> {
    return this.http.post<any>(this.consultationApiUrl, data, { withCredentials: true });
  }

  getReceivedInquiries(): Observable<Consultation[]> {
    return this.http.get<Consultation[]>(`${this.consultationApiUrl}/received`, { withCredentials: true });
  }

  getSentInquiries(): Observable<Consultation[]> {
    return this.http.get<Consultation[]>(`${this.consultationApiUrl}/sent`, { withCredentials: true });
  }

  updateInquiryStatus(id: number, status: string): Observable<any> {
    return this.http.put<any>(`${this.consultationApiUrl}/${id}/status`, { status }, { withCredentials: true });
  }

  // --- Reviews ---
  getMyReviews(): Observable<any[]> {
    return this.http.get<any[]>(`${this.reviewApiUrl}/mine`, { withCredentials: true });
  }

  trackProfileView(lawyerIdOrEmail: number | string): Observable<any> {
    const payload = typeof lawyerIdOrEmail === 'number'
      ? { lawyerId: lawyerIdOrEmail }
      : { lawyerEmail: lawyerIdOrEmail };
    return this.http.post<any>('/api/analytics/profile-view', payload, { withCredentials: true });
  }

  getMyAnalytics(): Observable<any> {
    return this.http.get<any>('/api/analytics/my-stats', { withCredentials: true });
  }

  // --- Enterprise Deep Insights (MNC-grade) ---
  getAdvocateInsights(range: string = '30d'): Observable<AdvocateInsightsData> {
    return this.http.get<AdvocateInsightsData>(`/api/analytics/advocate-insights?range=${range}`, { withCredentials: true }).pipe(
      map(data => {
        try {
          localStorage.setItem(`lc_adv_insights_${range}`, JSON.stringify({ timestamp: Date.now(), data }));
        } catch { /* storage quota ignore */ }
        return data;
      })
    );
  }

  getClientInsights(): Observable<ClientInsightsData> {
    return this.http.get<ClientInsightsData>('/api/analytics/client-insights', { withCredentials: true }).pipe(
      map(data => {
        try {
          localStorage.setItem('lc_client_insights', JSON.stringify({ timestamp: Date.now(), data }));
        } catch { /* storage quota ignore */ }
        return data;
      })
    );
  }

  getCachedAdvocateInsights(range: string = '30d'): AdvocateInsightsData | null {
    try {
      const raw = localStorage.getItem(`lc_adv_insights_${range}`);
      return raw ? JSON.parse(raw).data : null;
    } catch {
      return null;
    }
  }

  getCachedClientInsights(): ClientInsightsData | null {
    try {
      const raw = localStorage.getItem('lc_client_insights');
      return raw ? JSON.parse(raw).data : null;
    } catch {
      return null;
    }
  }

  setLegalBudget(budget: number | null): Observable<any> {
    return this.http.put<any>('/api/analytics/set-budget', { budget }, { withCredentials: true });
  }
}