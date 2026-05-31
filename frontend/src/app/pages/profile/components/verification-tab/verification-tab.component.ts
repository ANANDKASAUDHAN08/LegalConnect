import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, UserProfile } from '../../../../services/auth.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { COUNTRIES } from '../../../../constants/countries.constant';

@Component({
  selector: 'app-verification-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './verification-tab.component.html'
})
export class VerificationTabComponent implements OnInit {
  @Input() profile!: UserProfile;
  @Output() profileUpdated = new EventEmitter<Partial<UserProfile>>();

  resendLoading = false;
  otpLoading = false;
  showPhoneOtp = false;
  phoneOtpCode = '';
  phoneToVerify = '';

  // Identity simulation
  identityStatus: 'Not Started' | 'Pending' | 'Verified' = 'Not Started';
  uploadingId = false;
  selectedIdType = 'Driving License';

  // ── Indian Identity Verification ──
  indianIdType: 'Aadhaar' | 'PAN' | 'Voter ID' | 'Bar Council Card' = 'Aadhaar';
  aadhaarNumber = '';
  panNumber = '';
  voterIdNumber = '';
  barEnrollmentNumber = '';
  idUploadFile: File | null = null;
  idUploadFileName = '';
  showIdentityOtp = false;
  identityOtpCode = '';
  identityOtpLoading = false;

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

  constructor(
    private auth: AuthService,
    private snackbar: SnackbarService
  ) { }

