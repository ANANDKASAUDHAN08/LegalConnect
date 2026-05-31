import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LawyerService, LawyerProfileData } from '../../../../services/lawyer.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { COUNTRIES } from '../../../../constants/countries.constant';

@Component({
  selector: 'app-professional-credentials-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './professional-credentials-tab.component.html'
})
export class ProfessionalCredentialsTabComponent implements OnInit {
  @Input() lawyerProfile!: LawyerProfileData;
  @Output() profileUpdated = new EventEmitter<LawyerProfileData>();

  isEditing = false;
  saving = false;

  edit = {
    barCouncilNumber: '',
    specialization: '',
    experienceYears: 0,
    city: '',
    bio: '',
    phone: '',
    consultationFee: 0,
    officeAddress: '',
    education: '',
    languagesSpoken: '',
    isAvailable: true
  };

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
    private lawyerService: LawyerService,
    private snackbar: SnackbarService
  ) { }

  ngOnInit() {
    this.resetForm();
  }

  resetForm() {
    if (this.lawyerProfile) {
      this.edit = {
        barCouncilNumber: this.lawyerProfile.barCouncilNumber || '',
        specialization: this.lawyerProfile.specialization || '',
        experienceYears: this.lawyerProfile.experienceYears || 0,
        city: this.lawyerProfile.city || '',
        bio: this.lawyerProfile.bio || '',
        phone: this.lawyerProfile.phone || '',
        consultationFee: this.lawyerProfile.consultationFee || 0,
        officeAddress: this.lawyerProfile.officeAddress || '',
        education: this.lawyerProfile.education || '',
        languagesSpoken: this.lawyerProfile.languagesSpoken || '',
        isAvailable: this.lawyerProfile.isAvailable !== false
      };
      this.initializePhone(this.edit.phone);
    }
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing) this.resetForm();
  }

  save() {
    if (this.phoneBody.trim() && this.phoneBody.trim().length !== 10) {
      this.snackbar.show('Phone number must be exactly 10 digits.', 'warning');
      return;
    }

    this.saving = true;
    this.edit.phone = this.phoneBody ? `${this.selectedCountry.code} ${this.phoneBody}`.trim() : '';
    this.lawyerService.updateProfile({
      ...this.edit,
      experienceYears: Number(this.edit.experienceYears),
      consultationFee: Number(this.edit.consultationFee)
    }).subscribe({
      next: () => {
        this.saving = false;
        this.isEditing = false;
        this.snackbar.show('Professional credentials updated and synced!', 'success');
        this.profileUpdated.emit({ ...this.lawyerProfile, ...this.edit });
      },
      error: (err) => {
        this.saving = false;
        this.snackbar.show(err.error?.message || 'Failed to update credentials.', 'error');
      }
    });
  }

  getSpecializationTags(): string[] {
    return this.lawyerProfile?.specialization
      ? this.lawyerProfile.specialization.split(',').map(s => s.trim()).filter(Boolean)
      : [];
  }
}
