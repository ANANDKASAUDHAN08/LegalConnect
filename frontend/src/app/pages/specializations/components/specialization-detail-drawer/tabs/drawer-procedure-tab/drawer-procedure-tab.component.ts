import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../../../directives/tooltip.directive';
import { DRAWER_CONTEXT, IDrawerContext } from '../../drawer-context';

@Component({
  selector: 'app-drawer-procedure-tab',
  standalone: true,
  imports: [CommonModule, IconComponent, TooltipDirective],
  templateUrl: './drawer-procedure-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrawerProcedureTabComponent {
  readonly drawer: IDrawerContext = inject(DRAWER_CONTEXT);

  get spec() { return this.drawer.spec!; }
  get isHindi() { return this.drawer.isHindi; }

  // Signals & Computeds
  get expectedTimelines() { return this.drawer.expectedTimelines; }
  get headings() { return this.drawer.headings; }
  get activeMatter() { return this.drawer.activeMatter; }
  get activeFaqIndex() { return this.drawer.activeFaqIndex; }

  // Actions
  toggleFaq(i: number): void { this.drawer.toggleFaq(i); }
  toggleSpeech(text: string, key: string): void { this.drawer.toggleSpeech(text, key); }
  isSpeakingItem(key: string): boolean { return this.drawer.isSpeakingItem(key); }

  // TrackBy functions
  trackByTimeline(_index: number, t: any): string { return t?.court || String(_index); }
  trackByStepStage(_index: number, item: any): string { return item?.stage || String(_index); }
  trackByFaq(_index: number, faq: any): string { return faq?.q || String(_index); }
}