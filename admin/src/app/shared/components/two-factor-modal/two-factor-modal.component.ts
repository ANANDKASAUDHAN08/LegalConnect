import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TwoFactorEnforcerService } from '../../services/two-factor-enforcer.service';

@Component({
  selector: 'admin-two-factor-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './two-factor-modal.component.html',
  styleUrl: './two-factor-modal.component.scss'
})
export class TwoFactorModalComponent {
  code = '';
  error = '';

  constructor(public enforcer: TwoFactorEnforcerService) { }

  verify(): void {
    if (this.code.length !== 6 || !/^\d{6}$/.test(this.code)) {
      this.error = 'Please enter a valid 6-digit numerical OTP.';
      return;
    }
    this.error = '';
    const enteredCode = this.code;
    this.code = '';
    this.enforcer.confirm(enteredCode);
  }

  cancel(): void {
    this.code = '';
    this.error = '';
    this.enforcer.cancel();
  }
}