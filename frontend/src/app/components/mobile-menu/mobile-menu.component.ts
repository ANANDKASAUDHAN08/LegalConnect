import { Component, Input, Output, EventEmitter, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AsyncPipe, NgClass, NgIf, UpperCasePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { NotificationService } from '../../services/notification.service';
import { SnackbarService } from '../../services/snackbar.service';
import { TooltipDirective } from '../../directives/tooltip.directive';

@Component({
  selector: 'app-mobile-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AsyncPipe, NgClass, NgIf, UpperCasePipe, TooltipDirective],
  templateUrl: './mobile-menu.component.html',
  styleUrls: ['./mobile-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileMenuComponent implements OnDestroy {
  private _isOpen = false;
  avatarImageFailed = false;

  @Input()
  set isOpen(val: boolean) {
    this._isOpen = val;
    if (typeof document !== 'undefined') {
      if (val) {
        document.body.classList.add('mobile-menu-open');
        this.avatarImageFailed = false;

        // Reset scroll position to top when drawer is opened
        setTimeout(() => {
          const scrollContainer = document.querySelector('.mobile-drawer-panel .overflow-y-auto');
          if (scrollContainer) {
            scrollContainer.scrollTop = 0;
          }
        }, 100); // 100ms delay matches the drawer opening transition
      } else {
        document.body.classList.remove('mobile-menu-open');
      }
    }
    this.cdr.markForCheck();
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  @Output() closeMenu = new EventEmitter<void>();

  // Collapsible sub-menus for Mobile accordion view
  resourcesExpanded = false;
  professionalsExpanded = false;

  constructor(
    public auth: AuthService,
    public themeService: ThemeService,
    public notificationService: NotificationService,
    private snackbar: SnackbarService,
    public router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  isLawsRouteActive(): boolean {
    const url = this.router.url;
    return url.startsWith('/laws') && !url.startsWith('/laws/templates') && !url.includes('tab=faq');
  }

  handleImageError() {
    this.avatarImageFailed = true;
    this.cdr.markForCheck();
  }

  ngOnDestroy() {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('mobile-menu-open');
    }
  }

  toggleSection(section: 'resources' | 'professionals') {
    if (section === 'resources') {
      this.resourcesExpanded = !this.resourcesExpanded;
    } else if (section === 'professionals') {
      this.professionalsExpanded = !this.professionalsExpanded;
    }
    this.cdr.markForCheck();
  }

  onClose() {
    this.closeMenu.emit();
  }

  logout() {
    this.auth.logout().subscribe();
    this.snackbar.show('Logged out successfully. See you soon!', 'info');
    this.onClose();
  }
}