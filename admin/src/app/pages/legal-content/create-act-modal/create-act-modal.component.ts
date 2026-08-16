import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AdminApiService } from '../../../core/admin-api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { DialogService } from '../../../shared/services/dialog.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { BareAct, CreateActForm, CreateActPayload } from '../legal-content.models';

@Component({
  selector: 'admin-create-act-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective, SelectComponent],
  templateUrl: './create-act-modal.component.html',
  styleUrl: './create-act-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateActModalComponent implements OnInit, OnDestroy {
  @Input() acts: BareAct[] = [];
  @Output() actCreated = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  private destroy$ = new Subject<void>();
  private readonly DRAFT_STORAGE_KEY = 'legalconnect_act_create_draft';

  isSubmittingAct = false;
  activeModalTab: 'essentials' | 'gazette' | 'structure' | 'json' = 'essentials';
  shortCodeCollision = false;
  hasRestoredDraft = false;
  draftSavedTime: string | null = null;
  jsonText = '';
  jsonSyntaxError = '';
  isJsonValid = true;

  newActForm: CreateActForm = this.defaultFormState();

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
    private dialogService: DialogService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.activeModalTab = 'essentials';
    this.hasRestoredDraft = false;
    this.checkAndRestoreDraft();
    this.syncJsonFromForm();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  defaultFormState(): CreateActForm {
    return {
      actName: '',
      shortName: '',
      year: new Date().getFullYear(),
      actNumber: '',
      jurisdiction: '',
      category: '',
      ministry: 'Ministry of Law and Justice',
      assentDate: '',
      commencementDate: '',
      gazetteRef: '',
      description: '',
      tags: '',
      initialChapterTitle: 'PRELIMINARY',
      initialSectionTitle: 'Short title, extent and commencement.',
      initialSectionContent: ''
    };
  }

  onTabChange(tab: 'essentials' | 'gazette' | 'structure' | 'json'): void {
    if (tab === 'json') {
      this.syncJsonFromForm();
    }
    this.activeModalTab = tab;
    this.cdr.markForCheck();
  }

  nextTab(): void {
    if (this.activeModalTab === 'essentials') this.onTabChange('gazette');
    else if (this.activeModalTab === 'gazette') this.onTabChange('structure');
    else if (this.activeModalTab === 'structure') this.onTabChange('json');
  }

  prevTab(): void {
    if (this.activeModalTab === 'json') this.onTabChange('structure');
    else if (this.activeModalTab === 'structure') this.onTabChange('gazette');
    else if (this.activeModalTab === 'gazette') this.onTabChange('essentials');
  }

  checkAndRestoreDraft(): void {
    try {
      const saved = localStorage.getItem(this.DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.form && (parsed.form.actName || parsed.form.shortName || parsed.form.description || parsed.form.actNumber)) {
          this.newActForm = { ...this.defaultFormState(), ...parsed.form };
          this.draftSavedTime = parsed.timestamp || null;
          this.hasRestoredDraft = true;
          this.toast.info('Restored your unsaved draft! You can clear or continue editing.');
          this.checkShortCodeCollision();
          return;
        }
      }
    } catch (e) {
      console.warn('Draft restoration error:', e);
    }
    this.newActForm = this.defaultFormState();
    this.draftSavedTime = null;
  }

  onFormInput(): void {
    this.saveDraftToStorage();
    this.checkShortCodeCollision();
    this.syncJsonFromForm();
  }

  saveDraftToStorage(): void {
    if (!this.isFormDirty()) return;
    try {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      localStorage.setItem(this.DRAFT_STORAGE_KEY, JSON.stringify({
        form: this.newActForm,
        timestamp
      }));
      this.draftSavedTime = timestamp;
    } catch (e) {
      console.warn('Draft save error:', e);
    }
  }

  isFormDirty(): boolean {
    return !!(
      this.newActForm.actName.trim() ||
      this.newActForm.shortName.trim() ||
      this.newActForm.description.trim() ||
      this.newActForm.actNumber.trim()
    );
  }

  closeModal(autoSave = true): void {
    if (autoSave && this.isFormDirty()) {
      this.saveDraftToStorage();
      this.toast.info('Draft auto-saved! Your data is preserved when you reopen.');
    }
    this.closed.emit();
  }

  async clearAllFields(confirmClear = true): Promise<void> {
    if (confirmClear && this.isFormDirty()) {
      const confirmed = await this.dialogService.confirm({
        title: 'Clear Form & Draft?',
        message: 'Are you sure you want to reset all fields and wipe the auto-saved draft? This action cannot be undone.',
        type: 'danger',
        confirmText: 'Yes, Clear All',
        cancelText: 'Keep Editing'
      });
      if (!confirmed) return;
    }
    this.newActForm = this.defaultFormState();
    this.shortCodeCollision = false;
    this.hasRestoredDraft = false;
    this.draftSavedTime = null;
    this.syncJsonFromForm();
    localStorage.removeItem(this.DRAFT_STORAGE_KEY);
    this.toast.success('Form fields and draft cleared successfully.');
    this.cdr.markForCheck();
  }

  onActNameChange(): void {
    if (this.newActForm.actName && (!this.newActForm.shortName || this.hasRestoredDraft === false)) {
      const words = this.newActForm.actName.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/);
      if (words.length > 1) {
        this.newActForm.shortName = words.map((w: string) => w[0]?.toUpperCase()).join('');
      } else if (words[0] && words[0].length >= 3) {
        this.newActForm.shortName = words[0].substring(0, 4).toUpperCase();
      }
    }
    this.onFormInput();
  }

  checkShortCodeCollision(): void {
    if (!this.newActForm.shortName) {
      this.shortCodeCollision = false;
      return;
    }
    const target = this.newActForm.shortName.trim().toUpperCase();
    this.shortCodeCollision = (this.acts || []).some(act => act.shortName?.toUpperCase() === target);
  }

  applyPreambleTemplate(type: 'consolidation' | 'regulation' | 'establishment'): void {
    const act = this.newActForm.actName || 'this Act';
    if (type === 'consolidation') {
      this.newActForm.description = `An Act to consolidate and amend the statutory provisions relating to ${act.toLowerCase()} and matters connected therewith or incidental thereto.`;
    } else if (type === 'regulation') {
      this.newActForm.description = `An Act to provide for the statutory regulation, administration, and enforcement of ${act.toLowerCase()} across the jurisdiction.`;
    } else if (type === 'establishment') {
      this.newActForm.description = `An Act to establish a unified statutory framework for ${act.toLowerCase()} and for matters connected therewith.`;
    }
    this.onFormInput();
  }

  syncJsonFromForm(): void {
    this.jsonText = this.formattedJsonPayload;
    this.isJsonValid = true;
    this.jsonSyntaxError = '';
  }

  onJsonInputChange(): void {
    if (!this.jsonText.trim()) {
      this.isJsonValid = false;
      this.jsonSyntaxError = 'JSON payload cannot be empty.';
      this.cdr.markForCheck();
      return;
    }
    try {
      const parsed = JSON.parse(this.jsonText);
      this.isJsonValid = true;
      this.jsonSyntaxError = '';
      if (parsed.actName !== undefined) this.newActForm.actName = parsed.actName || '';
      if (parsed.shortName !== undefined) this.newActForm.shortName = parsed.shortName || '';
      if (parsed.year !== undefined) this.newActForm.year = Number(parsed.year) || new Date().getFullYear();
      if (parsed.description !== undefined) this.newActForm.description = parsed.description || '';

      if (Array.isArray(parsed.chapters) && parsed.chapters.length > 0) {
        const chap = parsed.chapters[0];
        if (chap.title) this.newActForm.initialChapterTitle = chap.title;
        if (Array.isArray(chap.sections) && chap.sections.length > 0) {
          const sec = chap.sections[0];
          if (sec.title) this.newActForm.initialSectionTitle = sec.title;
          if (sec.introduction_text) this.newActForm.initialSectionContent = sec.introduction_text;
        }
      }

      this.saveDraftToStorage();
      this.checkShortCodeCollision();
    } catch (err: any) {
      this.isJsonValid = false;
      this.jsonSyntaxError = err?.message || 'Invalid JSON syntax.';
    }
    this.cdr.markForCheck();
  }

  formatJsonText(): void {
    try {
      const parsed = JSON.parse(this.jsonText);
      this.jsonText = JSON.stringify(parsed, null, 2);
      this.isJsonValid = true;
      this.jsonSyntaxError = '';
      this.toast.success('JSON formatted & beautified!');
    } catch (err: any) {
      this.toast.error('Cannot format invalid JSON syntax.');
    }
    this.cdr.markForCheck();
  }

  get formCompletionPercentage(): number {
    let filled = 0;
    const total = 7;
    if (this.newActForm.actName.trim()) filled++;
    if (this.newActForm.shortName.trim() && !this.shortCodeCollision) filled++;
    if (this.newActForm.year) filled++;
    if (this.newActForm.actNumber.trim()) filled++;
    if (this.newActForm.description.trim()) filled++;
    if (this.newActForm.initialChapterTitle.trim()) filled++;
    if (this.newActForm.initialSectionTitle.trim()) filled++;
    return Math.round((filled / total) * 100);
  }

  get formattedJsonPayload(): string {
    return JSON.stringify(this.buildCreatePayload(), null, 2);
  }

  buildCreatePayload(): CreateActPayload {
    const actName = this.newActForm.actName.trim();
    const year = Number(this.newActForm.year);
    const metaParts: string[] = [];
    if (this.newActForm.actNumber) metaParts.push(`Act No: ${this.newActForm.actNumber.trim()}`);
    const jur = this.newActForm.jurisdiction || 'Union of India (Central)';
    const cat = this.newActForm.category || 'Criminal & Penal Law';
    if (jur) metaParts.push(`Jurisdiction: ${jur}`);
    if (cat) metaParts.push(`Category: ${cat}`);
    if (this.newActForm.ministry) metaParts.push(`Ministry: ${this.newActForm.ministry}`);
    if (this.newActForm.assentDate) metaParts.push(`Assent Date: ${this.newActForm.assentDate}`);
    if (this.newActForm.commencementDate) metaParts.push(`Enforced: ${this.newActForm.commencementDate}`);
    if (this.newActForm.gazetteRef) metaParts.push(`Gazette Ref: ${this.newActForm.gazetteRef}`);

    let fullDescription = this.newActForm.description.trim();
    if (metaParts.length > 0) {
      fullDescription = `${metaParts.join(' | ')}\n\n${fullDescription}`;
    }

    return {
      actName,
      shortName: this.newActForm.shortName.trim().toUpperCase(),
      year,
      description: fullDescription,
      chapters: [
        {
          chapterNumber: 'I',
          title: this.newActForm.initialChapterTitle || 'PRELIMINARY',
          sections: [
            {
              section_number: '1',
              title: this.newActForm.initialSectionTitle || 'Short title, extent and commencement.',
              clean_title: this.newActForm.initialSectionTitle || 'Short title, extent and commencement.',
              introduction_text: this.newActForm.initialSectionContent || `This Act may be called the ${actName}, ${year}. It extends to the whole of India.`
            }
          ]
        }
      ]
    };
  }

  submitCreateAct(): void {
    if (!this.newActForm.actName || !this.newActForm.shortName || !this.newActForm.year) {
      this.toast.error('Act Title, Short Code, and Year are required.');
      return;
    }
    if (this.shortCodeCollision) {
      this.toast.error(`Short code '${this.newActForm.shortName}' already exists. Choose a unique short code.`);
      return;
    }

    this.isSubmittingAct = true;
    this.cdr.markForCheck();

    const payload = this.buildCreatePayload();

    this.api.createAct(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isSubmittingAct = false;
          localStorage.removeItem(this.DRAFT_STORAGE_KEY);
          this.toast.success(`Bare Act '${payload.actName}' created & published successfully!`);
          this.actCreated.emit();
        },
        error: (err: any) => {
          this.isSubmittingAct = false;
          const msg = err?.error?.message || err?.message || 'Failed to create Act.';
          this.toast.error(msg);
          this.cdr.markForCheck();
        }
      });
  }
}