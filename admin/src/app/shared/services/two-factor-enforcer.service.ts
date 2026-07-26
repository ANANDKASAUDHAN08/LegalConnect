import { Injectable, signal } from '@angular/core';

export interface TwoFactorRequestOptions {
  title: string;
  actionDescription: string;
  confirmText?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TwoFactorEnforcerService {
  isOpen = signal(false);
  options = signal<TwoFactorRequestOptions>({
    title: '2FA Admin Verification Required',
    actionDescription: 'You are performing a high-risk administrative action. Enter your 6-digit TOTP code to authorize.'
  });

  private resolveFn?: (value: boolean) => void;

  prompt(options: TwoFactorRequestOptions): Promise<boolean> {
    return new Promise((resolve) => {
      this.options.set(options);
      this.isOpen.set(true);
      this.resolveFn = resolve;
    });
  }

  confirm(code: string): void {
    if (code && code.trim().length === 6) {
      this.isOpen.set(false);
      if (this.resolveFn) {
        this.resolveFn(true);
      }
    }
  }

  cancel(): void {
    this.isOpen.set(false);
    if (this.resolveFn) {
      this.resolveFn(false);
    }
  }
}