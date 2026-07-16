import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

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

@Injectable({ providedIn: 'root' })
export class LawyerService {
  private apiUrl = '/api/lawyers';
  private lawyerApiUrl = '/api/lawyer';
  private consultationApiUrl = '/api/consultation';
  private reviewApiUrl = '/api/review';

  constructor(private http: HttpClient) {}

  getLawyers(filters?: { specialization?: string; city?: string; q?: string }): Observable<LawyerApiResponse<Lawyer[]>> {
    const params: any = {};
    if (filters?.specialization) params.specialization = filters.specialization;
    if (filters?.city) params.city = filters.city;
    if (filters?.q) params.q = filters.q;
    return this.http.get<LawyerApiResponse<Lawyer[]>>(this.apiUrl, { params }).pipe(
      map(res => {
        if (res.success && res.data) {
          res.data.forEach(lawyer => {
            if (lawyer.avatarUrl && lawyer.avatarUrl.startsWith('/')) {
              lawyer.avatarUrl = lawyer.avatarUrl;
            }
            if (lawyer.bannerUrl && lawyer.bannerUrl.startsWith('/')) {
              lawyer.bannerUrl = lawyer.bannerUrl;
            }
          });
        }
        return res;
      })
    );
  }

  getLawyerById(id: string): Observable<LawyerApiResponse<Lawyer>> {
    return this.http.get<LawyerApiResponse<Lawyer>>(`${this.apiUrl}/${id}`).pipe(
      map(res => {
        if (res.success && res.data) {
          const lawyer = res.data;
          if (lawyer.avatarUrl && lawyer.avatarUrl.startsWith('/')) {
            lawyer.avatarUrl = lawyer.avatarUrl;
          }
          if (lawyer.bannerUrl && lawyer.bannerUrl.startsWith('/')) {
            lawyer.bannerUrl = lawyer.bannerUrl;
          }
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
        if (res.success && res.data) {
          res.data.forEach(lawyer => {
            if (lawyer.avatarUrl && lawyer.avatarUrl.startsWith('/')) {
              lawyer.avatarUrl = lawyer.avatarUrl;
            }
            if (lawyer.bannerUrl && lawyer.bannerUrl.startsWith('/')) {
              lawyer.bannerUrl = lawyer.bannerUrl;
            }
          });
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
        if (profile) {
          if (profile.bannerUrl && profile.bannerUrl.startsWith('/')) {
            profile.bannerUrl = profile.bannerUrl;
          }
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
}
