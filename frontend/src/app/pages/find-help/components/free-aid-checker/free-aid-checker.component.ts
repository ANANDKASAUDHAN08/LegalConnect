import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-free-aid-checker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './free-aid-checker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FreeAidCheckerComponent {
  @Input() eligibilityStep = 0;
  @Input() eligibilityAnswers: { gender: string; income: string; category: string } = {
    gender: '',
    income: '',
    category: ''
  };
  @Input() isFreeAidEligible = false;

  @Output() startCheck = new EventEmitter<void>();
  @Output() submitStep = new EventEmitter<void>();
  @Output() resetCheck = new EventEmitter<void>();
  @Output() backToStart = new EventEmitter<void>();

  openDropdown: 'category' | 'gender' | 'income' | null = null;

  @HostListener('document:click')
  onDocumentClick() {
    this.openDropdown = null;
  }

  toggleDropdown(type: 'category' | 'gender' | 'income', event: MouseEvent) {
    event.stopPropagation();
    this.openDropdown = this.openDropdown === type ? null : type;
  }

  selectOption(type: 'category' | 'gender' | 'income', value: string) {
    this.eligibilityAnswers[type] = value;
    this.openDropdown = null;
  }

  getCategoryLabel(): string {
    const val = this.eligibilityAnswers.category;
    if (val === 'sc') return 'Scheduled Caste (SC)';
    if (val === 'st') return 'Scheduled Tribe (ST)';
    if (val === 'labour') return 'Industrial Workman / Labour';
    if (val === 'general') return 'General / OBC / Others';
    return 'Select Category';
  }

  getGenderLabel(): string {
    const val = this.eligibilityAnswers.gender;
    if (val === 'female') return 'Female (Automatically eligible)';
    if (val === 'other') return 'Child / Specially Abled / Other';
    if (val === 'male') return 'Male';
    return 'Select Gender';
  }

  getIncomeLabel(): string {
    const val = this.eligibilityAnswers.income;
    if (val === 'under125') return 'Under ₹1,25,000';
    if (val === 'under300') return '₹1,25,000 - ₹3,00,000';
    if (val === 'over300') return 'Above ₹3,00,000';
    return 'Select Income Bracket';
  }

  isFormValid(): boolean {
    return !!this.eligibilityAnswers.category &&
      !!this.eligibilityAnswers.gender &&
      !!this.eligibilityAnswers.income;
  }
}