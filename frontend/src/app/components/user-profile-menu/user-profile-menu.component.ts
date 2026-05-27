import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-user-profile-menu',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './user-profile-menu.component.html',
  styleUrls: ['./user-profile-menu.component.scss']
})
export class UserProfileMenuComponent {
  @Input() currentUser!: any;
  @Output() logout = new EventEmitter<void>();
}
