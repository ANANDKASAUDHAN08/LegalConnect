import { Component, Input, Output, EventEmitter } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-premium-preview-modal',
  standalone: true,
  imports: [NgIf, RouterLink],
  templateUrl: './premium-preview-modal.component.html',
  styleUrls: ['./premium-preview-modal.component.scss']
})
export class PremiumPreviewModalComponent {
  @Input() show = false;
  @Output() showChange = new EventEmitter<boolean>();
  @Input() featureName: 'ai' | 'templates' = 'ai';

  get title(): string {
    return this.featureName === 'ai' ? 'AI Legal Assistant' : 'Legal Templates Library';
  }

  get desc(): string {
    if (this.featureName === 'ai') {
      return 'Unlock instant legal explanations and quick analysis. Upload any contract, notice, or document to receive plain-language summaries, risk highlights, and recommended response outlines in seconds.';
    } else {
      return 'Access our catalog of verified templates for common legal scenarios, including rent agreements, employment contracts, affidavits, power of attorney documents, and formal notices. Fully customizable to fit your needs.';
    }
  }

  close() {
    this.show = false;
    this.showChange.emit(false);
  }
}
