import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConsentService, ConsentPreferences } from '../../services/consent.service';
import { SnackbarService } from '../../services/snackbar.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { Subscription } from 'rxjs';
import { ScrollService } from '../../services/scroll.service';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-cookie-preferences',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TooltipDirective, ConfirmDialogComponent],
  templateUrl: './cookie-preferences.component.html'
})
export class CookiePreferencesComponent implements OnInit, OnDestroy {
  preferences: ConsentPreferences = {
    essentialConsent: true,
    analyticsConsent: false,
    marketingConsent: false
  };

  savedPreferences: ConsentPreferences = {
    essentialConsent: true,
    analyticsConsent: false,
    marketingConsent: false
  };

  isLoading = true;
  isSaving = false;
  lastUpdated: string | null = null;
  consentedAt: string | null = null;
  analyticsConsentedAt: string | null = null;
  marketingConsentedAt: string | null = null;
  policyVersion: string = '1.0';
  currentPolicyVersion: string = '1.0';
  needsReConsent = false;
  hasConsentedState = false;
  isConfirmOpen = false;

  isBottomNavVisible = true;
  private scrollSub!: Subscription;


  // Accordion open/close state
  expanded: { [key: string]: boolean } = {
    essential: false,
    analytics: false,
    marketing: false
  };

  get hasUnsavedChanges(): boolean {
    return this.preferences.analyticsConsent !== this.savedPreferences.analyticsConsent ||
      this.preferences.marketingConsent !== this.savedPreferences.marketingConsent;
  }

