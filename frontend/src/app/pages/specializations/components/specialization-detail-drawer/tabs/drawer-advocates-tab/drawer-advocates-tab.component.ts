import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../../../directives/tooltip.directive';
import { DRAWER_CONTEXT, IDrawerContext } from '../../drawer-context';
import { LawyerPreview } from '../../../../../../services/practice-areas.service';

@Component({
  selector: 'app-drawer-advocates-tab',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, TooltipDirective],
  templateUrl: './drawer-advocates-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrawerAdvocatesTabComponent {
  readonly drawer: IDrawerContext = inject(DRAWER_CONTEXT);

  get spec() { return this.drawer.spec!; }
  get headings() { return this.drawer.headings; }
  get lawyersHeadingShort() { return this.drawer.lawyersHeadingShort; }
  get sortedAdvocates() { return this.drawer.sortedAdvocates; }
  get pagedAdvocates() { return this.drawer.pagedAdvocates; }
  get totalAdvocateCount() { return this.drawer.totalAdvocateCount; }
  get localAdvocateCount() { return this.drawer.localAdvocateCount; }
  get freeAdvocateCount() { return this.drawer.freeAdvocateCount; }
  get userCityShort() { return this.drawer.userCityShort; }
  get showAlertModal() { return this.drawer.showAlertModal; }
  get alertSubscribed() { return this.drawer.alertSubscribed; }
  get advocateFilter() { return this.drawer.advocateFilter; }
  get advocateSort() { return this.drawer.advocateSort; }
  get hasMoreAdvocates() { return this.drawer.hasMoreAdvocates; }
  get isLawyer() { return this.drawer.isLawyer; }

  setAdvocateFilter(filter: 'all' | 'local' | 'free'): void { this.drawer.setAdvocateFilter(filter); }
  setAdvocateSort(sort: 'rating' | 'experience' | 'fee'): void { this.drawer.setAdvocateSort(sort); }
  loadMoreAdvocates(): void { this.drawer.loadMoreAdvocates(); }
  isAdvocateInUserCity(advocate: LawyerPreview): boolean { return this.drawer.isAdvocateInUserCity(advocate); }
  isStrongMatch(advocate: LawyerPreview): boolean { return this.drawer.isStrongMatch(advocate); }
  formatLanguagesShort(langs?: string[]): string { return this.drawer.formatLanguagesShort(langs); }
  referLawyerViaWhatsApp(advocate: LawyerPreview): void { this.drawer.referLawyerViaWhatsApp(advocate); }
  handleConsult(advocate: LawyerPreview): void { this.drawer.handleConsult(advocate); }
  trackByAdvocateId(_index: number, advocate: LawyerPreview): string { return advocate?._id || String(_index); }
}