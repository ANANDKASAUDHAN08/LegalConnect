import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserProfile } from '../../../../services/auth.service';
import { UserProfileService } from '../../../../services/user-profile.service';
import { VerificationService } from '../../../../services/verification.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { WhatsAppService, WhatsAppSendResult, WhatsAppStatusResponse } from '../../../../services/whatsapp.service';
import { COUNTRIES } from '../../../../constants/countries.constant';
import { IconComponent } from '../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';

export type VerificationFlowType = 'phone' | 'email' | 'whatsapp';

@Component({
  selector: 'app-verification-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, TooltipDirective],
  templateUrl: './verification-modal.component.html'
})
export class VerificationModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() flow: VerificationFlowType = 'phone';
  @Input() profile: UserProfile | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() profileUpdated = new EventEmitter<Partial<UserProfile>>();

  trackByCountryCode(index: number, c: any): string {
    return (c?.code || '') + (c?.short || '') || index.toString();
  }

  private userProfileService = inject(UserProfileService);
  private verificationService = inject(VerificationService);
  private snackbar = inject(SnackbarService);
  private whatsAppService = inject(WhatsAppService);

  activeFlow: VerificationFlowType = 'phone';

  // ── Phone Verification State ──
  countries = COUNTRIES;
  selectedCountry = this.countries[0];
  showCountryDropdown = false;
  phoneBody = '';
  countrySearchText = '';
  phoneOtpCode = '';
  showPhoneOtpInput = false;
  otpLoading = false;
  resendLoading = false;
  resendCooldown = 0;
  selectedOtpChannel: 'whatsapp' | 'email' = 'whatsapp';
  otpSentChannel = '';
  otpStatusMessage = '';
  directWhatsAppOtpUrl: string | null = null;
  canFallbackToEmail = true;
  private _cooldownInterval: ReturnType<typeof setInterval> | null = null;

  // ── Email Verification State ──
  emailResendLoading = false;

  // ── WhatsApp Alerts State ──
  whatsAppPhoneBody = '';
  usePrimaryPhoneForWhatsApp = true;
  whatsAppHearingsEnabled = true;
  whatsAppConsultationsEnabled = true;
  whatsAppAdvocateRepliesEnabled = true;
  isSavingWhatsApp = false;
  isDisablingWhatsApp = false;
  isSendingTestWhatsApp = false;
  lastTestResult: WhatsAppSendResult | null = null;
  gatewayStatus: WhatsAppStatusResponse | null = null;

  get isWhatsAppActive(): boolean {
    return !!this.profile?.notifyWhatsAppEnabled;
  }

  get displayWhatsAppPhone(): string {
    const p = this.profile?.whatsAppPhone || this.profile?.phone;
    if (!p) return '';
    return p.startsWith('+') ? p : `+91 ${p}`;
  }

  ngOnInit() {
    this.activeFlow = this.flow || 'phone';
    this.initFromProfile();
    if (this.activeFlow === 'whatsapp') {
      this.fetchGatewayStatus();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['flow']?.currentValue) {
      this.activeFlow = changes['flow'].currentValue;
      if (this.activeFlow === 'whatsapp') {
        this.fetchGatewayStatus();
      }
    }
    if (changes['profile']?.currentValue) {
      this.initFromProfile();
    }
  }

  ngOnDestroy() {
    if (this._cooldownInterval) {
      clearInterval(this._cooldownInterval);
    }
  }

  initFromProfile() {
    if (!this.profile) return;
    this.initializePhone(this.profile.phone || '');

    // Initialize WhatsApp state
    const currentWaPhone = this.profile.whatsAppPhone || this.profile.phone || '';
    this.whatsAppPhoneBody = currentWaPhone.replace(/^\+91/, '').replace(/\D/g, '');
    this.usePrimaryPhoneForWhatsApp = !this.profile.whatsAppPhone || (!!this.profile.phone && this.profile.whatsAppPhone === this.profile.phone);
  }

  setFlow(flow: VerificationFlowType) {
    this.activeFlow = flow;
    this.showPhoneOtpInput = false;
    this.phoneOtpCode = '';
    this.otpStatusMessage = '';
    if (flow === 'whatsapp') {
      this.fetchGatewayStatus();
    }
  }

  closeModal() {
    this.showPhoneOtpInput = false;
    this.phoneOtpCode = '';
    this.otpStatusMessage = '';
    if (this._cooldownInterval) {
      clearInterval(this._cooldownInterval);
    }
    this.close.emit();
  }

  // ── Country Selector ──
  toggleCountryDropdown() {
    this.showCountryDropdown = !this.showCountryDropdown;
    if (this.showCountryDropdown) this.countrySearchText = '';
  }

  selectCountry(country: any) {
    this.selectedCountry = country;
    this.showCountryDropdown = false;
  }

  getFilteredCountries() {
    if (!this.countrySearchText.trim()) return this.countries;
    const s = this.countrySearchText.toLowerCase().trim();
    return this.countries.filter(c =>
      c.name.toLowerCase().includes(s) ||
      c.short.toLowerCase().includes(s) ||
      c.code.includes(s)
    );
  }

  initializePhone(fullPhone: string) {
    if (!fullPhone) {
      this.selectedCountry = this.countries[0];
      this.phoneBody = '';
      return;
    }
    const sorted = [...this.countries].sort((a, b) => b.code.length - a.code.length);
    for (const c of sorted) {
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
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }

  filterPhoneDigits() {
    this.phoneBody = this.phoneBody.replace(/\D/g, '');
  }

  // ── Production Phone OTP Actions ──
  sendPhoneOtp(channel?: 'whatsapp' | 'email') {
    if (channel) {
      this.selectedOtpChannel = channel;
    }
    if (this.phoneBody.trim().length !== 10) {
      this.snackbar.show('Please enter a valid 10-digit mobile number.', 'warning');
      return;
    }
    const fullPhone = `${this.selectedCountry.code}${this.phoneBody}`.trim();
    this.resendLoading = true;
    this.otpStatusMessage = '';

    this.verificationService.sendPhoneOtp(fullPhone, this.selectedOtpChannel).subscribe({
      next: (res) => {
        this.resendLoading = false;
        this.showPhoneOtpInput = true;
        this.otpSentChannel = res.channel || this.selectedOtpChannel;
        this.directWhatsAppOtpUrl = res.directWhatsAppUrl || null;
        this.canFallbackToEmail = res.canFallbackToEmail ?? true;
        this.otpStatusMessage = res.message;
        this.startCooldown(res.cooldownSeconds || 60);

        if (this.otpSentChannel === 'whatsapp') {
          this.snackbar.show('Verification code sent via WhatsApp! Check your messages.', 'success');
        } else {
          this.snackbar.show('Verification code sent to your registered email!', 'info');
        }
      },
      error: (err: any) => {
        this.resendLoading = false;
        const msg = err?.error?.message || err?.message || 'Failed to dispatch verification code.';
        this.snackbar.show(msg, 'error');
        if (err?.error?.cooldownSeconds) {
          this.startCooldown(err.error.cooldownSeconds);
        }
      }
    });
  }

  switchChannelAndSend(channel: 'whatsapp' | 'email') {
    if (this.resendCooldown > 0) {
      this.snackbar.show(`Please wait ${this.resendCooldown}s before requesting a new code.`, 'warning');
      return;
    }
    this.phoneOtpCode = '';
    this.sendPhoneOtp(channel);
  }

  verifyPhoneOtp() {
    if (this.phoneOtpCode.trim().length < 6) {
      this.snackbar.show('Please enter the complete 6-digit verification code.', 'warning');
      return;
    }
    const fullPhone = `${this.selectedCountry.code}${this.phoneBody}`.trim();
    this.otpLoading = true;

    this.verificationService.verifyPhoneOtp(fullPhone, this.phoneOtpCode.trim()).subscribe({
      next: (res) => {
        this.otpLoading = false;
        this.showPhoneOtpInput = false;
        this.phoneOtpCode = '';
        this.snackbar.show(res?.message || 'Mobile number verified successfully! WhatsApp alerts activated.', 'success');

        const updatedData: Partial<UserProfile> = {
          phone: fullPhone,
          isPhoneVerified: true,
          whatsAppPhone: fullPhone,
          notifyWhatsAppEnabled: true
        };

        if (this.profile) {
          this.profile.phone = fullPhone;
          this.profile.isPhoneVerified = true;
          this.profile.whatsAppPhone = fullPhone;
          this.profile.notifyWhatsAppEnabled = true;
        }

        this.profileUpdated.emit(updatedData);
        this.closeModal();
      },
      error: (err: any) => {
        this.otpLoading = false;
        const msg = err?.error?.message || err?.message || 'Invalid or expired verification code.';
        this.snackbar.show(msg, 'error');
      }
    });
  }

  openDirectWhatsAppOtp() {
    if (this.directWhatsAppOtpUrl) {
      window.open(this.directWhatsAppOtpUrl, '_blank', 'noopener,noreferrer');
    }
  }

  resendPhoneOtp() {
    if (this.resendCooldown > 0) return;
    this.sendPhoneOtp(this.selectedOtpChannel);
  }

  private startCooldown(seconds: number = 60) {
    this.resendCooldown = seconds;
    if (this._cooldownInterval) clearInterval(this._cooldownInterval);
    this._cooldownInterval = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(this._cooldownInterval!);
        this._cooldownInterval = null;
      }
    }, 1000);
  }

  // ── Email Verification Actions ──
  resendEmailVerification() {
    if (!this.profile?.email) return;
    this.emailResendLoading = true;
    this.verificationService.resendEmailVerification(this.profile.email).subscribe({
      next: () => {
        this.emailResendLoading = false;
        this.snackbar.show('Verification link sent! Check your inbox.', 'success');
      },
      error: (err: any) => {
        this.emailResendLoading = false;
        this.snackbar.show(err?.error || err?.message || 'Failed to send email verification.', 'error');
      }
    });
  }

  // ── WhatsApp Alerts Actions ──
  saveWhatsAppAlerts(enable: boolean = true) {
    let targetPhone = '';
    if (enable) {
      if (this.usePrimaryPhoneForWhatsApp) {
        targetPhone = this.profile?.phone || '';
      } else {
        const cleaned = this.whatsAppPhoneBody.replace(/\D/g, '').trim();
        if (cleaned.length !== 10) {
          this.snackbar.show('Please enter a valid 10-digit WhatsApp number.', 'warning');
          return;
        }
        targetPhone = `+91${cleaned}`;
      }

      if (!targetPhone) {
        this.snackbar.show('Please enter a WhatsApp phone number.', 'warning');
        return;
      }
    }

    this.isSavingWhatsApp = true;
    const payload: Partial<UserProfile> = {
      notifyWhatsAppEnabled: enable,
      whatsAppPhone: enable ? targetPhone : ''
    };

    this.userProfileService.updateProfile(payload).subscribe({
      next: () => {
        this.isSavingWhatsApp = false;
        if (this.profile) {
          this.profile.notifyWhatsAppEnabled = enable;
          this.profile.whatsAppPhone = payload.whatsAppPhone;
        }
        this.snackbar.show(
          enable ? 'WhatsApp consultation & case alerts enabled successfully!' : 'WhatsApp alerts disabled.',
          enable ? 'success' : 'info'
        );
        this.profileUpdated.emit(payload);
        this.closeModal();
      },
      error: (err: any) => {
        this.isSavingWhatsApp = false;
        const msg = err?.error?.message || err?.error || 'Failed to update WhatsApp alerts.';
        this.snackbar.show(msg, 'error');
      }
    });
  }

  disableWhatsAppAlerts() {
    this.isDisablingWhatsApp = true;
    const payload: Partial<UserProfile> = {
      notifyWhatsAppEnabled: false
    };

    this.userProfileService.updateProfile(payload).subscribe({
      next: () => {
        this.isDisablingWhatsApp = false;
        if (this.profile) {
          this.profile.notifyWhatsAppEnabled = false;
        }
        this.snackbar.show('WhatsApp alerts disabled.', 'info');
        this.profileUpdated.emit(payload);
      },
      error: (err: any) => {
        this.isDisablingWhatsApp = false;
        const msg = err?.error?.message || err?.error || 'Failed to disable WhatsApp alerts.';
        this.snackbar.show(msg, 'error');
      }
    });
  }

  fetchGatewayStatus() {
    this.whatsAppService.getStatus().subscribe({
      next: (res) => {
        this.gatewayStatus = res;
      },
      error: () => {
        this.gatewayStatus = {
          isConfigured: false,
          activeProvider: 'Universal Gateway',
          hasMetaCredentials: false,
          hasTwilioCredentials: false,
          hasBrevoCredentials: false,
          userHasWhatsAppEnabled: !!this.profile?.notifyWhatsAppEnabled,
          userWhatsAppPhone: this.profile?.whatsAppPhone || this.profile?.phone
        };
      }
    });
  }

  sendTestWhatsAppAlert() {
    let targetPhone = '';
    if (this.usePrimaryPhoneForWhatsApp) {
      targetPhone = this.profile?.phone || '';
    } else {
      const cleaned = this.whatsAppPhoneBody.replace(/\D/g, '').trim();
      if (cleaned.length === 10) {
        targetPhone = `+91${cleaned}`;
      } else if (cleaned.length > 10) {
        targetPhone = `+${cleaned}`;
      }
    }

    if (!targetPhone) {
      targetPhone = this.profile?.whatsAppPhone || this.profile?.phone || '';
    }

    if (!targetPhone) {
      this.snackbar.show('Please provide a mobile number to test WhatsApp dispatch.', 'warning');
      return;
    }

    this.isSendingTestWhatsApp = true;
    this.lastTestResult = null;
    this.whatsAppService.sendTestAlert(targetPhone).subscribe({
      next: (res) => {
        this.isSendingTestWhatsApp = false;
        this.lastTestResult = res;
        this.snackbar.show(`WhatsApp alert dispatched successfully via ${res.provider}!`, 'success');
      },
      error: (err: any) => {
        this.isSendingTestWhatsApp = false;
        const msg = err?.error?.message || err?.error || 'Failed to send WhatsApp test alert.';
        this.snackbar.show(msg, 'error');
      }
    });
  }

  openDirectWhatsApp() {
    if (this.lastTestResult?.directWhatsAppUrl) {
      window.open(this.lastTestResult.directWhatsAppUrl, '_blank', 'noopener,noreferrer');
    }
  }
}