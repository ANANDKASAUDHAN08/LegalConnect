import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AdminApiService } from '../../../core/admin-api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { BareAct, EditMetaForm, EditMetaPayload } from '../legal-content.models';

@Component({
  selector: 'admin-edit-act-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective, SelectComponent],
  templateUrl: './edit-act-modal.component.html',
  styleUrl: './edit-act-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditActModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() act: BareAct | null = null;
  @Input() allActs: BareAct[] = [];
  @Output() actUpdated = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  private destroy$ = new Subject<void>();

  isEditingMeta = false;
  activeTab: 'core' | 'gazette' = 'core';
  shortCodeCollision = false;

  editMetaForm: EditMetaForm = {
    actName: '',
    shortName: '',
    year: 0,
    description: '',
    originalShortName: '',
    jurisdiction: '',
    category: '',
    ministry: '',
    assentDate: '',
    commencementDate: '',
    gazetteRef: '',
    actNumber: ''
  };

  jurisdictionOptions: SelectOption[] = [
    { label: 'Select Jurisdiction', value: '' },
    { label: 'Union of India (Central Act)', value: 'Central' },
    { label: 'State of Maharashtra', value: 'State of Maharashtra' },
    { label: 'State of Delhi (NCT)', value: 'State of Delhi (NCT)' },
    { label: 'State of Karnataka', value: 'State of Karnataka' },
    { label: 'State of Tamil Nadu', value: 'State of Tamil Nadu' },
    { label: 'State of Uttar Pradesh', value: 'State of Uttar Pradesh' },
    { label: 'State of West Bengal', value: 'State of West Bengal' },
    { label: 'Concurrent List / Multistate', value: 'Concurrent List / Multistate' }
  ];

  categoryOptions: SelectOption[] = [
    { label: 'Select Legal Field / Category', value: '' },
    { label: 'Criminal & Penal Law (CRIMINAL)', value: 'CRIMINAL' },
    { label: 'Civil & Procedure Law (CIVIL)', value: 'CIVIL' },
    { label: 'Commercial & Corporate Law (COMMERCIAL)', value: 'COMMERCIAL' },
    { label: 'Constitutional & Administrative Law (CONSTITUTIONAL)', value: 'CONSTITUTIONAL' },
    { label: 'Taxation, Financial & Revenue (FINANCIAL)', value: 'FINANCIAL' },
    { label: 'Labor, Employment & Industrial (LABOUR)', value: 'LABOUR' },
    { label: 'Environmental & Natural Resources (ENVIRONMENTAL)', value: 'ENVIRONMENTAL' },
    { label: 'Family & Personal Law (FAMILY)', value: 'FAMILY' },
    { label: 'Property & Land Law (PROPERTY)', value: 'PROPERTY' },
    { label: 'Intellectual Property Rights (IP)', value: 'IP' },
    { label: 'Special & Miscellaneous Acts (SPECIAL)', value: 'SPECIAL' }
  ];

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.populateForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['act'] && this.act) {
      this.populateForm();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  populateForm(): void {
    if (!this.act) return;
    this.editMetaForm = {
      actName: this.act.actName || this.act.name || '',
      shortName: this.act.shortName || '',
      year: this.act.year || 0,
      description: this.act.description || '',
      originalShortName: this.act.shortName || '',
      jurisdiction: this.act.jurisdiction || '',
      category: this.act.category || '',
      ministry: this.act.ministry || '',
      assentDate: this.act.assentDate || '',
      commencementDate: this.act.commencementDate || '',
      gazetteRef: this.act.gazetteRef || '',
      actNumber: this.act.actNumber || ''
    };
    this.shortCodeCollision = false;
    this.activeTab = 'core';
    this.cdr.markForCheck();
  }

  checkShortCodeCollision(): void {
    if (!this.editMetaForm.shortName || this.editMetaForm.shortName === this.editMetaForm.originalShortName) {
      this.shortCodeCollision = false;
      return;
    }
    const target = this.editMetaForm.shortName.trim().toUpperCase();
    this.shortCodeCollision = (this.allActs || []).some(
      a => a.shortName?.toUpperCase() === target && a.shortName?.toUpperCase() !== this.editMetaForm.originalShortName.toUpperCase()
    );
  }

  applyPreambleTemplate(type: 'consolidation' | 'regulation' | 'establishment'): void {
    const act = this.editMetaForm.actName || 'this Act';
    if (type === 'consolidation') {
      this.editMetaForm.description = `An Act to consolidate and amend the statutory provisions relating to ${act.toLowerCase()} and matters connected therewith or incidental thereto.`;
    } else if (type === 'regulation') {
      this.editMetaForm.description = `An Act to provide for the statutory regulation, administration, and enforcement of ${act.toLowerCase()} across the jurisdiction.`;
    } else if (type === 'establishment') {
      this.editMetaForm.description = `An Act to establish a unified statutory framework for ${act.toLowerCase()} and for matters connected therewith.`;
    }
    this.cdr.markForCheck();
  }

  getChapterCount(): number {
    if (!this.act) return 0;
    return this.act.chapterCount ?? (this.act.chapters?.length || 0);
  }

  getSectionCount(): number {
    if (!this.act) return 0;
    if (this.act.sectionCount !== undefined) return this.act.sectionCount;
    if (this.act.chapters) {
      return this.act.chapters.reduce((acc, ch) => acc + (ch.sections?.length || 0), 0);
    }
    return 0;
  }

  getEraClass(): string {
    const year = this.editMetaForm.year;
    if (!year) return 'era-historical';
    if (year >= 2020) return 'era-modern';
    if (year >= 2000) return 'era-recent';
    return 'era-historical';
  }

  getEraLabel(): string {
    const year = this.editMetaForm.year;
    if (!year) return 'Historical';
    if (year >= 2020) return 'Modern Enactment';
    if (year >= 2000) return 'Contemporary Enactment';
    if (year >= 1950) return 'Post-Independence';
    return 'Pre-Independence';
  }

  closeModal(): void {
    this.closed.emit();
  }

  submitEditMeta(): void {
    if (this.shortCodeCollision) {
      this.toast.error(`Short code '${this.editMetaForm.shortName}' already exists.`);
      return;
    }
    this.isEditingMeta = true;
    this.cdr.markForCheck();

    const data: EditMetaPayload = {
      actName: this.editMetaForm.actName,
      year: this.editMetaForm.year,
      description: this.editMetaForm.description,
      jurisdiction: this.editMetaForm.jurisdiction,
      category: this.editMetaForm.category,
      ministry: this.editMetaForm.ministry,
      assentDate: this.editMetaForm.assentDate,
      commencementDate: this.editMetaForm.commencementDate,
      gazetteRef: this.editMetaForm.gazetteRef,
      actNumber: this.editMetaForm.actNumber
    };

    if (this.editMetaForm.shortName !== this.editMetaForm.originalShortName) {
      data.newShortName = this.editMetaForm.shortName.toUpperCase();
    }

    this.api.patchActMetadata(this.editMetaForm.originalShortName, data)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isEditingMeta = false;
          this.toast.success(`Act '${this.editMetaForm.actName}' metadata updated successfully.`);
          this.actUpdated.emit();
        },
        error: (err: any) => {
          this.isEditingMeta = false;
          this.toast.error(err?.error?.message || 'Failed to update act metadata.');
          this.cdr.markForCheck();
        }
      });
  }
}