  constructor(
    public consentService: ConsentService,
    private snackbar: SnackbarService,
    private scrollService: ScrollService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.loadConsentDetails();

    // Track when bottom nav hides/shows
    this.scrollSub = this.scrollService.scrollDirection$.subscribe(dir => {
      this.isBottomNavVisible = dir === 'up';
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy() {
    if (this.scrollSub) this.scrollSub.unsubscribe();
  }

  loadConsentDetails() {
    this.isLoading = true;
    // Start with local storage values as a fast preview
    this.preferences = { ...this.consentService.consentPreferences() };
    this.savedPreferences = { ...this.preferences };

    const saved = localStorage.getItem('lc_consent_preferences');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.hasConsentedState = true;
        this.policyVersion = parsed.policyVersion || '1.0';
        this.lastUpdated = this.formatDate(parsed.updatedAt);
        this.consentedAt = this.formatDate(parsed.consentedAt || parsed.cachedAt);
        this.analyticsConsentedAt = this.formatDate(parsed.analyticsConsentedAt);
        this.marketingConsentedAt = this.formatDate(parsed.marketingConsentedAt);
        // If local storage is populated, hide skeleton loader quickly to prevent layout flicker
        this.isLoading = false;
      } catch {
        this.hasConsentedState = false;
      }
    }

    // Always fetch the freshest server-side details (Policy version, exact DB timestamps) to stay fully accurate
    this.consentService.fetchConsentFromBackend().subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.hasConsented) {
          this.hasConsentedState = true;
          this.preferences.analyticsConsent = res.analyticsConsent;
          this.preferences.marketingConsent = res.marketingConsent;
          this.savedPreferences = { ...this.preferences };
          this.policyVersion = res.policyVersion || '1.0';
          this.currentPolicyVersion = res.currentPolicyVersion || '1.0';
          this.needsReConsent = res.needsReConsent || false;
          this.lastUpdated = this.formatDate(res.updatedAt);
          this.consentedAt = this.formatDate(res.consentedAt);
          this.analyticsConsentedAt = this.formatDate(res.analyticsConsentedAt);
          this.marketingConsentedAt = this.formatDate(res.marketingConsentedAt);
        } else {
          this.hasConsentedState = false;
          this.needsReConsent = false;
          this.preferences.analyticsConsent = false;
          this.preferences.marketingConsent = false;
          this.savedPreferences = { ...this.preferences };
          this.currentPolicyVersion = res?.currentPolicyVersion || '1.0';
        }
      },
      error: () => {
        this.isLoading = false;
        // Fallback silently to cached values on connection error
      }
    });
  }

  toggleExpand(category: string) {
    this.expanded[category] = !this.expanded[category];
  }

  quickAcceptAll() {
    this.preferences.analyticsConsent = true;
    this.preferences.marketingConsent = true;
    this.savePreferences(true);
  }

  quickRejectAll() {
    this.preferences.analyticsConsent = false;
    this.preferences.marketingConsent = false;
    this.savePreferences(false);
  }

  savePreferences(showAllSuccess: boolean | null = null) {
    // If saving via main button with no actual changes, skip network request
    if (showAllSuccess === null && !this.hasUnsavedChanges) {
      this.snackbar.show('No changes detected in preferences.', 'info');
      return;
    }

    this.isSaving = true;
    this.consentService.saveConsent(this.preferences.analyticsConsent, this.preferences.marketingConsent).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.savedPreferences = { ...this.preferences };

        let msg = 'Preferences updated successfully!';
        if (showAllSuccess === true) {
          msg = 'Accepted all cookie categories successfully!';
        } else if (showAllSuccess === false) {
          msg = 'Declined optional cookies successfully!';
        }

        this.snackbar.show(msg, 'success');

        this.hasConsentedState = true;
        this.needsReConsent = false;
        this.policyVersion = res?.policyVersion || this.policyVersion || '1.0';
        this.lastUpdated = this.formatDate(res?.updatedAt) || this.formatDate(new Date().toISOString());
        this.analyticsConsentedAt = this.formatDate(res?.analyticsConsentedAt) || (this.preferences.analyticsConsent ? this.formatDate(new Date().toISOString()) : null);
        this.marketingConsentedAt = this.formatDate(res?.marketingConsentedAt) || (this.preferences.marketingConsent ? this.formatDate(new Date().toISOString()) : null);
      },
      error: () => {
        this.isSaving = false;
        this.savedPreferences = { ...this.preferences };
        this.hasConsentedState = true;
        this.needsReConsent = false;
        this.lastUpdated = this.formatDate(new Date().toISOString());

        let msg = 'Preferences updated successfully!';
        if (showAllSuccess === true) {
          msg = 'Accepted all cookie categories successfully!';
        } else if (showAllSuccess === false) {
          msg = 'Declined optional cookies successfully!';
        }

        this.snackbar.show(msg, 'success');
      }
    });
  }

  resetConsent() {
    this.isConfirmOpen = true;
  }

  executeReset() {
    this.isConfirmOpen = false;
    this.isSaving = true;
    this.consentService.revokeConsent().subscribe({
      next: () => {
        this.isSaving = false;
        this.preferences = {
          essentialConsent: true,
          analyticsConsent: false,
          marketingConsent: false
        };
        this.savedPreferences = { ...this.preferences };
        this.lastUpdated = null;
        this.consentedAt = null;
        this.analyticsConsentedAt = null;
        this.marketingConsentedAt = null;
        this.hasConsentedState = false;
        this.needsReConsent = false;
        this.snackbar.show('Consent withdrawn successfully. The cookies banner will now reappear.', 'info');
      },
      error: () => {
        this.isSaving = false;
        this.preferences = {
          essentialConsent: true,
          analyticsConsent: false,
          marketingConsent: false
        };
        this.savedPreferences = { ...this.preferences };
        this.lastUpdated = null;
        this.consentedAt = null;
        this.analyticsConsentedAt = null;
        this.marketingConsentedAt = null;
        this.hasConsentedState = false;
        this.needsReConsent = false;
        this.snackbar.show('Consent withdrawn successfully. The cookies banner will now reappear.', 'info');
      }
    });
  }

  private formatDate(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return null;
    }
  }
}