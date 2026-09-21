import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy,
  inject, signal, ChangeDetectionStrategy, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LawyerService, LawyerProfileData } from '../../../../services/lawyer.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { IconComponent } from '../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { PhoneInputComponent } from '../../../../components/phone-input/phone-input.component';
import { CustomSelectComponent, SelectOption } from '../../../../components/custom-select';

// ─── Typed Form Interface ──────────────────────────────────────
export interface CredentialsFormModel {
  barCouncilNumber: FormControl<string>;
  specialization: FormControl<string>;
  experienceYears: FormControl<number>;
  casesCompleted: FormControl<number>;
  successRate: FormControl<number>;
  city: FormControl<string>;
  bio: FormControl<string>;
  phone: FormControl<string>;
  officeAddress: FormControl<string>;
  education: FormControl<string>;
  languagesSpoken: FormControl<string>;
  activeCourts: FormControl<string>;
  responseTime: FormControl<string>;
  workingHours: FormControl<string>;
}

// ─── JSON Sub-Models ───────────────────────────────────────────
export interface FaqItem { question: string; answer: string; }
export interface AccoladeItem { year: string; title: string; description: string; }
export interface CaseItem { title: string; outcome: string; description: string; }
export interface TimeSlotItem { day: string; time: string; isBooked: boolean; }
export interface SocialLinksObj {
  linkedin?: string; website?: string; barAssociation?: string;
  bannerFit?: string; bannerPosition?: string;
}

@Component({
  selector: 'app-credentials-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, RouterLink,
    IconComponent, TooltipDirective, PhoneInputComponent, CustomSelectComponent
  ],
  templateUrl: './credentials-section.component.html'
})
export class CredentialsSectionComponent implements OnInit, OnDestroy {
  @Input() lawyerProfile!: LawyerProfileData;
  @Output() profileUpdated = new EventEmitter<LawyerProfileData>();

  private fb = inject(FormBuilder);
  private lawyerService = inject(LawyerService);
  private snackbar = inject(SnackbarService);

  // ─── Core State ──────────────────────────────────────────────
  credentialsForm!: FormGroup<CredentialsFormModel>;
  isEditing = signal(false);
  isSaving = signal(false);

  // ─── Courts Chip List ────────────────────────────────────────
  activeCourtsList = signal<string[]>([]);
  newCourt = signal('');

  // ─── JSON Lists (Edit-time mutable arrays) ───────────────────
  faqsList = signal<FaqItem[]>([]);
  accoladesList = signal<AccoladeItem[]>([]);
  casesList = signal<CaseItem[]>([]);
  timeSlotsList = signal<TimeSlotItem[]>([]);
  socialLinksObj = signal<SocialLinksObj>({});
  faqCollapseState = signal<boolean[]>([]);

  // ─── Social Link Edit Fields (simple signals for inputs) ─────
  editLinkedin = signal('');
  editWebsite = signal('');
  editBarAssociation = signal('');

  // ─── Response Time Options ───────────────────────────────────
  readonly responseTimeSelectOptions: SelectOption[] = [
    { value: 'Responds within 1 hour', label: 'Responds within 1 hour', icon: 'clock' },
    { value: 'Responds within 2 hours', label: 'Responds within 2 hours', icon: 'clock' },
    { value: 'Responds within 24 hours', label: 'Responds within 24 hours', icon: 'clock' },
    { value: 'Responds within 2-3 days', label: 'Responds within 2-3 days', icon: 'clock' }
  ];

  // ─── Banner Management ───────────────────────────────────────
  bannerUrl = signal('');
  showCropModal = signal(false);
  rawImage = signal<string | null>(null);
  uploadedRawImage = signal<string | null>(null);
  zoomScale = 1;
  rotation = 0;
  dragX = 0;
  dragY = 0;
  isDragging = false;
  startX = 0;
  startY = 0;
  baseScale = 1;
  isSavingBanner = signal(false);

  readonly bioMaxLength = 1000;
  bioLength = signal(0);

  readonly daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  activeDayDropdownIndex = signal<number | null>(null);

  // ─── Lifecycle ───────────────────────────────────────────────
  ngOnInit(): void {
    this.buildForm();
    this.patchFromProfile();
  }

  ngOnDestroy(): void {
    document.body.classList.remove('overflow-hidden');
  }

