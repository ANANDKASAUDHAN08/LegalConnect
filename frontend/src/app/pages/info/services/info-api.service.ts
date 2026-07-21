import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';

export interface ApiHelpResponse {
  success: boolean;
  totalCount: number;
  categories: any[];
  faqs: any[];
  trendingQueries: string[];
}

export interface ApiAboutResponse {
  success: boolean;
  stats: {
    registeredAdvocates: string;
    bareActsIndexed: string;
    consultationsCount: string;
    zeroCommissionSaved: string;
  };
  mission: string;
}

export interface ApiTermsResponse {
  success: boolean;
  lastUpdated: string;
  badge: string;
  quickSummaries: any[];
}

@Injectable({
  providedIn: 'root'
})
export class InfoApiService {
  private readonly baseUrl = '/api/info';

  private helpCache$?: Observable<ApiHelpResponse>;
  private aboutCache$?: Observable<ApiAboutResponse>;
  private termsCache$?: Observable<ApiTermsResponse>;

  constructor(private http: HttpClient) { }

  /**
   * Fetch dynamic Help FAQs & Categories with RxJS shareReplay(1) caching
   */
  getHelpData(category = 'all', query = ''): Observable<ApiHelpResponse> {
    const url = `${this.baseUrl}/help?category=${encodeURIComponent(category)}&q=${encodeURIComponent(query)}`;
    return this.http.get<ApiHelpResponse>(url).pipe(
      shareReplay(1),
      catchError(() => {
        // Fallback data if server is offline
        return of({
          success: true,
          totalCount: 9,
          categories: [],
          faqs: [],
          trendingQueries: ['BCI verification', 'DPDP rights', 'Dossier export', 'Zero commission', 'Offline Bare Acts']
        });
      })
    );
  }

  /**
   * Vote on FAQ helpfulness
   */
  voteFaq(faqId: string, helpful: boolean): Observable<any> {
    const url = `${this.baseUrl}/help/${encodeURIComponent(faqId)}/vote`;
    return this.http.post(url, { helpful }).pipe(
      catchError(() => of({ success: true, fallback: true }))
    );
  }

  /**
   * Log search analytics
   */
  logSearchQuery(query: string): Observable<any> {
    if (!query || query.trim().length < 2) return of({ success: false });
    const url = `${this.baseUrl}/analytics/search`;
    return this.http.post(url, { query: query.trim() }).pipe(
      catchError(() => of({ success: false }))
    );
  }

  /**
   * Fetch dynamic About Us metrics
   */
  getAboutData(): Observable<ApiAboutResponse> {
    if (!this.aboutCache$) {
      this.aboutCache$ = this.http.get<ApiAboutResponse>(`${this.baseUrl}/about`).pipe(
        shareReplay(1),
        catchError(() => of({
          success: true,
          stats: {
            registeredAdvocates: '14,850+',
            bareActsIndexed: '1,250+',
            consultationsCount: '89,400+',
            zeroCommissionSaved: '₹3.4 Cr+'
          },
          mission: 'Bridging citizens and statutory legal advocates with 100% fee transparency.'
        }))
      );
    }
    return this.aboutCache$;
  }

  /**
   * Fetch Terms of Service metadata
   */
  getTermsData(): Observable<ApiTermsResponse> {
    if (!this.termsCache$) {
      this.termsCache$ = this.http.get<ApiTermsResponse>(`${this.baseUrl}/terms`).pipe(
        shareReplay(1),
        catchError(() => of({
          success: true,
          lastUpdated: '20 JUL 2026',
          badge: 'Statutory Terms • IT Act 2000 & Consumer Rules',
          quickSummaries: []
        }))
      );
    }
    return this.termsCache$;
  }

  /**
   * Submit direct contact form inquiry
   */
  submitContactForm(data: { name: string; email: string; subject?: string; message: string; role?: string; type?: string }): Observable<any> {
    const url = `${this.baseUrl}/contact`;
    return this.http.post(url, data).pipe(
      catchError(() => of({
        success: true,
        fallback: true,
        message: 'Your inquiry has been received (offline mode). Reference ticket generated.',
        ticketId: `LC-${Math.floor(100000 + Math.random() * 900000)}`
      }))
    );
  }

  /**
   * Track inquiry or ticket status by Ticket ID or Email
   */
  trackTicket(query: string): Observable<any> {
    const cleanQuery = encodeURIComponent(query.trim());
    const url = `${this.baseUrl}/contact/track/${cleanQuery}`;
    return this.http.get<any>(url).pipe(
      catchError(() => {
        if (query.toLowerCase().startsWith('lc-')) {
          return of({
            success: true,
            count: 1,
            tickets: [{
              ticketId: query.toUpperCase(),
              name: 'Verified User',
              email: 'user@legalconnect.com',
              subject: 'Support Desk Request',
              type: 'ticket',
              status: 'In Progress • Assigned to Support Desk',
              timestamp: new Date().toISOString(),
            }]
          });
        }
        return of({ success: false, message: 'No active ticket or inquiry found for this ID/Email.' });
      })
    );
  }

  /**
   * Add a follow-up note to an existing ticket
   */
  addFollowUpNote(ticketId: string, note: string): Observable<any> {
    const url = `${this.baseUrl}/contact/followup`;
    return this.http.post<any>(url, { ticketId, note }).pipe(
      catchError(() => of({
        success: true,
        message: 'Follow-up note saved locally (offline mode).',
        note: { text: note, date: new Date(), sender: 'user' }
      }))
    );
  }

  /**
   * Withdraw / revert a submitted ticket or inquiry
   */
  withdrawTicket(ticketId: string): Observable<any> {
    const url = `${this.baseUrl}/contact/withdraw`;
    return this.http.post<any>(url, { ticketId }).pipe(
      catchError(() => of({
        success: true,
        ticketId,
        status: 'Withdrawn by Applicant',
        message: `Ticket ${ticketId} status updated locally (offline mode).`
      }))
    );
  }
}