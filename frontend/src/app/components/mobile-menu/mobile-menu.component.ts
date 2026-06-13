import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AsyncPipe, NgClass, NgIf, UpperCasePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { NotificationService } from '../../services/notification.service';
import { SnackbarService } from '../../services/snackbar.service';
import { LocationService } from '../../services/location.service';
import { Subscription } from 'rxjs';
import { TooltipDirective } from '../../directives/tooltip.directive';

@Component({
  selector: 'app-mobile-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AsyncPipe, NgClass, NgIf, UpperCasePipe, TooltipDirective],
  templateUrl: './mobile-menu.component.html',
  styleUrls: ['./mobile-menu.component.scss']
})
export class MobileMenuComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Output() closeMenu = new EventEmitter<void>();
  @Output() openLocationSelector = new EventEmitter<void>();

  // Collapsible sub-menus for Mobile accordion view
  resourcesExpanded = false;
  professionalsExpanded = false;

  activeLocation = 'New Delhi';
  private locationSub!: Subscription;

  constructor(
    public auth: AuthService,
    public themeService: ThemeService,
    public notificationService: NotificationService,
    private snackbar: SnackbarService,
    private locationService: LocationService
  ) { }

  ngOnInit() {
    this.locationSub = this.locationService.activeLocation$.subscribe(loc => {
      this.activeLocation = loc;
    });
  }

  ngOnDestroy() {
    if (this.locationSub) {
      this.locationSub.unsubscribe();
    }
  }

  toggleSection(section: 'resources' | 'professionals') {
    if (section === 'resources') {
      this.resourcesExpanded = !this.resourcesExpanded;
    } else if (section === 'professionals') {
      this.professionalsExpanded = !this.professionalsExpanded;
    }
  }

  onClose() {
    this.closeMenu.emit();
  }

  openMobileLocation() {
    this.openLocationSelector.emit();
    this.onClose();
  }

  logout() {
    this.auth.logout().subscribe();
    this.snackbar.show('Logged out successfully. See you soon!', 'info');
    this.onClose();
  }

  truncateLocation(loc: string): string {
    if (!loc) return '';
    return loc.length > 20 ? loc.substring(0, 17) + '...' : loc;
  }
}
