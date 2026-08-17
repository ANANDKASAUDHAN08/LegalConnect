import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sos-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sos-drawer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SosDrawerComponent {
  @Input() showSosDrawer = false;
  @Output() toggleSosDrawer = new EventEmitter<boolean>();
}