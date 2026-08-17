import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { SavedItemsService } from '../../../../services/saved-items.service';
import { ShareMenuComponent } from '../../../../components/share-menu/share-menu.component';
import { SnackbarService } from '../../../../services/snackbar.service';

@Component({
  selector: 'app-helpline-card',
  standalone: true,
  imports: [CommonModule, TooltipDirective, ShareMenuComponent],
  templateUrl: './helpline-card.component.html',
  styles: [`:host { display: block; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelplineCardComponent {
  @Input() helpline: any;

  @Output() showQr = new EventEmitter<any>();

  // Reactive saved state — uses MongoDB _id string
  isSaved = computed(() => this.helpline?._id ? this.savedItems.isSavedHelpline(this.helpline._id) : false);

  constructor(
    private savedItems: SavedItemsService,
    private snackbar: SnackbarService
  ) { }

  onSaveClick(event: Event) {
    event.stopPropagation();
    if (this.helpline?._id) {
      this.savedItems.toggleHelpline(this.helpline._id, this.helpline.name);
    }
  }

  copyCardDetails() {
    const text = this.getShareText() + `\nShared via LegalConnect Find-Help Portal`;
    navigator.clipboard.writeText(text).then(() => {
      this.snackbar.show('Helpline details copied to clipboard!');
    }).catch(() => {
      this.snackbar.show('Could not copy helpline details.');
    });
  }

  getShareSubject(): string {
    return `Emergency Helpline: ${this.helpline?.name || 'Contact'}`;
  }

  getShareText(): string {
    if (!this.helpline) return '';
    let text = `🚨 ${this.helpline.name}\n`;
    text += `----------------------------------------------\n`;
    text += `📞 Number: ${this.helpline.number}\n`;
    if (this.helpline.description) {
      text += `ℹ️ Description: ${this.helpline.description}\n`;
    }
    return text;
  }

  getShareUrl(): string {
    return 'https://legalconnect.com';
  }

  onQrClick(event: Event) {
    event.stopPropagation();
    if (this.showQr.observed) {
      this.showQr.emit(this.helpline);
    } else {
      const dataString = `Name: ${this.helpline.name}\nNumber: ${this.helpline.number}\nDescription: ${this.helpline.description || 'N/A'}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(dataString)}`;
      window.open(qrUrl, '_blank', 'width=350,height=350,status=no,toolbar=no,menubar=no,location=no');
    }
  }
}