  // ─── Form Setup ──────────────────────────────────────────────
  private buildForm(): void {
    this.credentialsForm = this.fb.group<CredentialsFormModel>({
      barCouncilNumber: this.fb.control('', { nonNullable: true }),
      specialization: this.fb.control('', { nonNullable: true }),
      experienceYears: this.fb.control(0, { nonNullable: true, validators: [Validators.min(0), Validators.max(70)] }),
      casesCompleted: this.fb.control(0, { nonNullable: true, validators: [Validators.min(0)] }),
      successRate: this.fb.control(0, { nonNullable: true, validators: [Validators.min(0), Validators.max(100)] }),
      city: this.fb.control('', { nonNullable: true }),
      bio: this.fb.control('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
      phone: this.fb.control('', { nonNullable: true }),
      officeAddress: this.fb.control('', { nonNullable: true }),
      education: this.fb.control('', { nonNullable: true }),
      languagesSpoken: this.fb.control('', { nonNullable: true }),
      activeCourts: this.fb.control('', { nonNullable: true }),
      responseTime: this.fb.control('Responds within 24 hours', { nonNullable: true }),
      workingHours: this.fb.control('Mon - Fri: 9:00 AM - 6:00 PM', { nonNullable: true })
    });

    this.credentialsForm.controls.bio.valueChanges.subscribe(val => {
      this.bioLength.set(val?.length || 0);
    });
  }

  private patchFromProfile(): void {
    if (!this.lawyerProfile || !this.credentialsForm) return;

    this.credentialsForm.patchValue({
      barCouncilNumber: this.lawyerProfile.barCouncilNumber || '',
      specialization: this.lawyerProfile.specialization || '',
      experienceYears: this.lawyerProfile.experienceYears || 0,
      casesCompleted: this.lawyerProfile.casesCompleted || 0,
      successRate: this.lawyerProfile.successRate || 0,
      city: this.lawyerProfile.city || '',
      bio: this.lawyerProfile.bio || '',
      phone: this.lawyerProfile.phone || '',
      officeAddress: this.lawyerProfile.officeAddress || '',
      education: this.lawyerProfile.education || '',
      languagesSpoken: this.lawyerProfile.languagesSpoken || '',
      activeCourts: this.lawyerProfile.activeCourts || '',
      responseTime: this.lawyerProfile.responseTime || 'Responds within 24 hours',
      workingHours: this.lawyerProfile.workingHours || 'Mon - Fri: 9:00 AM - 6:00 PM'
    }, { emitEvent: false });

    // Courts chips
    const courts = this.lawyerProfile.activeCourts
      ? this.lawyerProfile.activeCourts.split(',').map(c => c.trim()).filter(Boolean)
      : [];
    this.activeCourtsList.set(courts);

    // Parse JSON structures
    this.faqsList.set(this.safeParse<FaqItem[]>(this.lawyerProfile.faqsJson, []));
    this.faqCollapseState.set(new Array(this.faqsList().length).fill(false));
    this.accoladesList.set(this.safeParse<AccoladeItem[]>(this.lawyerProfile.accoladesJson, []));
    this.casesList.set(this.safeParse<CaseItem[]>(this.lawyerProfile.casesJson, []));
    this.timeSlotsList.set(this.safeParse<TimeSlotItem[]>(this.lawyerProfile.timeSlotsJson, []));

    const social = this.safeParse<SocialLinksObj>(this.lawyerProfile.socialLinksJson, {});
    if (!social.bannerFit) social.bannerFit = 'cover';
    if (!social.bannerPosition) social.bannerPosition = 'center';
    this.socialLinksObj.set(social);
    this.editLinkedin.set(social.linkedin || '');
    this.editWebsite.set(social.website || '');
    this.editBarAssociation.set(social.barAssociation || '');

    this.bannerUrl.set(this.lawyerProfile.bannerUrl || '');
    this.bioLength.set(this.lawyerProfile.bio?.length || 0);
    this.credentialsForm.markAsPristine();
  }

  private safeParse<T>(json: string | undefined, fallback: T): T {
    try { return JSON.parse(json || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  // ─── Edit / Cancel / Save ────────────────────────────────────
  toggleEdit(): void {
    if (this.isEditing()) {
      this.patchFromProfile();
      this.isEditing.set(false);
    } else {
      this.isEditing.set(true);
    }
  }

  cancelEdit(): void {
    this.patchFromProfile();
    this.isEditing.set(false);
    this.snackbar.show('Credentials edits discarded.', 'info');
  }

  save(): void {
    if (this.credentialsForm.invalid) {
      this.credentialsForm.markAllAsTouched();
      this.snackbar.show('Please fix the highlighted errors.', 'warning');
      return;
    }

    this.isSaving.set(true);
    const v = this.credentialsForm.getRawValue();

    // Sync social links from edit signals
    const social = { ...this.socialLinksObj() };
    social.linkedin = this.editLinkedin();
    social.website = this.editWebsite();
    social.barAssociation = this.editBarAssociation();

    const payload = {
      ...v,
      activeCourts: this.activeCourtsList().join(', '),
      experienceYears: Number(v.experienceYears),
      casesCompleted: Number(v.casesCompleted),
      successRate: Number(v.successRate),
      consultationFee: Number(this.lawyerProfile?.consultationFee ?? 0),
      inPersonFee: Number(this.lawyerProfile?.inPersonFee ?? 0),
      isAvailable: this.lawyerProfile?.isAvailable !== false,
      faqsJson: JSON.stringify(this.faqsList()),
      accoladesJson: JSON.stringify(this.accoladesList()),
      casesJson: JSON.stringify(this.casesList()),
      timeSlotsJson: JSON.stringify(this.timeSlotsList()),
      socialLinksJson: JSON.stringify(social),
      bannerUrl: this.bannerUrl()
    };

    this.lawyerService.updateProfile(payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isEditing.set(false);
        this.credentialsForm.markAsPristine();
        this.snackbar.show('Professional credentials updated and synced.', 'success');
        this.profileUpdated.emit({ ...this.lawyerProfile, ...payload });
      },
      error: (err) => {
        this.isSaving.set(false);
        this.snackbar.show(err.error?.message || 'Failed to update credentials.', 'error');
      }
    });
  }

  // ─── Courts Chip Management ──────────────────────────────────
  addCourt(): void {
    const court = this.newCourt().trim();
    if (court && !this.activeCourtsList().includes(court)) {
      this.activeCourtsList.update(list => [...list, court]);
      this.credentialsForm.markAsDirty();
      this.snackbar.show(`Court "${court}" added.`, 'info');
    }
    this.newCourt.set('');
  }

  removeCourt(index: number): void {
    const court = this.activeCourtsList()[index];
    this.activeCourtsList.update(list => list.filter((_, i) => i !== index));
    this.credentialsForm.markAsDirty();
    if (court) {
      this.snackbar.show(`Court "${court}" removed.`, 'info');
    }
  }

  onCourtKeypress(event: KeyboardEvent): void {
    if (event.key === 'Enter') { event.preventDefault(); this.addCourt(); }
  }

  // ─── FAQs CRUD ───────────────────────────────────────────────
  addFaq(): void {
    this.faqsList.update(list => [...list, { question: '', answer: '' }]);
    this.faqCollapseState.update(s => [...s, false]);
    this.credentialsForm.markAsDirty();
    this.snackbar.show('New FAQ entry added.', 'info');
  }

  removeFaq(index: number): void {
    this.faqsList.update(list => list.filter((_, i) => i !== index));
    this.faqCollapseState.update(s => s.filter((_, i) => i !== index));
    this.credentialsForm.markAsDirty();
    this.snackbar.show('FAQ entry removed.', 'info');
  }

  updateFaqQuestion(index: number, value: string): void {
    this.faqsList.update(list => list.map((f, i) => i === index ? { ...f, question: value } : f));
    this.credentialsForm.markAsDirty();
  }

  updateFaqAnswer(index: number, value: string): void {
    this.faqsList.update(list => list.map((f, i) => i === index ? { ...f, answer: value } : f));
    this.credentialsForm.markAsDirty();
  }

  toggleFaqCollapse(index: number): void {
    this.faqCollapseState.update(s => s.map((v, i) => i === index ? !v : v));
  }

  // ─── Accolades CRUD ──────────────────────────────────────────
  addAccolade(): void {
    this.accoladesList.update(list => [...list, { year: new Date().getFullYear().toString(), title: '', description: '' }]);
    this.credentialsForm.markAsDirty();
    this.snackbar.show('New accolade entry added.', 'info');
  }

  removeAccolade(index: number): void {
    this.accoladesList.update(list => list.filter((_, i) => i !== index));
    this.credentialsForm.markAsDirty();
    this.snackbar.show('Accolade entry removed.', 'info');
  }

  updateAccolade(index: number, field: keyof AccoladeItem, value: string): void {
    this.accoladesList.update(list => list.map((a, i) => i === index ? { ...a, [field]: value } : a));
    this.credentialsForm.markAsDirty();
  }

  // ─── Cases CRUD ──────────────────────────────────────────────
  addCase(): void {
    this.casesList.update(list => [...list, { title: '', outcome: '', description: '' }]);
    this.credentialsForm.markAsDirty();
    this.snackbar.show('New landmark case entry added.', 'info');
  }

  removeCase(index: number): void {
    this.casesList.update(list => list.filter((_, i) => i !== index));
    this.credentialsForm.markAsDirty();
    this.snackbar.show('Case entry removed.', 'info');
  }

  updateCase(index: number, field: keyof CaseItem, value: string): void {
    this.casesList.update(list => list.map((c, i) => i === index ? { ...c, [field]: value } : c));
    this.credentialsForm.markAsDirty();
  }

  // ─── Banner Upload & Crop ────────────────────────────────────
  triggerBannerUpload(): void {
    const fileInput = document.getElementById('cred-banner-file-input');
    if (fileInput) fileInput.click();
  }

  onBannerSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const result = e.target.result as string;
        this.rawImage.set(result);
        this.uploadedRawImage.set(result);
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

  openCropModal(): void {
    this.showCropModal.set(true);
    document.body.classList.add('overflow-hidden');
  }

  closeCropModal(): void {
    this.showCropModal.set(false);
    this.rawImage.set(null);
    this.isSavingBanner.set(false);
    document.body.classList.remove('overflow-hidden');
  }

  onImageLoaded(event: Event): void {
    const img = event.target as HTMLImageElement;
    const scaleX = 480 / img.naturalWidth;
    const scaleY = 120 / img.naturalHeight;
    this.baseScale = Math.max(scaleX, scaleY);
  }

  onDragStart(event: MouseEvent | TouchEvent): void {
    this.isDragging = true;
    const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;
    this.startX = clientX - this.dragX;
    this.startY = clientY - this.dragY;
    if (event instanceof MouseEvent) event.preventDefault();
  }

  onDrag(event: MouseEvent | TouchEvent): void {
    if (!this.isDragging) return;
    const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;
    this.dragX = clientX - this.startX;
    this.dragY = clientY - this.startY;
  }

  onDragEnd(): void { this.isDragging = false; }

  rotateImage(): void { this.rotation = (this.rotation + 90) % 360; }

  saveCroppedImage(): void {
    const raw = this.rawImage();
    if (!raw) return;
    this.isSavingBanner.set(true);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1200, 300);
      ctx.translate(600, 150);
      ctx.rotate((this.rotation * Math.PI) / 180);
      const scale = this.baseScale * this.zoomScale * 2.5;
      ctx.scale(scale, scale);
      ctx.translate(this.dragX / (this.baseScale * this.zoomScale), this.dragY / (this.baseScale * this.zoomScale));
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9);
      this.bannerUrl.set(croppedBase64);
      this.credentialsForm.markAsDirty();
      this.closeCropModal();
    };
    img.src = raw;
  }

  deleteBanner(): void {
    this.bannerUrl.set('');
    this.uploadedRawImage.set(null);
    this.credentialsForm.markAsDirty();
    this.snackbar.show('Profile banner removed.', 'info');
  }

  copyBarCouncilNumber(): void {
    const num = this.lawyerProfile?.barCouncilNumber;
    if (!num) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(num).then(() => {
        this.snackbar.show('Bar Council Registration copied to clipboard.', 'success');
      }).catch(() => {
        this.snackbar.show(`Bar Council Reg: ${num}`, 'info');
      });
    } else {
      this.snackbar.show(`Bar Council Reg: ${num}`, 'info');
    }
  }

  adjustBanner(): void {
    const uploaded = this.uploadedRawImage();
    const banner = this.bannerUrl();
    if (uploaded) {
      this.rawImage.set(uploaded);
    } else if (banner) {
      this.rawImage.set(banner);
    }
    if (this.rawImage()) {
      this.zoomScale = 1;
      this.rotation = 0;
      this.dragX = 0;
      this.dragY = 0;
      this.openCropModal();
    }
  }

  setBannerFit(fit: string): void {
    this.socialLinksObj.update(obj => ({ ...obj, bannerFit: fit }));
    this.credentialsForm.markAsDirty();
  }

  setBannerPosition(position: string): void {
    this.socialLinksObj.update(obj => ({ ...obj, bannerPosition: position }));
    this.credentialsForm.markAsDirty();
  }

  // ─── Helpers ─────────────────────────────────────────────────
  getSpecializationTags(): string[] {
    const val = this.credentialsForm?.controls.specialization.value || this.lawyerProfile?.specialization || '';
    return val.split(',').map((s: string) => s.trim()).filter(Boolean);
  }

  get isDirty(): boolean {
    return this.credentialsForm?.dirty || false;
  }

  getCropTransform(): string {
    return `translate(${this.dragX}px, ${this.dragY}px) scale(${this.baseScale * this.zoomScale}) rotate(${this.rotation}deg)`;
  }

  trackByIndex(index: number): number { return index; }
  trackByString(_index: number, item: string): string { return item; }
}