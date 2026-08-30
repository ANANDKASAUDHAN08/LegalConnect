import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { IconComponent, IconName } from '../../../../components/icon';
import { getCategoryColorByName } from '../../config/category-data.config';

export interface SearchSuggestion {
  category: string;
  subcategory?: string;
  displayName: string;
  isHeader?: boolean;
}

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss']
})
export class SearchBarComponent {
  // State inputs
  @Input() isAiMode = false;
  @Input() normalSearchQuery = '';
  @Input() situationQuery = '';
  @Input() voiceLanguage: 'en-IN' | 'hi-IN' = 'en-IN';
  @Input() isRecording = false;
  @Input() categories: Array<{ name: string; icon: string }> = [];
  @Input() isAiSolving = false;
  @Input() filteredSuggestions: SearchSuggestion[] = [];
  @Input() variant: 'mobile' | 'desktop' = 'desktop';
  @Input() isSearchingSuggestions = false;

  // Two-way binding outputs
  @Output() aiModeChange = new EventEmitter<boolean>();
  @Output() normalSearchQueryChange = new EventEmitter<string>();
  @Output() situationQueryChange = new EventEmitter<string>();

  // Action outputs
  @Output() searchTriggered = new EventEmitter<void>();
  @Output() aiSearchTriggered = new EventEmitter<void>();
  @Output() inputChanged = new EventEmitter<void>();
  @Output() voiceToggled = new EventEmitter<void>();
  @Output() languageToggled = new EventEmitter<'en-IN' | 'hi-IN'>();
  @Output() cleared = new EventEmitter<void>();
  @Output() suggestionSelected = new EventEmitter<SearchSuggestion>();

  get hasQuery(): boolean {
    return this.isAiMode ? !!this.situationQuery?.trim() : !!this.normalSearchQuery?.trim();
  }

  onNormalQueryChange(val: string) {
    this.normalSearchQueryChange.emit(val);
    this.inputChanged.emit();
  }

  onSituationQueryChange(val: string) {
    this.situationQueryChange.emit(val);
  }

  getCategoryColor(category: string): string {
    return getCategoryColorByName(category).text;
  }

  getSuggestionIcon(categoryName: string): IconName {
    if (!this.categories?.length) return 'help-circle';
    const cat = this.categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    const icon = cat?.icon;
    switch (icon) {
      case 'home': return 'home';
      case 'users': return 'users';
      case 'shopping-cart': return 'shopping-cart';
      case 'briefcase': return 'briefcase';
      case 'scale': return 'scale';
      case 'building': return 'building';
      case 'shield': return 'shield';
      default:
        return 'help-circle';
    }
  }

  trackBySuggestion(_: number, item: SearchSuggestion): string {
    return item.isHeader ? `h_${item.category}` : `s_${item.category}_${item.subcategory}`;
  }
}