import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, UserProfile } from '../../services/auth.service';
import { UserProfileService } from '../../services/user-profile.service';
import { LawyerService, LawyerProfileData } from '../../services/lawyer.service';
import { SnackbarService } from '../../services/snackbar.service';
import { ScrollService } from '../../services/scroll.service';
import { HasUnsavedChanges } from '../../guards/unsaved-changes.guard';
import { Subscription } from 'rxjs';

// Shared Design System & Subcomponents
import { ProfileTabComponent } from './components/profile-tab/profile-tab.component';
import { AccountTabComponent } from './components/account-tab/account-tab.component';
import { MobileOverviewTabComponent } from './components/mobile-overview-tab/mobile-overview-tab.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { AvatarEditorModalComponent } from './components/avatar-editor-modal/avatar-editor-modal.component';
import { ProfileSkeletonComponent } from './components/profile-skeleton/profile-skeleton.component';
import { VerificationModalComponent, VerificationFlowType } from './components/verification-modal/verification-modal.component';
import { AdvocatePreviewModalComponent } from './components/advocate-preview-modal/advocate-preview-modal.component';
import { IconComponent } from '../../components/icon/icon.component';
import { TooltipDirective } from '../../directives/tooltip.directive';

// ─── Responsive Tab Type System ──────────────────────────────────
export type ProfileTab = 'overview' | 'profile' | 'account';

export interface TabDef {
  id: ProfileTab;
  label: string;
  icon: string;
}

export interface MilestoneStep {
  title: string;
  done: boolean;
}

