import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserProfile } from '../../../../services/auth.service';
import { LawyerProfileData } from '../../../../services/lawyer.service';
import { IconComponent } from '../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { ProfileTab, TierMilestone, MilestoneStep } from '../../profile.component';
import { VerificationFlowType } from '../verification-modal/verification-modal.component';

@Component({
  selector: 'app-mobile-overview-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent, TooltipDirective],
  templateUrl: './mobile-overview-tab.component.html'
})
export class MobileOverviewTabComponent {
  @Input() profile: UserProfile | null = null;
  @Input() lawyerProfile: LawyerProfileData | null = null;
  @Input() overallCompletionPct = 0;
  @Input() fourTierMilestones: TierMilestone[] = [];
  @Input() nextMilestoneAction: any = null;
  @Input() securityScore = 0;
  @Input() securityRating = 'Strong';
  @Input() securityColor = '';
  @Input() memberSince = 'Member';
  @Input() isClient = true;

  @Output() navigateTab = new EventEmitter<ProfileTab>();
  @Output() requestVerification = new EventEmitter<VerificationFlowType>();
  @Output() logout = new EventEmitter<void>();

  openTab(tab: ProfileTab) {
    this.navigateTab.emit(tab);
  }

  onNextMilestone() {
    if (!this.nextMilestoneAction) return;
    if (this.nextMilestoneAction.actionFlow) {
      this.requestVerification.emit(this.nextMilestoneAction.actionFlow);
    } else if (this.nextMilestoneAction.tab) {
      this.navigateTab.emit(this.nextMilestoneAction.tab);
    } else if (this.nextMilestoneAction.label === 'Setup 2FA') {
      this.navigateTab.emit('account');
    }
  }

  onTierAction(tier: TierMilestone) {
    if (tier.actionFlow) {
      this.requestVerification.emit(tier.actionFlow);
    } else if (tier.actionTab) {
      this.navigateTab.emit(tier.actionTab);
    } else {
      this.navigateTab.emit('account');
    }
  }

  trackByTier(_index: number, tier: TierMilestone): number {
    return tier.tier;
  }

  trackByStepTitle(_index: number, step: MilestoneStep): string {
    return step.title;
  }
}