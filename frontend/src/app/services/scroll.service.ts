import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, auditTime } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ScrollService implements OnDestroy {
  private lastScrollY = 0;

  // Expose scroll direction: 'up' | 'down' (throttled at ~60fps)
  private directionSubject = new BehaviorSubject<'up' | 'down'>('up');
  scrollDirection$ = this.directionSubject.asObservable().pipe(auditTime(16));

  // Expose scroll percentage (0 - 100) for reading progress (throttled at ~60fps)
  private percentageSubject = new BehaviorSubject<number>(0);
  scrollPercentage$ = this.percentageSubject.asObservable().pipe(auditTime(16));

  private isScrolledSubject = new BehaviorSubject<boolean>(false);
  isScrolled$ = this.isScrolledSubject.asObservable().pipe(auditTime(16));

  private scrollListener!: () => void;

  constructor(private zone: NgZone) {
    this.initScrollTracking();
  }

  private accumulatedDown = 0;
  private accumulatedUp = 0;
  private readonly HIDE_THRESHOLD = 40; // Must scroll down 40px continuously to hide
  private readonly SHOW_THRESHOLD = 25; // Must scroll up 25px continuously to show

  private initScrollTracking() {
    this.zone.runOutsideAngular(() => {
      this.scrollListener = () => {
        const currentScrollY = window.scrollY;

        // 1. Detect scroll direction with accumulated hysteresis (eliminates micro-jitter)
        const delta = currentScrollY - this.lastScrollY;
        const currentDirection = this.directionSubject.value;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const isNearBottom = currentScrollY >= docHeight - 80;

        if (currentScrollY <= 50) {
          // Always show at top of page
          this.accumulatedDown = 0;
          this.accumulatedUp = 0;
          if (currentDirection !== 'up') {
            this.zone.run(() => {
              this.directionSubject.next('up');
            });
          }
        } else if (delta > 0) {
          // Scrolling downwards
          this.accumulatedUp = 0;
          this.accumulatedDown += delta;
          if (this.accumulatedDown >= this.HIDE_THRESHOLD && currentDirection !== 'down' && !isNearBottom) {
            this.accumulatedDown = 0;
            this.zone.run(() => {
              this.directionSubject.next('down');
            });
          }
        } else if (delta < 0) {
          // Scrolling upwards
          this.accumulatedDown = 0;
          this.accumulatedUp += Math.abs(delta);
          if (this.accumulatedUp >= this.SHOW_THRESHOLD && currentDirection !== 'up') {
            this.accumulatedUp = 0;
            this.zone.run(() => {
              this.directionSubject.next('up');
            });
          }
        }

        // 2. Is Scrolled state (for navbar shrinking)
        const isScrolled = currentScrollY > 20;
        if (isScrolled !== this.isScrolledSubject.value) {
          this.zone.run(() => {
            this.isScrolledSubject.next(isScrolled);
          });
        }

        // 3. Calculate reading progress percentage
        if (docHeight > 0) {
          const pct = Math.min(Math.max((currentScrollY / docHeight) * 100, 0), 100);
          if (Math.abs(pct - this.percentageSubject.value) > 0.5) { // only trigger change if changed by 0.5%
            this.zone.run(() => {
              this.percentageSubject.next(pct);
            });
          }
        } else {
          if (this.percentageSubject.value !== 0) {
            this.zone.run(() => {
              this.percentageSubject.next(0);
            });
          }
        }

        this.lastScrollY = currentScrollY;
      };

      window.addEventListener('scroll', this.scrollListener, { passive: true });
    });
  }

  ngOnDestroy() {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }
  }
}