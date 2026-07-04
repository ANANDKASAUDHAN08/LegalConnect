import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FreeAidCheckerComponent } from '../free-aid-checker/free-aid-checker.component';

/**
 * Reusable search filters panel — used by both desktop sidebar and mobile bottom sheet.
 * Eliminates ~250 lines of duplicated filter controls.
 * 
 * Usage:
 *   <app-filters-panel [filters]="filters" [resources]="resources" [helplines]="helplines"
 *     [lawyers]="lawyers" [variant]="'desktop'"
 *     (filtersChanged)="applyFilters()" />
 */

export interface FilterState {
  radius: number;
  resourceTypes: {
    LegalAid: boolean;
    Court: boolean;
    GovernmentOffice: boolean;
    Helpline: boolean;
    Lawyer: boolean;
  };
  openNow: boolean;
  languages: {
    English: boolean;
    Hindi: boolean;
    Punjabi: boolean;
    Bengali: boolean;
  };
  verifiedOnly: boolean;
  lawyerGender: string;
  maxConsultationFee: number;
  subcategories: Record<string, boolean>;
}

interface CategoryConfig {
  key: keyof FilterState['resourceTypes'];
  label: string;
  count: number;
}

@Component({
  selector: 'app-filters-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filters-panel.component.html',
  styleUrls: ['./filters-panel.component.scss']
})
export class FiltersPanelComponent implements OnChanges {
  @Input() filters!: FilterState;
  @Input() resources: any[] = [];
  @Input() helplines: any[] = [];
  @Input() lawyers: any[] = [];
  @Input() variant: 'desktop' | 'mobile' = 'desktop';
  @Input() locationQuery = '';
  @Input() allSubcategories: string[] = [];

  // Eligibility checker passthrough
  @Input() eligibilityStep = 0;
  @Input() eligibilityAnswers = { gender: '', income: '', category: '' };
  @Input() isFreeAidEligible = false;

  @Output() filtersChanged = new EventEmitter<void>();
  @Output() changeLocation = new EventEmitter<void>();
  @Output() resetFilters = new EventEmitter<void>();
  @Output() startCheck = new EventEmitter<void>();
  @Output() submitStep = new EventEmitter<void>();
  @Output() resetCheck = new EventEmitter<void>();

  readonly radiusOptions = [5, 10, 25, 50];
  readonly languageOptions = ['English', 'Hindi', 'Punjabi', 'Bengali'];
  readonly feeOptions = [500, 1500, 3000, 5000];
  readonly genderOptions = ['Any', 'Female', 'Male'];

  toggleSubcategory(subcat: string) {
    if (!this.filters.subcategories) {
      this.filters.subcategories = {};
    }
    this.filters.subcategories[subcat] = !this.filters.subcategories[subcat];
    this.onFilterChange();
  }

  isSubcategoryActive(subcat: string): boolean {
    return !!(this.filters.subcategories && this.filters.subcategories[subcat]);
  }

  readonly categoryKeys: (keyof FilterState['resourceTypes'])[] = [
    'LegalAid',
    'Court',
    'GovernmentOffice',
    'Helpline',
    'Lawyer'
  ];

  categoryConfigs: CategoryConfig[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['resources'] || changes['helplines'] || changes['lawyers'] || !this.categoryConfigs.length) {
      this.precomputeCategories();
    }
  }

  private precomputeCategories(): void {
    this.categoryConfigs = this.categoryKeys.map(key => ({
      key,
      label: this.getCategoryLabel(key),
      count: this.getCategoryCount(key)
    }));
  }

  getCategoryLabel(key: keyof FilterState['resourceTypes']): string {
    switch (key) {
      case 'LegalAid': return 'Legal Aid Centres';
      case 'Court': return 'District Courts';
      case 'GovernmentOffice': return 'Gov & Police Offices';
      case 'Helpline': return 'Emergency Hotlines';
      case 'Lawyer': return 'Verified Lawyers';
    }
  }

  getCategoryCount(key: keyof FilterState['resourceTypes']): number {
    switch (key) {
      case 'LegalAid':
        return this.resources.filter(r => r.type === 'LegalAid').length;
      case 'Court':
        return this.resources.filter(r => r.type === 'Court').length;
      case 'GovernmentOffice':
        return this.resources.filter(r => r.type === 'GovernmentOffice' || r.type === 'PoliceStation').length;
      case 'Helpline':
        return this.helplines.length;
      case 'Lawyer':
        return this.lawyers.length;
    }
  }

  onFilterChange() {
    this.filtersChanged.emit();
  }

  get allResourcesSelected(): boolean {
    return this.categoryKeys.every(key => this.filters.resourceTypes[key]);
  }

  set allResourcesSelected(val: boolean) {
    this.categoryKeys.forEach(key => {
      if (this.isFreeAidEligible && key !== 'LegalAid') {
        return;
      }
      this.filters.resourceTypes[key] = val;
    });
  }

  get totalResourcesCount(): number {
    return this.categoryConfigs.reduce((sum, config) => sum + config.count, 0);
  }

  toggleAllResources(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.allResourcesSelected = checked;
    this.onFilterChange();
  }

  toggleLanguage(lang: string) {
    const langs = this.filters.languages as any;
    if (langs.hasOwnProperty(lang)) {
      langs[lang] = !langs[lang];
      this.onFilterChange();
    }
  }

  isLanguageActive(lang: string): boolean {
    return !!(this.filters.languages as any)[lang];
  }

  trackByKey(index: number, item: any): string {
    return item.key;
  }

  trackByIndex(index: number): number {
    return index;
  }
}