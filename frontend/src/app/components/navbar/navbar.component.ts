import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AsyncPipe, NgClass, NgIf } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { NotificationService } from '../../services/notification.service';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AsyncPipe, NgClass, NgIf],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {
  isScrolled = false;
  menuOpen = false;

  constructor(
    public auth: AuthService, 
    public themeService: ThemeService,
    public notificationService: NotificationService,
    private snackbar: SnackbarService
  ) {

    window.addEventListener('scroll', () => {
      this.isScrolled = window.scrollY > 20;
    });
  }

  toggleMenu() { this.menuOpen = !this.menuOpen; }

  logout() {
    this.auth.logout();
    this.snackbar.show('Logged out successfully. See you soon!', 'info');
    this.menuOpen = false;
  }
}
