import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { AsyncPipe, NgClass, NgIf, UpperCasePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ScrollService } from '../../services/scroll.service';
import { LawyerService } from '../../services/lawyer.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { IconComponent } from '../icon/icon.component';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AsyncPipe, NgClass, NgIf, UpperCasePipe, TooltipDirective, IconComponent],
  templateUrl: './bottom-nav.component.html',
  styleUrls: ['./bottom-nav.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BottomNavComponent implements OnInit, OnDestroy {
  showNav = true;
  isKeyboardVisible = false;
  showSosOverlay = false;
  initialHeight = window.innerHeight;
  hasUpcomingAppointment = false;

  activeTab: 'home' | 'laws' | 'sos' | 'lawyers' | 'dashboard' | 'none' = 'home';

  private scrollSub!: Subscription;
  private routerSub!: Subscription;
  private authSub!: Subscription;

  constructor(
    public auth: AuthService,
    private scrollService: ScrollService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private lawyerService: LawyerService
  ) { }

  ngOnInit() {
    // 1. Scroll tracking to hide/show bar
    this.scrollSub = this.scrollService.scrollDirection$.subscribe(dir => {
      this.showNav = dir === 'up';
      this.cdr.markForCheck();
    });

    // 2. Active tab route tracking
    this.updateActiveTab(this.router.url);
    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.updateActiveTab(event.urlAfterRedirects || event.url);
    });

    // 3. Upcoming appointment check
    this.authSub = this.auth.currentUser$.subscribe(user => {
      if (user) {
        const getInquiries$ = user.role === 'Lawyer'
          ? this.lawyerService.getReceivedInquiries()
          : this.lawyerService.getSentInquiries();

        getInquiries$.subscribe({
          next: (inquiries) => {
            // Check if there is any inquiry with status 'approved' or 'pending'
            this.hasUpcomingAppointment = inquiries && inquiries.some(i => i.status === 'approved' || i.status === 'pending');
            this.cdr.markForCheck();
          },
          error: (err) => {
            console.warn('Could not fetch inquiries for bottom nav badge', err);
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

  ngOnDestroy() {
    if (this.scrollSub) this.scrollSub.unsubscribe();
    if (this.routerSub) this.routerSub.unsubscribe();
    if (this.authSub) this.authSub.unsubscribe();
  }

  @HostListener('window:resize')
  onResize() {
    // If current window height is significantly smaller than initial (keyboard open)
    this.isKeyboardVisible = window.innerHeight < this.initialHeight - 150;
    this.cdr.markForCheck();
  }

  toggleSos(event: Event) {
    event.stopPropagation();
    this.showSosOverlay = !this.showSosOverlay;
    this.cdr.markForCheck();
  }

  closeSos() {
    this.showSosOverlay = false;
    this.cdr.markForCheck();
  }

  private updateActiveTab(url: string) {
    const cleanUrl = url.split('?')[0].split('#')[0];

    if (cleanUrl === '/' || cleanUrl === '/home') {
      this.activeTab = 'home';
    } else if (cleanUrl.startsWith('/laws')) {
      this.activeTab = 'laws';
    } else if (cleanUrl.startsWith('/lawyers') || cleanUrl.startsWith('/specializations') || cleanUrl.startsWith('/legal-resources')) {
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
    } else if (cleanUrl.startsWith('/find-help')) {
      this.activeTab = 'sos';
    } else {
      this.activeTab = 'none';
    }
    this.cdr.markForCheck();
  }

  // Generate dynamic routing for the workstation tab based on roles
  getDashboardRoute(user: any): string {
    if (!user) return '/login';
    if (user.role === 'Lawyer') return '/lawyer/workstation';
    return '/client/portal';
  }
}
