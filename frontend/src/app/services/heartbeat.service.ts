import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Cloud Keep-Alive & Heartbeat Service
 *
 * Prevents cloud container spin-down (e.g. Render 15-minute inactivity idle sleep)
 * by issuing low-overhead health check pings while the web application is active.
 *
 * Runs timers outside Angular zone to ensure zero impact on change detection and frame rates.
 */
@Injectable({ providedIn: 'root' })
export class HeartbeatService {
  private static readonly PING_INTERVAL_MS = 8 * 60 * 1000; // 8 minutes (safely below 15m idle threshold)
  private static readonly VISIBILITY_RESUME_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  private lastPingTime = Date.now();
  private intervalId: any = null;

  constructor(
    private http: HttpClient,
    private ngZone: NgZone
  ) {
    this.initHeartbeat();
  }

  private initHeartbeat(): void {
    if (typeof window === 'undefined') return;

    // Run interval timer outside Angular's zone to prevent change detection churn
    this.ngZone.runOutsideAngular(() => {
      this.intervalId = setInterval(() => {
        this.pingBackends();
      }, HeartbeatService.PING_INTERVAL_MS);

      // Listen to tab foreground events (laptop lid open / tab switch)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          const elapsed = Date.now() - this.lastPingTime;
          if (elapsed >= HeartbeatService.VISIBILITY_RESUME_THRESHOLD_MS) {
            this.pingBackends();
          }
        }
      });
    });
  }

  /**
   * Pings both microservice health endpoints concurrently.
   * Silently swallows errors to ensure zero telemetry or UI pollution.
   */
  public pingBackends(): void {
    this.lastPingTime = Date.now();

    const authUrl = environment.authApiUrl ? `${environment.authApiUrl}/api/health` : '/api/health';
    const nodeUrl = environment.nodeApiUrl ? `${environment.nodeApiUrl}/api/health` : '/api/legal/health';

    this.http.get(authUrl, { responseType: 'text' }).pipe(catchError(() => of(null))).subscribe();
    this.http.get(nodeUrl, { responseType: 'text' }).pipe(catchError(() => of(null))).subscribe();
  }
}