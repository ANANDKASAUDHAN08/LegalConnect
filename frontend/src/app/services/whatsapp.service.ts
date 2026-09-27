import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface WhatsAppStatusResponse {
  isConfigured: boolean;
  activeProvider: string;
  hasMetaCredentials: boolean;
  hasTwilioCredentials: boolean;
  hasBrevoCredentials: boolean;
  userHasWhatsAppEnabled: boolean;
  userWhatsAppPhone?: string;
}

export interface WhatsAppSendResult {
  isSuccess: boolean;
  provider: string;
  message: string;
  targetPhone: string;
  directWhatsAppUrl?: string;
  externalMessageId?: string;
  errorDetails?: string;
  sentAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class WhatsAppService {
  private http = inject(HttpClient);
  private apiUrl = '/api/whatsapp';
  private httpOptions = {
    withCredentials: true
  };

  getStatus(): Observable<WhatsAppStatusResponse> {
    return this.http.get<WhatsAppStatusResponse>(`${this.apiUrl}/status`, this.httpOptions);
  }

  sendTestAlert(phone?: string): Observable<WhatsAppSendResult> {
    return this.http.post<WhatsAppSendResult>(`${this.apiUrl}/test`, { phone }, this.httpOptions);
  }
}