import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class VerificationService {
  private apiUrl = '/api/verification';

  private httpOptions = {
    withCredentials: true
  };

  constructor(private http: HttpClient) { }

  verifyEmail(token: string, email: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/email/verify?token=${token}&email=${email}`, this.httpOptions);
  }

  resendEmailVerification(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/email/resend`, { email }, this.httpOptions);
  }

  verifyPhone(code: string, firebaseToken?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/phone/verify`, { code, firebaseToken }, this.httpOptions);
  }
}