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

@Injectable({ providedIn: 'root' })
export class LawyerService {
  private apiUrl = 'http://localhost:5000/api/lawyers';

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
}
