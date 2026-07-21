import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FeedbackService {
  private apiUrl = '/api/feedback';

  constructor(private http: HttpClient) { }

  submitFeedback(pageSlug: string, isHelpful: boolean): Observable<any> {
    return this.http.post<any>(
      this.apiUrl,
      { pageSlug, isHelpful },
      { withCredentials: true }
    );
  }
}