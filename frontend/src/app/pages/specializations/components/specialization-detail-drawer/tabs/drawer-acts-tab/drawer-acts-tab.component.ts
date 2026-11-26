import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../../../directives/tooltip.directive';
import { DRAWER_CONTEXT, IDrawerContext } from '../../drawer-context';
import { ResolvedBareAct } from '../../../../../../services/practice-areas.service';

@Component({
  selector: 'app-drawer-acts-tab',
  standalone: true,
  imports: [CommonModule, IconComponent, TooltipDirective],
  templateUrl: './drawer-acts-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrawerActsTabComponent {
  readonly drawer: IDrawerContext = inject(DRAWER_CONTEXT);

  get spec() { return this.drawer.spec!; }
  get statuteResolver() { return this.drawer.statuteResolver; }

  getBrowseLawsUrl(): string { return this.drawer.getBrowseLawsUrl(); }
  onBrowseLaws(event: MouseEvent): void { this.drawer.onBrowseLaws(event); }
  trackByActName(_index: number, act: ResolvedBareAct | any): string { return act?.shortName || act?.name || (typeof act === 'string' ? act : String(_index)); }
  trackByString(_index: number, str: string): string { return str; }
  copySectionRef(act: ResolvedBareAct): void { this.drawer.copySectionRef(act); }
  hasNote(key: string): boolean { return this.drawer.hasNote(key); }
  openNoteEditor(key: string, title: string, category: 'statute' | 'case' | 'general'): void { this.drawer.openNoteEditor(key, title, category); }
  getActYear(act: ResolvedBareAct | string): string { return this.drawer.getActYear(act); }
  getActUrl(act: ResolvedBareAct | string): string { return this.drawer.getActUrl(act); }
  openBareAct(act: ResolvedBareAct | string, event: MouseEvent): void { this.drawer.openBareAct(act, event); }
  copyToClipboard(text: string, msg?: string): void { this.drawer.copyToClipboard(text, msg); }
}