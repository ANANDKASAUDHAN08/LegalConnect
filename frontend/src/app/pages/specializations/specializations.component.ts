import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  PracticeAreasService,
  PracticeArea,
  PracticeCategoryCount
} from '../../services/practice-areas.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { IconComponent } from '../../components/icon/icon.component';
import { IconName } from '../../components/icon/icon.types';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Title, Meta } from '@angular/platform-browser';

@Component({
  selector: 'app-specializations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TooltipDirective, IconComponent],
  templateUrl: './specializations.component.html',
  styleUrls: ['./specializations.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpecializationsComponent implements OnInit, OnDestroy {
  practiceService = inject(PracticeAreasService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private title = inject(Title);
  private meta = inject(Meta);

  // Search & Filter State
  searchQuery = signal<string>('');
  selectedCategory = signal<string>('All');
  selectedSort = signal<'popular' | 'alpha-asc' | 'alpha-desc' | 'advocates'>('popular');
  viewMode = signal<'grid' | 'grouped'>('grid');
  targetCardHighlight = signal<string>('');

  // Mobile Filter Drawer
  isMobileFilterOpen = signal<boolean>(false);

  private searchSubject = new Subject<string>();
  private searchSub!: Subscription;
  private routeSub!: Subscription;

  // Computed filtered list
  filteredPracticeAreas = computed(() => {
    let list = this.practiceService.practiceAreas();
    const cat = this.selectedCategory();
    const query = this.searchQuery().toLowerCase().trim();
    const sort = this.selectedSort();

    if (cat !== 'All') {
      list = list.filter(p => p.category.toLowerCase() === cat.toLowerCase());
    }

    if (query) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        p.subfields.some(s => s.toLowerCase().includes(query)) ||
        p.relevantActs?.some(a => a.toLowerCase().includes(query)) ||
        p.typicalForums?.some(f => f.toLowerCase().includes(query))
      );
    }

    // Sort
    const sorted = [...list];
    if (sort === 'alpha-asc') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'alpha-desc') {
      sorted.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sort === 'advocates') {
      sorted.sort((a, b) => (b.advocateCount || 0) - (a.advocateCount || 0));
    } else {
      sorted.sort((a, b) => {
        if (a.popular && !b.popular) return -1;
        if (!a.popular && b.popular) return 1;
        return (b.advocateCount || 0) - (a.advocateCount || 0);
      });
    }

    return sorted;
  });

  // Grouped by Category computed signal
  groupedPracticeAreas = computed(() => {
    const list = this.filteredPracticeAreas();
    const map = new Map<string, PracticeArea[]>();

    list.forEach(item => {
      const existing = map.get(item.category) || [];
      existing.push(item);
      map.set(item.category, existing);
    });

    return Array.from(map.entries()).map(([category, items]) => ({
      category,
      items
    }));
  });

  ngOnInit() {
    this.title.setTitle('Legal Practice Areas & Specializations | LegalConnect');
    this.meta.updateTag({
      name: 'description',
      content: 'Explore Indian legal practice areas including Property Disputes, Criminal Law, Cyber Crime, Family Law, Corporate Governance, and find verified advocates.'
    });

    this.searchSub = this.searchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged()
    ).subscribe(val => {
      this.searchQuery.set(val);
    });

    this.loadData();

    this.routeSub = this.route.queryParams.subscribe(params => {
      if (params['category']) {
        this.selectedCategory.set(params['category']);
      }
      if (params['name']) {
        this.targetCardHighlight.set(params['name']);
        setTimeout(() => {
          const el = document.getElementById(params['name']);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);
      }
    });
  }

  ngOnDestroy() {
    if (this.searchSub) {
      this.searchSub.unsubscribe();
    }
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
    if (typeof document !== 'undefined') {
      document.body.classList.remove('sheet-open');
    }
  }

  loadData() {
    this.practiceService.fetchPracticeAreas(
      this.selectedCategory(),
      this.searchQuery(),
      this.selectedSort()
    ).subscribe();
  }

  onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchSubject.next(input.value);
  }

  clearSearch() {
    this.searchQuery.set('');
    this.searchSubject.next('');
  }

  setCategory(category: string) {
    this.selectedCategory.set(category);
    this.loadData();
  }

  setSort(sort: 'popular' | 'alpha-asc' | 'alpha-desc' | 'advocates') {
    this.selectedSort.set(sort);
  }

  toggleViewMode() {
    this.viewMode.set(this.viewMode() === 'grid' ? 'grouped' : 'grid');
  }

  openMobileFilter() {
    this.isMobileFilterOpen.set(true);
    if (typeof document !== 'undefined') {
      document.body.classList.add('sheet-open');
    }
  }

  closeMobileFilter() {
    this.isMobileFilterOpen.set(false);
    if (typeof document !== 'undefined') {
      document.body.classList.remove('sheet-open');
    }
  }

  applyMobileFilter(cat: string, sort: 'popular' | 'alpha-asc' | 'alpha-desc' | 'advocates') {
    this.selectedCategory.set(cat);
    this.selectedSort.set(sort);
    this.closeMobileFilter();
    this.loadData();
  }

  findAdvocates(specName: string) {
    this.router.navigate(['/lawyers'], {
      queryParams: { specialization: specName }
    });
  }
}