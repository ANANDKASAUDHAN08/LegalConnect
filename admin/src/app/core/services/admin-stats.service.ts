import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminStatsService {
  private readonly API = environment.apiUrl;
  private readonly NODE_API = environment.nodeUrl;

  private consentStatsCache$?: Observable<any>;
  private templateStatsCache$?: Observable<any>;
  private bookmarkStatsCache$?: Observable<any>;

  constructor(private http: HttpClient) { }

  getOverview(): Observable<any> {
    return this.http.get(`${this.API}/stats/overview`);
  }

  getHealth(): Observable<any> {
    const baseApi = this.API.replace(/\/admin\/?$/, '');
    return this.http.get(`${baseApi}/health`);
  }

  getRegistrationTrends(): Observable<any> {
    return this.http.get(`${this.API}/stats/registrations`);
  }

  getLoginTrends(): Observable<any> {
    return this.http.get(`${this.API}/stats/logins`);
  }

  getConsultationTrends(): Observable<any> {
    return this.http.get(`${this.API}/stats/consultations`);
  }

  getReviewStats(): Observable<any> {
    return this.http.get(`${this.API}/stats/reviews`);
  }

  getCityStats(): Observable<any> {
    return this.http.get(`${this.API}/stats/cities`);
  }

  getSpecializationStats(): Observable<any> {
    return this.http.get(`${this.API}/stats/specializations`);
  }

  getConsentStats(): Observable<any> {
    if (!this.consentStatsCache$) {
      this.consentStatsCache$ = this.http.get(`${this.API}/stats/consent`).pipe(
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }
    return this.consentStatsCache$;
  }

  getTemplateStats(): Observable<any> {
    if (!this.templateStatsCache$) {
      this.templateStatsCache$ = this.http.get(`${this.NODE_API}/admin/templates/stats`).pipe(
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }
    return this.templateStatsCache$;
  }

  getBookmarkStats(): Observable<any> {
    if (!this.bookmarkStatsCache$) {
      this.bookmarkStatsCache$ = this.http.get(`${this.API}/bookmarks-notes/stats`).pipe(
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }
    return this.bookmarkStatsCache$;
  }
}