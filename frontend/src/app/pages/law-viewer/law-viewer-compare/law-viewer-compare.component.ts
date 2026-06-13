import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnDestroy, Inject, Renderer2, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { NgIf, NgClass, DOCUMENT } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { LegalService, Section } from '../../../services/legal.service';
import { TooltipDirective } from '../../../directives/tooltip.directive';
import { SnackbarService } from '../../../services/snackbar.service';

@Component({
  selector: 'app-law-viewer-compare',
  standalone: true,
  imports: [NgIf, NgClass, TooltipDirective],
  templateUrl: './law-viewer-compare.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LawViewerCompareComponent implements OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() shortName = '';
  @Input() activeSection: Section | null = null;

  @Output() close = new EventEmitter<void>();

  crossRefData: any = null;
  crossRefLoading = false;

  private destroy$ = new Subject<void>();

  constructor(
    private legalService: LegalService,
    private snackbar: SnackbarService,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: any,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.loadCrossReference();
        this.renderer.setStyle(this.document.body, 'overflow', 'hidden');
      } else {
        this.renderer.removeStyle(this.document.body, 'overflow');
      }
    }
  }

  ngOnDestroy() {
    this.renderer.removeStyle(this.document.body, 'overflow');
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCrossReference(force: boolean = false) {
    if (!this.activeSection) return;

    const storageKey = `transition_map_${this.shortName}_${this.activeSection.section_number}`;

    if (!force) {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        try {
          const cacheObj = JSON.parse(cached);
          if (cacheObj && cacheObj.data && cacheObj.timestamp) {
            const ageInMs = Date.now() - cacheObj.timestamp;
            const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
            if (ageInMs < thirtyDaysInMs) {
              this.crossRefData = cacheObj.data;
              this.crossRefLoading = false;
              this.cdr.markForCheck();
              return;
            }
          } else if (cacheObj && cacheObj.success) {
            this.crossRefData = cacheObj;
            this.crossRefLoading = false;
            this.cdr.markForCheck();
            return;
          }
        } catch (e) {
          console.error('Failed to parse cached mapping:', e);
        }
      }
    }

    this.crossRefLoading = true;
    if (!force) {
      this.crossRefData = null;
    }
    this.cdr.markForCheck();

    this.legalService.getTransitionMapping(this.shortName, this.activeSection.section_number)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.crossRefLoading = false;
          if (res.success) {
            this.crossRefData = res;
            const cacheObj = {
              data: res,
              timestamp: Date.now()
            };
            localStorage.setItem(storageKey, JSON.stringify(cacheObj));
            if (force) {
              this.snackbar.show('Comparison re-analyzed & updated successfully!', 'success');
            }
          } else {
            this.snackbar.show('Failed to load cross-reference mapping.', 'warning');
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.crossRefLoading = false;
          console.error('Failed to load mapping:', err);
          this.snackbar.show('Failed to load cross-reference mapping.', 'warning');
          this.cdr.markForCheck();
        }
      });
  }

  closeCrossRefModal() {
    this.close.emit();
  }

  parseMarkdown(text: string): string {
    if (!text) return '';

    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-text-primary dark:text-white">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

    const lines = html.split('\n');
    const formattedLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('* ')) {
        const itemContent = trimmed.substring(2);
        return `<li class="ml-6 list-disc mb-1.5 text-text-secondary dark:text-slate-350">${itemContent}</li>`;
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const match = trimmed.match(/^(\d+)\.\s(.*)$/);
        if (match) {
          return `<div class="font-bold text-sm text-accent mt-4 mb-2 flex items-start gap-1.5"><span>${match[1]}.</span> <span>${match[2]}</span></div>`;
        }
      }
      return trimmed ? `<p class="mb-2 leading-relaxed text-text-secondary dark:text-slate-350">${trimmed}</p>` : '';
    });

    return formattedLines.join('\n');
  }
}
