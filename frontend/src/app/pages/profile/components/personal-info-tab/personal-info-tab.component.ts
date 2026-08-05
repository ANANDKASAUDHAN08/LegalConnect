import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, UserProfile } from '../../../../services/auth.service';
import { UserProfileService } from '../../../../services/user-profile.service';
import { VerificationService } from '../../../../services/verification.service';
import { PhoneAuthService } from '../../../../services/phone-auth.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { COUNTRIES } from '../../../../constants/countries.constant';

@Component({
  selector: 'app-personal-info-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './personal-info-tab.component.html'
})
export class PersonalInfoTabComponent implements OnInit, OnChanges, OnDestroy {
  @Input() profile!: UserProfile;
  @Output() profileUpdated = new EventEmitter<UserProfile>();
  @Output() triggerAvatarChange = new EventEmitter<void>();

  /** Set to true from the parent to enter edit mode programmatically. */
  @Input() autoEdit = false;

  isEditing = false;
  editFullName = '';
  editFirstName = '';
  editLastName = '';
  editPhone = '';
  editLanguage = '';
  editCity = '';

  // ── Country Code Dropdown ──
  countries = COUNTRIES;

  selectedCountry = this.countries[0];
  showCountryDropdown = false;
  phoneBody = '';
  countrySearchText = '';

  toggleCountryDropdown() {
    this.showCountryDropdown = !this.showCountryDropdown;
    if (this.showCountryDropdown) {
      this.countrySearchText = '';
    }
  }

  selectCountry(country: any) {
    this.selectedCountry = country;
    this.showCountryDropdown = false;
    this.countrySearchText = '';
  }

  getFilteredCountries() {
    if (!this.countrySearchText.trim()) {
      return this.countries;
    }
    const search = this.countrySearchText.toLowerCase().trim();
    return this.countries.filter(c =>
      c.name.toLowerCase().includes(search) ||
      c.short.toLowerCase().includes(search) ||
      c.code.includes(search)
    );
  }

  initializePhone(fullPhone: string) {
    if (!fullPhone) {
      this.selectedCountry = this.countries[0];
      this.phoneBody = '';
      return;
    }

    const sortedCountries = [...this.countries].sort((a, b) => b.code.length - a.code.length);
    for (const c of sortedCountries) {
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
    const charCode = event.key;
    if (!/^\d$/.test(charCode)) {
      event.preventDefault();
    }
  }

  filterPhoneDigits() {
    this.phoneBody = this.phoneBody.replace(/\D/g, '');
  }
  editInterest = '';
  editDateOfBirth = '';
  editGender = '';
  showGenderDropdown = false;
  editAddressLine1 = '';
  editState = '';
  editZip = '';
  editBio = '';
  editAvatarUrl = '';

  // ── Custom Date Picker ──
  showDatePicker = false;
  calendarYear = new Date().getFullYear();
  calendarMonth = new Date().getMonth();
  calendarDays: (Date | null)[] = [];
  readonly monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  readonly weekDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  openDatePicker() {
    if (this.editDateOfBirth) {
      const d = new Date(this.editDateOfBirth + 'T00:00:00');
      this.calendarYear = d.getFullYear();
      this.calendarMonth = d.getMonth();
    } else {
      const now = new Date();
      this.calendarYear = now.getFullYear();
      this.calendarMonth = now.getMonth();
    }
    this.generateCalendar();
    this.showDatePicker = !this.showDatePicker;
  }

  closeDatePicker() { this.showDatePicker = false; }

  onCalMonthChange(month: any) {
    this.calendarMonth = Number(month);
    this.generateCalendar();
  }

  onCalYearChange(year: any) {
    this.calendarYear = Number(year);
    this.generateCalendar();
  }

  getYearOptions(): number[] {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= 1920; y--) {
      years.push(y);
    }
    return years;
  }

  prevCalMonth() {
    if (this.calendarMonth === 0) { this.calendarMonth = 11; this.calendarYear--; }
    else this.calendarMonth--;
    this.generateCalendar();
  }

  nextCalMonth() {
    if (this.calendarMonth === 11) { this.calendarMonth = 0; this.calendarYear++; }
    else this.calendarMonth++;
    this.generateCalendar();
  }

