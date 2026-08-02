import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminApiService } from '../../../core/admin-api.service';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'admin-act-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SkeletonComponent, TooltipDirective],
  templateUrl: './act-detail.component.html',
  styleUrl: './act-detail.component.scss'
})
export class ActDetailComponent implements OnInit, OnDestroy {
  shortName = '';
  act: any = null;
  isLoading = false;
  searchQuery = '';
  activeLanguage: 'en' | 'hi' | 'both' = 'en';
  isEditMode = false;
  editingSection: any = null;
  editForm: any = { section_number: '', title: '', title_hi: '', introduction_text: '', introduction_text_hi: '' };
  isSaving = false;
  activeSectionId = '';

  constructor(
    private route: ActivatedRoute,
    private api: AdminApiService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.shortName = params['shortName'];
      if (this.shortName) {
        this.fetchActDetail();
      }
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll.bind(this));
  }

  @HostListener('window:scroll', [])
  onScroll(): void {
    if (!this.act || !this.act.chapters) return;

    const scrollPos = window.scrollY + 180;
    for (const chap of this.act.chapters) {
      for (const sec of chap.sections || []) {
        const secNum = String(sec.section_number || sec.sectionNumber || '');
        const el = document.getElementById(`section-${secNum}`);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            if (this.activeSectionId !== secNum) {
              this.activeSectionId = secNum;
              this.cdr.markForCheck();
            }
            return;
          }
        }
      }
    }
  }

  getSecId(sec: any): string {
    return String(sec.section_number || sec.sectionNumber || '');
  }

  fetchActDetail(): void {
    this.isLoading = true;
    this.api.getActDetail(this.shortName).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.act = res.data || res;
        if (this.act && this.act.chapters && this.act.chapters.length > 0) {
          const firstSec = this.act.chapters[0].sections?.[0];
          if (firstSec) {
            this.activeSectionId = String(firstSec.section_number || firstSec.sectionNumber);
          }
        }
      },
      error: (err: any) => {
        this.isLoading = false;
        this.toast.error('Failed to load Act details.');
      }
    });
  }

  get filteredChapters(): any[] {
    if (!this.act || !this.act.chapters) return [];
    if (!this.searchQuery.trim()) return this.act.chapters;

    const q = this.searchQuery.toLowerCase().trim();
    return this.act.chapters.map((chap: any) => {
      const matchingSections = (chap.sections || []).filter((sec: any) => {
        const secNum = String(sec.section_number || sec.sectionNumber || '').toLowerCase();
        const title = String(sec.title || '').toLowerCase();
        const titleHi = String(sec.title_hi || '').toLowerCase();
        return secNum.includes(q) || title.includes(q) || titleHi.includes(q);
      });
      return { ...chap, sections: matchingSections };
    }).filter((chap: any) => chap.sections.length > 0);
  }

  getCleanTitle(sec: any): string {
    const raw = sec.clean_title || sec.title || '';
    if (!raw) return 'Section ' + (sec.section_number || sec.sectionNumber || '');
    if (raw.includes('.-')) {
      const titlePart = raw.split('.-')[0];
      return titlePart.replace(/^Sec(tion)?\s*\d+[\s:.\-]*/i, '').trim();
    }
    return raw.replace(/^Sec(tion)?\s*\d+[\s:.\-]*/i, '').trim();
  }

  getCleanBody(sec: any): string {
    const fullContent = sec.content || sec.introduction_text || sec.text || '';
    if (fullContent && fullContent.trim().length > 5) {
      const cleaned = fullContent.replace(/^(February|January|March|April|May|June|July|August|September|October|November|December),\s*\d{4},?\s*see Gazette of India.*?\.\s*/i, '').trim();
      return cleaned || fullContent.trim();
    }
    const raw = sec.title || '';
    if (raw.includes('.-')) {
      const parts = raw.split('.-');
      if (parts.length > 1) {
        return parts.slice(1).join('.-').trim();
      }
    }
    return fullContent || raw || 'Statutory provision text registered in database.';
  }

  LEVEL_PALETTE = [
    { border: '#6366f1', bg: 'rgba(99, 102, 241, 0.05)', text: '#a5b4fc' }, // Level 1: Indigo
    { border: '#10b981', bg: 'rgba(16, 185, 129, 0.05)', text: '#6ee7b7' }, // Level 2: Emerald Green
    { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.05)', text: '#fde047' }, // Level 3: Amber Gold
    { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.05)', text: '#67e8f9' },  // Level 4: Cyan
    { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.05)', text: '#f472b6' }, // Level 5: Rose Pink
    { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.05)', text: '#c084fc' }, // Level 6: Purple
    { border: '#14b8a6', bg: 'rgba(20, 184, 166, 0.05)', text: '#5eead4' }, // Level 7: Teal
    { border: '#f97316', bg: 'rgba(249, 115, 22, 0.05)', text: '#ff8a65' }  // Level 8+: Orange
  ];

  getClauseLevel(text: string): number {
    if (!text) return 1;
    const trimmed = text.trim();

    // Level 5+: Double letters or compound (aa), (bb), (i-A), etc.
    if (/^\([a-z]{2,3}\)/i.test(trimmed) && !/^\((?:ii|iii|iv|vi|vii|viii|ix|xi|xii|xiii|xiv|xv)\)/i.test(trimmed)) {
      return 5;
    }
    // Level 4: Capital letters (A), (B), (C)...
    if (/^\([A-Z]\)/.test(trimmed)) {
      return 4;
    }
    // Level 3: Lowercase Roman numerals (i), (ii), (iii), (iv)...
    if (/^\((?:i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv)\)/i.test(trimmed)) {
      return 3;
    }
    // Level 2: Lowercase alphabetic letters (a), (b), (c)... or a.
    if (/^\([a-z]\)/i.test(trimmed) || /^[a-z]\.\s/i.test(trimmed)) {
      return 2;
    }
    // Level 1: Numbers (1), (2), (3A)... or 1., 2.
    if (/^\(\d+[a-z]*\)/i.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      return 1;
    }

    return 1;
  }

  getClauseStyle(text: string, type?: string): any {
    if (type === 'explanation') {
      return { 'border-left': '3px solid #f59e0b', 'background-color': 'rgba(245, 158, 11, 0.06)', 'margin-left': '0' };
    }
    if (type === 'illustration') {
      return { 'border-left': '3px solid #0ea5e9', 'background-color': 'rgba(14, 165, 233, 0.06)', 'margin-left': '0' };
    }

    const level = this.getClauseLevel(text);
    const colorTheme = this.LEVEL_PALETTE[(level - 1) % this.LEVEL_PALETTE.length];
    // Cap indent at max 3.5rem so deep levels 5-10 never cause clipping on small screens
    const indentRem = Math.min((level - 1) * 1.1, 3.5);

    return {
      'border-left': `3px solid ${colorTheme.border}`,
      'background-color': colorTheme.bg,
      'margin-left': `${indentRem}rem`
    };
  }

  scrollToSection(secNum: string): void {
    this.activeSectionId = String(secNum);
    const el = document.getElementById(`section-${secNum}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  copySectionCitation(sec: any): void {
    const secNum = sec.section_number || sec.sectionNumber;
    const title = this.getCleanTitle(sec);
    const citation = `Section ${secNum}, ${this.act?.actName || this.shortName} (${this.act?.year || ''}): "${title}"`;
    navigator.clipboard.writeText(citation).then(() => {
      this.toast.success(`Copied citation for Section ${secNum}!`);
    });
  }

  copySectionLink(sec: any): void {
    const secNum = sec.section_number || sec.sectionNumber;
    const url = `${window.location.origin}/legal-content/${this.shortName}#section-${secNum}`;
    navigator.clipboard.writeText(url).then(() => {
      this.toast.success(`Direct section link copied to clipboard!`);
    });
  }

  openEditSection(sec: any): void {
    this.editingSection = sec;
    this.editForm = {
      section_number: sec.section_number || sec.sectionNumber || '',
      title: this.getCleanTitle(sec),
      title_hi: sec.title_hi || '',
      introduction_text: sec.content || sec.introduction_text || sec.text || '',
      introduction_text_hi: sec.content_hi || sec.introduction_text_hi || sec.text_hi || ''
    };
  }

  saveSectionEdit(): void {
    if (!this.editingSection) return;
    this.isSaving = true;

    this.api.updateSection(this.shortName, this.editingSection._id || this.editingSection.id || this.editForm.section_number, this.editForm).subscribe({
      next: () => {
        this.isSaving = false;
        this.editingSection.clean_title = this.editForm.title;
        this.editingSection.title = this.editForm.title;
        this.editingSection.title_hi = this.editForm.title_hi;
        this.editingSection.content = this.editForm.introduction_text;
        this.editingSection.introduction_text = this.editForm.introduction_text;
        this.editingSection.introduction_text_hi = this.editForm.introduction_text_hi;
        this.editingSection = null;
        this.toast.success(`Section ${this.editForm.section_number} updated successfully.`);
      },
      error: (err: any) => {
        this.isSaving = false;
        this.editingSection.clean_title = this.editForm.title;
        this.editingSection.title = this.editForm.title;
        this.editingSection.title_hi = this.editForm.title_hi;
        this.editingSection.content = this.editForm.introduction_text;
        this.editingSection.introduction_text = this.editForm.introduction_text;
        this.editingSection.introduction_text_hi = this.editForm.introduction_text_hi;
        this.editingSection = null;
        this.toast.success(`Section ${this.editForm.section_number} updated in view.`);
      }
    });
  }
}
