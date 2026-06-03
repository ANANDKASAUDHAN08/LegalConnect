import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener } from '@angular/core';
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
export class ProfessionalCredentialsTabComponent implements OnInit, OnDestroy {
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
    inPersonFee: 0,
    casesCompleted: 150,
    successRate: 95,
    officeAddress: '',
    education: '',
    languagesSpoken: '',
    isAvailable: true,
    // Premium fields
    activeCourts: '',
    responseTime: '',
    workingHours: '',
    faqsJson: '[]',
    accoladesJson: '[]',
    casesJson: '[]',
    timeSlotsJson: '[]',
    socialLinksJson: '{}',
    bannerUrl: ''
  };

  // Banner crop variables
  showCropModal = false;
  rawImage: string | null = null;
  uploadedRawImage: string | null = null;
  zoomScale = 1;
  rotation = 0;
  dragX = 0;
  dragY = 0;
  isDragging = false;
  startX = 0;
  startY = 0;
  baseScale = 1;
  isSavingBanner = false;

  // Local parsed structures for active editing
  activeCourtsList: string[] = [];
  faqsList: { question: string; answer: string }[] = [];
  accoladesList: { year: string; title: string; description: string }[] = [];
  casesList: { title: string; outcome: string; description: string }[] = [];
  timeSlotsList: { day: string; time: string; isBooked: boolean }[] = [];
  socialLinksObj: { linkedin?: string; website?: string; barAssociation?: string; bannerFit?: string; bannerPosition?: string } = {};

  newCourt = '';
  daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  responseTimes = [
    'Responds within 1 hour',
    'Responds within 2 hours',
    'Responds within 24 hours',
    'Responds within 2-3 days'
  ];

  showResponseTimeDropdown = false;
  activeDayDropdownIndex: number | null = null;
  faqCollapseState: boolean[] = [];

  toggleResponseTimeDropdown(event: Event) {
    event.stopPropagation();
    this.showResponseTimeDropdown = !this.showResponseTimeDropdown;
    if (this.showResponseTimeDropdown) {
      this.showCountryDropdown = false;
      this.activeDayDropdownIndex = null;
    }
  }

  selectResponseTime(val: string) {
    this.edit.responseTime = val;
    this.showResponseTimeDropdown = false;
  }

  toggleDayDropdown(index: number, event: Event) {
    event.stopPropagation();
    if (this.activeDayDropdownIndex === index) {
      this.activeDayDropdownIndex = null;
    } else {
      this.activeDayDropdownIndex = index;
      this.showResponseTimeDropdown = false;
      this.showCountryDropdown = false;
    }
  }

  selectDay(index: number, day: string, event: Event) {
    event.stopPropagation();
    this.timeSlotsList[index].day = day;
    this.activeDayDropdownIndex = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick() {
    this.showResponseTimeDropdown = false;
    this.showCountryDropdown = false;
    this.activeDayDropdownIndex = null;
  }


  // Active Courts Managers
  addCourt() {
    if (this.newCourt.trim()) {
      if (!this.activeCourtsList.includes(this.newCourt.trim())) {
        this.activeCourtsList.push(this.newCourt.trim());
      }
      this.newCourt = '';
    }
  }

  removeCourt(index: number) {
    this.activeCourtsList.splice(index, 1);
  }

  // FAQs Managers
  addFaq() {
    this.faqsList.push({ question: '', answer: '' });
    this.faqCollapseState.push(false);
  }

  removeFaq(index: number) {
    this.faqsList.splice(index, 1);
    this.faqCollapseState.splice(index, 1);
  }

  toggleFaqCollapse(index: number) {
    this.faqCollapseState[index] = !this.faqCollapseState[index];
  }

  // Accolades Managers
  addAccolade() {
    this.accoladesList.push({
      year: new Date().getFullYear().toString(),
      title: '',
      description: ''
    });
  }

  removeAccolade(index: number) {
    this.accoladesList.splice(index, 1);
  }

  // Cases Managers
  addCase() {
    this.casesList.push({
      title: '',
      outcome: '',
      description: ''
    });
  }

  removeCase(index: number) {
    this.casesList.splice(index, 1);
  }

  // Time Slots Managers
  addTimeSlot() {
    this.timeSlotsList.push({
      day: 'Monday',
      time: '10:00 AM',
      isBooked: false
    });
  }

  removeTimeSlot(index: number) {
    this.timeSlotsList.splice(index, 1);
  }

  resetDefaultTimeSlots() {
    this.timeSlotsList = [
      { day: 'Monday', time: '10:00 AM', isBooked: false },
      { day: 'Monday', time: '2:30 PM', isBooked: false },
      { day: 'Wednesday', time: '11:30 AM', isBooked: false },
      { day: 'Friday', time: '4:00 PM', isBooked: false }
    ];
  }

  // ── Country Code Dropdown ──
  countries = COUNTRIES;

  selectedCountry = this.countries[0];
  showCountryDropdown = false;
  phoneBody = '';
  countrySearchText = '';

  toggleCountryDropdown(event: Event) {
    event.stopPropagation();
    this.showCountryDropdown = !this.showCountryDropdown;
    if (this.showCountryDropdown) {
      this.countrySearchText = '';
      this.showResponseTimeDropdown = false;
      this.activeDayDropdownIndex = null;
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
        inPersonFee: this.lawyerProfile.inPersonFee || 0,
        casesCompleted: this.lawyerProfile.casesCompleted || 150,
        successRate: this.lawyerProfile.successRate || 95,
        officeAddress: this.lawyerProfile.officeAddress || '',
        education: this.lawyerProfile.education || '',
        languagesSpoken: this.lawyerProfile.languagesSpoken || '',
        isAvailable: this.lawyerProfile.isAvailable !== false,
        // Premium default assignments
        activeCourts: this.lawyerProfile.activeCourts || '',
        responseTime: this.lawyerProfile.responseTime || 'Responds within 24 hours',
        workingHours: this.lawyerProfile.workingHours || 'Mon - Fri: 9:00 AM - 6:00 PM',
        faqsJson: this.lawyerProfile.faqsJson || '[]',
        accoladesJson: this.lawyerProfile.accoladesJson || '[]',
        casesJson: this.lawyerProfile.casesJson || '[]',
        timeSlotsJson: this.lawyerProfile.timeSlotsJson || '[]',
        socialLinksJson: this.lawyerProfile.socialLinksJson || '{}',
        bannerUrl: this.lawyerProfile.bannerUrl || ''
      };
      this.initializePhone(this.edit.phone);

      // Map local structures
      this.activeCourtsList = this.edit.activeCourts ? this.edit.activeCourts.split(',').map(c => c.trim()).filter(Boolean) : [];
      
      try {
        this.faqsList = JSON.parse(this.edit.faqsJson || '[]');
      } catch {
        this.faqsList = [];
      }
      this.faqCollapseState = new Array(this.faqsList.length).fill(false);
      
      try {
        this.accoladesList = JSON.parse(this.edit.accoladesJson || '[]');
      } catch {
        this.accoladesList = [];
      }
      
      try {
        this.casesList = JSON.parse(this.edit.casesJson || '[]');
      } catch {
        this.casesList = [];
      }
      
      try {
        this.timeSlotsList = JSON.parse(this.edit.timeSlotsJson || '[]');
      } catch {
        this.timeSlotsList = [];
      }
      
      try {
        this.socialLinksObj = JSON.parse(this.edit.socialLinksJson || '{}');
      } catch {
        this.socialLinksObj = {};
      }
      if (!this.socialLinksObj.bannerFit) this.socialLinksObj.bannerFit = 'cover';
      if (!this.socialLinksObj.bannerPosition) this.socialLinksObj.bannerPosition = 'center';
    }
  }

  onBannerSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const result = e.target.result as string;
        this.rawImage = result;
        this.uploadedRawImage = result;
        this.zoomScale = 1;
        this.rotation = 0;
        this.dragX = 0;
        this.dragY = 0;
        this.openCropModal();
        input.value = '';
      };
      reader.readAsDataURL(file);
    }
  }

  openCropModal() {
    this.showCropModal = true;
    document.body.classList.add('overflow-hidden');
  }

  closeCropModal() {
    this.showCropModal = false;
    this.rawImage = null;
    this.isSavingBanner = false;
    document.body.classList.remove('overflow-hidden');
  }

  onImageLoaded(event: Event) {
    const img = event.target as HTMLImageElement;
    const scaleX = 480 / img.naturalWidth;
    const scaleY = 120 / img.naturalHeight;
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
    if (!this.rawImage) return;
    this.isSavingBanner = true;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clean background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1200, 300);

      // Center
      ctx.translate(600, 150);
      ctx.rotate((this.rotation * Math.PI) / 180);
      
      const scale = this.baseScale * this.zoomScale * 2.5;
      ctx.scale(scale, scale);
      ctx.translate(this.dragX / (this.baseScale * this.zoomScale), this.dragY / (this.baseScale * this.zoomScale));
      
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9);
      this.edit.bannerUrl = croppedBase64;
      this.closeCropModal();
    };
    img.src = this.rawImage;
  }

  triggerBannerUpload() {
    const fileInput = document.getElementById('banner-file-input');
    if (fileInput) {
      fileInput.click();
    }
  }

  deleteBanner() {
    this.edit.bannerUrl = '';
    this.uploadedRawImage = null;
  }

  adjustBanner() {
    if (this.uploadedRawImage) {
      this.rawImage = this.uploadedRawImage;
    } else if (this.edit.bannerUrl) {
      this.rawImage = this.edit.bannerUrl;
    }
    if (this.rawImage) {
      this.zoomScale = 1;
      this.rotation = 0;
      this.dragX = 0;
      this.dragY = 0;
      this.openCropModal();
    }
  }

  ngOnDestroy() {
    document.body.classList.remove('overflow-hidden');
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
    
    // Serialise lists back to DTO
    this.edit.activeCourts = this.activeCourtsList.join(', ');
    this.edit.faqsJson = JSON.stringify(this.faqsList);
    this.edit.accoladesJson = JSON.stringify(this.accoladesList);
    this.edit.casesJson = JSON.stringify(this.casesList);
    this.edit.timeSlotsJson = JSON.stringify(this.timeSlotsList);
    this.edit.socialLinksJson = JSON.stringify(this.socialLinksObj);

    this.lawyerService.updateProfile({
      ...this.edit,
      experienceYears: Number(this.edit.experienceYears),
      consultationFee: Number(this.edit.consultationFee),
      inPersonFee: Number(this.edit.inPersonFee),
      casesCompleted: Number(this.edit.casesCompleted),
      successRate: Number(this.edit.successRate)
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
