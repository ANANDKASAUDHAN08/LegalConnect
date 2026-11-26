import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PracticeArea } from '../../../../services/practice-areas.service';
import { CategoryColorTheme } from '../../specializations.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { IconComponent } from '../../../../components/icon/icon.component';

@Component({
  selector: 'app-specialization-card',
  standalone: true,
  imports: [CommonModule, TooltipDirective, IconComponent],
  templateUrl: './specialization-card.component.html',
  styleUrls: ['./specialization-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpecializationCardComponent {
  @Input({ required: true }) spec!: PracticeArea;
  @Input({ required: true }) theme!: CategoryColorTheme;
  @Input() isPinned = false;
  @Input() isHighlighted = false;
  @Input() isHindi = false;
  @Input() viewMode: 'grid' | 'grouped' = 'grid';

  @Output() cardClick = new EventEmitter<PracticeArea>();
  @Output() pinToggle = new EventEmitter<{ spec: PracticeArea; event: Event }>();
  @Output() printClick = new EventEmitter<{ spec: PracticeArea; event: Event }>();
  @Output() findAdvocatesClick = new EventEmitter<{ spec: PracticeArea; event: Event }>();

  private readonly acronymMap: Record<string, string> = {
    'ndps': 'Narcotic Drugs & Psychotropic Substances Act',
    'bns': 'Bharatiya Nyaya Sanhita (New Criminal Law)',
    'bnss': 'Bharatiya Nagarik Suraksha Sanhita (New Procedural Law)',
    'bsa': 'Bharatiya Sakshya Adhiniyam (New Evidence Law)',
    'nclt': 'National Company Law Tribunal (Corporate Insolvency)',
    'nclat': 'National Company Law Appellate Tribunal',
    'fema': 'Foreign Exchange Management Act',
    'sebi': 'Securities & Exchange Board of India',
    'drts': 'Debt Recovery Tribunals',
    'drt': 'Debt Recovery Tribunal',
    'rera': 'Real Estate Regulatory Authority',
    'it act': 'Information Technology Act',
    'sec 66d': 'Section 66D IT Act: Cyber Fraud & Impersonation',
    'ibc': 'Insolvency and Bankruptcy Code',
    'sarfaesi': 'Securitisation and Asset Reconstruction Act'
  };

  getDisplayName(): string {
    if (this.isHindi && this.spec.name_hi) return this.spec.name_hi;
    return this.spec.name;
  }

  getDisplayDescription(): string {
    if (this.isHindi && this.spec.description_hi) return this.spec.description_hi;
    return this.spec.description;
  }

  getTopCitiesString(): string {
    if (!this.spec.topCities || this.spec.topCities.length === 0) return '';
    return this.spec.topCities.slice(0, 3).map(c => c.city).join(', ');
  }

  get visibleSubfields(): string[] {
    return (this.spec?.subfields || []).slice(0, 3);
  }

  get remainingSubfieldsCount(): number {
    return Math.max(0, (this.spec?.subfields || []).length - 3);
  }

  getRelevantActsString(): string {
    if (!this.spec.relevantActs || this.spec.relevantActs.length === 0) return '';
    return this.spec.relevantActs.slice(0, 2).join(', ');
  }

  getAcronymTooltip(field: string): string {
    const clean = field.toLowerCase().trim();
    for (const [key, desc] of Object.entries(this.acronymMap)) {
      if (clean.includes(key)) {
        return `${field}: ${desc}`;
      }
    }
    return `Specialized subfield: ${field}`;
  }

  onCardClick(event?: Event) {
    if (event) {
      if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
    }
    this.cardClick.emit(this.spec);
  }

  onPinToggle(event: Event) {
    event.stopPropagation();
    this.pinToggle.emit({ spec: this.spec, event });
  }

  onPrintClick(event: Event) {
    event.stopPropagation();
    this.printClick.emit({ spec: this.spec, event });
  }

  onFindAdvocates(event: Event) {
    event.stopPropagation();
    this.findAdvocatesClick.emit({ spec: this.spec, event });
  }

  trackByString(_index: number, item: string): string {
    return item;
  }
}