import { Component, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { NgIf, NgFor, NgClass, DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { DocumentTemplateService, Template, Draft, TemplateField } from '../../services/document-template.service';
import { PrintService } from '../../services/print.service';
import { PrintExportService } from '../../services/print-export.service';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-document-templates',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, DatePipe, FormsModule, RouterLink, TooltipDirective, ConfirmDialogComponent],
  templateUrl: './document-templates.component.html',
  styleUrls: ['./document-templates.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentTemplatesComponent implements OnInit {
  searchQuery = '';
  selectedCategory = 'all';
  activeTemplateId = 'cheque-bounce-notice';

  // Tab control on mobile: 'select', 'form' or 'preview'
  activeMobileTab: 'select' | 'form' | 'preview' = 'select';

  // Layout mode on mobile: 'wizard' (tab-based) or 'stacked' (full scroll)
  mobileLayoutMode: 'wizard' | 'stacked' = 'wizard';
  showLayoutMenu = false;

  // Drafts Vault States
  MAX_DRAFTS = 50;
  draftSearchQuery = '';
  draftPage = 1;
  draftPageSize = 5;
  activeDraftId: string | null = null;
  draftsList: Draft[] = [];
  activeSidebarTab: 'templates' | 'drafts' = 'templates';
  showSidebar = true;

  // Cached states for performance / change detection optimization
  compiledTemplateHtml: SafeHtml = '';
  compiledTemplatePlain = '';
  filteredTemplatesList: Template[] = [];
  filteredDraftsList: Draft[] = [];
  paginatedDraftsList: Draft[] = [];

  // Clipboard / Download states
  copySuccess = false;
  downloadSuccess = false;

  // Focus highlighting
  activeFieldKey: string | null = null;

  private compilationSubject = new Subject<void>();

  // Manual Document Text Editing
  isManualEditMode = false;
  customBodyText = '';

  // Custom Template Creator States
  private _showCreateTemplateModal = false;
  get showCreateTemplateModal(): boolean {
    return this._showCreateTemplateModal;
  }
  set showCreateTemplateModal(val: boolean) {
    this._showCreateTemplateModal = val;
    if (val) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    this.cdr.markForCheck();
  }
  activeModalMobileTab: 'editor' | 'variables' = 'editor';
  newTemplateTitle = '';
  newTemplateAct = '';
  newTemplateDesc = '';
  newTemplateCategory = 'commercial';
  newTemplateBody = '';
  parsedPlaceholders: string[] = [];
  customFieldsConfig: { [key: string]: { label: string, type: string, helpTip: string } } = {};

  // Confirmation Dialog States
  showConfirm = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmType: 'danger' | 'warning' | 'info' = 'warning';
  confirmAction: (() => void) | null = null;

  // Custom Dropdown Configurations & States
  showCategoryDropdown = false;
  openFieldTypeDropdownKey: string | null = null;
  categories = [
    { value: 'commercial', label: 'Commercial Law' },
    { value: 'family', label: 'Family Law' },
    { value: 'civil', label: 'Civil Law' },
    { value: 'transport', label: 'Transport/MACT' },
    { value: 'rights', label: 'Statutory Notices & Rights' }
  ];
  fieldTypes = [
    { value: 'text', label: 'Short Text' },
    { value: 'textarea', label: 'Paragraph' },
    { value: 'date', label: 'Date Picker' }
  ];

  // Simulated premium loader state
  templateLoading = false;

  // Empty Field Compilation Modes
  emptyFieldsMode: 'placeholder' | 'underline' | 'blank' = 'placeholder';
  highlightEmptyFields = true;

  // Real-time fields binding values
  // Format: { [templateId]: { [fieldKey]: value } }
  formValues: { [templateId: string]: { [fieldKey: string]: string } } = {};

  templates: Template[] = [];

  get activeTemplate(): Template {
    return this.templates.find(t => t.id === this.activeTemplateId) || this.templates[0];
  }

  constructor(
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    private templateService: DocumentTemplateService,
    private cdr: ChangeDetectorRef,
    private printService: PrintService,
    private printExportService: PrintExportService
  ) { }

  ngOnInit() {
    // Setup debounced preview compilation (80ms)
    this.compilationSubject.pipe(
      debounceTime(80)
    ).subscribe(() => {
      this.updateCompiledTemplate();
    });

    // Load mobile layout preference from local storage
    const savedLayoutMode = localStorage.getItem('lc_mobile_layout_mode');
    if (savedLayoutMode === 'wizard' || savedLayoutMode === 'stacked') {
      this.mobileLayoutMode = savedLayoutMode;
    }

    // Subscribe to unified templates (System Templates from MongoDB + User Custom Templates)
    this.templateService.templates$.subscribe(list => {
      if (!list || list.length === 0) return;
      this.templates = list;

      // Initialize form values for all templates
      this.templates.forEach(t => {
        if (!this.formValues[t.id]) {
          this.formValues[t.id] = {};
        }
        t.fields.forEach(f => {
          if (this.formValues[t.id][f.key] === undefined) {
            if (f.type === 'date' && !f.defaultValue) {
              if (f.key === 'noticeDate' || f.key === 'currentDate' || f.key === 'declaredDate') {
                this.formValues[t.id][f.key] = this.getTodayDateString();
              } else {
                this.formValues[t.id][f.key] = '';
              }
            } else {
              this.formValues[t.id][f.key] = f.defaultValue;
            }
          }
        });
      });

      // Check if a deep-linked template was requested via queryParams
      const targetParam = this.route.snapshot.queryParams['open'] || this.route.snapshot.queryParams['id'];
      if (targetParam) {
        const match = this.resolveTemplate(targetParam);
        if (match && this.activeTemplateId !== match.id) {
          this.selectTemplate(match.id, true);
        }
      }

      this.updateFiltersAndPagination();
      this.cdr.markForCheck();
    });

    // Subscribe to drafts list from service
    this.templateService.drafts$.subscribe(drafts => {
      this.draftsList = drafts;
      this.updateFiltersAndPagination();
      this.cdr.markForCheck();
    });

    // Listen to route query parameters to check if we should auto-open a specific template
    this.route.queryParams.subscribe(params => {
      const openId = params['open'] || params['id'];
      if (openId) {
        const match = this.resolveTemplate(openId);
        if (match) {
          this.selectTemplate(match.id, true);
          this.activeMobileTab = 'form';
          this.cdr.markForCheck();
          return;
        }
      }
      this.templateLoading = true;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.templateLoading = false;
        this.updateCompiledTemplate();
        this.cdr.markForCheck();
      }, 400);
    });
  }

  resolveTemplate(idOrAlias: string): Template | undefined {
    if (!idOrAlias) return undefined;
    const q = idOrAlias.toLowerCase().trim();
    return this.templates.find(t =>
      t.id === idOrAlias ||
      t.id.toLowerCase() === q ||
      (q === 'cheque-bounce-sec-138' && t.id === 'cheque-bounce-notice') ||
      (q === 'cheque-bounce-notice' && t.id === 'cheque-bounce-sec-138')
    );
  }

  getTodayDateString(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  setMobileLayoutMode(mode: 'wizard' | 'stacked') {
    this.mobileLayoutMode = mode;
    localStorage.setItem('lc_mobile_layout_mode', mode);
  }

  scrollToMobileSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Caches/Updates search filters and pagination
  updateFiltersAndPagination() {
    // 1. Filter templates
    let tList = this.templates;
    if (this.selectedCategory !== 'all') {
      const cat = this.selectedCategory.toLowerCase();
      tList = tList.filter(t => {
        const tCat = (t.category || '').toLowerCase();
        if (tCat === cat) return true;
        if (cat === 'rights' && (tCat.includes('right') || tCat.includes('notice') || tCat.includes('police') || tCat.includes('tenancy') || tCat.includes('consumer'))) return true;
        if (cat === 'commercial' && (tCat.includes('commercial') || tCat.includes('banking'))) return true;
        return false;
      });
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      tList = tList.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.actRef.toLowerCase().includes(q)
      );
    }
    this.filteredTemplatesList = tList;

    // 2. Filter drafts
    let dList = this.draftsList;
    if (this.draftSearchQuery.trim()) {
      const q = this.draftSearchQuery.toLowerCase().trim();
      dList = dList.filter(d => d.title.toLowerCase().includes(q));
    }
    this.filteredDraftsList = dList;

    // 3. Paginate drafts
    const start = (this.draftPage - 1) * this.draftPageSize;
    this.paginatedDraftsList = this.filteredDraftsList.slice(start, start + this.draftPageSize);

    // 4. Update preview compilation
    this.updateCompiledTemplate();
  }

  // Pre-compiles and caches filled templates to avoid execution inside change detection cycles
  updateCompiledTemplate() {
    this.compiledTemplatePlain = this.getFilledTemplate(this.activeTemplateId, 'print');

    let htmlContent = '';
    if (this.isManualEditMode && this.customBodyText) {
      htmlContent = this.customBodyText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    } else {
      htmlContent = this.getFilledTemplate(this.activeTemplateId, 'preview');
    }
    this.compiledTemplateHtml = this.sanitizer.bypassSecurityTrustHtml(htmlContent);
    this.cdr.markForCheck();
  }

  setEmptyFieldsMode(mode: 'placeholder' | 'underline' | 'blank') {
    this.emptyFieldsMode = mode;
    this.updateCompiledTemplate();
  }

  onHighlightEmptyToggle() {
    this.updateCompiledTemplate();
  }

  toggleSidebar() {
    this.showSidebar = !this.showSidebar;
    this.cdr.markForCheck();
  }

  private findNameValueInValues(templateId: string, values: { [key: string]: string }): string {
    const keysToCheck = [
      'clientName', 'victimName', 'applicantName', 'husbandName', 'testatorName', 'declarantName', 'disclosingParty'
    ];
    for (const key of keysToCheck) {
      if (values[key] && values[key].trim()) {
        return values[key].trim();
      }
    }
    return '';
  }

  saveDraft(customTitle?: string) {
    const templateId = this.activeTemplateId;
    const values = this.formValues[templateId] || {};
    const customBody = this.isManualEditMode ? this.customBodyText : undefined;

    if (this.activeDraftId) {
      const draft = this.draftsList.find(d => d.id === this.activeDraftId);
      if (draft) {
        draft.values = { ...values };
        draft.customBody = customBody;
        if (customTitle && customTitle.trim()) {
          draft.title = customTitle.trim();
        } else {
          const nameVal = this.findNameValueInValues(templateId, values);
          if (nameVal && (draft.title.startsWith('Draft:') || draft.title.includes('Autosaved') || draft.title.includes('Draft #'))) {
            const template = this.templates.find(t => t.id === templateId);
            draft.title = `${template?.title || templateId} - ${nameVal}`;
          }
        }
        this.templateService.saveDraft(draft);
        return;
      }
    }

    if (this.draftsList.length >= this.MAX_DRAFTS) {
      this.openConfirm(
        'Draft Limit Reached',
        `Draft limit reached (${this.MAX_DRAFTS}/${this.MAX_DRAFTS}). Please delete some old drafts to save new ones.`,
        'warning',
        () => { }
      );
      return;
    }

    const template = this.templates.find(t => t.id === templateId);
    const nameVal = this.findNameValueInValues(templateId, values);
    let title = customTitle || '';
    if (!title.trim()) {
      title = nameVal ? `${template?.title || templateId} - ${nameVal}` : `Draft: ${template?.title || templateId} #${this.draftsList.length + 1}`;
    }

    const newDraft: Draft = {
      id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      templateId: templateId,
      title: title.trim(),
      updatedAt: new Date().toISOString(),
      values: { ...values },
      customBody: customBody
    };

    this.activeDraftId = newDraft.id;
    this.activeSidebarTab = 'drafts';
    this.templateService.saveDraft(newDraft);
  }

  onFieldChange() {
    const templateId = this.activeTemplateId;
    const values = this.formValues[templateId] || {};

    if (!this.activeDraftId) {
      if (this.draftsList.length < this.MAX_DRAFTS) {
        const template = this.templates.find(t => t.id === templateId);
        const nameVal = this.findNameValueInValues(templateId, values);
        const title = nameVal ? `${template?.title || templateId} - ${nameVal}` : `Draft: ${template?.title || templateId} (Autosaved)`;

        const newDraft: Draft = {
          id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          templateId: templateId,
          title: title,
          updatedAt: new Date().toISOString(),
          values: { ...values },
          customBody: this.isManualEditMode ? this.customBodyText : undefined
        };
        this.activeDraftId = newDraft.id;
        this.templateService.saveDraft(newDraft);
      }
    } else {
      this.saveDraft();
    }
    this.compilationSubject.next();
  }

  onCustomBodyChange() {
    if (this.isManualEditMode) {
      this.saveDraft();
      this.compilationSubject.next();
    }
  }

  toggleManualEditMode(enable: boolean) {
    if (enable) {
      this.customBodyText = this.getFilledTemplate(this.activeTemplateId, 'plain');
      this.isManualEditMode = true;
      this.saveDraft();
      this.updateCompiledTemplate();
      this.cdr.markForCheck();
    } else {
      this.openConfirm(
        'Switch to Sync Mode',
        'Are you sure you want to switch back to Form Sync Mode? Any manual modifications you made directly to the document text will be lost.',
        'warning',
        () => {
          this.isManualEditMode = false;
          this.customBodyText = '';
          this.saveDraft();
          this.updateCompiledTemplate();
          this.cdr.markForCheck();
        }
      );
    }
  }

  loadDraft(draftId: string) {
    const draft = this.draftsList.find(d => d.id === draftId);
    if (draft) {
      this.activeDraftId = draft.id;
      this.activeTemplateId = draft.templateId;

      if (!this.formValues[draft.templateId]) {
        this.formValues[draft.templateId] = {};
      }

      const template = this.templates.find(t => t.id === draft.templateId);
      if (template) {
        template.fields.forEach(f => {
          this.formValues[draft.templateId][f.key] = draft.values[f.key] !== undefined ? draft.values[f.key] : f.defaultValue;
        });
      }

      this.selectTemplate(draft.templateId, false);

      if (draft.customBody) {
        this.isManualEditMode = true;
        this.customBodyText = draft.customBody;
      } else {
        this.isManualEditMode = false;
        this.customBodyText = '';
      }

      this.activeMobileTab = 'form';
      this.updateCompiledTemplate();
    }
  }

  selectTemplate(id: string, resetValues = true) {
    this.templateLoading = true;
    this.activeTemplateId = id;
    this.copySuccess = false;
    this.downloadSuccess = false;
    this.activeMobileTab = 'form';

    if (!this.formValues[id]) {
      this.formValues[id] = {};
    }

    if (resetValues) {
      this.activeDraftId = null;
      this.isManualEditMode = false;
      this.customBodyText = '';
      const temp = this.templates.find(t => t.id === id);
      if (temp) {
        temp.fields.forEach(f => {
          if (this.formValues[id]) {
            if (f.type === 'date' && !f.defaultValue) {
              if (f.key === 'noticeDate' || f.key === 'currentDate' || f.key === 'declaredDate') {
                this.formValues[id][f.key] = this.getTodayDateString();
              } else {
                this.formValues[id][f.key] = '';
              }
            } else {
              this.formValues[id][f.key] = f.defaultValue;
            }
          }
        });
      }
    }

    setTimeout(() => {
      this.templateLoading = false;
      this.updateCompiledTemplate();
      this.cdr.markForCheck();
    }, 400);
  }

  createNewDraft(templateId: string) {
    this.selectTemplate(templateId, true);
  }

  // --- Custom Templates Creator Helper Functions ---
  parsePlaceholders() {
    const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
    const found: string[] = [];
    let match;
    while ((match = regex.exec(this.newTemplateBody)) !== null) {
      const key = match[1];
      if (!found.includes(key)) {
        found.push(key);
      }
    }
    this.parsedPlaceholders = found;

    const newConfig: { [key: string]: { label: string, type: string, helpTip: string } } = {};
    found.forEach(key => {
      if (this.customFieldsConfig[key]) {
        newConfig[key] = this.customFieldsConfig[key];
      } else {
        const friendlyLabel = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase())
          .trim();
        newConfig[key] = {
          label: friendlyLabel,
          type: 'text',
          helpTip: ''
        };
      }
    });
    this.customFieldsConfig = newConfig;
  }

  saveCustomTemplate() {
    if (!this.newTemplateTitle.trim() || !this.newTemplateBody.trim()) {
      this.openConfirm(
        'Missing Information',
        'Please enter a title and template body.',
        'warning',
        () => { }
      );
      return;
    }

    const id = `custom-${this.newTemplateTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
    const fields: TemplateField[] = this.parsedPlaceholders.map(key => {
      const config = this.customFieldsConfig[key];
      return {
        key: key,
        label: config.label || key,
        placeholder: `Enter ${config.label || key}`,
        type: config.type || 'text',
        defaultValue: '',
        helpTip: config.helpTip || undefined
      };
    });

    const newTemplate: Template = {
      id: id,
      title: this.newTemplateTitle.trim(),
      actRef: this.newTemplateAct.trim() || 'Custom Template',
      category: this.newTemplateCategory,
      description: this.newTemplateDesc.trim() || 'User defined custom template.',
      fields: fields,
      body: this.newTemplateBody,
      isCustom: true
    };

    this.templateService.saveCustomTemplate(newTemplate);

    this.newTemplateTitle = '';
    this.newTemplateAct = '';
    this.newTemplateDesc = '';
    this.newTemplateCategory = 'commercial';
    this.newTemplateBody = '';
    this.parsedPlaceholders = [];
    this.customFieldsConfig = {};
    this.showCreateTemplateModal = false;

    this.selectTemplate(id, true);
  }

  deleteCustomTemplate(id: string, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    this.openConfirm(
      'Delete Custom Template',
      'Are you sure you want to delete this custom template? All saved drafts for this template will remain but the template structure will be removed.',
      'danger',
      () => {
        this.templateService.deleteCustomTemplate(id);
        if (this.activeTemplateId === id) {
          this.selectTemplate(this.templates[0].id, true);
        }
      }
    );
  }

  toggleCategoryDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.showCategoryDropdown = !this.showCategoryDropdown;
    this.openFieldTypeDropdownKey = null;
  }

  selectCategory(val: string) {
    this.newTemplateCategory = val;
    this.showCategoryDropdown = false;
  }

  getCategoryLabel(val: string) {
    return this.categories.find(c => c.value === val)?.label || val;
  }

  toggleFieldTypeDropdown(key: string, event: MouseEvent) {
    event.stopPropagation();
    this.openFieldTypeDropdownKey = this.openFieldTypeDropdownKey === key ? null : key;
    this.showCategoryDropdown = false;
  }

  selectFieldType(key: string, type: string) {
    if (this.customFieldsConfig[key]) {
      this.customFieldsConfig[key].type = type;
    }
    this.openFieldTypeDropdownKey = null;
  }

  getFieldTypeLabel(key: string) {
    const val = this.customFieldsConfig[key]?.type;
    return this.fieldTypes.find(t => t.value === val)?.label || 'Short Text';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    this.showCategoryDropdown = false;
    this.openFieldTypeDropdownKey = null;
    this.showLayoutMenu = false;
  }

  openConfirm(title: string, message: string, type: 'danger' | 'warning' | 'info', action: () => void) {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.confirmType = type;
    this.confirmAction = action;
    this.showConfirm = true;
    this.cdr.markForCheck();
  }

  handleConfirm() {
    if (this.confirmAction) {
      this.confirmAction();
    }
    this.showConfirm = false;
    this.confirmAction = null;
    this.cdr.markForCheck();
  }

  handleCancel() {
    this.showConfirm = false;
    this.confirmAction = null;
    this.cdr.markForCheck();
  }

  deleteDraft(draftId: string, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();

    this.openConfirm(
      'Delete Draft',
      'Are you sure you want to delete this draft?',
      'danger',
      () => {
        this.templateService.deleteDraft(draftId);
        if (this.activeDraftId === draftId) {
          this.activeDraftId = null;
        }
      }
    );
  }

  clearAllDrafts() {
    this.openConfirm(
      'Wipe All Drafts',
      'Are you sure you want to delete ALL saved drafts? This action cannot be undone.',
      'danger',
      () => {
        this.templateService.clearAllDrafts();
        this.activeDraftId = null;
      }
    );
  }

  get totalDraftPages(): number {
    return Math.ceil(this.filteredDraftsList.length / this.draftPageSize) || 1;
  }

  nextDraftPage() {
    if (this.draftPage < this.totalDraftPages) {
      this.draftPage++;
      this.updateFiltersAndPagination();
    }
  }

  prevDraftPage() {
    if (this.draftPage > 1) {
      this.draftPage--;
      this.updateFiltersAndPagination();
    }
  }

  escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Compiler & Preview Formatting ---
  getFilledTemplate(templateId: string, mode: 'preview' | 'print' | 'plain'): string {
    if (this.isManualEditMode && this.customBodyText) {
      return this.customBodyText;
    }

    const template = this.templates.find(t => t.id === templateId);
    if (!template) return '';

    let text = template.body;
    const values = this.formValues[templateId] || {};

    template.fields.forEach(f => {
      const val = values[f.key];
      const regex = new RegExp(`{{\\s*${f.key}\\s*}}`, 'g');

      let replacement = '';
      if (val && val.trim()) {
        let finalVal = val;
        if (f.type === 'date') {
          try {
            const dateObj = new Date(val);
            if (!isNaN(dateObj.getTime())) {
              finalVal = dateObj.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              });
            }
          } catch (e) {
            // Keep raw val
          }
        }

        // Escape HTML for preview and print views to prevent XSS script injection
        if (mode === 'preview' || mode === 'print') {
          finalVal = this.escapeHtml(finalVal);
        }

        replacement = finalVal;

        if (mode === 'preview') {
          const isFocused = this.activeFieldKey === f.key;
          const focusClass = isFocused ? 'field-highlight-active ring-2 ring-indigo-500 bg-indigo-500/10' : '';
          replacement = `<span class="filled-field-span px-1 rounded cursor-pointer border border-transparent hover:border-indigo-500/30 transition-all ${focusClass}" data-field-key="${f.key}" title="Double-click to edit field">${replacement}</span>`;
        }
      } else {
        if (mode === 'preview' && this.highlightEmptyFields) {
          const isFocused = this.activeFieldKey === f.key;
          const focusClass = isFocused ? 'field-highlight-active-empty ring-4 ring-indigo-500/30 border-indigo-500 bg-indigo-500/20 text-indigo-700 scale-105' : 'bg-amber-105 dark:bg-amber-900/40 text-amber-800 dark:text-amber-250 border-amber-300 dark:border-amber-800';
          replacement = `<span class="placeholder-badge border rounded px-1.5 py-0.5 font-sans font-bold cursor-pointer transition-all hover:bg-amber-200 dark:hover:bg-amber-900/60 inline-flex items-center gap-1 select-all ${focusClass}" data-field-key="${f.key}" title="Double-click to fill field">[${f.label}]</span>`;
        } else {
          if (this.emptyFieldsMode === 'placeholder') {
            replacement = `[${f.label}]`;
          } else if (this.emptyFieldsMode === 'underline') {
            replacement = '________________________';
          } else {
            replacement = '      ';
          }
        }
      }
      text = text.replace(regex, replacement);
    });

    return text;
  }

  // --- Clipboard, Download, Print Utilities ---
  copyToClipboard() {
    navigator.clipboard.writeText(this.compiledTemplatePlain).then(() => {
      this.copySuccess = true;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.copySuccess = false;
        this.cdr.markForCheck();
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }

  downloadTxtFile() {
    const blob = new Blob([this.compiledTemplatePlain], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.activeTemplateId}_draft.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    this.downloadSuccess = true;
    this.templateService.recordTemplateUsage(this.activeTemplateId);
    this.cdr.markForCheck();
    setTimeout(() => {
      this.downloadSuccess = false;
      this.cdr.markForCheck();
    }, 2000);
  }

  onPreviewClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const badge = target.closest('[data-field-key]');
    if (badge) {
      const fieldKey = badge.getAttribute('data-field-key');
      if (fieldKey) {
        const inputEl = document.getElementById(`input-${fieldKey}`);
        if (inputEl) {
          inputEl.focus();
          inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

          inputEl.classList.add('ring-4', 'ring-amber-500/30', 'border-amber-500');
          setTimeout(() => {
            inputEl.classList.remove('ring-4', 'ring-amber-500/30', 'border-amber-500');
          }, 1500);
        }
      }
    }
  }

  triggerPrint() {
    const t = this.activeTemplate;
    const title = t?.title || 'Legal Document Draft';
    const plainText = this.compiledTemplatePlain || '';
    const formVals = this.formValues[this.activeTemplateId] || {};

    this.printExportService.open({
      title: `${title} — Instrument Dispatch`,
      subtitle: 'Export legal instrument as court-ready PDF, plain text execution copy, or JSON values.',
      formats: ['pdf', 'txt', 'json'],
      allowWatermark: true,
      defaultWatermark: 'DRAFT',
      onExport: async (params) => {
        if (params.format === 'pdf') {
          const contentHtml = this.printService.buildLegalDraft(plainText, {
            hasSignatureBlock: false,
          });
          this.printService.print({
            title: t.title,
            subtitle: `${(t.category || 'LEGAL').toUpperCase()} • Draft Instrument`,
            content: contentHtml,
            watermark: params.watermark !== 'NONE' ? params.watermark : undefined,
            classification: params.watermark !== 'NONE' ? params.watermark : 'DRAFT',
            sealText: 'Official LegalConnect Document Draft • Non-Notarized Instrument',
            extraMeta: [
              { label: 'Template ID', value: t.id },
              { label: 'Category', value: t.category },
            ],
          });
        } else if (params.format === 'txt') {
          this.downloadTxtFile();
        } else if (params.format === 'json') {
          const jsonStr = JSON.stringify({
            templateId: t.id,
            templateTitle: t.title,
            category: t.category,
            compiledAt: new Date().toISOString(),
            formValues: formVals
          }, null, 2);
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${t.id}-data-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    });
  }
}