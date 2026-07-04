import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Category } from '../../../../services/legal.service';
import { CategoryIconComponent } from '../category-icon/category-icon.component';
import { CategoryClassesPipe } from '../../pipes/category-classes.pipe';
import { CategoryDescriptionPipe } from '../../pipes/category-description.pipe';
import { CategoryInsightsPipe } from '../../pipes/category-insights.pipe';
import { TooltipDirective } from '../../../../directives/tooltip.directive';

@Component({
  selector: 'app-category-grid',
  standalone: true,
  imports: [
    CommonModule,
    CategoryIconComponent,
    CategoryClassesPipe,
    CategoryDescriptionPipe,
    CategoryInsightsPipe,
    TooltipDirective
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-grid.component.html',
  styleUrls: ['./category-grid.component.scss']
})
export class CategoryGridComponent {
  @Input() categories: Category[] = [];
  @Input() activeCategory = '';
  @Input() locationQuery = '';
  @Input() selectedSubcategories: string[] = [];

  @Output() categorySelected = new EventEmitter<string>();
  @Output() subcategoryToggled = new EventEmitter<string>();
  @Output() searchTriggered = new EventEmitter<void>();
  @Output() searchModeToggled = new EventEmitter<void>();
  @Output() aiSuggestionTried = new EventEmitter<string>();

  isDetailsLoading = false;
  activeMobileTab: 'search' | 'faqs' | 'ai' = 'search';
  activeFaqIndex: number | null = null;

  constructor(private cdr: ChangeDetectorRef) { }

  selectCategoryLocal(catId: string) {
    this.triggerHaptic();

    if (this.activeCategory === catId && !this.isDetailsLoading) {
      this.scrollToDetails();
      return;
    }

    this.activeCategory = catId;
    this.isDetailsLoading = true;
    this.activeMobileTab = 'search'; // Reset active tab on category change
    this.activeFaqIndex = null;      // Reset active FAQ accordion
    this.cdr.markForCheck();
    this.scrollToDetails();

    setTimeout(() => {
      this.isDetailsLoading = false;
      this.categorySelected.emit(catId);
      this.cdr.markForCheck();
      setTimeout(() => this.scrollToDetails(), 90);
    }, 450);
  }

  setMobileTab(tab: 'search' | 'faqs' | 'ai') {
    this.activeMobileTab = tab;
    this.triggerHaptic();
    this.cdr.markForCheck();
  }

  toggleFaq(index: number) {
    if (window.innerWidth >= 768) return;
    this.activeFaqIndex = this.activeFaqIndex === index ? null : index;
    this.triggerHaptic();
    this.cdr.markForCheck();
  }

  triggerHaptic() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch (e) { }
    }
  }

  private scrollToDetails() {
    setTimeout(() => {
      const el = document.getElementById('category-details-card');
      if (el) {
        const rect = el.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetY = scrollTop + rect.top - 100; // Perfect header & ticker clearance
        window.scrollTo({
          top: targetY,
          behavior: 'smooth'
        });
      }
    }, 100);
  }

  trackByCategory(_: number, cat: Category): string {
    return cat.id;
  }

  trackBySubcategory(_: number, sub: string): string {
    return sub;
  }

  trackByIndex(index: number): number {
    return index;
  }
}