import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

export interface ReviewItem {
  id?: number;
  userId?: number; // Nullable user ownership link
  userRole: 'Client' | 'Lawyer' | 'Guest';
  authorName: string;
  targetName: string;
  rating: number;
  content: string;
  createdAt: string;
  likes?: number;
  advocateReply?: string;
  advocateReplyStatus?: string;
  isVerifiedClient?: boolean;
  moderationStatus?: string;
  consultationId?: number;
  redactedContent?: string;
  lastEditedAt?: string;
  originalContent?: string;
  isDisputeRequested?: boolean;
  disputeReason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private apiUrl = '/api/review';
  private cachedReviews$: Observable<any> | null = null;
  private cachedStats$: Observable<any> | null = null;

  constructor(private http: HttpClient) { }

  clearCache() {
    this.cachedReviews$ = null;
    this.cachedStats$ = null;
  }

  getReviews(targetName?: string, page = 1, limit = 100): Observable<any> {
    if (!targetName && page === 1 && limit >= 100 && this.cachedReviews$) {
      return this.cachedReviews$;
    }

    const params: any = { page, limit };
    if (targetName) params.targetName = targetName;

    const req$ = this.http.get<any>(this.apiUrl, { params }).pipe(
      shareReplay(1)
    );

    if (!targetName && page === 1 && limit >= 100) {
      this.cachedReviews$ = req$;
    }

    return req$;
  }

  getStats(targetName?: string): Observable<any> {
    if (!targetName && this.cachedStats$) {
      return this.cachedStats$;
    }

    const params: any = {};
    if (targetName) params.targetName = targetName;

    const req$ = this.http.get<any>(`${this.apiUrl}/stats`, { params }).pipe(
      shareReplay(1)
    );

    if (!targetName) {
      this.cachedStats$ = req$;
    }

    return req$;
  }

  submitReview(reviewData: {
    rating: number;
    content: string;
    targetName: string;
    authorName?: string;
  }): Observable<ReviewItem> {
    this.clearCache();
    return this.http.post<ReviewItem>(this.apiUrl, reviewData, { withCredentials: true });
  }

  updateReview(id: number, reviewData: {
    rating: number;
    content: string;
    targetName: string;
  }): Observable<ReviewItem> {
    this.clearCache();
    return this.http.put<ReviewItem>(`${this.apiUrl}/${id}`, reviewData, { withCredentials: true });
  }

  deleteReview(id: number): Observable<any> {
    this.clearCache();
    return this.http.delete<any>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  likeReview(id: number): Observable<ReviewItem> {
    return this.http.post<ReviewItem>(`${this.apiUrl}/${id}/like`, {});
  }

  unlikeReview(id: number): Observable<ReviewItem> {
    return this.http.post<ReviewItem>(`${this.apiUrl}/${id}/unlike`, {});
  }

  flagReview(id: number, reason: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/flag`, { reason });
  }

  submitDispute(id: number, reason: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/dispute`, { reason }, { withCredentials: true });
  }
}