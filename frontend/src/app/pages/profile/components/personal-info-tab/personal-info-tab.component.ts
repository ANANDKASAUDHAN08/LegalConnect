import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, UserProfile } from '../../../../services/auth.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { COUNTRIES } from '../../../../constants/countries.constant';

@Component({
  selector: 'app-personal-info-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './personal-info-tab.component.html'
})
export class PersonalInfoTabComponent implements OnInit, OnChanges {
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

  constructor(
    private auth: AuthService,
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
    this.auth.updateProfile({
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
    this.editPhone = this.phoneBody ? `${this.selectedCountry.code} ${this.phoneBody}`.trim() : '';
    if (!this.editPhone.trim()) {
      this.snackbar.show('Please enter a phone number first.', 'warning');
      return;
    }

    if (this.phoneBody.trim().length !== 10) {
      this.snackbar.show('Phone number must be exactly 10 digits.', 'warning');
      return;
    }

    this.showPhoneOtp = true;
    this.snackbar.show('OTP sent! Use code 123456 for this demo.', 'success');
  }

  verifyPhoneOtp() {
    if (!this.phoneOtpCode.trim()) return;
    this.otpLoading = true;
    this.auth.verifyPhone(this.phoneOtpCode).subscribe({
      next: (res) => {
        this.otpLoading = false;
        this.showPhoneOtp = false;
        this.phoneOtpCode = '';
        this.snackbar.show('Phone number verified successfully!', 'success');
        this.profileUpdated.emit({ ...this.profile, isPhoneVerified: true });
      },
      error: (err) => {
        this.otpLoading = false;
        this.snackbar.show(err.error || 'Invalid OTP code.', 'error');
      }
    });
  }

  cancelPhoneVerification() {
    this.showPhoneOtp = false;
    this.phoneOtpCode = '';
  }

  resendEmailVerification() {
    this.resendLoading = true;
    this.auth.resendEmailVerification().subscribe({
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
}
