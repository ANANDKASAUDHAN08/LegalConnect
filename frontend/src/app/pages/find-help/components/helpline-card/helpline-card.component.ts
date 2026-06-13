import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-helpline-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './helpline-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelplineCardComponent {
  @Input() helpline: any;
}