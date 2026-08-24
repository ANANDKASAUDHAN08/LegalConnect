import {
  Component, EventEmitter, Output, Input, OnDestroy, OnInit,
  inject, ChangeDetectionStrategy, ChangeDetectorRef, HostListener, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { LegalService } from '../../../../services/legal.service';
import { AuthService, UserProfile } from '../../../../services/auth.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { IconComponent } from '../../../../components/icon';
import { CustomSelectComponent, SelectOption } from '../../../../components/custom-select';
import {
  CANONICAL_RESOURCE_TYPES,
  INDIAN_STATES_AND_UTS,
  getResourceTypeLabel,
  SUBMITTER_ROLES,
  RESOURCE_FEE_TYPES,
  OPERATING_SCHEDULE_OPTIONS,
  TARGET_BENEFICIARY_TAGS,
  RESOURCE_VALIDATION_RULES
} from '../../../../core/constants/legal-resource.constants';

// ── Typed Payload Interface ──────────────────────────────────────────────────

export interface SuggestResourcePayload {
  name: string;
  type: string;
  state: string;
  district: string;
  city: string;
  pincode?: string;
  address: string;
  contactNumber: string[];
  email?: string;
  website?: string;
  feeType: string;
  operatingDays: string;
  operatingHours: string;
  lunchBreak: string;
  is24x7Emergency: boolean;
  targetBeneficiaries: string[];
  signboardImageUrl?: string;
  submitter: {
    name: string;
    email?: string;
    phone?: string;
    role: string;
    isGuest: boolean;
    userId?: number;
  };
  facilities: {
    hasEfiling: boolean;
    hasLADCS: boolean;
    hasVCRoom: boolean;
    hasLegalAidClinic: boolean;
    isWheelchairAccessible: boolean;
  };
  notes?: string;
  languages: string[];
  coordinates?: { lat: number; lng: number };
}

// ── Upload Constraints ───────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES: readonly string[] = RESOURCE_VALIDATION_RULES.imageUpload.allowedMimeTypes;
const MAX_IMAGE_SIZE_BYTES: number = RESOURCE_VALIDATION_RULES.imageUpload.maxSizeBytes;

@Component({
  selector: 'app-suggest-resource-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TooltipDirective,
    IconComponent,
    CustomSelectComponent
  ],
  templateUrl: './suggest-resource-modal.component.html',
  styleUrls: ['./suggest-resource-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SuggestResourceModalComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private legalService = inject(LegalService);
  private snackbar = inject(SnackbarService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private elementRef = inject(ElementRef);

  private _isOpen = false;

  @Input()
  get isOpen(): boolean {
    return this._isOpen;
  }

  set isOpen(value: boolean) {
    this._isOpen = value;
    this.toggleBodyScroll(value);
    if (value) {
      this.initAuthContext();
      setTimeout(() => this.focusFirstInput(), 50);
    } else {
      this.resetUiState();
    }
  }

  @Output() close = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<any>();

  // ── Reactive Form ──────────────────────────────────────────────────────────

  form: FormGroup = this.buildForm();

  // Wizard Step (1: Essential Details, 2: Operational & Trust Details)
  currentStep: 1 | 2 = 1;

  // Submitter Auth State
  currentUser: UserProfile | null = null;
  isLoggedIn = false;
  private authSub?: Subscription;

  // Target Beneficiaries Selection Map (outside form — toggle-map pattern)
  selectedBeneficiaries: { [key: string]: boolean } = {
    'General Public': true
  };

  // Signboard Photo Proof (visual state — form holds the data URL)
  signboardPreview: string | null = null;
  signboardFileName: string | null = null;

  // GPS Proximity Detection (outside form — set programmatically)
  isLocatingGps = false;
  gpsSuccess = false;
  coordinates: { lat: number | null; lng: number | null } = { lat: null, lng: null };

  // Duplicate Check Engine
  private duplicateSub?: Subscription;
  isCheckingDuplicate = false;
  duplicateWarning: { hasDuplicate: boolean; count: number; matches: any[] } | null = null;

  // ── Static Configuration Presets ───────────────────────────────────────────

  readonly typeOptions: SelectOption[] = CANONICAL_RESOURCE_TYPES.map(t => ({
    value: t.value,
    label: t.label,
    icon: t.icon
  }));

  readonly stateOptions: SelectOption[] = INDIAN_STATES_AND_UTS.map(s => ({
    value: s,
    label: s,
    icon: 'map-pin'
  }));

  readonly submitterRoles = SUBMITTER_ROLES;
  readonly feeTypes = RESOURCE_FEE_TYPES;
  readonly scheduleOptions = OPERATING_SCHEDULE_OPTIONS;
  readonly beneficiaryTags = TARGET_BENEFICIARY_TAGS;

  readonly facilityOptions: Array<{
    key: 'hasEfiling' | 'hasLADCS' | 'hasVCRoom' | 'hasLegalAidClinic' | 'isWheelchairAccessible';
    label: string;
    icon: string;
  }> = [
      { key: 'hasLegalAidClinic', label: 'Legal Aid Clinic', icon: 'shield' },
      { key: 'hasLADCS', label: 'LADCS Counsel', icon: 'award' },
      { key: 'hasEfiling', label: 'e-Filing Desk', icon: 'file-text' },
      { key: 'hasVCRoom', label: 'VC Hearing Room', icon: 'monitor' },
      { key: 'isWheelchairAccessible', label: 'Wheelchair Access', icon: 'check-circle' }
    ];

  // ── UI State ───────────────────────────────────────────────────────────────

  isSubmitting = false;
  successMessage = '';
  submittedRecordId: string | null = null;
  errorMessage = '';

  // ── Cached Step 1 Validity (avoids method calls in template per CD cycle) ─

  get step1Valid(): boolean {
    const f = this.form;
    return !!(
      f.get('name')?.valid &&
      f.get('type')?.valid &&
      f.get('state')?.valid &&
      f.get('district')?.value?.trim() &&
      f.get('address')?.valid
    );
  }

  // ── Convenience Getters for Template [ngClass] & UI Bindings ──────────────

  get selectedFeeType(): string { return this.form.get('feeType')?.value || 'FreeLegalAid'; }
  get selectedOperatingDays(): string { return this.form.get('operatingDays')?.value || 'Mon-Sat'; }
  get selectedSubmitterRole(): string { return this.form.get('submitter.role')?.value || 'Citizen'; }

  get addressLength(): number {
    return (this.form.get('address')?.value || '').length;
  }

  get notesLength(): number {
    return (this.form.get('notes')?.value || '').length;
  }

  // ── Keyboard Navigation & Focus Trap ───────────────────────────────────────

  @HostListener('keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (!this._isOpen) return;

    if (event.key === 'Escape') {
      if (!this.isSubmitting) {
        this.onClose();
      }
      return;
    }

    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  private trapFocus(event: KeyboardEvent) {
    const modalEl = this.elementRef.nativeElement.querySelector('.modal-container');
    if (!modalEl) return;

    const focusableElements = Array.from(
      modalEl.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el: any) => el.offsetParent !== null) as HTMLElement[];

    if (focusableElements.length === 0) return;

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }
  }

  private focusFirstInput() {
    if (typeof document === 'undefined') return;
    const firstInput = this.elementRef.nativeElement.querySelector(
      'input:not([disabled]):not([type="hidden"]), textarea:not([disabled])'
    ) as HTMLElement;
    firstInput?.focus();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit() {
    this.authSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.isLoggedIn = !!user;
      this.initAuthContext();
      this.cdr.markForCheck();
    });

    // Real-time debounced duplicate detection via reactive valueChanges
    this.duplicateSub = this.form.get('name')!.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(val => {
      const trimmed = val?.trim() || '';
      if (trimmed.length >= 3) {
        this.checkDuplicates(trimmed);
      } else {
        this.duplicateWarning = null;
        this.isCheckingDuplicate = false;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy() {
    this.toggleBodyScroll(false);
    this.authSub?.unsubscribe();
    this.duplicateSub?.unsubscribe();
  }

  // ── Form Construction ──────────────────────────────────────────────────────

  private buildForm(): FormGroup {
    return this.fb.group({
      // Step 1: Essential Location Details
      name: ['', [Validators.required, Validators.minLength(RESOURCE_VALIDATION_RULES.name.min), Validators.maxLength(RESOURCE_VALIDATION_RULES.name.max)]],
      type: ['LegalAid', Validators.required],
      state: ['', Validators.required],
      district: ['', [Validators.required, Validators.maxLength(RESOURCE_VALIDATION_RULES.district.max)]],
      pincode: ['', Validators.pattern(RESOURCE_VALIDATION_RULES.pincode.regex)],
      address: ['', [Validators.required, Validators.maxLength(RESOURCE_VALIDATION_RULES.address.max)]],
      contactNumber: ['', Validators.maxLength(RESOURCE_VALIDATION_RULES.contactNumber.max)],
      email: ['', Validators.email],

      // Step 2: Operations & Trust Details
      website: ['', Validators.maxLength(RESOURCE_VALIDATION_RULES.website.max)],
      feeType: ['FreeLegalAid'],
      operatingDays: ['Mon-Sat'],
      operatingHours: ['09:30 AM - 05:00 PM', Validators.maxLength(RESOURCE_VALIDATION_RULES.operatingHours.max)],
      lunchBreak: ['01:30 PM - 02:00 PM'],
      is24x7Emergency: [false],
      notes: ['', Validators.maxLength(RESOURCE_VALIDATION_RULES.notes.max)],
      languages: [['English', 'Hindi']],

      // Facility Flags
      hasEfiling: [false],
      hasLADCS: [false],
      hasVCRoom: [false],
      hasLegalAidClinic: [true],
      isWheelchairAccessible: [true],

      // Hidden (set programmatically)
      signboardImageUrl: [''],

      // Nested Submitter Group
      submitter: this.fb.group({
        name: ['', Validators.maxLength(100)],
        email: ['', Validators.email],
        phone: ['', Validators.maxLength(20)],
        role: ['Citizen'],
        isGuest: [true]
      })
    });
  }

  private getDefaultFormValues() {
    return {
      name: '',
      type: 'LegalAid',
      state: '',
      district: '',
      pincode: '',
      address: '',
      contactNumber: '',
      email: '',
      website: '',
      feeType: 'FreeLegalAid',
      operatingDays: 'Mon-Sat',
      operatingHours: '09:30 AM - 05:00 PM',
      lunchBreak: '01:30 PM - 02:00 PM',
      is24x7Emergency: false,
      notes: '',
      languages: ['English', 'Hindi'],
      hasEfiling: false,
      hasLADCS: false,
      hasVCRoom: false,
      hasLegalAidClinic: true,
      isWheelchairAccessible: true,
      signboardImageUrl: '',
      submitter: {
        name: '',
        email: '',
        phone: '',
        role: 'Citizen',
        isGuest: true
      }
    };
  }

  // ── Auth Context ───────────────────────────────────────────────────────────

  private initAuthContext() {
    if (this.currentUser) {
      this.form.patchValue({
        submitter: {
          isGuest: false,
          name: this.currentUser.fullName || '',
          email: this.currentUser.email || '',
          phone: this.currentUser.phone || ''
        }
      });
      const roleLower = (this.currentUser.role || '').toLowerCase();
      if (roleLower.includes('advocate') || roleLower.includes('lawyer')) {
        this.form.get('submitter.role')?.setValue('Advocate');
      } else if (roleLower.includes('official') || roleLower.includes('admin')) {
        this.form.get('submitter.role')?.setValue('CourtOfficial');
      } else {
        this.form.get('submitter.role')?.setValue('Citizen');
      }
    } else {
      this.form.patchValue({ submitter: { isGuest: true } });
      if (!this.form.get('submitter.role')?.value) {
        this.form.get('submitter.role')?.setValue('Citizen');
      }
    }
  }

  // ── Duplicate Detection ────────────────────────────────────────────────────

  private checkDuplicates(query: string) {
    this.isCheckingDuplicate = true;
    const city = this.form.get('district')?.value || '';
    const state = this.form.get('state')?.value || '';

    this.legalService.checkDuplicateResource(query, city, state).subscribe({
      next: (res) => {
        this.isCheckingDuplicate = false;
        if (res.success && res.data && res.data.hasDuplicate) {
          this.duplicateWarning = res.data;
        } else {
          this.duplicateWarning = null;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isCheckingDuplicate = false;
        this.duplicateWarning = null;
        this.cdr.markForCheck();
      }
    });
  }

  dismissDuplicateWarning() {
    this.duplicateWarning = null;
  }

  // ── GPS Proximity ──────────────────────────────────────────────────────────

  fetchCurrentGps() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.snackbar.show('Geolocation is not supported by your browser.', 'error');
      return;
    }

    this.isLocatingGps = true;
    this.gpsSuccess = false;
    this.cdr.markForCheck();

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.isLocatingGps = false;
        this.gpsSuccess = true;
        this.coordinates = {
          lat: parseFloat(position.coords.latitude.toFixed(6)),
          lng: parseFloat(position.coords.longitude.toFixed(6))
        };
        this.snackbar.show(
          `📍 GPS Location attached: ${this.coordinates.lat}, ${this.coordinates.lng}`,
          'success'
        );
        this.cdr.markForCheck();
      },
      (error) => {
        this.isLocatingGps = false;
        this.gpsSuccess = false;
        console.warn('Geolocation error:', error);
        this.snackbar.show('Could not access GPS. Centroid fallback will be used automatically.', 'info');
        this.cdr.markForCheck();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  clearCoordinates() {
    this.coordinates = { lat: null, lng: null };
    this.gpsSuccess = false;
  }

  // ── Photo Proof Upload with MIME Validation ────────────────────────────────

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        this.snackbar.show('Invalid file type. Please upload JPEG, PNG, or WebP images only.', 'error');
        input.value = '';
        return;
      }

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        this.snackbar.show('File size exceeds 5MB limit.', 'error');
        input.value = '';
        return;
      }

      this.signboardFileName = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        this.signboardPreview = reader.result as string;
        this.form.get('signboardImageUrl')?.setValue(reader.result as string);
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    }
  }

  removePhoto() {
    this.signboardPreview = null;
    this.signboardFileName = null;
    this.form.get('signboardImageUrl')?.setValue('');
  }

  // ── Step Navigation ────────────────────────────────────────────────────────

  setStep(step: 1 | 2) {
    if (step === 2 && !this.step1Valid) {
      this.errorMessage = 'Please complete all required fields marked with * in Step 1 before proceeding.';
      return;
    }
    this.errorMessage = '';
    this.currentStep = step;
  }

  // ── Selection Handlers ─────────────────────────────────────────────────────

  toggleBeneficiary(key: string) {
    this.selectedBeneficiaries[key] = !this.selectedBeneficiaries[key];
  }

  selectSchedule(schedule: any) {
    this.form.patchValue({
      operatingDays: schedule.value,
      operatingHours: schedule.hours
    });
    if (schedule.value === '24x7Emergency') {
      this.form.get('is24x7Emergency')?.setValue(true);
    }
  }

  selectFeeType(fee: string) {
    this.form.get('feeType')?.setValue(fee);
  }

  selectSubmitterRole(role: any) {
    this.form.get('submitter.role')?.setValue(role.value);
  }

  getSelectedTypeLabel(): string {
    return getResourceTypeLabel(this.form.get('type')?.value);
  }

  // ── Modal Close & Reset ────────────────────────────────────────────────────

  onClose() {
    this.close.emit();
    this.resetUiState();
  }

  /** Reset UI-only state — preserves form data as draft between open/close */
  private resetUiState() {
    this.currentStep = 1;
    this.successMessage = '';
    this.submittedRecordId = null;
    this.errorMessage = '';
    this.isSubmitting = false;
    this.duplicateWarning = null;
    this.isCheckingDuplicate = false;
    // Draft state (form data, photo, GPS) is intentionally preserved
  }

  /** Full reset after successful submission — clears everything */
  private resetFormData() {
    this.form.reset(this.getDefaultFormValues());
    this.coordinates = { lat: null, lng: null };
    this.gpsSuccess = false;
    this.signboardPreview = null;
    this.signboardFileName = null;
    this.selectedBeneficiaries = { 'General Public': true };
    this.initAuthContext();
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  submitSuggestion() {
    const v = this.form.getRawValue();
    const cityOrDistrict = v.district?.trim() || '';

    if (!v.name?.trim() || !v.type || !v.state || !v.address?.trim() || !cityOrDistrict) {
      this.errorMessage = 'Please fill in all required fields marked with * (Institution Name, Category, State, District/City, Physical Address)';
      this.currentStep = 1;
      return;
    }

    if (v.pincode && !/^\d{6}$/.test(v.pincode.trim())) {
      this.errorMessage = 'Please enter a valid 6-digit Indian PIN code';
      this.currentStep = 1;
      return;
    }

    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) {
      this.errorMessage = 'Please enter a valid email address';
      this.currentStep = 1;
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const selectedBeneficiaryList = Object.keys(this.selectedBeneficiaries)
      .filter(k => this.selectedBeneficiaries[k]);

    const hasValidCoords = this.coordinates?.lat !== null &&
      this.coordinates?.lng !== null &&
      !isNaN(Number(this.coordinates?.lat)) &&
      !isNaN(Number(this.coordinates?.lng));

    const payload: SuggestResourcePayload = {
      name: v.name.trim(),
      type: v.type,
      state: v.state,
      district: cityOrDistrict,
      city: cityOrDistrict,
      pincode: v.pincode?.trim() || undefined,
      address: v.address.trim(),
      contactNumber: v.contactNumber ? [v.contactNumber.trim()] : [],
      email: v.email ? v.email.trim() : undefined,
      website: v.website ? v.website.trim() : undefined,
      feeType: v.feeType,
      operatingDays: v.operatingDays,
      operatingHours: v.operatingHours,
      lunchBreak: v.lunchBreak,
      is24x7Emergency: v.is24x7Emergency,
      targetBeneficiaries: selectedBeneficiaryList,
      signboardImageUrl: v.signboardImageUrl || undefined,
      submitter: {
        name: v.submitter.name?.trim() || (this.isLoggedIn ? this.currentUser?.fullName : 'Guest Contributor'),
        email: v.submitter.email?.trim() || (this.isLoggedIn ? this.currentUser?.email : undefined),
        phone: v.submitter.phone?.trim() || undefined,
        role: v.submitter.role,
        isGuest: !this.isLoggedIn,
        userId: this.currentUser?.id || undefined
      },
      facilities: {
        hasEfiling: !!v.hasEfiling,
        hasLADCS: !!v.hasLADCS,
        hasVCRoom: !!v.hasVCRoom,
        hasLegalAidClinic: !!v.hasLegalAidClinic,
        isWheelchairAccessible: !!v.isWheelchairAccessible
      },
      notes: v.notes ? v.notes.trim() : undefined,
      languages: v.languages,
      coordinates: hasValidCoords ? {
        lat: Number(this.coordinates.lat),
        lng: Number(this.coordinates.lng)
      } : undefined
    };

    this.legalService.suggestResource(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success) {
          this.successMessage = res.message || 'Resource suggestion queued successfully!';
          this.submittedRecordId = res.data?._id || `SUG-${Date.now().toString().slice(-6)}`;
          this.snackbar.show(
            'Suggestion submitted successfully! Thank you for contributing to civic legal access.',
            'success'
          );
          this.submitted.emit(res.data);
          // Clear form data after successful submit (success screen stays visible)
          this.resetFormData();
        } else {
          this.errorMessage = 'Submission could not be completed. Please verify all entries.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || 'Failed to submit suggestion. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  private toggleBodyScroll(showModal: boolean) {
    if (typeof document !== 'undefined') {
      if (showModal) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
  }
}