export interface TierMilestone {
  tier: number;
  title: string;
  subtitle: string;
  pct: number;
  done: boolean;
  steps: MilestoneStep[];
  actionLabel?: string;
  actionTab?: ProfileTab;
  actionFlow?: VerificationFlowType;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    ProfileTabComponent,
    AccountTabComponent,
    MobileOverviewTabComponent,
    ConfirmDialogComponent,
    AvatarEditorModalComponent,
    ProfileSkeletonComponent,
    VerificationModalComponent,
    AdvocatePreviewModalComponent,
    IconComponent,
    TooltipDirective
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, OnDestroy, HasUnsavedChanges {
  private auth = inject(AuthService);
  private userProfileService = inject(UserProfileService);
  private lawyerService = inject(LawyerService);
  private snackbar = inject(SnackbarService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private scrollService = inject(ScrollService);
  private scrollSub?: Subscription;

  @ViewChild(ProfileTabComponent) profileTab?: ProfileTabComponent;

  // ─── Modern Signal State ─────────────────────────────────────
  profile = signal<UserProfile | null>(null);
  lawyerProfile = signal<LawyerProfileData | null>(null);
  loading = signal<boolean>(true);
  activeTab = signal<ProfileTab>('profile');
  triggerProfileEdit = signal<boolean>(false);
  isScrolled = signal<boolean>(false);

  // Avatar Modal State
  showAvatarEditor = signal<boolean>(false);
  isSavingAvatar = signal<boolean>(false);

  // Verification Modal State
  showVerificationModal = signal<boolean>(false);
  verificationFlow = signal<VerificationFlowType>('phone');

  // Advocate Live Public Preview Studio State
  showAdvocatePreview = signal<boolean>(false);

  // Confirmation Dialog State
  isConfirmOpen = signal<boolean>(false);
  confirmTitle = signal<string>('');
  confirmMessage = signal<string>('');
  confirmType = signal<'danger' | 'warning' | 'info'>('warning');
  private onConfirmAction: (() => void) | null = null;

  // ─── Computed Projections ───────────────────────────────────
  isClient = computed(() => this.profile()?.role !== 'Lawyer');

  copiedAccountId = signal<boolean>(false);

  accountId = computed(() => {
    const prof = this.profile();
    if (!prof) return 'LC-USR-94821';
    if (!this.isClient()) {
      const law = this.lawyerProfile();
      if (law?.publicId) return law.publicId;
      if (prof.publicId) return prof.publicId.startsWith('usr_') ? prof.publicId.replace('usr_', 'law_') : prof.publicId;
    } else {
      if (prof.publicId) return prof.publicId;
    }
    const prefix = this.isClient() ? 'LC-USR' : 'LC-ADV';
    const hash = ((prof.id * 2654435761 + 1013904223) >>> 0).toString(16).toUpperCase().padStart(6, '0').slice(-6);
    return `${prefix}-${hash}`;
  });

  securityScore = computed<number>(() => {
    let score = 40;
    const u = this.profile();
    if (u?.isEmailVerified) score += 20;
    if (u?.isPhoneVerified) score += 20;
    if (u?.isTwoFactorEnabled) score += 20;
    return score;
  });

  securityRating = computed<string>(() => {
    const s = this.securityScore();
    if (s >= 80) return 'Strong';
    if (s >= 60) return 'Moderate';
    return 'Weak';
  });

  securityColor = computed<string>(() => {
    const s = this.securityScore();
    if (s >= 80) return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/5';
    if (s >= 60) return 'text-amber-500 border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/5';
    return 'text-rose-500 border-rose-500/20 bg-rose-500/10 dark:bg-rose-500/5';
  });

  initials = computed(() => {
    const name = this.profile()?.fullName || '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  });

  memberSince = computed(() => {
    const p = this.profile();
    if (!p?.createdAt) return 'Member';
    const now = new Date();
    const created = new Date(p.createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 30) return `${diffDays} days ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    const years = Math.floor(diffMonths / 12);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  });

  // ─── Responsive Tab Definitions (Overview is mobile-first) ──
  readonly tabs: TabDef[] = [
    { id: 'overview', label: 'Overview', icon: 'layout' },
    { id: 'profile', label: 'Profile', icon: 'user' },
    { id: 'account', label: 'Account & Preferences', icon: 'shield-check' }
  ];

  isMobile = signal<boolean>(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);

  visibleTabs = computed(() => {
    return this.isMobile() ? this.tabs : this.tabs.filter(t => t.id !== 'overview');
  });

  // ─── Simplified 3-Tier Milestone Framework ──────────────────
  fourTierMilestones = computed<TierMilestone[]>(() => {
    const u = this.profile();
    const l = this.lawyerProfile();
    const isLawyerRole = u?.role === 'Lawyer';

    const tier1Steps: MilestoneStep[] = [
      { title: 'Full Name', done: !!u?.fullName },
      { title: 'Profile Photo', done: !!u?.avatarUrl }
    ];
    const tier1Done = tier1Steps.every(s => s.done);

    const tier2Steps: MilestoneStep[] = [
      { title: 'Verified Email', done: !!u?.isEmailVerified },
      { title: 'Verified Phone', done: !!u?.isPhoneVerified }
    ];
    const tier2Done = tier2Steps.every(s => s.done);

    const tier3Steps: MilestoneStep[] = [
      { title: 'City & Location', done: !!(u?.clientCity || u?.clientState) },
      ...(isLawyerRole ? [] : [{ title: 'Preferred Language', done: !!u?.clientLanguage }])
    ];
    const tier3Done = tier3Steps.every(s => s.done);

    const tier4Steps: MilestoneStep[] = isLawyerRole
      ? [
        { title: 'Bar Council Registration', done: !!l?.barCouncilNumber && l.barCouncilNumber !== 'PENDING' },
        { title: 'Practice Areas & Specialization', done: !!l?.specialization },
        { title: 'Two-Factor Security (2FA)', done: !!u?.isTwoFactorEnabled }
      ]
      : [
        { title: 'Identity Completed', done: tier1Done && tier2Done },
        { title: 'Two-Factor Security (2FA)', done: !!u?.isTwoFactorEnabled },
        { title: 'Account in Good Standing', done: true }
      ];
    const tier4Done = tier4Steps.every(s => s.done);

    return [
      {
        tier: 1, title: 'Basic Identity', subtitle: 'Name & Photo',
        pct: 25, done: tier1Done, steps: tier1Steps,
        actionLabel: !tier1Done ? 'Add Photo / Name' : undefined,
        actionTab: 'profile'
      },
      {
        tier: 2, title: 'Contact Verification', subtitle: 'Email & Phone',
        pct: 50, done: tier2Done, steps: tier2Steps,
        actionLabel: !tier2Done ? 'Verify Contact' : undefined,
        actionFlow: !u?.isPhoneVerified ? 'phone' : 'email'
      },
      {
        tier: 3, title: 'Location & Preferences', subtitle: 'City & Language',
        pct: 75, done: tier3Done, steps: tier3Steps,
        actionLabel: !tier3Done ? 'Add Location' : undefined,
        actionTab: 'profile'
      },
      {
        tier: 4,
        title: isLawyerRole ? 'Bar Council Credentials' : 'Verified Standing',
        subtitle: isLawyerRole ? 'License & 2FA Security' : 'Full Access & 2FA',
        pct: 100, done: tier4Done, steps: tier4Steps,
        actionLabel: !tier4Done ? (!u?.isTwoFactorEnabled ? 'Setup 2FA' : (isLawyerRole && !tier4Steps[0].done ? 'Verify Bar License' : undefined)) : undefined,
        actionTab: 'account'
      }
    ];
  });

  overallCompletionPct = computed<number>(() => {
    const milestones = this.fourTierMilestones();
    let completedWeight = 0;
    milestones.forEach(m => {
      const stepScore = m.steps.filter(s => s.done).length / (m.steps.length || 1);
      completedWeight += stepScore * 25;
    });
    return Math.round(completedWeight);
  });

  nextMilestoneAction = computed(() => {
    const milestones = this.fourTierMilestones();
    for (const m of milestones) {
      if (!m.done) {
        return {
          tier: m.tier,
          title: m.title,
          label: m.actionLabel || 'Complete Step',
          tab: m.actionTab,
          actionFlow: m.actionFlow
        };
      }
    }
    return null;
  });

  // ─── CanDeactivate Implementation ───────────────────────────
  hasUnsavedChanges(): boolean {
    return this.profileTab?.isDirty || false;
  }

  // ─── Lifecycle ───────────────────────────────────────────────
  ngOnInit() {
    this.scrollSub = this.scrollService.isScrolled$.subscribe(scrolled => {
      this.isScrolled.set(scrolled);
    });

    const isMobileScreen = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
    this.isMobile.set(isMobileScreen);

    const currentUrl = this.router.url;
    if (currentUrl.includes('/profile/credentials') || currentUrl.includes('/profile/identity')) {
      this.activeTab.set('profile');
    } else if (currentUrl.includes('/profile/verification') || currentUrl.includes('/profile/security')) {
      this.activeTab.set('account');
    } else {
      // Mobile view default is 'overview', desktop view default is 'profile'
      this.activeTab.set(isMobileScreen ? 'overview' : 'profile');
    }

    this.route.queryParams.subscribe(params => {
      const tab = params['tab'];
      if (tab) {
        if (tab === 'overview') {
          this.activeTab.set(this.isMobile() ? 'overview' : 'profile');
        } else if (tab === 'profile' || tab === 'identity' || tab === 'credentials' || tab === 'profile-details') {
          this.activeTab.set('profile');
        } else if (tab === 'account' || tab === 'verification' || tab === 'security') {
          this.activeTab.set('account');
        } else if (tab === 'cases' || tab === 'activity-log' || tab === 'bookmarks' || tab === 'inquiries') {
          this.navigateToDashboard();
        }
      }
    });

    this.loadProfile();
  }

  ngOnDestroy() {
    this.scrollSub?.unsubscribe();
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden');
    }
  }

  // ─── Data Ingestion ─────────────────────────────────────────
  loadProfile() {
    this.loading.set(true);
    this.userProfileService.getProfile().subscribe({
      next: (res) => {
        this.profile.set(res);
        if (res.role === 'Lawyer') {
          this.loadLawyerProfile();
        } else {
          this.loading.set(false);
        }
      },
      error: () => {
        this.snackbar.show('Failed to load profile. Please sign in again.', 'error');
        this.loading.set(false);
      }
    });
  }

  loadLawyerProfile() {
    this.lawyerService.getProfile().subscribe({
      next: (res) => {
        this.lawyerProfile.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  // ─── Tab Operations ──────────────────────────────────────────
  setTab(tab: ProfileTab) {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (typeof window !== 'undefined') {
      const mobile = window.innerWidth < 1024;
      if (this.isMobile() !== mobile) {
        this.isMobile.set(mobile);
        if (!mobile && this.activeTab() === 'overview') {
          this.setTab('profile');
        }
      }
    }
  }

  onTabKeydown(event: KeyboardEvent, currentTab: ProfileTab) {
    const currentVisible = this.visibleTabs();
    const currentIndex = currentVisible.findIndex(t => t.id === currentTab);
    let newIndex = currentIndex;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      newIndex = (currentIndex + 1) % currentVisible.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      newIndex = (currentIndex - 1 + currentVisible.length) % currentVisible.length;
    } else if (event.key === 'Home') {
      event.preventDefault();
      newIndex = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      newIndex = currentVisible.length - 1;
    }

    if (newIndex !== currentIndex && newIndex >= 0) {
      this.setTab(currentVisible[newIndex].id);
      // Focus the new tab button
      setTimeout(() => {
        const tabEl = document.getElementById(`profile-tab-${currentVisible[newIndex].id}`);
        tabEl?.focus();
      });
    }
  }

  editProfileAndSwitch() {
    this.setTab('profile');
    this.triggerProfileEdit.set(true);
    setTimeout(() => this.triggerProfileEdit.set(false), 50);
  }

  // ─── Global Keyboard Accelerators (Ctrl+S / Esc) ───────────
  @HostListener('window:keydown', ['$event'])
  handleGlobalShortcuts(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      if (this.activeTab() === 'profile' && this.profileTab?.isEditing()) {
        this.profileTab.saveProfile();
      }
    } else if (event.key === 'Escape') {
      if (this.activeTab() === 'profile' && this.profileTab?.isEditing()) {
        this.profileTab.cancelEdit();
      }
    }
  }

  handleNextMilestone() {
    const next = this.nextMilestoneAction();
    if (!next) return;
    if (next.actionFlow) {
      this.openVerificationModal(next.actionFlow);
    } else if (next.tab) {
      this.setTab(next.tab);
    }
  }

  // ─── Modal Triggers ──────────────────────────────────────────
  openAdvocatePreview() {
    this.showAdvocatePreview.set(true);
  }

  closeAdvocatePreview() {
    this.showAdvocatePreview.set(false);
  }

  openVerificationModal(flow: VerificationFlowType = 'phone') {
    this.verificationFlow.set(flow);
    this.showVerificationModal.set(true);
  }

  closeVerificationModal() {
    this.showVerificationModal.set(false);
  }

  // ─── Cross-Module Navigation Hub ────────────────────────────
  navigateToDashboard() {
    if (this.profile()?.role === 'Lawyer') {
      this.router.navigate(['/lawyer/workstation']);
    } else {
      this.router.navigate(['/client/portal']);
    }
  }

  navigateToLawyers() {
    this.router.navigate(['/lawyers']);
  }

  navigateToLaws() {
    this.router.navigate(['/laws']);
  }

  navigateToLawyerDetail(id: string) {
    this.router.navigate(['/lawyers', id]);
  }

  copyAccountId() {
    const id = this.accountId();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(id).then(() => {
        this.copiedAccountId.set(true);
        this.snackbar.show(`${this.isClient() ? 'Client ID' : 'Advocate ID'} copied to clipboard!`, 'success');
        setTimeout(() => this.copiedAccountId.set(false), 2000);
      }).catch(() => {
        this.snackbar.show(`Account ID: ${id}`, 'info');
      });
    } else {
      this.snackbar.show(`Account ID: ${id}`, 'info');
    }
  }

  handleConfirmRequest(event: { title: string; message: string; type: 'danger' | 'warning' | 'info'; action: () => void }) {
    this.triggerConfirm(event.title, event.message, event.type, event.action);
  }

  // ─── Profile Update Handlers ────────────────────────────────
  onProfileUpdated(updated: Partial<UserProfile>) {
    const curr = this.profile();
    if (curr) {
      this.profile.set({ ...curr, ...updated });
    }
    this.auth.updateCurrentUser(updated);
  }

  onLawyerProfileUpdated(updated: LawyerProfileData) {
    this.lawyerProfile.set(updated);
  }

  // ─── Modular Avatar Handlers ────────────────────────────────
  openAvatarModal() {
    this.showAvatarEditor.set(true);
  }

  closeAvatarModal() {
    this.showAvatarEditor.set(false);
  }

  onSaveCroppedAvatar(croppedBase64: string) {
    this.isSavingAvatar.set(true);
    this.userProfileService.updateProfile({ avatarUrl: croppedBase64 }).subscribe({
      next: () => {
        this.isSavingAvatar.set(false);
        this.closeAvatarModal();
        this.snackbar.show('Profile photo updated successfully!', 'success');
        this.onProfileUpdated({ avatarUrl: croppedBase64 });
      },
      error: () => {
        this.isSavingAvatar.set(false);
        this.snackbar.show('Failed to save profile photo.', 'error');
      }
    });
  }

  onRemoveAvatar() {
    this.triggerConfirm(
      'Remove Profile Photo',
      'Are you sure you want to remove your profile photo? Your avatar will revert to initials.',
      'danger',
      () => {
        this.userProfileService.updateProfile({ avatarUrl: '' }).subscribe({
          next: () => {
            this.closeAvatarModal();
            this.snackbar.show('Profile photo removed.', 'success');
            this.onProfileUpdated({ avatarUrl: '' });
          },
          error: () => {
            this.snackbar.show('Failed to remove photo.', 'error');
          }
        });
      }
    );
  }

  // ─── Confirmation Dialog System ─────────────────────────────
  triggerConfirm(title: string, message: string, type: 'danger' | 'warning' | 'info', action: () => void) {
    this.confirmTitle.set(title);
    this.confirmMessage.set(message);
    this.confirmType.set(type);
    this.onConfirmAction = action;
    this.isConfirmOpen.set(true);
  }

  onConfirmDialog() {
    this.isConfirmOpen.set(false);
    if (this.onConfirmAction) {
      this.onConfirmAction();
    }
  }

  onCancelDialog() {
    this.isConfirmOpen.set(false);
    this.onConfirmAction = null;
  }

  logout() {
    this.snackbar.show('Sign out successful.', 'info');
    this.auth.logout().subscribe();
  }

  // ─── TrackBy Optimizers ─────────────────────────────────────
  trackByTabId(_index: number, tab: TabDef): string {
    return tab.id;
  }

  trackByTier(_index: number, tier: TierMilestone): number {
    return tier.tier;
  }

  trackByStepTitle(_index: number, step: MilestoneStep): string {
    return step.title;
  }
}