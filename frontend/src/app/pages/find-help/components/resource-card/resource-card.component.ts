import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-resource-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './resource-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResourceCardComponent {
  @Input() resource: any;
  @Input() isFreeAidEligible = false;

  @Output() bookmark = new EventEmitter<string>();
  @Output() directions = new EventEmitter<{ lat: number, lng: number }>();
}