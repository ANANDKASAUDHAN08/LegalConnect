import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChildren, QueryList, HostListener } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { LegalService, BareAct, Chapter, Section } from '../../services/legal.service';
import { BookmarkService } from '../../services/bookmark.service';
import { AuthService, UserProfile } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { BookmarkModalComponent } from '../../components/bookmark-modal/bookmark-modal.component';

@Component({
  selector: 'app-law-viewer',
  standalone: true,
  imports: [RouterLink, NgFor, NgIf, NgClass, BookmarkModalComponent],
  templateUrl: './law-viewer.component.html',
  styleUrls: ['./law-viewer.component.scss']
})
export class LawViewerComponent implements OnInit, OnDestroy, AfterViewInit {
  act: BareAct | null = null;
  activeChapter: Chapter | null = null;
  activeSectionId: string | null = null;
  loading = true;
  error = '';
  shortName = '';
  isLoggedIn = false;
  currentUser: UserProfile | null = null;
  
  // Reusable Bookmark Modal State
  isBookmarkModalOpen = false;
  modalActShortName = '';
  modalChapterNumber = '';
  modalSection: Section | null = null;

  @ViewChildren('sectionElement') sectionElements!: QueryList<ElementRef>;
  private observer: IntersectionObserver | null = null;

  summaries: { [key: string]: { loading: boolean, text: string | null, error: string | null } } = {};

  constructor(
    private route: ActivatedRoute, 
    private legalService: LegalService,
    public bookmarkService: BookmarkService,
    private authService: AuthService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit() {
    this.authService.isLoggedIn$.subscribe(loggedIn => this.isLoggedIn = loggedIn);
    this.authService.currentUser$.subscribe(user => this.currentUser = user);
    this.shortName = this.route.snapshot.paramMap.get('shortName') || '';
    this.legalService.getActByShortName(this.shortName).subscribe({
      next: res => {
        this.act = res.data;
        this.activeChapter = res.data.chapters[0] || null;
        this.loading = false;
        // Need a slight delay to allow Angular to render the *ngFor sections
        setTimeout(() => this.setupIntersectionObserver(), 100);
      },
      error: () => { this.error = 'Could not load this act.'; this.loading = false; }
    });
  }

  ngAfterViewInit() {
    this.sectionElements.changes.subscribe(() => {
      this.setupIntersectionObserver();
    });
  }

  ngOnDestroy() {
    if (this.observer) this.observer.disconnect();
  }

  setChapter(ch: Chapter) { 
    this.activeChapter = ch;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  setupIntersectionObserver() {
    if (this.observer) this.observer.disconnect();

    const options = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.activeSectionId = entry.target.id;
        }
      });
    }, options);

    this.sectionElements.forEach(el => this.observer!.observe(el.nativeElement));
  }

  openBookmarkModal(section: Section) {
    if (!this.isLoggedIn) {
      this.snackbar.show('Please log in to save this section to your library.', 'warning');
      return;
    }
    this.modalActShortName = this.shortName;
    if (this.activeChapter) {
      this.modalChapterNumber = this.activeChapter.chapterNumber;
    }
    this.modalSection = section;
    this.isBookmarkModalOpen = true;
  }

  shareSection(section: Section) {
    const url = `${window.location.origin}/laws/${this.shortName}#sec-${section.section_number}`;
    navigator.clipboard.writeText(url).then(() => {
      this.snackbar.show('Section link copied to clipboard!', 'success');
    });
  }

  summarizeSection(section: Section) {
    const secKey = section.section_number;
    
    // If we already have the summary loaded, don't refetch
    if (this.summaries[secKey] && this.summaries[secKey].text) {
      return;
    }

    this.summaries[secKey] = { loading: true, text: null, error: null };
    
    this.legalService.getSectionSummary(this.shortName, secKey).subscribe({
      next: (res) => {
        this.summaries[secKey] = { loading: false, text: res.data.summary, error: null };
      },
      error: () => {
        this.summaries[secKey] = { loading: false, text: null, error: 'Failed to generate AI summary. Please ensure the backend API key is configured.' };
      }
    });
  }
}
