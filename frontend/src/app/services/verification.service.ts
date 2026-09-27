import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PhoneOtpResponse {
  isSuccess: boolean;
  message: string;
  channel: 'whatsapp' | 'email' | 'sms';
  targetPhone: string;
  cooldownSeconds: number;
  directWhatsAppUrl?: string;
  canFallbackToEmail: boolean;
  userEmail?: string;
}

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

  sendPhoneOtp(phone: string, channel: 'whatsapp' | 'email' | 'sms' = 'whatsapp'): Observable<PhoneOtpResponse> {
    return this.http.post<PhoneOtpResponse>(`${this.apiUrl}/phone/send-otp`, { phone, channel }, this.httpOptions);
  }

  verifyPhoneOtp(phone: string, code: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/phone/verify-otp`, { phone, code }, this.httpOptions);
  }
}