import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  inject
} from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { AsyncPipe, NgClass, NgIf } from '@angular/common';
import { Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service';
import { LawyerService } from '../../services/lawyer.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { IconComponent } from '../icon/icon.component';
import { SosModalComponent } from '../sos-modal/sos-modal.component';

export type BottomNavTab = 'home' | 'lawyers' | 'laws' | 'dashboard' | 'sos' | 'none';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [
    RouterLink,
    AsyncPipe,
    NgClass,
    NgIf,
    IconComponent,
    TooltipDirective,
    SosModalComponent
  ],
  templateUrl: './bottom-nav.component.html',
  styleUrls: ['./bottom-nav.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BottomNavComponent implements OnInit, OnDestroy {
  public auth = inject(AuthService);
  private lawyerService = inject(LawyerService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  showNav = true;
  isKeyboardVisible = false;
  showSosOverlay = false;
  hasUpcomingAppointment = false;
  activeTab: BottomNavTab = 'home';

  private initialHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  private routerSub!: Subscription;
  private authSub!: Subscription;

  ngOnInit(): void {
    // 1. Initial route tab tracking
    this.updateActiveTab(this.router.url);

    // 2. Route change tracking
    this.routerSub = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event) => {
      this.updateActiveTab(event.urlAfterRedirects || event.url);
      if (this.showSosOverlay) {
        this.closeSos();
      }
    });

    // 3. Upcoming appointment indicator (safe single-shot subscription per auth update)
    this.authSub = this.auth.currentUser$.subscribe((user) => {
      if (user) {
        const inquiries$ = user.role === 'Lawyer'
          ? this.lawyerService.getReceivedInquiries()
          : this.lawyerService.getSentInquiries();

        inquiries$.pipe(take(1)).subscribe({
          next: (inquiries) => {
            this.hasUpcomingAppointment = Array.isArray(inquiries) &&
              inquiries.some((i) => i.status === 'approved' || i.status === 'pending');
            this.cdr.markForCheck();
          },
          error: () => {
            this.hasUpcomingAppointment = false;
            this.cdr.markForCheck();
          }
        });
      } else {
        this.hasUpcomingAppointment = false;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routerSub) this.routerSub.unsubscribe();
    if (this.authSub) this.authSub.unsubscribe();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (typeof window !== 'undefined') {
      this.isKeyboardVisible = window.innerHeight < this.initialHeight - 150;
      this.cdr.markForCheck();
    }
  }

  // Keyboard shortcut: Escape to dismiss SOS Console
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showSosOverlay) {
      this.closeSos();
    }
  }

  toggleSos(event: Event): void {
    event.stopPropagation();
    this.showSosOverlay = !this.showSosOverlay;
    this.triggerHaptic(this.showSosOverlay ? 'emergency' : 'light');
    this.cdr.markForCheck();
  }

  closeSos(): void {
    this.showSosOverlay = false;
    this.cdr.markForCheck();
  }

  private updateActiveTab(url: string): void {
    const cleanUrl = url.split('?')[0].split('#')[0];

    if (cleanUrl === '/' || cleanUrl === '/home') {
      this.activeTab = 'home';
    } else if (cleanUrl.startsWith('/laws')) {
      this.activeTab = 'laws';
    } else if (
      cleanUrl.startsWith('/lawyers') ||
      cleanUrl.startsWith('/specializations')
    ) {
      this.activeTab = 'lawyers';
    } else if (
      cleanUrl.startsWith('/client') ||
      cleanUrl.startsWith('/lawyer') ||
      cleanUrl.startsWith('/dashboard') ||
      cleanUrl.startsWith('/portal') ||
      cleanUrl.startsWith('/workstation') ||
      cleanUrl.startsWith('/profile') ||
      cleanUrl.startsWith('/login') ||
      cleanUrl.startsWith('/register') ||
      cleanUrl.startsWith('/settings') ||
      cleanUrl.startsWith('/notifications')
    ) {
      this.activeTab = 'dashboard';
    } else if (cleanUrl.startsWith('/find-help') || cleanUrl.startsWith('/legal-resources')) {
      this.activeTab = 'sos';
    } else {
      this.activeTab = 'none';
    }
    this.cdr.markForCheck();
  }

  getDashboardRoute(user: any): string {
    if (!user) return '/login';
    if (user.role === 'Lawyer') return '/lawyer/workstation';
    return '/client/portal';
  }

  private triggerHaptic(type: 'light' | 'emergency'): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(type === 'emergency' ? [40, 80, 40] : 15);
      } catch {
        // Ignore if vibration is restricted by browser policy
      }
    }
  }
}