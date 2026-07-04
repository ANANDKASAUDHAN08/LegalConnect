import { Component, EventEmitter, Output, Input, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LegalService } from '../../../../services/legal.service';
import { TooltipDirective } from '../../../../directives/tooltip.directive';

@Component({
  selector: 'app-suggest-resource-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective],
  templateUrl: './suggest-resource-modal.component.html',
  styleUrls: ['./suggest-resource-modal.component.scss']
})
export class SuggestResourceModalComponent implements OnDestroy {
  private _isOpen = false;

  @Input()
  get isOpen(): boolean {
    return this._isOpen;
  }

  set isOpen(value: boolean) {
    this._isOpen = value;
    this.toggleBodyScroll(value);
  }

  @Output() close = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<any>();

  formData = {
    name: '',
    type: 'LegalAid',
    categories: ['General'],
    subcategories: '',
    city: '',
    state: '',
    address: '',
    contactNumber: '',
    website: '',
    languages: ['English', 'Hindi'],
    coordinates: {
      lat: 28.6139,
      lng: 77.2090
    }
  };

  availableLanguages = ['English', 'Hindi', 'Bengali', 'Marathi', 'Telugu', 'Tamil', 'Gujarati', 'Kannada', 'Odia', 'Punjabi', 'Malayalam', 'Assamese'];
  selectedLanguages: { [key: string]: boolean } = {
    'English': true,
    'Hindi': true
  };

  isSubmitting = false;
  successMessage = '';
  errorMessage = '';

  isTypeDropdownOpen = false;

  typeOptions = [
    { value: 'LegalAid', label: 'Legal Aid Center / DLSA' },
    { value: 'Court', label: 'District Court / Forum' },
    { value: 'PoliceStation', label: 'Police Station / Cyber Cell' },
    { value: 'GovernmentOffice', label: 'Government Office / Tehsil' }
  ];

  constructor(private legalService: LegalService, private elementRef: ElementRef) {}

  onClose() {
    this.close.emit();
    // Reset state
    this.successMessage = '';
    this.errorMessage = '';
    this.isSubmitting = false;
    this.isTypeDropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const dropdownContainer = this.elementRef.nativeElement.querySelector('.dropdown-container-el');
    if (dropdownContainer && !dropdownContainer.contains(event.target as Node)) {
      this.isTypeDropdownOpen = false;
    }
  }

  toggleTypeDropdown() {
    this.isTypeDropdownOpen = !this.isTypeDropdownOpen;
  }

  selectType(value: string) {
    this.formData.type = value;
    this.isTypeDropdownOpen = false;
  }

  getSelectedTypeLabel(): string {
    const opt = this.typeOptions.find(o => o.value === this.formData.type);
    return opt ? opt.label : 'Select Resource Type';
  }

  toggleLanguage(lang: string) {
    this.selectedLanguages[lang] = !this.selectedLanguages[lang];
  }

  submitSuggestion() {
    if (!this.formData.name || !this.formData.type || !this.formData.city || !this.formData.state || !this.formData.address) {
      this.errorMessage = 'Please fill in all required fields marked with *';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Map selected checkboxes back to languages array
    const languages = Object.keys(this.selectedLanguages).filter(key => this.selectedLanguages[key]);
    
    // Parse subcategories from comma-separated string
    const subcats = this.formData.subcategories
      ? this.formData.subcategories.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : [];

    const payload = {
      ...this.formData,
      languages,
      subcategories: subcats
    };

    this.legalService.suggestResource(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success) {
          this.successMessage = 'Thank you! Your suggestion has been submitted to the moderation queue.';
          this.submitted.emit(res.data);
          setTimeout(() => {
            this.onClose();
          }, 3000);
        } else {
          this.errorMessage = 'Submission failed. Please try again.';
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || 'Error occurred while submitting.';
        console.error(err);
      }
    });
  }

  ngOnDestroy() {
    this.toggleBodyScroll(false);
  }

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
