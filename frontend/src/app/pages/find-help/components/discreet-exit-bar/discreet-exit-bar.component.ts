import { Component, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipDirective } from '../../../../directives/tooltip.directive';

/**
 * Discreet Quick Exit Safety Component
 * Provides immediate exit functionality for citizens in distress or domestic abuse situations.
 * Pressing ESC 3 times or clicking the button instantly clears session history and redirects
 * to a neutral portal (Google Weather).
 */
@Component({
  selector: 'app-discreet-exit-bar',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './discreet-exit-bar.component.html',
  styleUrls: ['./discreet-exit-bar.component.scss']
})
export class DiscreetExitBarComponent {
  private escapePressTimestamps: number[] = [];

  @HostListener('window:keydown.escape')
  handleEscapeKey(): void {
    const now = Date.now();
    this.escapePressTimestamps.push(now);

    // Keep only timestamps within the last 2 seconds
    this.escapePressTimestamps = this.escapePressTimestamps.filter(t => now - t <= 2000);

    if (this.escapePressTimestamps.length >= 3) {
      this.triggerQuickExit();
    }
  }

  triggerQuickExit(): void {
    try {
      // 1. Wipe sensitive legal session storage
      sessionStorage.removeItem('lc_search_normal');
      sessionStorage.removeItem('lc_search_situation');
      sessionStorage.removeItem('lc_search_aimode');
      sessionStorage.removeItem('lc_saved_case_packs');
      sessionStorage.removeItem('lc_recent_searches');
      localStorage.removeItem('lc_recent_searches');
    } catch {
      // Ignore storage clear errors
    }

    // 2. Perform hard replace to neutral weather search
    window.location.replace('https://www.google.com/search?q=weather+today');
  }
}