  generateCalendar() {
    const firstDay = new Date(this.calendarYear, this.calendarMonth, 1);
    const lastDay = new Date(this.calendarYear, this.calendarMonth + 1, 0);
    // Convert Sunday=0 to Mon-based offset (Mon=0 … Sun=6)
    const startOffset = (firstDay.getDay() + 6) % 7;
    this.calendarDays = [];
    for (let i = 0; i < startOffset; i++) this.calendarDays.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++)
      this.calendarDays.push(new Date(this.calendarYear, this.calendarMonth, d));
    while (this.calendarDays.length % 7 !== 0) this.calendarDays.push(null);
  }

  selectCalDate(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    this.editDateOfBirth = `${y}-${m}-${d}`;
    this.showDatePicker = false;
  }

  goToToday() {
    const today = new Date();
    this.calendarYear = today.getFullYear();
    this.calendarMonth = today.getMonth();
    this.generateCalendar();
    this.selectCalDate(today);
  }

  isCalSelected(date: Date): boolean {
    if (!this.editDateOfBirth) return false;
    const sel = new Date(this.editDateOfBirth + 'T00:00:00');
    return date.getFullYear() === sel.getFullYear() &&
      date.getMonth() === sel.getMonth() &&
      date.getDate() === sel.getDate();
  }

  isCalToday(date: Date): boolean {
    const t = new Date();
    return date.getFullYear() === t.getFullYear() &&
      date.getMonth() === t.getMonth() &&
      date.getDate() === t.getDate();
  }

  formatDateDisplay(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  languageOptions = ['English', 'Hindi', 'Tamil', 'Telugu', 'Marathi', 'Bengali', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi'];
  interestOptions = ['Criminal Law', 'Civil Law', 'Family Law', 'Corporate Law', 'Property Law', 'Tax Law', 'Labour Law', 'Consumer Rights', 'Cyber Law', 'Immigration Law'];

  showPhoneOtp = false;
  phoneOtpCode = '';
  otpLoading = false;
  resendLoading = false;
  resendCooldown = 0;
  private _cooldownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private auth: AuthService,
    private userProfileService: UserProfileService,
    private verificationService: VerificationService,
    private phoneAuth: PhoneAuthService,
    private snackbar: SnackbarService
  ) { }

  ngOnInit() {
    this.resetForm();
    if (this.autoEdit) this.isEditing = true;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['autoEdit']?.currentValue === true) {
      this.isEditing = true;
    }
  }

  resetForm() {
    this.editFullName = this.profile?.fullName || '';
    const nameParts = this.editFullName.trim().split(' ');
    this.editFirstName = nameParts[0] || '';
    this.editLastName = nameParts.slice(1).join(' ') || '';

    this.editPhone = this.profile?.phone || '';
    this.initializePhone(this.editPhone);
    this.editLanguage = this.profile?.clientLanguage || 'English';
    this.editCity = this.profile?.clientCity || '';
    this.editInterest = this.profile?.clientInterest || '';

    if (this.profile?.dateOfBirth) {
      this.editDateOfBirth = this.profile.dateOfBirth.split('T')[0];
    } else {
      this.editDateOfBirth = '';
    }

    this.editGender = this.profile?.gender || '';
    this.editAddressLine1 = this.profile?.addressLine1 || '';
    this.editState = this.profile?.clientState || '';
    this.editZip = this.profile?.clientZip || '';
    this.editBio = this.profile?.clientBio || '';
    this.editAvatarUrl = this.profile?.avatarUrl || '';
  }

  onAvatarClick() {
    this.triggerAvatarChange.emit();
  }
  /** Toggle edit mode (backward-compatible). */
  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing) this.resetForm();
  }

  /** Cancel editing: reset all fields back to saved values and exit edit mode. */
  cancelEdit() {
    this.resetForm();
    this.isEditing = false;
  }

  saveProfile() {
    if (!this.editFirstName.trim()) {
      this.snackbar.show('First name cannot be empty.', 'warning');
      return;
    }

    if (this.phoneBody.trim() && this.phoneBody.trim().length !== 10) {
      this.snackbar.show('Phone number must be exactly 10 digits.', 'warning');
      return;
    }

    this.editFullName = `${this.editFirstName} ${this.editLastName}`.trim();
    this.editPhone = this.phoneBody ? `${this.selectedCountry.code} ${this.phoneBody}`.trim() : '';
    this.userProfileService.updateProfile({
      fullName: this.editFullName,
      phone: this.editPhone,
      clientLanguage: this.editLanguage,
      clientCity: this.editCity,
      clientInterest: this.editInterest,
      dateOfBirth: this.editDateOfBirth ? new Date(this.editDateOfBirth).toISOString() : undefined,
      gender: this.editGender,
      addressLine1: this.editAddressLine1,
      clientState: this.editState,
      clientZip: this.editZip,
      clientBio: this.editBio,
      avatarUrl: this.editAvatarUrl
    }).subscribe({
      next: () => {
        this.snackbar.show('Personal info updated successfully!', 'success');
        this.profileUpdated.emit({
          ...this.profile,
          fullName: this.editFullName,
          phone: this.editPhone,
          clientLanguage: this.editLanguage,
          clientCity: this.editCity,
          clientInterest: this.editInterest,
          dateOfBirth: this.editDateOfBirth,
          gender: this.editGender,
          addressLine1: this.editAddressLine1,
          clientState: this.editState,
          clientZip: this.editZip,
          clientBio: this.editBio,
          avatarUrl: this.editAvatarUrl
        });
        this.isEditing = false;
      },
      error: () => this.snackbar.show('Failed to update profile.', 'error')
    });
  }

  sendPhoneOtp() {
    const fullPhone = this.phoneBody ? `${this.selectedCountry.code}${this.phoneBody}`.trim() : (this.editPhone || this.profile?.phone || '').replace(/\s+/g, '');
    if (!fullPhone) {
      this.snackbar.show('Please enter a phone number first.', 'warning');
      return;
    }

    // Rate limit check
    if (!this.phoneAuth.canSendOtp) {
      const remaining = this.phoneAuth.cooldownRemaining;
      this.snackbar.show(`Please wait ${remaining}s before requesting another OTP.`, 'warning');
      return;
    }

    this.otpLoading = true;
    this.phoneAuth.sendSmsOtp(fullPhone).subscribe({
      next: () => {
        this.otpLoading = false;
        this.showPhoneOtp = true;
        this.startResendCooldown();
        this.snackbar.show(`SMS OTP sent to ${fullPhone}! Enter the 6-digit code.`, 'success');
      },
      error: (err: any) => {
        this.otpLoading = false;
        this.showPhoneOtp = false; // Don't show OTP input if send failed
        console.error('📱 Firebase Phone Auth error:', err);
        this.snackbar.show(err.message || 'Failed to send SMS OTP. Please check your phone number.', 'error');
      }
    });
  }

  verifyPhoneOtp() {
    if (!this.phoneOtpCode.trim()) {
      this.snackbar.show('Please enter the 6-digit OTP code.', 'warning');
      return;
    }

    if (this.phoneOtpCode.trim().length !== 6) {
      this.snackbar.show('OTP code must be exactly 6 digits.', 'warning');
      return;
    }

    this.otpLoading = true;
    const fullPhone = this.phoneBody ? `${this.selectedCountry.code}${this.phoneBody}`.trim() : (this.editPhone || this.profile?.phone || '').replace(/\s+/g, '');

    // Step 1: Verify OTP with Firebase to get a verified ID token
    this.phoneAuth.verifySmsOtp(this.phoneOtpCode).subscribe({
      next: (res) => {
        // Step 2: Send the Firebase ID token to backend for server-side validation
        this.phoneAuth.saveVerifiedPhoneToBackend(fullPhone, res.idToken).subscribe({
          next: () => {
            this.otpLoading = false;
            this.showPhoneOtp = false;
            this.phoneOtpCode = '';
            this.clearCooldownTimer();
            this.snackbar.show('Phone number verified successfully!', 'success');
            this.profileUpdated.emit({ ...this.profile, phone: fullPhone, isPhoneVerified: true });
          },
          error: (backendErr: any) => {
            this.otpLoading = false;
            this.snackbar.show(
              backendErr.error?.message || 'Failed to save verification. Please try again.',
              'error'
            );
          }
        });
      },
      error: (err: any) => {
        this.otpLoading = false;
        this.snackbar.show(err.message || 'Invalid OTP code. Please try again.', 'error');
      }
    });
  }

  /** Resend the OTP (respects cooldown) */
  resendPhoneOtp() {
    if (this.resendCooldown > 0) {
      this.snackbar.show(`Please wait ${this.resendCooldown}s before resending.`, 'warning');
      return;
    }
    this.phoneOtpCode = '';
    this.sendPhoneOtp();
  }

  cancelPhoneVerification() {
    this.showPhoneOtp = false;
    this.phoneOtpCode = '';
    this.clearCooldownTimer();
    this.phoneAuth.resetOtpSession();
  }

  /** Start a 60-second cooldown for the resend button */
  private startResendCooldown() {
    this.clearCooldownTimer();
    this.resendCooldown = 60;
    this._cooldownInterval = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        this.clearCooldownTimer();
      }
    }, 1000);
  }

  private clearCooldownTimer() {
    if (this._cooldownInterval) {
      clearInterval(this._cooldownInterval);
      this._cooldownInterval = null;
    }
    this.resendCooldown = 0;
  }

  resendEmailVerification() {
    this.resendLoading = true;
    this.verificationService.resendEmailVerification(this.profile?.email || '').subscribe({
      next: () => {
        this.resendLoading = false;
        this.snackbar.show('Verification email sent! Check your inbox.', 'success');
      },
      error: (err) => {
        this.resendLoading = false;
        this.snackbar.show(err.error || 'Failed to send verification email.', 'error');
      }
    });
  }

  ngOnDestroy() {
    this.clearCooldownTimer();
    this.phoneAuth.resetOtpSession();
  }
}