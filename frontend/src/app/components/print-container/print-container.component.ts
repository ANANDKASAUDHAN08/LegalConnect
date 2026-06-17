import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-print-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './print-container.component.html',
  styleUrls: ['./print-container.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class PrintContainerComponent {
  @Input() title = 'Document Report';
  @Input() subtitle = '';

  get printDate(): string {
    return new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get currentUrl(): string {
    return typeof window !== 'undefined' ? window.location.href : '';
  }
}