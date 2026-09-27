import {
  Component, Input, Output, EventEmitter, inject, WritableSignal,
  signal, computed, ChangeDetectionStrategy, OnInit, OnDestroy, DestroyRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { UserProfile } from '../../../../../../services/auth.service';
import { UserProfileService } from '../../../../../../services/user-profile.service';
import { SettingsService } from '../../../../../../services/settings.service';
import { SnackbarService } from '../../../../../../services/snackbar.service';
import { VerificationFlowType } from '../../../verification-modal/verification-modal.component';
import { IconComponent } from '../../../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../../../directives/tooltip.directive';

@Component({
  selector: 'app-preferences-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IconComponent,
    TooltipDirective
  ],
  templateUrl: './preferences-section.component.html',
  styleUrls: ['./preferences-section.component.scss']
})
export class PreferencesSectionComponent implements OnInit, OnDestroy {
  @Input({ required: true }) profile!: UserProfile;

  @Output() profileUpdated = new EventEmitter<Partial<UserProfile>>();
  @Output() requestVerification = new EventEmitter<VerificationFlowType>();

  private userProfileService = inject(UserProfileService);
  private settingsService = inject(SettingsService);
  private snackbar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);

  private isDestroyed = false;

  // ─── Notification Preferences Signals ────────────────────────
  notifyEmailCases = signal<boolean>(true);
  notifyEmailDigest = signal<boolean>(true);
  notifyLawAmendments = signal<boolean>(true);
  notifyPushAlerts = signal<boolean>(false);
  notifyWhatsAppAlerts = signal<boolean>(false);

  // ─── Privacy & Search Indexing ───────────────────────────────
  isSearchIndexable = signal<boolean>(true);

  // ─── Data Export ─────────────────────────────────────────────
  isExportingData = signal<boolean>(false);

  // ─── Computed Projections ────────────────────────────────────
  isClient = computed(() => this.profile?.role !== 'Lawyer');

  ngOnInit(): void {
    // Sync settings signals with service & profile
    this.notifyEmailDigest.set(this.settingsService.notifyEmailDigest());
    this.notifyLawAmendments.set(this.settingsService.notifyLawAmendments());
    this.notifyPushAlerts.set(this.settingsService.notifyPushEnabled());
    this.notifyWhatsAppAlerts.set(!!this.profile?.notifyWhatsAppEnabled);

    if (typeof localStorage !== 'undefined') {
      const storedCase = localStorage.getItem('lc_notify_email_cases');
      if (storedCase !== null) {
        this.notifyEmailCases.set(storedCase !== 'false');
      }
    }

    if (this.profile) {
      this.isSearchIndexable.set(this.profile.isSearchIndexable !== false);
    }
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
  }

  // ─── Notification Preferences ────────────────────────────────
  toggleNotification(type: 'emailCases' | 'emailDigest' | 'lawAmendments' | 'pushAlerts'): void {
    const toggleMap: Record<string, { signal: WritableSignal<boolean>; dbKey?: string; storageKey?: string; label: string }> = {
      emailCases: { signal: this.notifyEmailCases, storageKey: 'lc_notify_email_cases', label: 'Consultation & case alerts' },
      emailDigest: { signal: this.notifyEmailDigest, dbKey: 'notifyEmailDigest', label: 'Weekly digest emails' },
      lawAmendments: { signal: this.notifyLawAmendments, dbKey: 'notifyLawAmendments', label: 'Legal updates & news' },
      pushAlerts: { signal: this.notifyPushAlerts, dbKey: 'notifyPushEnabled', label: 'Push alerts' }
    };

    const entry = toggleMap[type];
    if (!entry) return;

    const prevVal = entry.signal();
    const nextVal = !prevVal;
    entry.signal.set(nextVal);

    if (entry.storageKey && typeof localStorage !== 'undefined') {
      localStorage.setItem(entry.storageKey, String(nextVal));
    }

    // Undo callback — reverts signal, localStorage, and DB safely
    const undoFn = () => {
      if (!this.isDestroyed) {
        entry.signal.set(prevVal);
      }
      if (entry.storageKey && typeof localStorage !== 'undefined') {
        localStorage.setItem(entry.storageKey, String(prevVal));
      }
      if (entry.dbKey) {
        this.settingsService.saveDbSettings({ [entry.dbKey]: prevVal }).subscribe();
      }
      this.snackbar.show(`${entry.label} reverted.`, 'info', 2500);
    };

    if (entry.dbKey) {
      this.settingsService.saveDbSettings({ [entry.dbKey]: nextVal })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.snackbar.showWithUndo(
            `${entry.label} ${nextVal ? 'enabled' : 'disabled'}.`,
            undoFn, 'success', 5000
          ),
          error: () => this.snackbar.show(`${entry.label} preference saved.`, 'info')
        });
    } else {
      this.snackbar.showWithUndo(
        `${entry.label} ${nextVal ? 'enabled' : 'disabled'}.`,
        undoFn, 'success', 5000
      );
    }
  }

  onToggleSwitch(type: 'emailCases' | 'emailDigest' | 'lawAmendments' | 'pushAlerts' | 'searchIndexable' | 'whatsAppAlerts'): void {
    if (type === 'searchIndexable') {
      this.toggleSearchIndexable();
    } else if (type === 'whatsAppAlerts') {
      this.toggleWhatsAppAlerts();
    } else {
      this.toggleNotification(type);
    }
  }

  toggleWhatsAppAlerts(): void {
    if (!this.profile) return;
    const current = !!this.profile.notifyWhatsAppEnabled;
    const nextVal = !current;

    // If turning on and no phone exists, prompt configuration modal
    if (nextVal && !this.profile.whatsAppPhone && !this.profile.phone) {
      this.requestVerification.emit('whatsapp');
      return;
    }

    const phoneToUse = this.profile.whatsAppPhone || this.profile.phone || '';
    const payload: Partial<UserProfile> = {
      notifyWhatsAppEnabled: nextVal,
      whatsAppPhone: phoneToUse
    };

    this.notifyWhatsAppAlerts.set(nextVal);
    this.userProfileService.updateProfile(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.profile) {
            this.profile.notifyWhatsAppEnabled = nextVal;
            if (phoneToUse) this.profile.whatsAppPhone = phoneToUse;
          }
          this.profileUpdated.emit(payload);
          this.snackbar.show(
            nextVal ? 'WhatsApp case & consultation alerts enabled!' : 'WhatsApp alerts disabled.',
            nextVal ? 'success' : 'info'
          );
        },
        error: () => {
          this.notifyWhatsAppAlerts.set(current);
          this.snackbar.show('Failed to update WhatsApp alert preference.', 'error');
        }
      });
  }

  // ─── Privacy Controls ────────────────────────────────────────
  toggleSearchIndexable(): void {
    const prevVal = this.isSearchIndexable();
    const newVal = !prevVal;
    this.isSearchIndexable.set(newVal);

    const undoFn = () => {
      if (!this.isDestroyed) {
        this.isSearchIndexable.set(prevVal);
      }
      this.userProfileService.updateProfile({ isSearchIndexable: prevVal }).subscribe({
        next: () => {
          if (!this.isDestroyed) {
            this.profileUpdated.emit({ isSearchIndexable: prevVal });
          }
        }
      });
      this.snackbar.show('Search indexing preference reverted.', 'info', 2500);
    };

    this.userProfileService.updateProfile({ isSearchIndexable: newVal })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.profileUpdated.emit({ isSearchIndexable: newVal });
          this.snackbar.showWithUndo(
            newVal
              ? 'Public profile will appear in Google and LegalConnect directory search results.'
              : 'Profile unlisted from search engines and directory indexing.',
            undoFn, 'info', 5000
          );
        },
        error: () => {
          this.isSearchIndexable.set(prevVal);
          this.snackbar.show('Failed to update search indexing preference.', 'error');
        }
      });
  }

  // ─── Data Portability (GDPR / DPDP) ──────────────────────────
  exportPersonalData(): void {
    this.isExportingData.set(true);
    this.userProfileService.downloadDataDossier()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.isExportingData.set(false);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `LegalConnect_Data_Dossier_User_${this.profile?.publicId || this.profile?.id || 'Profile'}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.snackbar.show('Personal data dossier downloaded successfully from server.', 'success');
        },
        error: () => {
          this.isExportingData.set(false);
          this.snackbar.show('Failed to download data dossier. Please try again.', 'error');
        }
      });
  }
}