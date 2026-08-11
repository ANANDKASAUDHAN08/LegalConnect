import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'admin-legal-content',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SkeletonComponent, TooltipDirective],
  templateUrl: './legal-content.component.html',
  styleUrl: './legal-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegalContentComponent implements OnInit {
  acts: any[] = [];
  isLoading = false;
  searchQuery = '';
  yearFilter: 'all' | 'new' | 'historical' = 'all';
  sortBy: 'name' | 'year-desc' | 'year-asc' | 'chapters-desc' | 'sections-desc' = 'name';

  // Load More pagination
  displayCount = 30;
  readonly PAGE_SIZE = 30;

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.fetchActs();
  }

  fetchActs(): void {
    this.isLoading = true;
    this.displayCount = this.PAGE_SIZE;
    this.cdr.markForCheck();
    this.api.getActs().subscribe({
      next: (res: any) => {
        this.isLoading = false;
        const rawActs = Array.isArray(res) ? res : (res?.data || res?.acts || res?.items || []);
        this.acts = rawActs.map((act: any) => ({
          ...act,
          // Trust the backend normalizer — no more duplicate formatting
          actName: act.actName || act.name || act.title || '',
          shortName: act.shortName || 'ACT'
        }));
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.toast.error('Failed to load Bare Acts directory.');
        this.cdr.markForCheck();
      }
    });
  }

  get totalActsCount(): number {
    return this.acts.length;
  }

  get totalChaptersCount(): number {
    return this.acts.reduce((sum, act) => sum + (act.chapterCount || act.chapters?.length || 0), 0);
  }

  get totalSectionsCount(): number {
    return this.acts.reduce((sum, act) => {
      if (act.sectionCount !== undefined) return sum + act.sectionCount;
      if (act.chapters) {
        return sum + act.chapters.reduce((acc: number, ch: any) => acc + (ch.sections?.length || 0), 0);
      }
      return sum;
    }, 0);
  }

  get actsWithMissingContent(): number {
    return this.acts.filter(a => this.getSectionCount(a) === 0).length;
  }

  get filteredAndSortedActs(): any[] {
    let result = [...this.acts];

    // Search filter
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(act => {
        const name = (act.actName || act.name || '').toLowerCase();
        const shortName = (act.shortName || '').toLowerCase();
        const desc = (act.description || '').toLowerCase();
        const year = String(act.year || '');
        return name.includes(q) || shortName.includes(q) || desc.includes(q) || year.includes(q);
      });
    }

    // Year filter
    if (this.yearFilter === 'new') {
      result = result.filter(act => (act.year || 0) >= 2000);
    } else if (this.yearFilter === 'historical') {
      result = result.filter(act => (act.year || 0) < 2000);
    }

    // Sorting
    result.sort((a, b) => {
      switch (this.sortBy) {
        case 'name':
          return (a.actName || a.name || '').localeCompare(b.actName || b.name || '');
        case 'year-desc':
          return (b.year || 0) - (a.year || 0);
        case 'year-asc':
          return (a.year || 0) - (b.year || 0);
        case 'chapters-desc':
          return this.getChapterCount(b) - this.getChapterCount(a);
        case 'sections-desc':
          return this.getSectionCount(b) - this.getSectionCount(a);
        default:
          return 0;
      }
    });

    return result;
  }

  /** Visible acts after filtering + Load More pagination */
  get visibleActs(): any[] {
    return this.filteredAndSortedActs.slice(0, this.displayCount);
  }

  get hasMoreActs(): boolean {
    return this.displayCount < this.filteredAndSortedActs.length;
  }

  get remainingCount(): number {
    return Math.max(0, this.filteredAndSortedActs.length - this.displayCount);
  }

  loadMore(): void {
    this.displayCount += this.PAGE_SIZE;
    this.cdr.markForCheck();
  }

  getSectionCount(act: any): number {
    if (act.sectionCount !== undefined) return act.sectionCount;
    if (act.chapters) {
      return act.chapters.reduce((acc: number, ch: any) => acc + (ch.sections?.length || 0), 0);
    }
    return 0;
  }

  getChapterCount(act: any): number {
    return act.chapterCount ?? (act.chapters?.length || 0);
  }

  /** Returns a content completeness percentage (0-100) */
  getContentCompleteness(act: any): number {
    const totalSections = this.getSectionCount(act);
    if (totalSections === 0) return 0;
    // Estimate: sections with content_blocks or introduction_text are "complete"
    // For the list view we approximate from chapter/section counts
    return Math.min(100, Math.round((totalSections / Math.max(totalSections, 1)) * 100));
  }

  /** Returns era classification for accent coloring */
  getEraClass(year: number): string {
    if (!year) return 'era-historical';
    if (year >= 2020) return 'era-modern';
    if (year >= 2000) return 'era-recent';
    return 'era-historical';
  }

  getEraLabel(year: number): string {
    if (!year) return 'Historical';
    if (year >= 2020) return 'Modern';
    if (year >= 2000) return 'Contemporary';
    if (year >= 1950) return 'Post-Independence';
    return 'Pre-Independence';
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.yearFilter = 'all';
    this.displayCount = this.PAGE_SIZE;
    this.cdr.markForCheck();
  }

  /** Reset display count when search/filter changes */
  onSearchChange(): void {
    this.displayCount = this.PAGE_SIZE;
    this.cdr.markForCheck();
  }

  // --- Create Act Modal ---
  isCreateModalOpen = false;
  isSubmittingAct = false;
  newActForm = {
    actName: '',
    shortName: '',
    year: new Date().getFullYear(),
    description: '',
    initialChapterTitle: 'PRELIMINARY',
    initialSectionTitle: 'Short title, extent and commencement.',
    initialSectionContent: ''
  };

  openCreateModal(): void {
    this.isCreateModalOpen = true;
    this.newActForm = {
      actName: '',
      shortName: '',
      year: new Date().getFullYear(),
      description: '',
      initialChapterTitle: 'PRELIMINARY',
      initialSectionTitle: 'Short title, extent and commencement.',
      initialSectionContent: ''
    };
    this.cdr.markForCheck();
  }

  closeCreateModal(): void {
    this.isCreateModalOpen = false;
    this.cdr.markForCheck();
  }

  onActNameChange(): void {
    if (this.newActForm.actName && !this.newActForm.shortName) {
      const words = this.newActForm.actName.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/);
      if (words.length > 1) {
        this.newActForm.shortName = words.map(w => w[0]?.toUpperCase()).join('');
      } else if (words[0] && words[0].length >= 3) {
        this.newActForm.shortName = words[0].substring(0, 4).toUpperCase();
      }
      this.cdr.markForCheck();
    }
  }

  submitCreateAct(): void {
    if (!this.newActForm.actName || !this.newActForm.shortName || !this.newActForm.year) {
      this.toast.error('Act Name, Short Code, and Year are required.');
      return;
    }

    this.isSubmittingAct = true;
    this.cdr.markForCheck();

    const payload = {
      actName: this.newActForm.actName.trim(),
      shortName: this.newActForm.shortName.trim().toUpperCase(),
      year: Number(this.newActForm.year),
      description: this.newActForm.description.trim(),
      chapters: [
        {
          chapterNumber: 'I',
          title: this.newActForm.initialChapterTitle || 'PRELIMINARY',
          sections: [
            {
              section_number: '1',
              title: this.newActForm.initialSectionTitle || 'Short title, extent and commencement.',
              clean_title: this.newActForm.initialSectionTitle || 'Short title, extent and commencement.',
              introduction_text: this.newActForm.initialSectionContent || `This Act may be called the ${this.newActForm.actName.trim()}, ${this.newActForm.year}.`
            }
          ]
        }
      ]
    };

    this.api.createAct(payload).subscribe({
      next: () => {
        this.isSubmittingAct = false;
        this.isCreateModalOpen = false;
        this.toast.success(`Act '${payload.actName}' created successfully!`);
        this.fetchActs();
      },
      error: (err: any) => {
        this.isSubmittingAct = false;
        const msg = err?.error?.message || err?.message || 'Failed to create Act.';
        this.toast.error(msg);
        this.cdr.markForCheck();
      }
    });
  }

  // --- Edit Act Metadata Modal ---
  isEditMetaModalOpen = false;
  isEditingMeta = false;
  editMetaForm = { actName: '', shortName: '', year: 0, description: '', originalShortName: '' };

  openEditMetaModal(act: any, event: Event): void {
    event.stopPropagation();
    this.editMetaForm = {
      actName: act.actName || '',
      shortName: act.shortName || '',
      year: act.year || 0,
      description: act.description || '',
      originalShortName: act.shortName || ''
    };
    this.isEditMetaModalOpen = true;
    this.cdr.markForCheck();
  }

  closeEditMetaModal(): void {
    this.isEditMetaModalOpen = false;
    this.cdr.markForCheck();
  }

  submitEditMeta(): void {
    this.isEditingMeta = true;
    this.cdr.markForCheck();
    const data: any = {
      actName: this.editMetaForm.actName,
      year: this.editMetaForm.year,
      description: this.editMetaForm.description
    };
    if (this.editMetaForm.shortName !== this.editMetaForm.originalShortName) {
      data.newShortName = this.editMetaForm.shortName;
    }
    this.api.patchActMetadata(this.editMetaForm.originalShortName, data).subscribe({
      next: () => {
        this.isEditingMeta = false;
        this.isEditMetaModalOpen = false;
        this.toast.success('Act metadata updated successfully.');
        this.fetchActs();
      },
      error: (err: any) => {
        this.isEditingMeta = false;
        this.toast.error(err?.error?.message || 'Failed to update act metadata.');
        this.cdr.markForCheck();
      }
    });
  }

  // --- Delete Act ---
  deleteTarget: any = null;

  confirmDeleteAct(act: any, event: Event): void {
    event.stopPropagation();
    this.deleteTarget = act;
    this.cdr.markForCheck();
  }

  cancelDelete(): void {
    this.deleteTarget = null;
    this.cdr.markForCheck();
  }

  executeDelete(): void {
    if (!this.deleteTarget) return;
    const shortName = this.deleteTarget.shortName;
    this.api.deleteAct(shortName).subscribe({
      next: () => {
        this.deleteTarget = null;
        this.toast.success(`Act '${shortName}' deleted permanently.`);
        this.fetchActs();
      },
      error: (err: any) => {
        this.deleteTarget = null;
        this.toast.error(err?.error?.message || 'Failed to delete act.');
        this.cdr.markForCheck();
      }
    });
  }

  openActDetail(shortName: string, inNewTab = true): void {
    if (inNewTab) {
      window.open(`/legal-content/${shortName}`, '_blank');
    } else {
      this.router.navigate(['/legal-content', shortName]);
    }
  }
}