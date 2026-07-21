import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService, UserProfile } from '../../services/auth.service';
import { LawyerService, LawyerProfileData } from '../../services/lawyer.service';
import { SnackbarService } from '../../services/snackbar.service';

// Subcomponents
import { ClientOverviewTabComponent } from './components/client-overview-tab/client-overview-tab.component';
import { PersonalInfoTabComponent } from './components/personal-info-tab/personal-info-tab.component';
import { ProfessionalCredentialsTabComponent } from './components/professional-credentials-tab/professional-credentials-tab.component';
import { SecuritySettingsTabComponent } from './components/security-settings-tab/security-settings-tab.component';
import { DangerZoneTabComponent } from './components/danger-zone-tab/danger-zone-tab.component';
import { VerificationTabComponent } from './components/verification-tab/verification-tab.component';
import { MyCasesTabComponent } from './components/my-cases-tab/my-cases-tab.component';
import { MyReviewsTabComponent } from './components/my-reviews-tab/my-reviews-tab.component';
import { SavedLawsTabComponent } from './components/saved-laws-tab/saved-laws-tab.component';

import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

// Client tabs
type ClientTab = 'overview' | 'profile-details' | 'activity-log' | 'security' | 'my-reviews';

// Lawyer tabs (tab-based behavior)
type LawyerTab = 'overview' | 'profile-details' | 'verification' | 'cases' | 'reviews' | 'security';

type AnyTab = ClientTab | LawyerTab;

interface TabDef {
  id: AnyTab;
  label: string;
  icon: string;
  emoji: string;
}

interface ProfileStrengthItem {
  label: string;
  done: boolean;
  actionNeeded: boolean;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ClientOverviewTabComponent,
    PersonalInfoTabComponent,
    ProfessionalCredentialsTabComponent,
    SecuritySettingsTabComponent,
    DangerZoneTabComponent,
    VerificationTabComponent,
    MyCasesTabComponent,
    MyReviewsTabComponent,
    SavedLawsTabComponent,
    ConfirmDialogComponent
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, OnDestroy {
  // Modal Dialog variables
  isConfirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmType: 'danger' | 'warning' | 'info' = 'warning';
  onConfirmAction: (() => void) | null = null;

  triggerConfirm(title: string, message: string, type: 'danger' | 'warning' | 'info', action: () => void) {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.confirmType = type;
    this.onConfirmAction = action;
    this.isConfirmOpen = true;
  }

  onConfirmDialog() {
    this.isConfirmOpen = false;
    if (this.onConfirmAction) {
      this.onConfirmAction();
    }
  }

  onCancelDialog() {
    this.isConfirmOpen = false;
    this.onConfirmAction = null;
  }

  profile: UserProfile | null = null;
  lawyerProfile: LawyerProfileData | null = null;
  loading = true;
  activeTab: AnyTab = 'overview';
  triggerProfileEdit = false;
  reviewsGivenCount: number | null = null;
  private observer: IntersectionObserver | null = null;

  // Avatar uploading and cropping state
  showAvatarMenu = false;
  showCropModal = false;
  rawImage: string | null = null;
  baseScale = 1;
  zoomScale = 1;
  rotation = 0;
  dragX = 0;
  dragY = 0;
  isDragging = false;
  startX = 0;
  startY = 0;
  isSavingAvatar = false;

  updateBodyScroll() {
    if (typeof document !== 'undefined') {
      if (this.showAvatarMenu || this.showCropModal) {
        document.body.classList.add('overflow-hidden');
      } else {
        document.body.classList.remove('overflow-hidden');
      }
    }
  }

  openAvatarMenu() {
    this.showAvatarMenu = true;
    this.updateBodyScroll();
  }

  closeAvatarMenu() {
    this.showAvatarMenu = false;
    this.updateBodyScroll();
  }

  openCropModal() {
    this.showCropModal = true;
    this.updateBodyScroll();
  }

  closeCropModal() {
    if (this.isSavingAvatar) return;
    this.showCropModal = false;
    this.rawImage = null;
    this.updateBodyScroll();
  }

  triggerAvatarUpload() {
    const fileInput = document.getElementById('avatar-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = ''; // Reset
      fileInput.click();
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      this.rawImage = reader.result as string;
      this.closeAvatarMenu();
      this.openCropModal();
      // Reset cropping
      this.zoomScale = 1;
      this.rotation = 0;
      this.dragX = 0;
      this.dragY = 0;
    };
    reader.readAsDataURL(file);
  }

  onImageLoaded(event: Event) {
    const img = event.target as HTMLImageElement;
    const viewportSize = 256;

    // Fit to cover
    const scaleX = viewportSize / img.naturalWidth;
    const scaleY = viewportSize / img.naturalHeight;
    this.baseScale = Math.max(scaleX, scaleY);
  }

  onDragStart(event: MouseEvent | TouchEvent) {
    this.isDragging = true;
    const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;
    this.startX = clientX - this.dragX;
    this.startY = clientY - this.dragY;
    if (event instanceof MouseEvent) {
      event.preventDefault();
    }
  }

  onDrag(event: MouseEvent | TouchEvent) {
    if (!this.isDragging) return;
    const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;
    this.dragX = clientX - this.startX;
    this.dragY = clientY - this.startY;
  }

  onDragEnd() {
    this.isDragging = false;
  }

  rotateImage() {
    this.rotation = (this.rotation + 90) % 360;
  }

  saveCroppedImage() {
    if (!this.rawImage || !this.profile) return;
    this.isSavingAvatar = true;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clean background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 256, 256);

      // Center
      ctx.translate(128, 128);
      ctx.rotate((this.rotation * Math.PI) / 180);
      const scale = this.baseScale * this.zoomScale;
      ctx.scale(scale, scale);
      ctx.translate(this.dragX / scale, this.dragY / scale);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.85);

