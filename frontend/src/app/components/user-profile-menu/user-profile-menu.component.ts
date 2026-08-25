import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PwaInstallService } from '../../services/pwa-install.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { NAV_DROPDOWN_DIRECTIVES } from '../../directives/nav-dropdown.directive';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-user-profile-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, TooltipDirective, NAV_DROPDOWN_DIRECTIVES, IconComponent],
  templateUrl: './user-profile-menu.component.html',
  styleUrls: ['./user-profile-menu.component.scss']
})
export class UserProfileMenuComponent {
  @Input() currentUser!: any;
  @Output() logout = new EventEmitter<void>();

  pwaInstall = inject(PwaInstallService);
}