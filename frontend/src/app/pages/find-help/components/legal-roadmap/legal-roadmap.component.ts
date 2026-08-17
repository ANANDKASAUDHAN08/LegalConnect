import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipDirective } from '../../../../directives/tooltip.directive';

@Component({
  selector: 'app-legal-roadmap',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
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
  @Output() speak = new EventEmitter<{ textKey: string, text: string, lang: 'en' | 'hi' }>();
  @Output() saveOffline = new EventEmitter<void>();
  @Output() removeOffline = new EventEmitter<void>();
  @Output() progressChanged = new EventEmitter<{ completed: number, total: number }>();

  // Pillar 3: Interactive checklist state
  checkedSteps = new Set<number>();
  checkedDocs = new Set<number>();

  // Accordion state (expand first step by default using a Set)
  expandedSteps = new Set<number>([0]);

  private get storageKey(): string {
    const cat = (this.activeCategory || 'general').toLowerCase().replace(/\s+/g, '_');
    const loc = (this.locationQuery || 'unknown').toLowerCase().replace(/\s+/g, '_').slice(0, 30);
    return `checklist_progress_${cat}_${loc}`;
  }

  constructor(private cdr: ChangeDetectorRef) {}

  toggleStepExpansion(idx: number) {
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

  toggleExpandAll() {
    const steps = this.roadmap?.steps || [];
    if (this.allStepsExpanded) {
      this.expandedSteps.clear();
    } else {
      steps.forEach((_: any, idx: number) => this.expandedSteps.add(idx));
    }
    this.cdr.markForCheck();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Reload checklist when category or location changes
    if (changes['activeCategory'] || changes['locationQuery']) {
      this.loadChecklistFromStorage();
    }
  }

  private loadChecklistFromStorage() {
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
    } catch (e) {
      this.checkedSteps = new Set<number>();
      this.checkedDocs = new Set<number>();
      this.emitProgress();
    }
  }

  private saveChecklistToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        steps: Array.from(this.checkedSteps),
        docs: Array.from(this.checkedDocs)
      }));
    } catch (e) { /* storage full — ignore */ }
  }

  private emitProgress() {
    this.progressChanged.emit({
      completed: this.completedItems,
      total: this.totalItems
    });
  }

  toggleStep(idx: number) {
    if (this.checkedSteps.has(idx)) {
      this.checkedSteps.delete(idx);
    } else {
      this.checkedSteps.add(idx);
    }
    // Reassign to trigger change detection (Sets are reference-equal)
    this.checkedSteps = new Set(this.checkedSteps);
    this.saveChecklistToStorage();
    this.emitProgress();
    this.cdr.markForCheck();
  }

  toggleDoc(idx: number) {
    if (this.checkedDocs.has(idx)) {
      this.checkedDocs.delete(idx);
    } else {
      this.checkedDocs.add(idx);
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

  onSpeakClick(textKey: string, text: string, lang: 'en' | 'hi') {
    this.speak.emit({ textKey, text, lang });
  }
}