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
import { Title, Meta } from '@angular/platform-browser';
import {
  RightsService,
  StatutoryRight,
  RightsCategoryCount
} from '../../services/rights.service';
import { SnackbarService } from '../../services/snackbar.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { IconComponent } from '../../components/icon/icon.component';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-rights',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TooltipDirective, IconComponent],
  templateUrl: './rights.component.html',
  styleUrls: ['./rights.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RightsComponent implements OnInit, OnDestroy {
  rightsService = inject(RightsService);
  private snackbar = inject(SnackbarService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private title = inject(Title);
  private meta = inject(Meta);

  // Filtering & View State
  searchQuery = signal<string>('');
  selectedCategory = signal<string>('All');
  showOnlyBookmarked = signal<boolean>(false);
  expandedRightId = signal<string | null>(null);
  isMobileFilterOpen = signal<boolean>(false);

  private searchSubject = new Subject<string>();
  private searchSub!: Subscription;
  private routeSub!: Subscription;

  // Filtered computed list
  filteredRights = computed(() => {
    let list = this.rightsService.rights();
    const cat = this.selectedCategory();
    const query = this.searchQuery().toLowerCase().trim();
    const bookmarksOnly = this.showOnlyBookmarked();
    const bookmarkedIds = this.rightsService.bookmarkedIds();

    if (bookmarksOnly) {
      list = list.filter(r => bookmarkedIds.includes(r.id));
    }

    if (cat !== 'All') {
      list = list.filter(r => r.category.toLowerCase() === cat.toLowerCase());
    }

    if (query) {
      list = list.filter(r =>
        r.title.toLowerCase().includes(query) ||
        r.summary.toLowerCase().includes(query) ||
        r.category.toLowerCase().includes(query) ||
        r.statutoryBasis.actName.toLowerCase().includes(query) ||
        r.statutoryBasis.sections.some(s => s.toLowerCase().includes(query)) ||
        r.keyProtections.some(p => p.toLowerCase().includes(query)) ||
        r.actionableSteps.some(a => a.toLowerCase().includes(query)) ||
        (r.penaltiesForViolation && r.penaltiesForViolation.toLowerCase().includes(query))
      );
    }

    return list;
  });

  ngOnInit() {
    this.title.setTitle('Citizen Rights & Legal Safeguards Library | LegalConnect');
    this.meta.updateTag({
      name: 'description',
      content: 'Verified Indian statutory constitutional rights, police detainment safeguards, tenant rights, consumer protection, and DPDP digital privacy laws.'
    });

    this.searchSub = this.searchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged()
    ).subscribe(val => {
      this.searchQuery.set(val);
    });

    this.loadData();

    this.routeSub = this.route.fragment.subscribe(fragment => {
      if (fragment) {
        this.expandedRightId.set(fragment);
        setTimeout(() => {
          const el = document.getElementById(fragment);
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
    this.rightsService.fetchRights(
      this.selectedCategory(),
      this.searchQuery()
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
    this.showOnlyBookmarked.set(false);
    this.loadData();
  }

  toggleBookmarksOnly() {
    this.showOnlyBookmarked.set(!this.showOnlyBookmarked());
    if (this.showOnlyBookmarked()) {
      this.selectedCategory.set('All');
    }
  }

  toggleAccordion(id: string) {
    if (this.expandedRightId() === id) {
      this.expandedRightId.set(null);
    } else {
      this.expandedRightId.set(id);
    }
  }

  expandAll() {
    // If list has items, expand the first 5 or active
    const list = this.filteredRights();
    if (list.length > 0) {
      this.expandedRightId.set(list[0].id);
      this.snackbar.show('Showing first expanded statutory right.', 'info');
    }
  }

  collapseAll() {
    this.expandedRightId.set(null);
  }

  toggleBookmark(right: StatutoryRight, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.rightsService.toggleBookmark(right.id, right.title);
  }

  isBookmarked(id: string): boolean {
    return this.rightsService.isBookmarked(id);
  }

  shareRight(right: StatutoryRight, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    const shareUrl = `${window.location.origin}/rights#${right.id}`;
    if (navigator.share) {
      navigator.share({
        title: right.title,
        text: `${right.title} - Indian Legal Rights Guide via LegalConnect: ${right.summary}`,
        url: shareUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        this.snackbar.show(`Share link copied to clipboard for "${right.title}".`, 'success');
      }).catch(() => {
        this.snackbar.show('Failed to copy link.', 'warning');
      });
    }
  }

  printGuide() {
    window.print();
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

  findAdvocatesForRight(category: string) {
    this.router.navigate(['/lawyers'], {
      queryParams: { specialization: category }
    });
  }

  formatDate(dateStr: string | Date): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
}
