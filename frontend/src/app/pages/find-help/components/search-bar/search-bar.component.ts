import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoryIconComponent } from '../category-icon/category-icon.component';
import { getCategoryColorByName } from '../../config/category-data.config';
import { TooltipDirective } from '../../../../directives/tooltip.directive';

export interface SearchSuggestion {
  category: string;
  subcategory?: string;
  displayName: string;
  isHeader?: boolean;
}

/**
 * Unified search bar with AI/Keyword toggle, voice mic, autocomplete dropdown.
 * REUSABLE between mobile hero and desktop dashboard — eliminates ~400 lines of duplication.
 * 
 * Usage:
 *   <app-search-bar
 *     [isAiMode]="isAiMode" [normalSearchQuery]="normalSearchQuery"
 *     [situationQuery]="situationQuery" [voiceLanguage]="voiceLanguage"
 *     [isRecording]="isRecording" [isAiSolving]="isAiSolving"
 *     [filteredSuggestions]="filteredSuggestions"
 *     [variant]="'desktop'"
 *     (aiModeChange)="isAiMode = $event"
 *     (normalSearchQueryChange)="normalSearchQuery = $event"
 *     (situationQueryChange)="situationQuery = $event"
 *     (searchTriggered)="triggerNormalSearch()"
 *     (aiSearchTriggered)="handleAiSearchInput()"
 *     (inputChanged)="handleNormalSearchInput()"
 *     (voiceToggled)="toggleVoiceRecording()"
 *     (languageToggled)="setVoiceLanguage($event)"
 *     (cleared)="clearSearchQuery()"
 *     (suggestionSelected)="selectSuggestion($event)"
 *   />
 */
@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, CategoryIconComponent, TooltipDirective],
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

  getSuggestionIcon(categoryName: string): string {
    if (!this.categories?.length) return 'question';
    const cat = this.categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    return cat ? cat.icon : 'question';
  }

  trackBySuggestion(_: number, item: SearchSuggestion): string {
    return item.isHeader ? `h_${item.category}` : `s_${item.category}_${item.subcategory}`;
  }
}