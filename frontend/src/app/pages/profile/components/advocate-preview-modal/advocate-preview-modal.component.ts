import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserProfile } from '../../../../services/auth.service';
import { LawyerProfileData } from '../../../../services/lawyer.service';
import { IconComponent } from '../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';

@Component({
  selector: 'app-advocate-preview-modal',
  standalone: true,
  imports: [CommonModule, IconComponent, TooltipDirective],
  templateUrl: './advocate-preview-modal.component.html'
})
export class AdvocatePreviewModalComponent {
  @Input() isOpen = false;
  @Input() profile: UserProfile | null = null;
  @Input() lawyerProfile: LawyerProfileData | null = null;

  @Output() close = new EventEmitter<void>();

  private router = inject(Router);

  trackByString(index: number, item: string): string {
    return item || index.toString();
  }

  closeModal() {
    this.close.emit();
  }

  getSpecializationList(): string[] {
    const spec = this.lawyerProfile?.specialization;
    if (!spec) return ['Civil Law', 'Constitutional Law'];
    return spec.split(',').map(s => s.trim()).filter(s => !!s);
  }

  getLanguagesList(): string[] {
    const lang = this.lawyerProfile?.languagesSpoken;
    if (!lang) return ['English', 'Hindi'];
    return lang.split(',').map(l => l.trim()).filter(l => !!l);
  }

  getInitials(): string {
    const name = this.profile?.fullName || '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AD';
  }

  navigateToPublicPage() {
    this.closeModal();
    const id = this.profile?.id;
    if (id) {
      this.router.navigate(['/lawyers', id]);
    } else {
      this.router.navigate(['/lawyers']);
    }
  }
}