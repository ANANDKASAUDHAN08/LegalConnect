import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnChanges,
  SimpleChanges,
  ChangeDetectorRef,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { getCategoryMeta, StatutoryLimitation, RelatedTemplateBridge } from '../../config/category-data.config';
import { SnackbarService } from '../../../../services/snackbar.service';

@Component({
  selector: 'app-legal-roadmap',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective],
  templateUrl: './legal-roadmap.component.html',
  styleUrls: ['./legal-roadmap.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegalRoadmapComponent implements OnChanges {
  @Input() roadmap: any;
  @Input() activeCategory = '';
  @Input() locationQuery = '';
  @Input() isSpeaking = false;
  @Input() speakingTextKey: string | null = null;
  @Input() isCasePackSaved = false;

  @Output() downloadCasePack = new EventEmitter<void>();
  @Output() speak = new EventEmitter<{ textKey: string; text: string; lang: 'en' | 'hi' }>();
  @Output() saveOffline = new EventEmitter<void>();
  @Output() removeOffline = new EventEmitter<void>();
  @Output() progressChanged = new EventEmitter<{ completed: number; total: number }>();

  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private snackbar = inject(SnackbarService);

  // Interactive checklist state
  checkedSteps = new Set<number>();
  checkedDocs = new Set<number>();

  // Accordion state
  expandedSteps = new Set<number>([0]);

  // Category metadata (limitation clock & templates)
  limitationData: StatutoryLimitation | null = null;
  relatedTemplates: RelatedTemplateBridge[] = [];

  // Interactive Deadline Calculator
  calculatorIncidentDate = '';
  calculatedDaysRemaining: number | null = null;
  calculatedExpiryDateString: string | null = null;
  calculatorUrgencyText = '';
  calculatorStatusClass = '';

  private get storageKey(): string {
    const cat = (this.activeCategory || 'general').toLowerCase().replace(/\s+/g, '_');
    const loc = (this.locationQuery || 'unknown').toLowerCase().replace(/\s+/g, '_').slice(0, 30);
    return `checklist_progress_${cat}_${loc}`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeCategory'] || changes['locationQuery']) {
      this.loadCategoryMetadata();
      this.loadChecklistFromStorage();
      this.resetCalculator();
    }
  }

  private loadCategoryMetadata(): void {
    const meta = getCategoryMeta(this.activeCategory);
    this.limitationData = meta.limitation || null;
    this.relatedTemplates = meta.relatedTemplates || [];
  }

  toggleStepExpansion(idx: number): void {
    if (this.expandedSteps.has(idx)) {
      this.expandedSteps.delete(idx);
    } else {
      this.expandedSteps.add(idx);
    }
    this.cdr.markForCheck();
  }

  get allStepsExpanded(): boolean {
    const total = (this.roadmap?.steps || []).length;
    return this.expandedSteps.size === total;
  }

  toggleExpandAll(): void {
    const steps = this.roadmap?.steps || [];
    if (this.allStepsExpanded) {
      this.expandedSteps.clear();
    } else {
      steps.forEach((_: any, idx: number) => this.expandedSteps.add(idx));
    }
    this.cdr.markForCheck();
  }

  private loadChecklistFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.checkedSteps = new Set<number>(parsed.steps || []);
        this.checkedDocs = new Set<number>(parsed.docs || []);
      } else {
        this.checkedSteps = new Set<number>();
        this.checkedDocs = new Set<number>();
      }
      this.emitProgress();
      this.cdr.markForCheck();
    } catch {
      this.checkedSteps = new Set<number>();
      this.checkedDocs = new Set<number>();
      this.emitProgress();
    }
  }

  private saveChecklistToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({
          steps: Array.from(this.checkedSteps),
          docs: Array.from(this.checkedDocs)
        })
      );
    } catch {
      // Storage full
    }
  }

  private emitProgress(): void {
    this.progressChanged.emit({
      completed: this.completedItems,
      total: this.totalItems
    });
  }

  toggleStep(idx: number): void {
    if (this.checkedSteps.has(idx)) {
      this.checkedSteps.delete(idx);
    } else {
      this.checkedSteps.add(idx);
    }
    this.checkedSteps = new Set(this.checkedSteps);
    this.saveChecklistToStorage();
    this.emitProgress();
    this.cdr.markForCheck();
  }

  toggleDoc(di: number): void {
    if (this.checkedDocs.has(di)) {
      this.checkedDocs.delete(di);
    } else {
      this.checkedDocs.add(di);
    }
    this.checkedDocs = new Set(this.checkedDocs);
    this.saveChecklistToStorage();
    this.emitProgress();
    this.cdr.markForCheck();
  }

  get totalItems(): number {
    const steps = this.roadmap?.steps?.length || 0;
    const docs = this.roadmap?.documents?.length || 0;
    return steps + docs;
  }

  get completedItems(): number {
    return this.checkedSteps.size + this.checkedDocs.size;
  }

  get progressPercent(): number {
    if (this.totalItems === 0) return 0;
    return Math.round((this.completedItems / this.totalItems) * 100);
  }

  onSpeakClick(textKey: string, text: string, lang: 'en' | 'hi'): void {
    this.speak.emit({ textKey, text, lang });
  }

  // Interactive Deadline Calculator
  onIncidentDateChange(): void {
    if (!this.calculatorIncidentDate || !this.limitationData || !this.limitationData.statutoryLimitDays) {
      this.resetCalculator();
      return;
    }

    const incidentTime = new Date(this.calculatorIncidentDate).getTime();
    if (isNaN(incidentTime)) {
      this.resetCalculator();
      return;
    }

    const expiryTime = incidentTime + this.limitationData.statutoryLimitDays * 24 * 3600 * 1000;
    const expiryDate = new Date(expiryTime);
    const now = Date.now();

    const diffDays = Math.ceil((expiryTime - now) / (1000 * 3600 * 24));
    this.calculatedDaysRemaining = diffDays;
    this.calculatedExpiryDateString = expiryDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    if (diffDays <= 0) {
      this.calculatorUrgencyText = 'Statutory Limitation Window Expired!';
      this.calculatorStatusClass = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
    } else if (diffDays <= 7) {
      this.calculatorUrgencyText = `Critical: Only ${diffDays} day${diffDays === 1 ? '' : 's'} remaining! Issue notice immediately.`;
      this.calculatorStatusClass = 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 animate-pulse';
    } else if (diffDays <= 30) {
      this.calculatorUrgencyText = `High Urgency: ${diffDays} days remaining to complete statutory requirements.`;
      this.calculatorStatusClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
    } else {
      this.calculatorUrgencyText = `Standard Window: ${diffDays} days remaining until statutory deadline.`;
      this.calculatorStatusClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    }

    this.cdr.markForCheck();
  }

  resetCalculator(): void {
    this.calculatorIncidentDate = '';
    this.calculatedDaysRemaining = null;
    this.calculatedExpiryDateString = null;
    this.calculatorUrgencyText = '';
    this.calculatorStatusClass = '';
  }

  goToTemplate(templateId: string): void {
    this.snackbar.show('Opening Legal Document Generator for pre-formatted draft...', 'info');
    this.router.navigate(['/laws/templates'], { queryParams: { template: templateId } });
  }

  trackByStepTitle(index: number, step: any): string {
    return step?.title || String(index);
  }

  trackByDoc(index: number, doc: string): string {
    return doc || String(index);
  }

  trackByLinkUrl(index: number, link: any): string {
    return link?.url || String(index);
  }

  trackByTemplateId(_: number, tmpl: any): string {
    return tmpl.id;
  }
}