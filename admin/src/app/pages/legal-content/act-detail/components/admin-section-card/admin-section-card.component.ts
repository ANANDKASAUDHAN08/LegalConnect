import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EnrichedSection, EnrichedClauseNode, EnrichedParsedLegalSection } from '../../act-detail.component';
import { TooltipDirective } from '../../../../../shared/directives/tooltip.directive';
import { HighlightPipe } from '../../../../../shared/pipes/highlight.pipe';

@Component({
  selector: 'admin-section-card',
  standalone: true,
  imports: [CommonModule, TooltipDirective, HighlightPipe],
  templateUrl: './admin-section-card.component.html',
  styleUrl: './admin-section-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminSectionCardComponent {
  @Input({ required: true }) section!: EnrichedSection;
  @Input() searchQuery = '';
  @Input() viewMode: 'structured' | 'raw' = 'structured';
  @Input() activeLanguage: 'en' | 'hi' | 'both' = 'en';
  @Input() splitViewMode: 'stacked' | 'split' = 'stacked';
  @Input() isEditMode = false;
  @Input() isActive = false;
  @Input() isCollapsed = false;
  @Input() showLayman = false;
  @Input() showDefined = true;

  @Output() bookmarkToggle = new EventEmitter<{ secId: string; event?: Event }>();
  @Output() collapseToggle = new EventEmitter<{ secId: string; event?: Event }>();
  @Output() editClick = new EventEmitter<{ section: EnrichedSection; event?: Event }>();
  @Output() printClick = new EventEmitter<{ section: EnrichedSection; event?: Event }>();
  @Output() copyCitationClick = new EventEmitter<{ section: EnrichedSection; event?: Event }>();
  @Output() copyLinkClick = new EventEmitter<{ section: EnrichedSection; event?: Event }>();
  @Output() copyCleanTextClick = new EventEmitter<{ section: EnrichedSection; event?: Event }>();
  @Output() laymanToggle = new EventEmitter<string>();
  @Output() definedTermsToggle = new EventEmitter<string>();
  @Output() footnoteClick = new EventEmitter<string>();

  onBookmark(event?: Event): void {
    event?.stopPropagation();
    this.bookmarkToggle.emit({ secId: this.section.secId, event });
  }

  onToggleCollapse(event?: Event): void {
    event?.stopPropagation();
    this.collapseToggle.emit({ secId: this.section.secId, event });
  }

  onEdit(event?: Event): void {
    event?.stopPropagation();
    this.editClick.emit({ section: this.section, event });
  }

  onPrint(event?: Event): void {
    event?.stopPropagation();
    this.printClick.emit({ section: this.section, event });
  }

  onCopyCitation(event?: Event): void {
    event?.stopPropagation();
    this.copyCitationClick.emit({ section: this.section, event });
  }

  onCopyLink(event?: Event): void {
    event?.stopPropagation();
    this.copyLinkClick.emit({ section: this.section, event });
  }

  onCopyCleanText(event?: Event): void {
    event?.stopPropagation();
    this.copyCleanTextClick.emit({ section: this.section, event });
  }

  onToggleLayman(): void {
    this.laymanToggle.emit(this.section.secId);
  }

  onToggleDefinedTerms(): void {
    this.definedTermsToggle.emit(this.section.secId);
  }

  getCleanBlockText(text: any): string {
    if (text === null || text === undefined) return '';
    if (typeof text === 'string') {
      return text.replace(/\[object\s+Object\]/gi, '').replace(/\{"[^"]*":\s*"[^"]*"\}/g, '').trim();
    }
    try {
      return JSON.stringify(text).replace(/\[object\s+Object\]/gi, '').trim();
    } catch {
      return '';
    }
  }

  get parsedHi(): EnrichedParsedLegalSection | undefined {
    return this.section?.parsed_hi;
  }

  getClauseStyle(_text: string, type?: string): any {
    if (type === 'explanation') {
      return { 'border-left': '3px solid #0ea5e9', 'background-color': 'rgba(14, 165, 233, 0.05)', 'margin-left': '0' };
    }
    if (type === 'illustration') {
      return { 'border-left': '3px solid #10b981', 'background-color': 'rgba(16, 185, 129, 0.05)', 'margin-left': '0' };
    }
    return {};
  }
}