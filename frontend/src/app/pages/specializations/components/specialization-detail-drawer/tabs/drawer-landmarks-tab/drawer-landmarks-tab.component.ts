import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../../../directives/tooltip.directive';
import { DRAWER_CONTEXT, IDrawerContext } from '../../drawer-context';
import { LandmarkJudgmentPreview } from '../../../../../../services/practice-areas.service';

@Component({
  selector: 'app-drawer-landmarks-tab',
  standalone: true,
  imports: [CommonModule, IconComponent, TooltipDirective],
  templateUrl: './drawer-landmarks-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrawerLandmarksTabComponent {
  readonly drawer: IDrawerContext = inject(DRAWER_CONTEXT);

  get spec() { return this.drawer.spec!; }
  get headings() { return this.drawer.headings; }
  get copiedCitationId() { return this.drawer.copiedCitationId; }

  trackByCaseId(_index: number, item: LandmarkJudgmentPreview): string { return item?.caseId || item?.citation || String(_index); }
  getCourtTier(court: string) { return this.drawer.getCourtTier(court); }
  isHoldingExpanded(caseId: string): boolean { return this.drawer.isHoldingExpanded(caseId); }
  toggleHolding(caseId: string): void { this.drawer.toggleHolding(caseId); }
  copyCitation(item: LandmarkJudgmentPreview, format: 'standard' | 'formal' = 'standard'): void { this.drawer.copyCitation(item, format); }
  openNoteEditor(key: string, title: string, category: 'statute' | 'case' | 'general'): void { this.drawer.openNoteEditor(key, title, category); }
  hasNote(key: string): boolean { return this.drawer.hasNote(key); }
}