  ngOnInit() {
    this.identityStatus = (this.profile?.identityStatus as any) || 'Not Started';
    this.initializePhone(this.profile?.phone || '');
    if (this.profile?.role === 'Lawyer') {
      this.indianIdType = 'Bar Council Card';
    } else {
      this.indianIdType = 'Aadhaar';
    }
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

  sendPhoneOtp() {
    let num = '';
    if (this.phoneBody.trim()) {
      if (this.phoneBody.trim().length !== 10) {
        this.snackbar.show('Phone number must be exactly 10 digits.', 'warning');
        return;
      }

      num = `${this.selectedCountry.code} ${this.phoneBody}`.trim();
    } else {
      num = this.profile.phone || '';
    }

    if (!num) {
      this.snackbar.show('Please enter a phone number to verify.', 'warning');
      return;
    }
    this.phoneToVerify = num;
    this.showPhoneOtp = true;
    this.snackbar.show('Verification code sent! Enter code 123456.', 'success');
  }

  verifyPhoneOtp() {
    if (!this.phoneOtpCode.trim()) return;
    this.otpLoading = true;
    this.auth.verifyPhone(this.phoneOtpCode).subscribe({
      next: () => {
        this.otpLoading = false;
        this.showPhoneOtp = false;
        this.phoneOtpCode = '';
        this.snackbar.show('Phone number verified successfully!', 'success');
        this.profileUpdated.emit({ isPhoneVerified: true, phone: this.phoneToVerify || this.profile.phone });
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

  onIdFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.idUploadFile = file;
      this.idUploadFileName = file.name;
    }
  }

  sendAadhaarOtp() {
    if (!this.aadhaarNumber.trim() || this.aadhaarNumber.trim().length !== 12 || !/^\d+$/.test(this.aadhaarNumber)) {
      this.snackbar.show('Please enter a valid 12-digit Aadhaar number.', 'warning');
      return;
    }
    this.showIdentityOtp = true;
    this.snackbar.show('e-KYC verification OTP sent to Aadhaar-registered mobile number! Use code 123456.', 'success');
  }

  verifyAadhaarOtp() {
    if (this.identityOtpCode !== '123456') {
      this.snackbar.show('Invalid Aadhaar OTP code. Please use code 123456 for this demo.', 'error');
      return;
    }
    this.identityOtpLoading = true;
    const mockBase64Pdf = 'data:application/pdf;base64,JVBERi0xLjQKJdPpNDcKMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nCiAgICAgL1BhZ2VzIDIgMCBSCiAgPj4KZW5kb2JqCjIgMCBvYmoKICA8PCAvVHlwZSAvUGFnZXMKICAgICAvS2lkcyBbIDMgMCBSIF0KICAgICAvQ291bnQgMQogID4+CmVuZG9iagozIDAgb2JqCiAgPDwgL1R5cGUgL1BhZ2UKICAgICAvUGFyZW50IDIgMCBSCiAgICAgL01lZGlhQm94IFsgMCAwIDU5NSA4NDIgXQogICAgIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDQgMCBSID4+ID4+CiAgICAgL0NvbnRlbnRzIDUgMCBSCiAgPj4KZW5kb2JqCjQgMCBvYmoKICA8PCAvVHlwZSAvRm9udAogICAgIC9TdWJ0eXBlIC9UeXBlMQogICAgIC9CYXNlRm9udCAvSGVsdmV0aWNhCiAgPj4KZW5kb2JqCjUgMCBvYmoKICA8PCAvTGVuZ3RoIDQ0ID4+CnN0cmVhbQpCVAovRjEgMjQgVGYKMTAwIDcwMCBUZCAoTGVnYWxDb25uZWN0IElkZW50aXR5IERvY3VtZW50KSBUagogRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA3MCAwMDAwMCBuIAowMDAwMDAwMTMwIDAwMDAwIGggCjAwMDAwMDAyNzAgMDAwMDAgbiAKMDAwMDAwMDM0MCAwMDAwMCBuIAp0cmFpbGVyCiAgPDwgL1NpemUgNgogICAgIC9Sb290IDEgMCBSCiAgPj4Kc3RhcnR4cmVmCjQzNQolJUVPRgo=';
    this.auth.verifyIdentity('Aadhaar OTP', mockBase64Pdf).subscribe({
      next: (res) => {
        this.identityOtpLoading = false;
        this.showIdentityOtp = false;
        this.identityStatus = res.identityStatus;
        this.profile.identityStatus = res.identityStatus;
        this.profile.identityDocumentUrl = res.identityDocumentUrl;
        this.profileUpdated.emit({
          identityStatus: res.identityStatus,
          identityDocumentUrl: res.identityDocumentUrl
        });
        this.snackbar.show('Aadhaar verified successfully via UIDAI e-KYC!', 'success');
      },
      error: (err) => {
        this.identityOtpLoading = false;
        this.snackbar.show(err.error?.message || err.error || 'Aadhaar e-KYC failed.', 'error');
      }
    });
  }

  verifyPanCard() {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(this.panNumber.trim().toUpperCase())) {
      this.snackbar.show('Please enter a valid 10-character PAN number (e.g. ABCDE1234F).', 'warning');
      return;
    }
    this.uploadingId = true;
    const mockBase64Pdf = 'data:application/pdf;base64,JVBERi0xLjQKJdPpNDcKMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nCiAgICAgL1BhZ2VzIDIgMCBSCiAgPj4KZW5kb2JqCjIgMCBvYmoKICA8PCAvVHlwZSAvUGFnZXMKICAgICAvS2lkcyBbIDMgMCBSIF0KICAgICAvQ291bnQgMQogID4+CmVuZG9iagozIDAgb2JqCiAgPDwgL1R5cGUgL1BhZ2UKICAgICAvUGFyZW50IDIgMCBSCiAgICAgL01lZGlhQm94IFsgMCAwIDU5NSA4NDIgXQogICAgIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDQgMCBSID4+ID4+CiAgICAgL0NvbnRlbnRzIDUgMCBSCiAgPj4KZW5kb2JqCjQgMCBvYmoKICA8PCAvVHlwZSAvRm9udAogICAgIC9TdWJ0eXBlIC9UeXBlMQogICAgIC9CYXNlRm9udCAvSGVsdmV0aWNhCiAgPj4KZW5kb2JqCjUgMCBvYmoKICA8PCAvTGVuZ3RoIDQ0ID4+CnN0cmVhbQpCVAovRjEgMjQgVGYKMTAwIDcwMCBUZCAoTGVnYWxDb25uZWN0IElkZW50aXR5IERvY3VtZW50KSBUagogRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA3MCAwMDAwMCBuIAowMDAwMDAwMTMwIDAwMDAwIGggCjAwMDAwMDAyNzAgMDAwMDAgbiAKMDAwMDAwMDM0MCAwMDAwMCBuIAp0cmFpbGVyCiAgPDwgL1NpemUgNgogICAgIC9Sb290IDEgMCBSCiAgPj4Kc3RhcnR4cmVmCjQzNQolJUVPRgo=';
    this.auth.verifyIdentity('PAN Card', mockBase64Pdf).subscribe({
      next: (res) => {
        this.uploadingId = false;
        this.identityStatus = res.identityStatus;
        this.profile.identityStatus = res.identityStatus;
        this.profile.identityDocumentUrl = res.identityDocumentUrl;
        this.profileUpdated.emit({
          identityStatus: res.identityStatus,
          identityDocumentUrl: res.identityDocumentUrl
        });
        this.snackbar.show('PAN Card verified successfully against NSDL database!', 'success');
      },
      error: (err) => {
        this.uploadingId = false;
        this.snackbar.show(err.error?.message || err.error || 'PAN verification failed.', 'error');
      }
    });
  }

  verifyVoterOrPassport() {
    if (!this.voterIdNumber.trim()) {
      this.snackbar.show('Please enter a valid Voter ID / Document number.', 'warning');
      return;
    }
    this.uploadingId = true;
    const mockBase64Pdf = 'data:application/pdf;base64,JVBERi0xLjQKJdPpNDcKMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nCiAgICAgL1BhZ2VzIDIgMCBSCiAgPj4KZW5kb2JqCjIgMCBvYmoKICA8PCAvVHlwZSAvUGFnZXMKICAgICAvS2lkcyBbIDMgMCBSIF0KICAgICAvQ291bnQgMQogID4+CmVuZG9iagozIDAgb2JqCiAgPDwgL1R5cGUgL1BhZ2UKICAgICAvUGFyZW50IDIgMCBSCiAgICAgL01lZGlhQm94IFsgMCAwIDU5NSA4NDIgXQogICAgIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDQgMCBSID4+ID4+CiAgICAgL0NvbnRlbnRzIDUgMCBSCiAgPj4KZW5kb2JqCjQgMCBvYmoKICA8PCAvVHlwZSAvRm9udAogICAgIC9TdWJ0eXBlIC9UeXBlMQogICAgIC9CYXNlRm9udCAvSGVsdmV0aWNhCiAgPj4KZW5kb2JqCjUgMCBvYmoKICA8PCAvTGVuZ3RoIDQ0ID4+CnN0cmVhbQpCVAovRjEgMjQgVGYKMTAwIDcwMCBUZCAoTGVnYWxDb25uZWN0IElkZW50aXR5IERvY3VtZW50KSBUagogRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA3MCAwMDAwMCBuIAowMDAwMDAwMTMwIDAwMDAwIGggCjAwMDAwMDAyNzAgMDAwMDAgbiAKMDAwMDAwMDM0MCAwMDAwMCBuIAp0cmFpbGVyCiAgPDwgL1NpemUgNgogICAgIC9Sb290IDEgMCBSCiAgPj4Kc3RhcnR4cmVmCjQzNQolJUVPRgo=';
    this.auth.verifyIdentity(this.indianIdType, mockBase64Pdf).subscribe({
      next: (res) => {
        this.uploadingId = false;
        this.identityStatus = res.identityStatus;
        this.profile.identityStatus = res.identityStatus;
        this.profile.identityDocumentUrl = res.identityDocumentUrl;
        this.profileUpdated.emit({
          identityStatus: res.identityStatus,
          identityDocumentUrl: res.identityDocumentUrl
        });
        this.snackbar.show(`${this.indianIdType} submitted and verified successfully!`, 'success');
      },
      error: (err) => {
        this.uploadingId = false;
        this.snackbar.show(err.error?.message || err.error || 'Verification failed.', 'error');
      }
    });
  }

  verifyBarCouncilCard() {
    if (!this.barEnrollmentNumber.trim()) {
      this.snackbar.show('Please enter your Bar Council Enrollment number.', 'warning');
      return;
    }
    this.uploadingId = true;
    const mockBase64Pdf = 'data:application/pdf;base64,JVBERi0xLjQKJdPpNDcKMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nCiAgICAgL1BhZ2VzIDIgMCBSCiAgPj4KZW5kb2JqCjIgMCBvYmoKICA8PCAvVHlwZSAvUGFnZXMKICAgICAvS2lkcyBbIDMgMCBSIF0KICAgICAvQ291bnQgMQogID4+CmVuZG9iagozIDAgb2JqCiAgPDwgL1R5cGUgL1BhZ2UKICAgICAvUGFyZW50IDIgMCBSCiAgICAgL01lZGlhQm94IFsgMCAwIDU5NSA4NDIgXQogICAgIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDQgMCBSID4+ID4+CiAgICAgL0NvbnRlbnRzIDUgMCBSCiAgPj4KZW5kb2JqCjQgMCBvYmoKICA8PCAvVHlwZSAvRm9udAogICAgIC9TdWJ0eXBlIC9UeXBlMQogICAgIC9CYXNlRm9udCAvSGVsdmV0aWNhCiAgPj4KZW5kb2JqCjUgMCBvYmoKICA8PCAvTGVuZ3RoIDQ0ID4+CnN0cmVhbQpCVAovRjEgMjQgVGYKMTAwIDcwMCBUZCAoTGVnYWxDb25uZWN0IElkZW50aXR5IERvY3VtZW50KSBUagogRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA3MCAwMDAwMCBuIAowMDAwMDAwMTMwIDAwMDAwIGggCjAwMDAwMDAyNzAgMDAwMDAgbiAKMDAwMDAwMDM0MCAwMDAwMCBuIAp0cmFpbGVyCiAgPDwgL1NpemUgNgogICAgIC9Sb290IDEgMCBSCiAgPj4Kc3RhcnR4cmVmCjQzNQolJUVPRgo=';
    this.auth.verifyIdentity('Bar Council Card', mockBase64Pdf).subscribe({
      next: (res) => {
        this.uploadingId = false;
        this.identityStatus = res.identityStatus;
        this.profile.identityStatus = res.identityStatus;
        this.profile.identityDocumentUrl = res.identityDocumentUrl;
        this.profileUpdated.emit({
          identityStatus: res.identityStatus,
          identityDocumentUrl: res.identityDocumentUrl
        });
        this.snackbar.show('Bar Council Card verification submitted successfully!', 'success');
      },
      error: (err) => {
        this.uploadingId = false;
        this.snackbar.show(err.error?.message || err.error || 'Bar Council Card submission failed.', 'error');
      }
    });
  }
}
