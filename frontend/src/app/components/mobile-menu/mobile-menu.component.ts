import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AsyncPipe, NgClass, NgIf, UpperCasePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { NotificationService } from '../../services/notification.service';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-mobile-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AsyncPipe, NgClass, NgIf, UpperCasePipe],
  templateUrl: './mobile-menu.component.html',
  styleUrls: ['./mobile-menu.component.scss']
})
export class MobileMenuComponent {
  @Input() isOpen = false;
  @Output() closeMenu = new EventEmitter<void>();

  // Collapsible sub-menus for Mobile accordion view
  lawyersExpanded = false;
  resourcesExpanded = false;
  professionalsExpanded = false;

  constructor(
    public auth: AuthService,
    public themeService: ThemeService,
    public notificationService: NotificationService,
    private snackbar: SnackbarService
  ) {}

  toggleSection(section: 'lawyers' | 'resources' | 'professionals') {
    if (section === 'lawyers') {
      this.lawyersExpanded = !this.lawyersExpanded;
    } else if (section === 'resources') {
      this.resourcesExpanded = !this.resourcesExpanded;
    } else if (section === 'professionals') {
      this.professionalsExpanded = !this.professionalsExpanded;
    }
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
