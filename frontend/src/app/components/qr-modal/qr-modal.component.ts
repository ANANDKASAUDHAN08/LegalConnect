import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-qr-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qr-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QrModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() qrData: any = null;

  @Output() closed = new EventEmitter<void>();

  isLoadingImage = true;
  qrCodeUrl = '';
  title = '';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['qrData'] || changes['isOpen']) {
      this.isLoadingImage = true;
      if (this.qrData) {
        this.title = this.qrData.name || '';
        const address = this.qrData.address || 'N/A';
        const phone = this.qrData.contactNumber || this.qrData.number || 'N/A';
        const dataString = `Name: ${this.title}\nAddress: ${address}\nPhone: ${phone}`;
        this.qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(dataString)}`;
      } else {
        this.qrCodeUrl = '';
        this.title = '';
      }
    }
  }

  onImageLoad() {
    this.isLoadingImage = false;
  }

  onClose() {
    this.closed.emit();
  }
}