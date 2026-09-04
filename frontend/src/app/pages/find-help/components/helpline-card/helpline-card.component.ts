import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { ShareMenuComponent } from '../../../../components/share-menu/share-menu.component';
import { SnackbarService } from '../../../../services/snackbar.service';

import { BookmarkButtonComponent } from '../../../../components/bookmark-button/bookmark-button.component';
import { InteractiveLikeComponent } from '../../../../components/interactive-like/interactive-like.component';
import { ReportTriggerComponent } from '../../../../components/report-modal/report-trigger/report-trigger.component';
import { IconComponent } from '../../../../components/icon';

@Component({
  selector: 'app-helpline-card',
  standalone: true,
  imports: [
    CommonModule,
    TooltipDirective,
    ShareMenuComponent,
    BookmarkButtonComponent,
    InteractiveLikeComponent,
    ReportTriggerComponent,
    IconComponent
  ],
  templateUrl: './helpline-card.component.html',
  styles: [`:host { display: block; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelplineCardComponent {
  @Input() helpline: any;
  @Output() showQr = new EventEmitter<any>();

  constructor(
    private snackbar: SnackbarService
  ) { }

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
    let text = `${this.helpline.name}\n`;
    text += `----------------------------------------------\n`;
    text += `Phone: ${this.helpline.number}\n`;
    if (this.helpline.description) {
      text += `Details: ${this.helpline.description}\n`;
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