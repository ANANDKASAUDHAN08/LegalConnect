import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-legal-roadmap',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './legal-roadmap.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegalRoadmapComponent {
  @Input() roadmap: any;
  @Input() activeCategory = '';
  @Input() locationQuery = '';

  @Output() downloadCasePack = new EventEmitter<void>();
}