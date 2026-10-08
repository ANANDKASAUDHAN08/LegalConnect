import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-notification-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-skeleton.component.html',
  styleUrls: ['./notification-skeleton.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationSkeletonComponent {
  @Input() activeTab: string = 'all';
  @Input() count: number = 4;

  get countArray(): number[] {
    return Array.from({ length: Math.max(1, this.count) }, (_, i) => i);
  }
}