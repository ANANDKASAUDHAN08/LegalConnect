import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
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
  @Input() eligibilityAnswers = {
    gender: '',
    income: '',
    category: ''
  };
  @Input() isFreeAidEligible = false;

  @Output() startCheck = new EventEmitter<void>();
  @Output() submitStep = new EventEmitter<void>();
  @Output() resetCheck = new EventEmitter<void>();
}