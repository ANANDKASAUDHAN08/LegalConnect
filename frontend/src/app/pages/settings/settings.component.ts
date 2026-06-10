import { Component, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SettingsService, UserSettings } from '../../services/settings.service';
import { AuthService, UserProfile } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { TooltipDirective } from '../../directives/tooltip.directive';

interface TabDef {
  id: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TooltipDirective],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  public settingsService = inject(SettingsService);
  private authService = inject(AuthService);
  private snackbar = inject(SnackbarService);
  private router = inject(Router);

  activeTab = 'appearance';
  viewMode: 'overview' | 'focused' = 'overview';
  isSaving = false;
  currentUser: UserProfile | null = null;

  // Form states matching current settings (mutable in form)
  selectedLanguage = 'English';
  selectedTimezone = 'Asia/Kolkata';
  selectedDateFormat = 'DD/MM/YYYY';

  notifyLawAmendments = true;
  notifyEmailDigest = true;
  notifyPushEnabled = false;

  cookiePreferences = {
    essential: true,
    analytics: true,
    marketing: false
  };

  // Lists for choices
  languages = [
    { code: 'English', name: 'English (US/UK)' },
    { code: 'Hindi', name: 'Hindi (हिन्दी)' },
    { code: 'Spanish', name: 'Spanish (Español)' },
    { code: 'French', name: 'French (Français)' },
    { code: 'German', name: 'German (Deutsch)' }
  ];

  timezones = [
    { code: 'Asia/Kolkata', name: 'India Standard Time (IST) - GMT+5:30' },
    { code: 'UTC', name: 'Coordinated Universal Time (UTC) - GMT+0' },
    { code: 'America/New_York', name: 'Eastern Standard Time (EST) - GMT-5' },
    { code: 'Europe/London', name: 'Greenwich Mean Time (GMT) - GMT+0/1' },
    { code: 'Asia/Singapore', name: 'Singapore Standard Time (SST) - GMT+8' }
  ];

  dateFormats = [
    { code: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g. 05/06/2026)' },
    { code: 'MM/DD/YYYY', label: 'MM/DD/YYYY (e.g. 06/05/2026)' },
    { code: 'YYYY-MM-DD', label: 'YYYY-MM-DD (e.g. 2026-06-05)' }
  ];

  categories = [
    { code: 'All', name: 'All Categories' },
    { code: 'IPC', name: 'BNS / Indian Penal Code (IPC)' },
    { code: 'Corporate', name: 'Corporate & Business Law' },
    { code: 'Family', name: 'Family & Personal Law' },
    { code: 'Criminal', name: 'Criminal Law & Criminal Procedure' },
    { code: 'Civil', name: 'Civil Procedure & Disputes' }
  ];

  resultsPerPageOptions = [10, 20, 50];

  // Sessions and history state
  sessions: any[] = [];
  loginHistory: any[] = [];
  isLoadingSessions = false;
  isLoadingHistory = false;
  currentSessionId: string | null = null;

  // Modal control
  showDeleteConfirm = false;
  deleteConfirmText = '';

  tabs: TabDef[] = [
    { id: 'appearance', label: 'Appearance', icon: 'M2 3h20v14H2z M10 21h4 M12 17v4' },
    { id: 'language', label: 'Language & Region', icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5c-.313 1.565-.953 3.051-1.879 4.387M6.412 9a11.52 11.52 0 003.5 4.5M6.412 9a11.503 11.503 0 01-2.912-5' },
    { id: 'notifications', label: 'Notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
    { id: 'accessibility', label: 'Accessibility', icon: 'M12 2a10 10 0 100 20 10 10 0 000-20z M12 8v8 M8 12h8' },
    { id: 'search', label: 'Search Preferences', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
    { id: 'security', label: 'Session & Security', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { id: 'privacy', label: 'Privacy & Data', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
    { id: 'legal', label: 'Legal & Policies', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
  ];

  ngOnInit() {
    this.syncFormWithSignals();
    this.loadSessions();
    this.loadLoginHistory();
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  syncFormWithSignals() {
    this.selectedLanguage = this.settingsService.clientLanguage();
    this.selectedTimezone = this.settingsService.preferredTimezone();
    this.selectedDateFormat = this.settingsService.dateFormat();
    this.notifyLawAmendments = this.settingsService.notifyLawAmendments();
    this.notifyEmailDigest = this.settingsService.notifyEmailDigest();
    this.notifyPushEnabled = this.settingsService.notifyPushEnabled();
    this.cookiePreferences = { ...this.settingsService.cookiePreferences() };
  }

  get securityScore(): number {
    let score = 40; // Base score
    if (this.currentUser?.isEmailVerified) score += 20;
    if (this.currentUser?.isPhoneVerified) score += 20;
    if (this.currentUser?.isTwoFactorEnabled) score += 20;

    // Deduct slightly for multiple sessions (up to 3 sessions are fine, more are suspicious)
    const activeSessionsCount = this.sessions?.length || 1;
    if (activeSessionsCount > 3) {
      score = Math.max(score - 10, 40);
    }

    return score;
  }

  get securityRating(): string {
    const score = this.securityScore;
    if (score >= 80) return 'Strong';
    if (score >= 60) return 'Moderate';
    return 'Weak';
  }

  get securityColor(): string {
    const score = this.securityScore;
    if (score >= 80) return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/5';
    if (score >= 60) return 'text-amber-500 border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/5';
    return 'text-rose-500 border-rose-500/20 bg-rose-500/10 dark:bg-rose-500/5';
  }

  hudExpanded = false;

  toggleHud() {
    this.hudExpanded = !this.hudExpanded;
  }

  setTab(tabId: string) {
    this.activeTab = tabId;
    this.viewMode = 'focused';

    if (window.innerWidth < 1024) {
      setTimeout(() => {
        const element = document.getElementById('mobile-settings-nav-trigger');
        if (element) {
          const yOffset = -68; // offset to align with sticky site header on mobile
          const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (tabId === 'security') {
      this.loadSessions();
      this.loadLoginHistory();
    }
  }

  setOverviewMode() {
    this.viewMode = 'overview';

    if (window.innerWidth < 1024) {
      setTimeout(() => {
        const element = document.getElementById('mobile-settings-nav-trigger');
        if (element) {
          const yOffset = -80; // offset to align with sticky site header on mobile
          const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // --- Theme Toggle ---
  setTheme(themeName: 'light' | 'dark' | 'system') {
    this.settingsService.updateTheme(themeName);
    this.snackbar.show(`Theme updated to ${themeName}.`, 'success');
  }

  // --- Font Size Toggle ---
  setFontSize(sz: 'sm' | 'md' | 'lg') {
    this.settingsService.updateFontSize(sz);
    this.snackbar.show(`Font size set to ${sz === 'sm' ? 'Small' : sz === 'md' ? 'Default' : 'Large'}.`, 'success');
  }

  // --- UI Density Toggle ---
  setUiDensity(density: 'compact' | 'comfortable' | 'spacious') {
    this.settingsService.updateUiDensity(density);
    this.snackbar.show(`UI Density set to ${density}.`, 'success');
  }

  // --- Accessibility Toggles ---
  toggleHighContrast(val: boolean) {
    this.settingsService.updateHighContrast(val);
    this.snackbar.show(val ? 'High contrast mode enabled.' : 'High contrast mode disabled.', 'info');
  }

  toggleReduceMotion(val: boolean) {
    this.settingsService.updateReduceMotion(val);
    this.snackbar.show(val ? 'Reduced motion enabled.' : 'Animations restored.', 'info');
  }

  toggleTextSpacing(val: boolean) {
    this.settingsService.updateTextSpacing(val);
    this.snackbar.show(val ? 'Extra text spacing enabled.' : 'Default text spacing restored.', 'info');
  }

  // --- Search Preferences Toggles ---
  updateSearchPreferences() {
    this.settingsService.updateDefaultCategoryFilter(this.settingsService.defaultCategoryFilter());
    this.settingsService.updateResultsPerPage(this.settingsService.resultsPerPage());
    this.settingsService.updateShowRelatedLaws(this.settingsService.showRelatedLaws());
    this.snackbar.show('Search preferences updated.', 'success');
  }

  // --- Cookie Settings ---
  saveCookiePreferences() {
    this.settingsService.updateCookiePreferences(this.cookiePreferences);
    this.snackbar.show('Cookie preferences saved successfully!', 'success');
  }

  // --- Save Language & Region ---
  saveLanguageRegion() {
    this.isSaving = true;
    this.settingsService.saveDbSettings({
      clientLanguage: this.selectedLanguage,
      preferredTimezone: this.selectedTimezone,
      dateFormat: this.selectedDateFormat
    }).subscribe({
      next: () => {
        this.isSaving = false;
        this.snackbar.show('Language and region settings saved.', 'success');
      },
      error: () => {
        this.isSaving = false;
        this.snackbar.show('Failed to save regional settings.', 'error');
      }
    });
  }

  // --- Save Notifications ---
  saveNotifications() {
    this.isSaving = true;
    this.settingsService.saveDbSettings({
      notifyLawAmendments: this.notifyLawAmendments,
      notifyEmailDigest: this.notifyEmailDigest,
      notifyPushEnabled: this.notifyPushEnabled
    }).subscribe({
      next: () => {
        this.isSaving = false;
        this.snackbar.show('Notification preferences updated.', 'success');
      },
      error: () => {
        this.isSaving = false;
        this.snackbar.show('Failed to update notification settings.', 'error');
      }
    });
  }

  // --- Sessions and security actions ---
  loadSessions() {
    this.isLoadingSessions = true;
    this.authService.getActiveSessions().subscribe({
      next: (data) => {
        this.sessions = data;
        this.isLoadingSessions = false;
      },
      error: () => {
        this.isLoadingSessions = false;
      }
    });
  }

  loadLoginHistory() {
    this.isLoadingHistory = true;
    this.authService.getLoginHistory().subscribe({
      next: (data) => {
        this.loginHistory = data;
        this.isLoadingHistory = false;
      },
      error: () => {
        this.isLoadingHistory = false;
      }
    });
  }

  revokeSession(id: number) {
    if (confirm('Are you sure you want to log out this device?')) {
      this.authService.revokeSession(id).subscribe({
        next: () => {
          this.snackbar.show('Device session revoked.', 'success');
          this.loadSessions();
        },
        error: () => {
          this.snackbar.show('Failed to revoke session.', 'error');
        }
      });
    }
  }

  revokeAllOtherSessions() {
    if (confirm('This will log you out from all other devices. Proceed?')) {
      this.authService.revokeAllOtherSessions().subscribe({
        next: () => {
          this.snackbar.show('Logged out from all other devices.', 'success');
          this.loadSessions();
        },
        error: () => {
          this.snackbar.show('Failed to revoke other sessions.', 'error');
        }
      });
    }
  }

  // --- Export Data ---
  exportMyData() {
    this.snackbar.show('Preparing your data export. Download will start shortly...', 'info');
    this.authService.getExportData().subscribe({
      next: (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `LegalConnect-DataExport-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.snackbar.show('Data exported successfully!', 'success');
      },
      error: () => {
        this.snackbar.show('Failed to export your data.', 'error');
      }
    });
  }

  // --- Delete Account Modal and Action ---
  openDeleteModal() {
    this.showDeleteConfirm = true;
    this.deleteConfirmText = '';
  }

  closeDeleteModal() {
    this.showDeleteConfirm = false;
    this.deleteConfirmText = '';
  }

  confirmDeleteAccount() {
    if (this.deleteConfirmText !== 'DELETE MY ACCOUNT') {
      this.snackbar.show('Please type the confirmation phrase exactly.', 'warning');
      return;
    }

    this.authService.deleteAccount().subscribe({
      next: () => {
        this.snackbar.show('Your account has been deleted. We are sorry to see you go.', 'info');
        this.closeDeleteModal();
        this.router.navigate(['/']);
      },
      error: () => {
        this.snackbar.show('Failed to delete your account. Contact support.', 'error');
      }
    });
  }

  activeDropdown: string | null = null;

  toggleDropdown(name: string, event: Event) {
    event.stopPropagation();
    if (this.activeDropdown === name) {
      this.activeDropdown = null;
    } else {
      this.activeDropdown = name;
    }
  }

  selectLanguage(code: string) {
    this.selectedLanguage = code;
    this.activeDropdown = null;
  }

  selectTimezone(code: string) {
    this.selectedTimezone = code;
    this.activeDropdown = null;
  }

  selectDateFormat(code: string) {
    this.selectedDateFormat = code;
    this.activeDropdown = null;
  }

  selectCategory(code: string) {
    this.settingsService.updateDefaultCategoryFilter(code);
    this.updateSearchPreferences();
    this.activeDropdown = null;
  }

  selectResultsPerPage(count: number) {
    this.settingsService.updateResultsPerPage(count);
    this.updateSearchPreferences();
    this.activeDropdown = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown-container')) {
      this.activeDropdown = null;
    }
  }

  getSelectedLanguageName(): string {
    const lang = this.languages.find(l => l.code === this.selectedLanguage);
    return lang ? lang.name : this.selectedLanguage;
  }

  getSelectedTimezoneName(): string {
    const tz = this.timezones.find(t => t.code === this.selectedTimezone);
    return tz ? tz.name : this.selectedTimezone;
  }

  getSelectedDateFormatLabel(): string {
    const df = this.dateFormats.find(d => d.code === this.selectedDateFormat);
    return df ? df.label : this.selectedDateFormat;
  }

  getSelectedCategoryName(): string {
    const cat = this.settingsService.defaultCategoryFilter();
    switch (cat) {
      case 'All': return 'All Categories';
      case 'IPC': return 'BNS / Indian Penal Code (IPC)';
      case 'Corporate': return 'Corporate & Business Law';
      case 'Family': return 'Family & Personal Law';
      case 'Criminal': return 'Criminal Law & Criminal Procedure';
      case 'Civil': return 'Civil Procedure & Disputes';
      default: return cat;
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    const format = this.settingsService.dateFormat();

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hrs = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');

    let datePart = '';
    if (format === 'MM/DD/YYYY') {
      datePart = `${month}/${day}/${year}`;
    } else if (format === 'YYYY-MM-DD') {
      datePart = `${year}-${month}-${day}`;
    } else {
      datePart = `${day}/${month}/${year}`;
    }

    return `${datePart} at ${hrs}:${mins}`;
  }
}