      this.auth.updateProfile({ avatarUrl: croppedBase64 }).subscribe({
        next: () => {
          this.isSavingAvatar = false;
          this.closeCropModal();
          this.snackbar.show('Profile picture updated successfully!', 'success');

          if (this.profile) {
            this.profile.avatarUrl = croppedBase64;
            this.onProfileUpdated({ avatarUrl: croppedBase64 });
          }
        },
        error: () => {
          this.isSavingAvatar = false;
          this.snackbar.show('Failed to save profile picture.', 'error');
        }
      });
    };
    img.src = this.rawImage;
  }

  deleteAvatar() {
    if (!this.profile) return;
    this.triggerConfirm(
      'Remove Profile Picture',
      'Are you sure you want to remove your profile picture? This will revert it to the default initials placeholder.',
      'danger',
      () => {
        this.auth.updateProfile({ avatarUrl: '' }).subscribe({
          next: () => {
            this.closeAvatarMenu();
            this.snackbar.show('Profile picture removed successfully!', 'success');
            if (this.profile) {
              this.profile.avatarUrl = undefined;
              this.onProfileUpdated({ avatarUrl: undefined });
            }
          },
          error: () => {
            this.snackbar.show('Failed to remove profile picture.', 'error');
          }
        });
      }
    );
  }

  constructor(
    private auth: AuthService,
    private lawyerService: LawyerService,
    private snackbar: SnackbarService,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const tab = params['tab'];
      if (tab) {
        if (tab === 'bookmarks' || tab === 'inquiries') {
          this.activeTab = this.profile?.role === 'Lawyer' ? 'cases' : 'activity-log';
        } else {
          this.activeTab = tab as AnyTab;
        }
      }
    });
    this.loadProfile();
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden');
    }
  }

  // ─── Data Loading ───────────────────────────────────────────
  loadProfile() {
    this.loading = true;
    this.auth.getProfile().subscribe({
      next: (res) => {
        this.profile = res;
        // Set default tab per role
        if (!this.route.snapshot.queryParams['tab']) {
          this.activeTab = 'overview';
        }
        if (res.role === 'Lawyer') {
          this.loadLawyerProfile();
        } else {
          this.loadClientReviewsCount();
        }
      },
      error: () => {
        this.snackbar.show('Failed to load profile. Please sign in again.', 'error');
        setTimeout(() => this.loading = false, 500);
      }
    });
  }

  loadClientReviewsCount() {
    this.lawyerService.getMyReviews().subscribe({
      next: (reviews) => {
        this.reviewsGivenCount = reviews ? reviews.length : 0;
        setTimeout(() => this.loading = false, 300);
      },
      error: () => {
        this.reviewsGivenCount = 0;
        setTimeout(() => this.loading = false, 300);
      }
    });
  }

  loadLawyerProfile() {
    this.lawyerService.getProfile().subscribe({
      next: (res) => {
        this.lawyerProfile = res;
        setTimeout(() => this.loading = false, 500);
      },
      error: () => {
        setTimeout(() => this.loading = false, 500);
      }
    });
  }

  // ─── Tab Navigation ─────────────────────────────────────────
  isClient(): boolean { return this.profile?.role !== 'Lawyer'; }

  setTab(tab: AnyTab) {
    this.activeTab = tab;
  }

  /** Navigate to Profile Details tab AND immediately activate edit mode. */
  editProfileAndSwitch() {
    this.activeTab = 'profile-details';
    this.triggerProfileEdit = true;
    // Reset after one cycle so the flag can fire again next time
    setTimeout(() => this.triggerProfileEdit = false, 0);
  }

  scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Client-only: tab is active panel
  isActiveClientTab(tab: ClientTab): boolean {
    return this.profile?.role !== 'Lawyer' && this.activeTab === tab;
  }

  // Lawyer-only: tab is active panel
  isActiveLawyerTab(tab: LawyerTab): boolean {
    return this.profile?.role === 'Lawyer' && this.activeTab === tab;
  }

  getTabActiveClasses(tabId: string): string {
    if (this.activeTab !== tabId) {
      return 'text-slate-500 dark:text-slate-400 border-b-2 border-transparent hover:text-slate-800 dark:hover:text-white font-semibold';
    }

    if (this.profile?.role === 'Lawyer') {
      return 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 font-extrabold';
    }

    switch (tabId) {
      case 'overview':
        return 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 font-extrabold';
      case 'profile-details':
        return 'text-indigo-650 dark:text-indigo-400 border-b-2 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 font-extrabold';
      case 'activity-log':
        return 'text-violet-650 dark:text-violet-400 border-b-2 border-violet-500 bg-violet-50/50 dark:bg-violet-950/30 font-extrabold';
      case 'security':
        return 'text-red-655 dark:text-red-400 border-b-2 border-red-500 bg-red-50/50 dark:bg-red-950/30 font-extrabold';
      case 'my-reviews':
        return 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 font-extrabold';
      default:
        return 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 font-extrabold';
    }
  }

  // ─── Lawyer scroll-spy ──────────────────────────────────────
  setupScrollSpy() {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id') as LawyerTab;
          if (id) this.activeTab = id;
        }
      });
    }, { root: null, rootMargin: '-80px 0px -60% 0px', threshold: 0 });
    document.querySelectorAll('.scroll-section').forEach(s => this.observer?.observe(s));
  }

  // ─── Profile Events ─────────────────────────────────────────
  onProfileUpdated(updated: Partial<UserProfile>) {
    if (this.profile) this.profile = { ...this.profile, ...updated };
  }

  onLawyerProfileUpdated(updated: LawyerProfileData) {
    this.lawyerProfile = updated;
  }

  // ─── Computed Helpers ────────────────────────────────────────
  getInitials(): string {
    const name = this.profile?.fullName || '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  getRoleBadgeClass(): string {
    return this.profile?.role === 'Lawyer'
      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
      : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50';
  }

  getCompletionPct(): number {
    if (!this.profile) return 0;
    let score = 0;
    let total = 6;
    if (this.profile.fullName) score++;
    if (this.profile.avatarUrl) score++;
    if (this.profile.isEmailVerified) score++;
    if (this.profile.isPhoneVerified) score++;
    if (this.profile.isTwoFactorEnabled) score++;
    if (this.profile.gender || this.profile.dateOfBirth) score++;
    if (this.profile.role === 'Lawyer' && this.lawyerProfile) {
      total += 4;
      if (this.lawyerProfile.barCouncilNumber && this.lawyerProfile.barCouncilNumber !== 'PENDING') score++;
      if (this.lawyerProfile.specialization) score++;
      if (this.lawyerProfile.experienceYears > 0) score++;
      if (this.lawyerProfile.bio) score++;
    }
    return Math.round((score / total) * 100);
  }

  getStrengthColor(): string {
    const pct = this.getCompletionPct();
    if (pct >= 80) return 'from-emerald-400 to-emerald-600';
    if (pct >= 50) return 'from-amber-400 to-amber-600';
    return 'from-red-400 to-red-600';
  }

  getStrengthTextColor(): string {
    const pct = this.getCompletionPct();
    if (pct >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (pct >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  }

  getStrengthItems(): ProfileStrengthItem[] {
    if (!this.profile) return [];
    const items = [
      { label: 'Basic Info', done: !!this.profile.fullName, actionNeeded: !this.profile.fullName },
      { label: 'Profile Photo', done: !!this.profile.avatarUrl, actionNeeded: !this.profile.avatarUrl },
      { label: 'Phone Verified', done: !!this.profile.isPhoneVerified, actionNeeded: !this.profile.isPhoneVerified },
      { label: 'Identity Verified', done: !!this.profile.isEmailVerified, actionNeeded: !this.profile.isEmailVerified },
      { label: '2FA Enabled', done: !!this.profile.isTwoFactorEnabled, actionNeeded: !this.profile.isTwoFactorEnabled }
    ];

    if (this.profile.role === 'Lawyer' && this.lawyerProfile) {
      items.push({
        label: 'Bar Credentials',
        done: !!this.lawyerProfile.barCouncilNumber && this.lawyerProfile.barCouncilNumber !== 'PENDING',
        actionNeeded: !this.lawyerProfile.barCouncilNumber || this.lawyerProfile.barCouncilNumber === 'PENDING'
      });
      items.push({
        label: 'Professional Bio',
        done: !!this.lawyerProfile.bio,
        actionNeeded: !this.lawyerProfile.bio
      });
    }

    return items;
  }

  getMemberSinceLabel(): string {
    if (!this.profile?.createdAt) return '4 mo.';
    const now = new Date();
    const created = new Date(this.profile.createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 30) return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} mo.`;
    return `${Math.floor(diffMonths / 12)}yr ago`;
  }

  getMemberSinceFull(): string {
    if (!this.profile?.createdAt) return '4 months ago';
    const now = new Date();
    const created = new Date(this.profile.createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 30) return `${diffDays} days ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    const years = Math.floor(diffMonths / 12);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }

  logout() {
    this.auth.logout().subscribe({
      next: () => this.snackbar.show('Sign out successful.', 'info')
    });
  }

  // ─── Tab Definitions ─────────────────────────────────────────
  get clientTabs(): TabDef[] {
    return [
      {
        id: 'overview' as ClientTab,
        label: 'Overview',
        emoji: '🏠',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />`
      },
      {
        id: 'profile-details' as ClientTab,
        label: 'Profile Details',
        emoji: '👤',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />`
      },
      {
        id: 'activity-log' as ClientTab,
        label: 'Activity Log',
        emoji: '📋',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />`
      },
      {
        id: 'security' as ClientTab,
        label: 'Security',
        emoji: '🔒',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />`
      },
      {
        id: 'my-reviews' as ClientTab,
        label: 'My Reviews',
        emoji: '⭐',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.36 1.24.588 1.81l-3.97 2.883a1 1 0 00-.364 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.971-2.883a1 1 0 00-1.175 0l-3.97 2.883c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.364-1.118L2.98 10.1c-.773-.57-.375-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />`
      }
    ];
  }

  get lawyerTabs(): TabDef[] {
    return [
      {
        id: 'overview' as LawyerTab,
        label: 'Overview',
        emoji: '🏠',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />`
      },
      {
        id: 'profile-details' as LawyerTab,
        label: 'Profile Details',
        emoji: '👤',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />`
      },
      {
        id: 'verification' as LawyerTab,
        label: 'Verification',
        emoji: '✅',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 6.624 5.372 12 12 12s12-5.376 12-12c0-2.17-.578-4.204-1.598-5.956L12 2.714z" />`
      },
      {
        id: 'cases' as LawyerTab,
        label: 'My Clients',
        emoji: '💼',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />`
      },
      {
        id: 'reviews' as LawyerTab,
        label: 'Reviews',
        emoji: '⭐',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.36 1.24.588 1.81l-3.97 2.883a1 1 0 00-.364 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.971-2.883a1 1 0 00-1.175 0l-3.97 2.883c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.364-1.118L2.98 10.1c-.773-.57-.375-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />`
      },
      {
        id: 'security' as LawyerTab,
        label: 'Security & Privacy',
        emoji: '🔒',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />`
      }
    ];
  }
}
