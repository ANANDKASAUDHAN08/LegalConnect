import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

@Injectable({ providedIn: 'root' })
export class LawyerService {
  private apiUrl = 'http://localhost:8888/api/lawyers';
  private lawyerApiUrl = 'http://localhost:8888/api/lawyer';
  private consultationApiUrl = 'http://localhost:8888/api/consultation';

  constructor(private http: HttpClient) {}

  getLawyers(filters?: { specialization?: string; city?: string; q?: string }): Observable<LawyerApiResponse<Lawyer[]>> {
    const params: any = {};
    if (filters?.specialization) params.specialization = filters.specialization;
    if (filters?.city) params.city = filters.city;
    if (filters?.q) params.q = filters.q;
    return this.http.get<LawyerApiResponse<Lawyer[]>>(this.apiUrl, { params });
  }

  getMeta(): Observable<LawyerApiResponse<LawyerMeta>> {
    return this.http.get<LawyerApiResponse<LawyerMeta>>(`${this.apiUrl}/meta`);
  }

  // --- Lawyer Profile endpoints (MySQL backend) ---
  getProfile(): Observable<any> {
    return this.http.get<any>(`${this.lawyerApiUrl}/profile`, { withCredentials: true });
  }

  updateProfile(data: { barCouncilNumber: string; specialization: string; experienceYears: number; city: string; bio: string; phone: string }): Observable<any> {
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
}
