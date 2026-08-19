import { Component, ElementRef, HostListener, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AdminAuthService } from '../core/auth.service';
import { TooltipDirective } from '../shared/directives/tooltip.directive';
import { DialogComponent } from '../shared/components/dialog/dialog.component';
import { AdminThemeService } from '../core/services/admin-theme.service';
import { ActivityStreamService } from '../core/services/activity-stream.service';
import { CommandPaletteService, CommandPaletteComponent } from '../shared/components/command-palette/command-palette.component';
import { TwoFactorModalComponent } from '../shared/components/two-factor-modal/two-factor-modal.component';

@Component({
  selector: 'admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TooltipDirective,
    DialogComponent,
    CommandPaletteComponent,
    TwoFactorModalComponent
  ],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent implements OnInit, OnDestroy {
  @ViewChild('contentBody') contentBody?: ElementRef<HTMLElement>;
  private routerSub?: Subscription;

  isCollapsed = false;
  showActivityDropdown = false;

  get user() {
    return this.auth.user;
  }

  constructor(
    private auth: AdminAuthService,
    private router: Router,
    public themeService: AdminThemeService,
    public activityService: ActivityStreamService,
    public commandPalette: CommandPaletteService,
    private elementRef: ElementRef
  ) { }

  ngOnInit(): void {
    this.routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.contentBody?.nativeElement) {
          this.contentBody.nativeElement.scrollTop = 0;
        }
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.showActivityDropdown) return;
    const target = event.target as HTMLElement;
    const dropdownWrapper = this.elementRef.nativeElement.querySelector('.activity-dropdown-wrapper');
    if (dropdownWrapper && !dropdownWrapper.contains(target)) {
      this.showActivityDropdown = false;
    }
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  openCommandPalette(): void {
    this.commandPalette.open();
  }

  toggleActivityDropdown(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.showActivityDropdown = !this.showActivityDropdown;
  }

  markItemRead(ev: any): void {
    if (ev && !ev.read) {
      this.activityService.markAsRead(ev.id);
    }
    this.showActivityDropdown = false;
  }

  markAllDropdownRead(event: MouseEvent): void {
    event.stopPropagation();
    this.activityService.markAllAsRead().subscribe();
  }

  logout(): void {
    this.auth.logout();
  }
}