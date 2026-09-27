import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfileTab } from '../../profile.component';

@Component({
  selector: 'app-profile-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './profile-skeleton.component.html',
  styleUrls: ['./profile-skeleton.component.scss']
})
export class ProfileSkeletonComponent {
  @Input() activeTab: ProfileTab = 'profile';
  @Input() isClient: boolean = true;
  @Input() isScrolled: boolean = false;
  @Output() tabChange = new EventEmitter<ProfileTab>();

  onSelectTab(tab: ProfileTab): void {
    this.tabChange.emit(tab);
  }
}