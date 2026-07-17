import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private deferredPrompt: any = null;

  canInstall = signal<boolean>(true); // Default to true so button is discoverable
  isStandalone = signal<boolean>(false);
  isIos = signal<boolean>(false);
  showIosGuide = signal<boolean>(false);
  showDesktopGuide = signal<boolean>(false);

  constructor() {
    this.checkStandaloneState();
    this.detectIos();
    this.listenForInstallPrompt();
  }

  private checkStandaloneState() {
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    this.isStandalone.set(isStandaloneMode);
  }

  private detectIos() {
    const ua = window.navigator.userAgent;
    const isIosDevice = /iPhone|iPad|iPod/.test(ua) && !(window as any).MSStream;
    this.isIos.set(isIosDevice);
  }

  private listenForInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.isStandalone.set(true);
      this.setScrollLock(false);
    });
  }

  private setScrollLock(lock: boolean) {
    if (typeof document !== 'undefined') {
      if (lock) {
        document.body.classList.add('overflow-hidden');
      } else {
        document.body.classList.remove('overflow-hidden');
      }
    }
  }

  async promptInstall(): Promise<boolean> {
    if (this.isIos() && !this.isStandalone()) {
      this.showIosGuide.set(true);
      this.setScrollLock(true);
      return true;
    }

    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;

      if (outcome === 'accepted') {
        this.isStandalone.set(true);
        return true;
      }
      return false;
    }

    // If native prompt is not ready (e.g. dev mode or browser restriction), show desktop guide modal
    this.showDesktopGuide.set(true);
    this.setScrollLock(true);
    return true;
  }

  closeIosGuide() {
    this.showIosGuide.set(false);
    this.setScrollLock(false);
  }

  closeDesktopGuide() {
    this.showDesktopGuide.set(false);
    this.setScrollLock(false);
  }
}