import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
}

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private apiUrl = 'http://localhost:8888/api/review';

  constructor(private http: HttpClient) {}

  getReviews(targetName?: string): Observable<ReviewItem[]> {
    const params: any = {};
    if (targetName) params.targetName = targetName;
    return this.http.get<ReviewItem[]>(this.apiUrl, { params });
  }

  submitReview(reviewData: {
    rating: number;
    content: string;
    targetName: string;
    authorName?: string;
  }): Observable<ReviewItem> {
    return this.http.post<ReviewItem>(this.apiUrl, reviewData, { withCredentials: true });
  }

  updateReview(id: number, reviewData: {
    rating: number;
    content: string;
    targetName: string;
  }): Observable<ReviewItem> {
    return this.http.put<ReviewItem>(`${this.apiUrl}/${id}`, reviewData, { withCredentials: true });
  }

  deleteReview(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  likeReview(id: number): Observable<ReviewItem> {
    return this.http.post<ReviewItem>(`${this.apiUrl}/${id}/like`, {});
  }

  unlikeReview(id: number): Observable<ReviewItem> {
    return this.http.post<ReviewItem>(`${this.apiUrl}/${id}/unlike`, {});
  }
}
