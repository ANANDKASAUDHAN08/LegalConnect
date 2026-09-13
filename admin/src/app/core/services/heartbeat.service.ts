import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Admin Cloud Keep-Alive & Heartbeat Service
 *
 * Emits background pings to prevent Render free-tier containers from going idle/sleeping.
 * Runs outside Angular's zone to prevent change detection cycles.
 */
@Injectable({ providedIn: 'root' })
export class AdminHeartbeatService {
  private static readonly PING_INTERVAL_MS = 8 * 60 * 1000; // 8 minutes
  private static readonly RESUME_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  private lastPingTime = Date.now();

  constructor(
    private http: HttpClient,
    private ngZone: NgZone
  ) {
    this.initHeartbeat();
  }

  private initHeartbeat(): void {
    if (typeof window === 'undefined') return;

    this.ngZone.runOutsideAngular(() => {
      setInterval(() => {
        this.pingBackends();
      }, AdminHeartbeatService.PING_INTERVAL_MS);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          const elapsed = Date.now() - this.lastPingTime;
          if (elapsed >= AdminHeartbeatService.RESUME_THRESHOLD_MS) {
            this.pingBackends();
          }
        }
      });
    });
  }

  public pingBackends(): void {
    this.lastPingTime = Date.now();

    const authBase = environment.apiUrl ? environment.apiUrl.replace(/\/api\/admin\/?$/, '') : '';
    const nodeBase = environment.nodeUrl ? environment.nodeUrl.replace(/\/api\/legal\/?$/, '') : '';

    const authHealthUrl = authBase ? `${authBase}/api/health` : '/api/health';
    const nodeHealthUrl = nodeBase ? `${nodeBase}/api/health` : '/api/legal/health';

    this.http.get(authHealthUrl, { responseType: 'text' }).pipe(catchError(() => of(null))).subscribe();
    this.http.get(nodeHealthUrl, { responseType: 'text' }).pipe(catchError(() => of(null))).subscribe();
  }
}
