import {
  Component, Input, Output, EventEmitter, OnInit, OnChanges,
  SimpleChanges, inject, signal, computed, effect, untracked, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators,
  AbstractControl, ValidationErrors
} from '@angular/forms';
import { UserProfile, AuthService } from '../../../../services/auth.service';
import { UserProfileService } from '../../../../services/user-profile.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { IconComponent } from '../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { PhoneInputComponent } from '../../../../components/phone-input/phone-input.component';
import { CredentialsSectionComponent } from '../credentials-section/credentials-section.component';
import { CustomSelectComponent, SelectOption } from '../../../../components/custom-select';
import { LawyerProfileData, LawyerService, Lawyer, Consultation } from '../../../../services/lawyer.service';
import { SavedItemsService, SavedLawyerInfo } from '../../../../services/saved-items.service';
import { BookmarkService, Bookmark } from '../../../../services/bookmark.service';
import { ReviewService, ReviewItem } from '../../../../services/review.service';
import { InfoApiService } from '../../../info/services/info-api.service';
import { of, switchMap, map, catchError } from 'rxjs';

// ─── Custom Reactive Form Validators ────────────────────────────
export function trimmedRequired(control: AbstractControl): ValidationErrors | null {
  if (!control.value || typeof control.value !== 'string' || control.value.trim().length === 0) {
    return { required: true };
  }
  return null;
}

export function phoneValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  const digits = String(control.value).replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.length < 10) return { minDigits: { requiredLength: 10, actualLength: digits.length } };
  if (digits.length > 15) return { maxDigits: { maxLength: 15, actualLength: digits.length } };
  return null;
}

// ─── Typed Form Interface (Simplified) ──────────────────────────
export interface ProfileFormModel {
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  phone: FormControl<string>;
  language: FormControl<string>;
  city: FormControl<string>;
  state: FormControl<string>;
}

@Component({
  selector: 'app-profile-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IconComponent,
    TooltipDirective,
    PhoneInputComponent,
    CredentialsSectionComponent,
    CustomSelectComponent
  ],
  templateUrl: './profile-tab.component.html'
})
export class ProfileTabComponent implements OnInit, OnChanges {
  @Input() profile!: UserProfile;
  @Input() lawyerProfile: LawyerProfileData | null = null;
  @Input() autoEdit = false;
  @Input() accountIdInput?: string;

  copiedId = signal(false);

  @Output() profileUpdated = new EventEmitter<Partial<UserProfile>>();
  @Output() lawyerProfileUpdated = new EventEmitter<LawyerProfileData>();
  @Output() triggerAvatarChange = new EventEmitter<void>();
  @Output() requestPhoneVerification = new EventEmitter<void>();
  @Output() navigateTab = new EventEmitter<'overview' | 'profile' | 'account'>();

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private userProfileService = inject(UserProfileService);
  private lawyerService = inject(LawyerService);
  private savedItemsService = inject(SavedItemsService);
  private bookmarkService = inject(BookmarkService);
  private reviewService = inject(ReviewService);
  private authService = inject(AuthService);
  private infoApi = inject(InfoApiService);
  private snackbar = inject(SnackbarService);

  // ─── Form & Edit State ────────────────────────────────────────
  profileForm!: FormGroup<ProfileFormModel>;
  isEditing = signal(false);
  isSaving = signal(false);

  // ─── Select Options ───────────────────────────────────────────
  readonly languageSelectOptions: SelectOption[] = [
    { value: 'English', label: 'English', icon: 'globe' },
    { value: 'Hindi', label: 'Hindi', icon: 'globe' },
    { value: 'Tamil', label: 'Tamil', icon: 'globe' },
    { value: 'Telugu', label: 'Telugu', icon: 'globe' },
    { value: 'Marathi', label: 'Marathi', icon: 'globe' },
    { value: 'Bengali', label: 'Bengali', icon: 'globe' },
    { value: 'Gujarati', label: 'Gujarati', icon: 'globe' },
    { value: 'Kannada', label: 'Kannada', icon: 'globe' },
    { value: 'Malayalam', label: 'Malayalam', icon: 'globe' },
    { value: 'Punjabi', label: 'Punjabi', icon: 'globe' }
  ];

