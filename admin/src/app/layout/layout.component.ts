import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AdminAuthService } from '../core/auth.service';
import { TooltipDirective } from '../shared/directives/tooltip.directive';
import { DialogComponent } from '../shared/components/dialog/dialog.component';

@Component({
  selector: 'admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, TooltipDirective, DialogComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent {
  isCollapsed = false;

  get user() {
    return this.auth.user;
  }

  constructor(private auth: AdminAuthService) { }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  logout(): void {
    this.auth.logout();
  }
}