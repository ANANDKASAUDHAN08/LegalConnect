import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { AsyncPipe, NgClass, NgIf, UpperCasePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ScrollService } from '../../services/scroll.service';
import { LawyerService } from '../../services/lawyer.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AsyncPipe, NgClass, NgIf, UpperCasePipe, TooltipDirective],
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

  activeTab: 'home' | 'laws' | 'sos' | 'lawyers' | 'dashboard' = 'home';

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
    if (url.includes('/home') || url === '/') {
      this.activeTab = 'home';
    } else if (url.includes('/laws')) {
      this.activeTab = 'laws';
    } else if (url.includes('/lawyers') || url.includes('/specializations')) {
      this.activeTab = 'lawyers';
    } else if (url.includes('/dashboard') || url.includes('/portal') || url.includes('/workstation') || url.includes('/profile')) {
      this.activeTab = 'dashboard';
    } else {
      // Default fallback
      this.activeTab = 'home';
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
