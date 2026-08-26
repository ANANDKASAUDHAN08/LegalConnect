import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminStatsService {
  private readonly API = environment.apiUrl;
  private readonly NODE_API = environment.nodeUrl;

  private overviewCache: any = null;
  private secondaryStatsCache: any = null;
  private chartDataCache: any = null;

  private consentStatsCache$?: Observable<any>;
  private templateStatsCache$?: Observable<any>;
  private bookmarkStatsCache$?: Observable<any>;

  constructor(private http: HttpClient) { }

  getCachedOverview(): any | null {
    return this.overviewCache;
  }

  getCachedSecondaryStats(): any | null {
    return this.secondaryStatsCache;
  }

  setCachedSecondaryStats(data: any): void {
    this.secondaryStatsCache = data;
  }

  getCachedChartData(): any | null {
    return this.chartDataCache;
  }

  setCachedChartData(data: any): void {
    this.chartDataCache = data;
  }

  getOverview(): Observable<any> {
    return this.http.get<any>(`${this.API}/stats/overview`).pipe(
      tap(res => {
        if (res) this.overviewCache = res;
      })
    );
  }

  getHealth(): Observable<any> {
    const baseApi = this.API.replace(/\/admin\/?$/, '');
    return this.http.get(`${baseApi}/health`);
  }

  getNodeHealth(): Observable<any> {
    return this.http.get(`${this.NODE_API}/health`);
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

  // ── Tier 2: Advanced Analytics ────────────────────────────────

  getAuthProviderStats(): Observable<any> {
    return this.http.get(`${this.API}/stats/auth-providers`);
  }

  getChurnRiskStats(): Observable<any> {
    return this.http.get(`${this.API}/stats/churn-risk`);
  }

  getSupportBreakdown(): Observable<any> {
    return this.http.get(`${this.API}/stats/support-breakdown`);
  }

  getCopExpiryWarnings(): Observable<any> {
    return this.http.get(`${this.API}/stats/cop-expiry`);
  }

  getSecurityPosture(): Observable<any> {
    return this.http.get(`${this.API}/stats/security-posture`);
  }

  getSlaCompliance(): Observable<any> {
    return this.http.get(`${this.API}/stats/sla-compliance`);
  }

  // ── Tier 3: Computed Analytics ────────────────────────────────

  getConversionFunnel(): Observable<any> {
    return this.http.get(`${this.API}/stats/conversion-funnel`);
  }

  getLawyerLeaderboard(): Observable<any> {
    return this.http.get(`${this.API}/stats/lawyer-leaderboard`);
  }

  getRevenuePotential(): Observable<any> {
    return this.http.get(`${this.API}/stats/revenue-potential`);
  }

  getSupplyDemand(): Observable<any> {
    return this.http.get(`${this.API}/stats/supply-demand`);
  }

  getRetentionCohorts(): Observable<any> {
    return this.http.get(`${this.API}/stats/retention`);
  }

  getVerificationVelocity(): Observable<any> {
    return this.http.get(`${this.API}/stats/verification-velocity`);
  }

  getTelemetryStream(): Observable<any> {
    return new Observable(observer => {
      const eventSource = new EventSource('/api/admin/telemetry/stream');
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          observer.next(data);
        } catch (e) {
          observer.next(event.data);
        }
      };
      eventSource.onerror = (error) => {
        observer.error(error);
      };
      return () => eventSource.close();
    });
  }
}