import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../../../directives/tooltip.directive';
import { DRAWER_CONTEXT, IDrawerContext, DrawerTab } from '../../drawer-context';
import { PracticeArea } from '../../../../../../services/practice-areas.service';

@Component({
  selector: 'app-drawer-overview-tab',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, TooltipDirective],
  templateUrl: './drawer-overview-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrawerOverviewTabComponent {
  readonly drawer: IDrawerContext = inject(DRAWER_CONTEXT);

  get spec() { return this.drawer.spec!; }
  get theme() { return this.drawer.theme; }
  get isHindi() { return this.drawer.isHindi; }
  get freeAidService() { return this.drawer.freeAidService; }

  // Signals
  get viewerRole() { return this.drawer.viewerRole; }
  get jargonMode() { return this.drawer.jargonMode; }
  get isFirstTimerDismissed() { return this.drawer.isFirstTimerDismissed; }
  get readMoreDesc() { return this.drawer.readMoreDesc; }
  get showHindiDesc() { return this.drawer.showHindiDesc; }
  get showCostBreakdown() { return this.drawer.showCostBreakdown; }
  get serverLawyerPosition() { return this.drawer.serverLawyerPosition; }
  get demandIntelligence() { return this.drawer.demandIntelligence; }
  get activeMatter() { return this.drawer.activeMatter; }
  get checkedDocuments() { return this.drawer.checkedDocuments; }

  // Computed
  get confidenceScore() { return this.drawer.confidenceScore; }
  get dataCompleteness() { return this.drawer.dataCompleteness; }
  get quickGlanceChips() { return this.drawer.quickGlanceChips; }
  get displayTagline() { return this.drawer.displayTagline; }
  get displayDescription() { return this.drawer.displayDescription; }
  get displayHindiDescription() { return this.drawer.displayHindiDescription; }
  get lawyerPosition() { return this.drawer.lawyerPosition; }
  get availableAdvocatesCount() { return this.drawer.availableAdvocatesCount; }
  get freeConsultLawyers() { return this.drawer.freeConsultLawyers; }
  get userCityShort() { return this.drawer.userCityShort; }
  get relatedPracticeAreas() { return this.drawer.relatedPracticeAreas; }
  get headings() { return this.drawer.headings; }
  get advocateSort() { return this.drawer.advocateSort; }
  get languagesList() { return this.drawer.languagesList; }
  get checklistProgress() { return this.drawer.checklistProgress; }

  get isLawyer() { return this.drawer.isLawyer; }
  get isClient() { return this.drawer.isClient; }
  get isGuest() { return this.drawer.isGuest; }

  // Methods
  setTab(tab: DrawerTab) { this.drawer.setTab(tab); }
  dismissFirstTimerCard() { this.drawer.dismissFirstTimerCard(); }
  getCourtTier(forum: string) { return this.drawer.getCourtTier(forum); }
  printChecklist() { this.drawer.printChecklist(); }
  toggleDocumentCheck(doc: string) { this.drawer.toggleDocumentCheck(doc); }
  handleSelectRelated(area: PracticeArea) { this.drawer.handleSelectRelated(area); }
  trackByCity(_index: number, item: any): string { return item?.city || String(_index); }
  trackByString(_index: number, str: string): string { return str; }
  trackByPracticeArea(_index: number, area: PracticeArea): string { return area?.id || String(_index); }
}