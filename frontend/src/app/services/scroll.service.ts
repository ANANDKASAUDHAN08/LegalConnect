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

  private initScrollTracking() {
    this.zone.runOutsideAngular(() => {
      this.scrollListener = () => {
        const currentScrollY = window.scrollY;

        // 1. Detect scroll direction
        const delta = currentScrollY - this.lastScrollY;
        const currentDirection = this.directionSubject.value;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const isNearBottom = currentScrollY >= docHeight - 80;

        if (Math.abs(delta) > 5) { // threshold of 5px
          const newDirection = delta > 0 ? 'down' : 'up';
          if (newDirection !== currentDirection && currentScrollY > 80 && !isNearBottom) {
            this.zone.run(() => {
              this.directionSubject.next(newDirection);
            });
          } else if (currentScrollY <= 80 && currentDirection !== 'up') {
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