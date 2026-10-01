import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  HostListener,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SnackbarService } from '../../services/snackbar.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-sos-modal',
  standalone: true,
  imports: [CommonModule, RouterLink, TooltipDirective, IconComponent],
  templateUrl: './sos-modal.component.html',
  styleUrls: ['./sos-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SosModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();

  private snackbar = inject(SnackbarService);
  private cdr = inject(ChangeDetectorRef);

  isSharingLocation = false;
  private scrollYPosition = 0;

  ngOnInit(): void {
    if (this.isOpen) {
      this.lockScroll();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.lockScroll();
      } else {
        this.unlockScroll();
      }
    }
  }

  ngOnDestroy(): void {
    this.unlockScroll();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.dismiss();
    }
  }

  dismiss(): void {
    this.unlockScroll();
    this.closeModal.emit();
  }

  /**
   * Functional Geolocation Dispatcher:
   * Acquires precise GPS coordinates and prepares an emergency alert SMS/clipboard dispatch
   */
  shareLiveLocation(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.snackbar.show('Geolocation is not supported by your device.', 'error');
      return;
    }

    this.isSharingLocation = true;
    this.cdr.markForCheck();

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
        const sosMessage = `EMERGENCY ALERT (LegalConnect): Urgent legal help needed. My current GPS coordinates are: ${mapsUrl}`;

        // Attempt clipboard copy
        if (navigator.clipboard) {
          navigator.clipboard.writeText(sosMessage).catch(() => { });
        }

        // Open native SMS pre-filled dispatch
        const smsLink = `sms:?&body=${encodeURIComponent(sosMessage)}`;
        window.open(smsLink, '_blank');

        this.isSharingLocation = false;
        this.snackbar.show('GPS coordinates copied & emergency SMS opened.', 'success');
        this.dismiss();
        this.cdr.markForCheck();
      },
      (error) => {
        this.isSharingLocation = false;
        let errMsg = 'Unable to acquire GPS coordinates.';
        if (error.code === error.PERMISSION_DENIED) {
          errMsg = 'Location permission denied. Please allow GPS access in settings.';
        } else if (error.code === error.TIMEOUT) {
          errMsg = 'GPS request timed out. Please check signal and retry.';
        }
        this.snackbar.show(errMsg, 'error');
        this.cdr.markForCheck();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  /**
   * iOS & Android Bulletproof Body Scroll Lock with Position Preservation
   * Only locks scroll on mobile viewports (< 768px) to prevent bottom sheet rubber-banding.
   * On desktop, the console docks like an MNC action hub, keeping the background page fluid.
   */
  private lockScroll(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.innerWidth >= 768) return; // Free scroll for desktop docked console

    this.scrollYPosition = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.scrollYPosition}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.body.classList.add('sos-modal-active');
  }

  private unlockScroll(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (document.body.classList.contains('sos-modal-active')) {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      document.body.classList.remove('sos-modal-active');
      window.scrollTo(0, this.scrollYPosition);
    }
  }
}