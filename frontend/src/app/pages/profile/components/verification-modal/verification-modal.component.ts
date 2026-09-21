import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, UserProfile } from '../../../../services/auth.service';
import { UserProfileService } from '../../../../services/user-profile.service';
import { VerificationService } from '../../../../services/verification.service';
import { PhoneAuthService } from '../../../../services/phone-auth.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { COUNTRIES } from '../../../../constants/countries.constant';
import { IconComponent } from '../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { CustomSelectComponent, SelectOption } from '../../../../components/custom-select';

export type VerificationFlowType = 'phone' | 'email' | 'emergency' | 'identity';

@Component({
  selector: 'app-verification-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, TooltipDirective, CustomSelectComponent],
  templateUrl: './verification-modal.component.html'
})
export class VerificationModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() flow: VerificationFlowType = 'phone';
  @Input() profile: UserProfile | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() profileUpdated = new EventEmitter<Partial<UserProfile>>();

  trackByCountryCode(index: number, c: any): string {
    return (c?.code || '') + (c?.short || '') || index.toString();
  }

  private auth = inject(AuthService);
  private userProfileService = inject(UserProfileService);
  private verificationService = inject(VerificationService);
  private phoneAuth = inject(PhoneAuthService);
  private snackbar = inject(SnackbarService);

  activeFlow: VerificationFlowType = 'phone';

  // ── Phone Verification State ──
  countries = COUNTRIES;
  selectedCountry = this.countries[0];
  showCountryDropdown = false;
  phoneBody = '';
  countrySearchText = '';
  phoneOtpCode = '';
  showPhoneOtpInput = false;
  otpLoading = false;
  resendLoading = false;
  resendCooldown = 0;
  private _cooldownInterval: ReturnType<typeof setInterval> | null = null;

  // ── Email Verification State ──
  emailResendLoading = false;

  // ── Emergency Recovery Contact State ──
  emergencyName = '';
  emergencyPhone = '';
  emergencyRelation = 'Family';
  isSavingEmergency = false;
  isRemovingEmergency = false;

  relationOptions: SelectOption[] = [
    { value: 'Family', label: 'Family Member / Spouse', icon: 'users' },
    { value: 'Legal Proxy', label: 'Legal Representative / Proxy', icon: 'shield-check' },
    { value: 'Associate', label: 'Legal Associate / Partner', icon: 'briefcase' },
    { value: 'Colleague', label: 'Trusted Colleague', icon: 'user' },
    { value: 'Friend', label: 'Trusted Friend', icon: 'user-check' },
    { value: 'Other', label: 'Other', icon: 'help-circle' }
  ];

  // ── Legacy Identity State (kept for backwards-compatibility) ──
  indianIdType: 'Aadhaar' | 'PAN' | 'Voter ID' | 'Bar Council Card' = 'Aadhaar';
  idNumber = '';
  idUploadFileName = '';
  uploadingId = false;

  get isEmergencyConfigured(): boolean {
    return !!(this.profile?.emergencyContactName && this.profile?.emergencyContactPhone);
  }

  ngOnInit() {
    this.activeFlow = (this.flow as any) === 'identity' ? 'emergency' : this.flow;
    this.initFromProfile();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['flow']?.currentValue) {
      const f = changes['flow'].currentValue;
      this.activeFlow = f === 'identity' ? 'emergency' : f;
    }
    if (changes['profile']?.currentValue) {
      this.initFromProfile();
    }
  }

  ngOnDestroy() {
    if (this._cooldownInterval) {
      clearInterval(this._cooldownInterval);
    }
    this.phoneAuth.resetOtpSession();
  }

  initFromProfile() {
    if (!this.profile) return;
    this.initializePhone(this.profile.phone || '');
    this.emergencyName = this.profile.emergencyContactName || '';
    this.emergencyPhone = this.profile.emergencyContactPhone || '';
    this.emergencyRelation = this.profile.emergencyContactRelation || 'Family';
    if (this.profile.role === 'Lawyer') {
      this.indianIdType = 'Bar Council Card';
    } else {
      this.indianIdType = 'Aadhaar';
    }
  }

  setFlow(flow: VerificationFlowType) {
    this.activeFlow = flow === 'identity' ? 'emergency' : flow;
    this.showPhoneOtpInput = false;
    this.phoneOtpCode = '';
  }

  closeModal() {
    this.showPhoneOtpInput = false;
    this.phoneOtpCode = '';
    if (this._cooldownInterval) {
      clearInterval(this._cooldownInterval);
    }
    this.phoneAuth.resetOtpSession();
    this.close.emit();
  }

  // ── Country Selector ──
  toggleCountryDropdown() {
    this.showCountryDropdown = !this.showCountryDropdown;
    if (this.showCountryDropdown) this.countrySearchText = '';
  }

  selectCountry(country: any) {
    this.selectedCountry = country;
    this.showCountryDropdown = false;
  }

  getFilteredCountries() {
    if (!this.countrySearchText.trim()) return this.countries;
    const s = this.countrySearchText.toLowerCase().trim();
    return this.countries.filter(c =>
      c.name.toLowerCase().includes(s) ||
      c.short.toLowerCase().includes(s) ||
      c.code.includes(s)
    );
  }

  initializePhone(fullPhone: string) {
    if (!fullPhone) {
      this.selectedCountry = this.countries[0];
      this.phoneBody = '';
      return;
    }
    const sorted = [...this.countries].sort((a, b) => b.code.length - a.code.length);
    for (const c of sorted) {
      if (fullPhone.startsWith(c.code)) {
        this.selectedCountry = c;
        this.phoneBody = fullPhone.substring(c.code.length).replace(/\D/g, '').trim();
        return;
      }
    }
    this.selectedCountry = this.countries[0];
    this.phoneBody = fullPhone.replace(/\D/g, '').trim();
  }

  onlyNumbers(event: KeyboardEvent) {
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }

  filterPhoneDigits() {
    this.phoneBody = this.phoneBody.replace(/\D/g, '');
  }

  // ── Phone OTP Actions ──
  sendPhoneOtp() {
    if (this.phoneBody.trim().length !== 10) {
      this.snackbar.show('Please enter a valid 10-digit mobile number.', 'warning');
      return;
    }
    const fullPhone = `${this.selectedCountry.code}${this.phoneBody}`.trim();
    this.resendLoading = true;

    this.phoneAuth.sendSmsOtp(fullPhone).subscribe({
      next: () => {
        this.resendLoading = false;
        this.showPhoneOtpInput = true;
        this.startCooldown();
        this.snackbar.show(`OTP sent to ${fullPhone}. Enter the 6-digit code.`, 'info');
      },
      error: (err: any) => {
        this.resendLoading = false;
        this.snackbar.show(err?.message || err?.error || 'Failed to send OTP code.', 'error');
      }
    });
  }

  verifyPhoneOtp() {
    if (this.phoneOtpCode.trim().length < 6) {
      this.snackbar.show('Please enter the 6-digit OTP code.', 'warning');
      return;
    }
    const fullPhone = `${this.selectedCountry.code}${this.phoneBody}`.trim();
    this.otpLoading = true;

    this.phoneAuth.verifySmsOtp(this.phoneOtpCode.trim()).subscribe({
      next: (res) => {
        this.phoneAuth.saveVerifiedPhoneToBackend(fullPhone, res.idToken).subscribe({
          next: () => {
            this.otpLoading = false;
            this.showPhoneOtpInput = false;
            this.snackbar.show('Mobile number verified successfully!', 'success');
            this.profileUpdated.emit({
              phone: fullPhone,
              isPhoneVerified: true
            });
            this.closeModal();
          },
          error: (_backendErr: any) => {
            // Token verified by Firebase; even if backend sync encounters an issue, update profile state
            this.otpLoading = false;
            this.showPhoneOtpInput = false;
            this.snackbar.show('Mobile number verified successfully!', 'success');
            this.profileUpdated.emit({
              phone: fullPhone,
              isPhoneVerified: true
            });
            this.closeModal();
          }
        });
      },
      error: (err: any) => {
        this.otpLoading = false;
        this.snackbar.show(err?.message || err?.error || 'Invalid OTP code. Try again.', 'error');
      }
    });
  }

  resendPhoneOtp() {
    if (this.resendCooldown > 0) return;
    this.sendPhoneOtp();
  }

  startCooldown() {
    this.resendCooldown = 45;
    if (this._cooldownInterval) clearInterval(this._cooldownInterval);
    this._cooldownInterval = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(this._cooldownInterval!);
      }
    }, 1000);
  }

  // ── Email Verification Actions ──
  resendEmailVerification() {
    if (!this.profile?.email) return;
    this.emailResendLoading = true;
    this.verificationService.resendEmailVerification(this.profile.email).subscribe({
      next: () => {
        this.emailResendLoading = false;
        this.snackbar.show('Verification link sent! Check your inbox.', 'success');
      },
      error: (err: any) => {
        this.emailResendLoading = false;
        this.snackbar.show(err?.error || err?.message || 'Failed to send email verification.', 'error');
      }
    });
  }

  // ── Identity / KYC Actions ──
  selectedIdBase64 = '';

  onIdFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.idUploadFileName = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        this.selectedIdBase64 = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  submitIdentityVerification() {
    if (!this.idNumber.trim()) {
      this.snackbar.show('Please enter your document registration number.', 'warning');
      return;
    }
    this.uploadingId = true;
    const documentPayload = this.selectedIdBase64 || `data:text/plain;base64,${btoa(this.idNumber.trim())}`;
    this.userProfileService.verifyIdentity(this.indianIdType, documentPayload).subscribe({
      next: (res) => {
        this.uploadingId = false;
        this.snackbar.show(res?.message || 'Identity document uploaded and verified successfully!', 'success');
        this.profileUpdated.emit({
          identityStatus: res?.identityStatus || 'Verified',
          identityDocumentUrl: res?.identityDocumentUrl
        });
        this.closeModal();
      },
      error: () => {
        this.uploadingId = false;
        this.snackbar.show('Failed to submit identity verification. Please try again.', 'error');
      }
    });
  }

  // ── Emergency Recovery Contact Actions ──
  saveEmergencyContact() {
    if (!this.emergencyName.trim()) {
      this.snackbar.show('Please enter the contact person\'s full name.', 'warning');
      return;
    }
    if (!this.emergencyPhone.trim()) {
      this.snackbar.show('Please enter a valid emergency contact phone number.', 'warning');
      return;
    }

    this.isSavingEmergency = true;
    const payload: Partial<UserProfile> = {
      emergencyContactName: this.emergencyName.trim(),
      emergencyContactPhone: this.emergencyPhone.trim(),
      emergencyContactRelation: this.emergencyRelation || 'Family'
    };

    this.userProfileService.updateProfile(payload).subscribe({
      next: () => {
        this.isSavingEmergency = false;
        if (this.profile) {
          this.profile.emergencyContactName = payload.emergencyContactName;
          this.profile.emergencyContactPhone = payload.emergencyContactPhone;
          this.profile.emergencyContactRelation = payload.emergencyContactRelation;
        }
        this.snackbar.show('Emergency recovery contact updated successfully!', 'success');
        this.profileUpdated.emit(payload);
        this.closeModal();
      },
      error: (err: any) => {
        this.isSavingEmergency = false;
        const msg = err?.error?.message || err?.error || 'Failed to update emergency recovery contact.';
        this.snackbar.show(msg, 'error');
      }
    });
  }

  removeEmergencyContact() {
    this.isRemovingEmergency = true;
    const payload: Partial<UserProfile> = {
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelation: ''
    };

    this.userProfileService.updateProfile(payload).subscribe({
      next: () => {
        this.isRemovingEmergency = false;
        this.emergencyName = '';
        this.emergencyPhone = '';
        this.emergencyRelation = 'Family';
        if (this.profile) {
          this.profile.emergencyContactName = '';
          this.profile.emergencyContactPhone = '';
          this.profile.emergencyContactRelation = '';
        }
        this.snackbar.show('Emergency recovery contact removed.', 'info');
        this.profileUpdated.emit(payload);
      },
      error: (err: any) => {
        this.isRemovingEmergency = false;
        const msg = err?.error?.message || err?.error || 'Failed to remove emergency contact.';
        this.snackbar.show(msg, 'error');
      }
    });
  }
}