  // ─── Computed Projections ─────────────────────────────────────
  isLawyer = computed(() => this.profile?.role === 'Lawyer');
  isClient = computed(() => this.profile?.role !== 'Lawyer');

  initials = computed(() => {
    const name = this.profile?.fullName || '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  });

  // ─── Activity Hub State (Client Users Only, Real APIs) ────────
  savedLawyers = signal<Lawyer[]>([]);
  savedLawyersLoading = signal(false);
  savedLawyerCount = computed(() => this.savedItemsService.savedLawyers().length);

  savedSections = computed(() => this.bookmarkService.bookmarks().slice(0, 4));
  savedSectionCount = computed(() => this.bookmarkService.bookmarks().length);

  allInquiries = signal<Consultation[]>([]);
  sentInquiriesLoading = signal(false);
  inquiryCount = computed(() => this.allInquiries().length);
  sentInquiries = computed(() => this.allInquiries().slice(0, 4));

  supportTickets = signal<any[]>([]);
  supportTicketsLoading = signal(false);
  supportTicketCount = computed(() => this.supportTickets().length);
  recentSupportTickets = computed(() => this.supportTickets().slice(0, 4));

  allReviews = signal<ReviewItem[]>([]);
  myReviewsLoading = signal(false);
  reviewCount = computed(() => this.allReviews().length);
  myReviews = computed(() => this.allReviews().slice(0, 4));

  constructor() {
    effect(() => {
      const saved = this.savedItemsService.savedLawyers();
      const isClient = this.isClient();
      untracked(() => {
        if (isClient && saved.length > 0) {
          this.fetchSavedLawyerDetails(saved);
        } else if (isClient && saved.length === 0) {
          this.savedLawyers.set([]);
        }
      });
    }, { allowSignalWrites: true });
  }

  // ─── Lifecycle ────────────────────────────────────────────────
  ngOnInit(): void {
    this.buildForm();
    this.patchFormFromProfile();
    if (this.autoEdit) {
      this.startEdit();
    }
    if (this.isClient()) {
      this.loadClientActivity();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['autoEdit']?.currentValue === true) {
      this.startEdit();
    }
    if (changes['profile'] && !changes['profile'].firstChange) {
      this.patchFormFromProfile();
    }
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  // ─── Form Setup ───────────────────────────────────────────────
  private buildForm(): void {
    this.profileForm = this.fb.group<ProfileFormModel>({
      firstName: this.fb.control('', {
        nonNullable: true,
        validators: [trimmedRequired, Validators.minLength(2), Validators.maxLength(50)]
      }),
      lastName: this.fb.control('', {
        nonNullable: true,
        validators: [Validators.maxLength(50)]
      }),
      phone: this.fb.control('', {
        nonNullable: true,
        validators: [phoneValidator]
      }),
      language: this.fb.control('English', { nonNullable: true }),
      city: this.fb.control('', {
        nonNullable: true,
        validators: [Validators.maxLength(60)]
      }),
      state: this.fb.control('', {
        nonNullable: true,
        validators: [Validators.maxLength(60)]
      })
    });
  }

  private patchFormFromProfile(): void {
    if (!this.profile || !this.profileForm) return;
    const nameParts = (this.profile.fullName || '').trim().split(' ');

    this.profileForm.patchValue({
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      phone: this.profile.phone || '',
      language: this.profile.clientLanguage || 'English',
      city: this.profile.clientCity || '',
      state: this.profile.clientState || ''
    }, { emitEvent: false });

    this.profileForm.markAsPristine();
    this.profileForm.markAsUntouched();
  }

  // ─── Reactive Form Helpers ────────────────────────────────────
  isFieldInvalid(fieldName: keyof ProfileFormModel): boolean {
    const control = this.profileForm?.get(fieldName);
    if (!control) return false;
    return control.invalid && (control.touched || control.dirty);
  }

  getFieldError(fieldName: keyof ProfileFormModel): string | null {
    const control = this.profileForm?.get(fieldName);
    if (!control || !control.errors || (!control.touched && !control.dirty)) return null;

    const errors = control.errors;
    if (errors['required']) {
      return `${this.getFieldLabel(fieldName)} is required.`;
    }
    if (errors['minlength']) {
      return `${this.getFieldLabel(fieldName)} must be at least ${errors['minlength'].requiredLength} characters.`;
    }
    if (errors['maxlength']) {
      return `${this.getFieldLabel(fieldName)} cannot exceed ${errors['maxlength'].requiredLength} characters.`;
    }
    if (errors['minDigits']) {
      return `Phone number must be at least ${errors['minDigits'].requiredLength} digits.`;
    }
    if (errors['maxDigits']) {
      return `Phone number cannot exceed ${errors['maxDigits'].maxLength} digits.`;
    }
    return 'Invalid value.';
  }

  getFieldLabel(fieldName: keyof ProfileFormModel): string {
    const labels: Record<keyof ProfileFormModel, string> = {
      firstName: 'First name',
      lastName: 'Last name',
      phone: 'Mobile phone number',
      language: 'Preferred language',
      city: 'City',
      state: 'State'
    };
    return labels[fieldName] || fieldName;
  }

  // ─── Actions ──────────────────────────────────────────────────
  startEdit(): void {
    this.isEditing.set(true);
  }

  toggleEdit(): void {
    if (this.isEditing()) {
      this.cancelEdit();
    } else {
      this.startEdit();
    }
  }

  cancelEdit(): void {
    this.patchFormFromProfile();
    this.isEditing.set(false);
    this.snackbar.show('Profile edits discarded.', 'info');
  }

  saveProfile(): void {
    const fieldsToValidate: (keyof ProfileFormModel)[] = ['firstName', 'lastName', 'phone', 'city', 'state'];

    let hasErrors = false;
    for (const field of fieldsToValidate) {
      const ctrl = this.profileForm.get(field);
      if (ctrl) {
        ctrl.markAsTouched();
        ctrl.markAsDirty();
        if (ctrl.invalid) {
          hasErrors = true;
        }
      }
    }

    if (hasErrors) {
      for (const field of fieldsToValidate) {
        const errorMsg = this.getFieldError(field);
        if (errorMsg) {
          this.snackbar.show(errorMsg, 'warning');
          break;
        }
      }
      return;
    }

    const v = this.profileForm.getRawValue();
    this.isSaving.set(true);
    const fullName = `${v.firstName} ${v.lastName}`.trim();

    const updatePayload: any = {
      fullName,
      phone: v.phone,
      clientLanguage: v.language,
      clientCity: v.city,
      clientState: v.state
    };

    this.userProfileService.updateProfile(updatePayload).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.isEditing.set(false);
        this.snackbar.show('Profile details saved successfully!', 'success');
        this.profileUpdated.emit({
          ...res,
          ...updatePayload
        });
      },
      error: () => {
        this.isSaving.set(false);
        this.snackbar.show('Failed to save profile. Please try again.', 'error');
      }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────
  get isDirty(): boolean {
    return this.profileForm ? this.profileForm.dirty : false;
  }

  onAvatarClick(): void {
    this.triggerAvatarChange.emit();
  }

  triggerVerifyPhone(): void {
    this.requestPhoneVerification.emit();
  }

  getMaskedPhone(): string {
    const phone = this.profile?.phone;
    if (!phone) return '—';
    if (phone.length <= 4) return phone;
    const last4 = phone.slice(-4);
    return `+91 ••••• ••${last4}`;
  }

  get accountId(): string {
    if (this.accountIdInput) return this.accountIdInput;
    if (this.profile?.publicId) return this.profile.publicId;
    const prefix = this.isClient() ? 'LC-USR' : 'LC-ADV';
    const id = this.profile?.id || 1;
    const hash = ((id * 2654435761 + 1013904223) >>> 0).toString(16).toUpperCase().padStart(6, '0').slice(-6);
    return `${prefix}-${hash}`;
  }

  copyAccountId(): void {
    const id = this.accountId;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(id).then(() => {
        this.copiedId.set(true);
        this.snackbar.show(`${this.isClient() ? 'Client ID' : 'Advocate ID'} copied to clipboard!`, 'success');
        setTimeout(() => this.copiedId.set(false), 2000);
      }).catch(() => {
        this.snackbar.show(`Account ID: ${id}`, 'info');
      });
    } else {
      this.snackbar.show(`Account ID: ${id}`, 'info');
    }
  }

  onLawyerCredentialsUpdated(data: LawyerProfileData): void {
    this.lawyerProfileUpdated.emit(data);
  }

  // ─── Client Activity Methods ─────────────────────────────────
  loadClientActivity(): void {
    this.fetchSavedLawyerDetails(this.savedItemsService.savedLawyers());
    this.loadSentInquiries();
    this.loadSupportTickets();

    this.myReviewsLoading.set(true);
    this.reviewService.getMyReviews().subscribe({
      next: (reviews) => {
        this.allReviews.set(reviews || []);
        this.myReviewsLoading.set(false);
      },
      error: () => this.myReviewsLoading.set(false)
    });
  }

  loadSentInquiries(): void {
    this.sentInquiriesLoading.set(true);
    this.lawyerService.getSentInquiries().subscribe({
      next: (consultations) => {
        this.allInquiries.set(Array.isArray(consultations) ? consultations : []);
        this.sentInquiriesLoading.set(false);
      },
      error: () => this.sentInquiriesLoading.set(false)
    });
  }

  loadSupportTickets(): void {
    this.supportTicketsLoading.set(true);
    const userEmail = (this.profile?.email || this.authService.currentUser?.email || '').trim();
    if (!userEmail) {
      this.supportTicketsLoading.set(false);
      return;
    }

    this.infoApi.trackTicket(userEmail).pipe(
      map((res) => {
        let tickets = (res && res.success && res.tickets) ? res.tickets : [];

        if (typeof window !== 'undefined') {
          try {
            const key = `legalconnect_history_${userEmail.toLowerCase()}`;
            const saved = localStorage.getItem(key);
            if (saved) {
              const localItems: any[] = JSON.parse(saved);
              const ticketIdSet = new Set(tickets.map((t: any) => t.ticketId));
              localItems.forEach(item => {
                if (!ticketIdSet.has(item.ticketId)) {
                  tickets.push(item);
                  ticketIdSet.add(item.ticketId);
                }
              });
            }
          } catch (e) { }
        }

        return tickets.sort((a: any, b: any) =>
          new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
        );
      }),
      catchError(() => of([]))
    ).subscribe({
      next: (tickets) => {
        this.supportTickets.set(tickets);
        this.supportTicketsLoading.set(false);
      },
      error: () => {
        this.supportTicketsLoading.set(false);
      }
    });
  }

  private fetchSavedLawyerDetails(savedInfos: SavedLawyerInfo[]): void {
    if (!savedInfos || savedInfos.length === 0) {
      this.savedLawyers.set([]);
      this.savedLawyersLoading.set(false);
      return;
    }
    this.savedLawyersLoading.set(true);
    const ids = savedInfos.map(l => l.lawyerId);
    this.lawyerService.getLawyersByIds(ids).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.savedLawyers.set(res.data.slice(0, 4));
        }
        this.savedLawyersLoading.set(false);
      },
      error: () => this.savedLawyersLoading.set(false)
    });
  }

  navigateToLawyers(): void {
    this.router.navigate(['/lawyers']);
  }

  navigateToLawyerDetail(lawyerId?: string | number): void {
    if (lawyerId) {
      this.router.navigate(['/lawyers', String(lawyerId)]);
    }
  }

  navigateToSavedDirectory(): void {
    this.router.navigate(['/client/portal'], { queryParams: { tab: 'saved-directory' } });
  }

  navigateToInquiries(): void {
    this.router.navigate(['/client/portal'], { queryParams: { tab: 'inquiries' } });
  }

  navigateToInquiryDetail(_inq?: Consultation): void {
    this.router.navigate(['/client/portal'], { queryParams: { tab: 'inquiries' } });
  }

  navigateToSavedBookmarks(): void {
    this.router.navigate(['/client/portal'], { queryParams: { tab: 'bookmarks' } });
  }

  navigateToSection(actShortName?: string, sectionNumber?: string): void {
    if (actShortName && sectionNumber) {
      this.router.navigate(['/laws', actShortName], { fragment: `sec-${sectionNumber}` });
    } else if (actShortName) {
      this.router.navigate(['/laws', actShortName]);
    } else {
      this.router.navigate(['/laws']);
    }
  }

  navigateToReviewsTab(): void {
    this.router.navigate(['/client/portal'], { queryParams: { tab: 'feedback' } });
  }

  navigateToReview(_rev?: ReviewItem): void {
    this.router.navigate(['/client/portal'], { queryParams: { tab: 'feedback' } });
  }

  navigateToPublicReviews(): void {
    this.router.navigate(['/reviews']);
  }

  navigateToLaws(): void {
    this.router.navigate(['/laws']);
  }

  navigateToFindHelp(): void {
    this.router.navigate(['/find-help']);
  }

  navigateToAccount(): void {
    this.navigateTab.emit('account');
  }

  formatRelativeTime(dateString?: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  }

  getInquiryStatusClasses(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'accepted':
      case 'confirmed':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60';
      case 'pending':
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60';
      case 'completed':
        return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/60';
      case 'cancelled':
      case 'declined':
        return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60';
      default:
        return 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  }

  getInquiryStatusDot(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'accepted':
      case 'confirmed':
        return 'bg-emerald-500';
      case 'pending':
        return 'bg-amber-500 animate-pulse';
      case 'completed':
        return 'bg-blue-500';
      case 'cancelled':
      case 'declined':
        return 'bg-rose-500';
      default:
        return 'bg-slate-400';
    }
  }

  trackByLawyerId(_index: number, lawyer: Lawyer): string {
    return lawyer._id;
  }

  trackByInquiryId(_index: number, inq: Consultation): number {
    return inq.id;
  }

  trackByBookmark(_index: number, bm: Bookmark): string {
    return bm.actShortName + '-' + bm.section.section_number;
  }

  trackByReviewId(_index: number, rev: ReviewItem): number {
    return rev.id || _index;
  }

  navigateToSupportTickets(): void {
    this.router.navigate(['/client/portal'], { queryParams: { tab: 'inquiries' } });
  }

  navigateToContact(): void {
    this.router.navigate(['/contact']);
  }

  trackByTicketId(_index: number, t: any): string {
    return t.ticketId || String(_index);
  }

  getTicketStatusClasses(status?: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('closed') || s.includes('resolved')) {
      return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60';
    }
    if (s.includes('progress') || s.includes('acknowledged') || s.includes('scheduled')) {
      return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/60';
    }
    return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60';
  }

  getTicketStatusDot(status?: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('closed') || s.includes('resolved')) {
      return 'bg-emerald-500';
    }
    if (s.includes('progress') || s.includes('acknowledged') || s.includes('scheduled')) {
      return 'bg-blue-500';
    }
    return 'bg-amber-500 animate-pulse';
  }

  getTicketStatusLabel(status?: string): string {
    if (!status) return 'Pending';
    if (status.includes('Progress')) return 'In Progress';
    if (status.includes('Closed') || status.includes('Resolved')) return 'Resolved';
    if (status.includes('Acknowledged')) return 'Assigned';
    if (status.includes('Scheduled')) return 'Scheduled';
    return status.split('•')[0].trim();
  }
}