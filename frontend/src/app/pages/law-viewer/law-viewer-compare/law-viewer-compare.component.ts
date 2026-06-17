import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnDestroy, Inject, Renderer2, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { NgIf, NgClass, DOCUMENT } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { LegalService, Section } from '../../../services/legal.service';
import { FormattingService } from '../../../services/formatting.service';
import { TooltipDirective } from '../../../directives/tooltip.directive';
import { SnackbarService } from '../../../services/snackbar.service';

@Component({
  selector: 'app-law-viewer-compare',
  standalone: true,
  imports: [NgIf, NgClass, TooltipDirective],
  templateUrl: './law-viewer-compare.component.html',
  styleUrls: ['./law-viewer-compare.component.scss'],
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
    private cdr: ChangeDetectorRef,
    public formatter: FormattingService
  ) { }

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

  private processSectionData(res: any): any {
    if (!res) return res;
    if (res.oldSection) {
      const healedOld = this.formatter.healTitleAndContent(res.oldSection.title, res.oldSection.content);
      res.oldSection.title = healedOld.title;
      res.oldSection.content = this.formatter.cleanSectionContent(healedOld.content);
    }
    if (res.newSection) {
      const healedNew = this.formatter.healTitleAndContent(res.newSection.title, res.newSection.content);
      res.newSection.title = healedNew.title;
      res.newSection.content = this.formatter.cleanSectionContent(healedNew.content);
    }
    return res;
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
              this.crossRefData = this.processSectionData(cacheObj.data);
              this.crossRefLoading = false;
              this.cdr.markForCheck();
              return;
            }
          } else if (cacheObj && cacheObj.success) {
            this.crossRefData = this.processSectionData(cacheObj);
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
            this.crossRefData = this.processSectionData(res);
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

}