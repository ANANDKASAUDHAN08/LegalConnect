import { Component, OnInit, OnDestroy, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AdminApiService } from '../../core/admin-api.service';
import { AdminIconComponent } from '../../shared/components/icon/icon.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { CsvExporter } from '../../core/utils/csv-exporter';
import { environment } from '../../../environments/environment';

export interface StatutoryRightAdminItem {
  _id?: string;
  id: string;
  slug: string;
  title: string;
  category: string;
  icon: string;
  summary: string;
  statutoryBasis: {
    actName: string;
    shortAct: string;
    sections: string[];
    actUrl?: string;
    landmarkCases?: string[];
  };
  keyProtections: string[];
  actionableSteps: string[];
  legalRemedy: string;
  emergencyHelpline?: {
    name: string;
    number: string;
    description: string;
    portalUrl?: string;
  };
  penaltiesForViolation?: string;
  scenarioTag?: string;
  whatToSay?: string;
  dos?: string[];
  donts?: string[];
  title_hi?: string;
  summary_hi?: string;
  whatToSay_hi?: string;
  dos_hi?: string[];
  donts_hi?: string[];
  verifiedDate?: string;
  verifiedBy?: string;
  isPopular?: boolean;
  isPublished?: boolean;
}

export interface RightFormModel {
  id: string;
  slug: string;
  title: string;
  title_hi: string;
  category: string;
  icon: string;
  summary: string;
  summary_hi: string;
  actName: string;
  shortAct: string;
  sectionsText: string;
  actUrl: string;
  landmarkCasesText: string;
  keyProtectionsText: string;
  actionableStepsText: string;
  legalRemedy: string;
  penaltiesForViolation: string;
  scenarioTag: string;
  whatToSay: string;
  whatToSay_hi: string;
  dosText: string;
  dontsText: string;
  helplineName: string;
  helplineNumber: string;
  helplineDesc: string;
  helplineUrl: string;
  isPopular: boolean;
  isPublished: boolean;
  verifiedBy: string;
}

export interface EmergencyScenarioAdminItem {
  _id?: string;
  tag: string;
  label: string;
  label_hi?: string;
  icon: string;
  color: string;
  description: string;
  description_hi?: string;
  subtext?: string;
  subtext_hi?: string;
  badge?: string;
  filterKeywords?: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
}

@Component({
  selector: 'admin-rights',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminIconComponent,
    TooltipDirective
  ],
  templateUrl: './rights.component.html',
  styleUrl: './rights.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RightsComponent implements OnInit, OnDestroy {
  // Navigation Tabs
  activeTab = signal<'rights' | 'scenarios' | 'analytics'>('rights');

  // Statutory Rights State
  rights = signal<StatutoryRightAdminItem[]>([]);
  isLoading = signal(false);
  isSyncing = signal(false);
  isSubmitting = signal(false);

  // AI Gazette Codifier State
  isAiModalOpen = signal(false);
  aiInputText = signal('');
  isAiCodifying = signal(false);

  // Telemetry & Demand Analytics State
  analyticsData = signal<any>(null);
  isLoadingAnalytics = signal(false);

  // Scenarios State
  scenarios = signal<EmergencyScenarioAdminItem[]>([]);
  isLoadingScenarios = signal(false);
  isScenarioModalOpen = signal(false);
  isEditingScenario = signal(false);
  editingScenarioTag = signal<string | null>(null);
  scenarioKeywordsText = signal<string>('');
  scenarioForm = signal<EmergencyScenarioAdminItem>({
    tag: '',
    label: '',
    label_hi: '',
    icon: 'shield',
    color: 'blue',
    description: '',
    subtext: '',
    badge: '',
    filterKeywords: [],
    sortOrder: 1,
    isActive: true
  });

  // Filters & Search
  searchQuery = signal('');
  selectedCategory = signal('All');
  filterStatus = signal<'all' | 'published' | 'draft'>('all');
  filterPriority = signal<'all' | 'priority'>('all');

  // Drawer / Modal State
  isDrawerOpen = signal(false);
  isEditing = signal(false);
  editingId = signal<string | null>(null);

  // Form State
  form = signal<RightFormModel>(this.getEmptyForm());

  readonly userAppUrl = environment.userAppUrl || 'http://localhost:4200';

  readonly categories = [
    'All',
    'Constitutional & Civil Liberties',
    'Police & Criminal Justice',
    'Traffic & Motor Vehicles',
    'Banking, UPI & Cyber Fraud',
    'Consumer Protection & E-Commerce',
    'Tenancy & Housing Rights',
    'Women, POSH & Domestic Safeguards',
    'Labour, Wages & Employment',
    'Healthcare & Patient Charters',
    'Digital Privacy & DPDP Act',
    'Aviation & Passenger Charters',
    'Senior Citizens & Maintenance',
    'Transparency & Governance'
  ];

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  // Telemetry Metrics
  totalCount = computed(() => this.rights().length);
  publishedCount = computed(() => this.rights().filter(r => r.isPublished !== false).length);
  draftCount = computed(() => this.rights().filter(r => r.isPublished === false).length);
  priorityCount = computed(() => this.rights().filter(r => r.isPopular === true).length);
  scenariosCount = computed(() => this.scenarios().length);

  // Filtered Rights List for View
  filteredRights = computed(() => {
    let list = this.rights();

    const cat = this.selectedCategory();
    if (cat && cat !== 'All') {
      list = list.filter(r => r.category.toLowerCase() === cat.toLowerCase());
    }

    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.statutoryBasis?.actName && r.statutoryBasis.actName.toLowerCase().includes(q)) ||
        (r.statutoryBasis?.shortAct && r.statutoryBasis.shortAct.toLowerCase().includes(q))
      );
    }

    const status = this.filterStatus();
    if (status === 'published') {
      list = list.filter(r => r.isPublished !== false);
    } else if (status === 'draft') {
      list = list.filter(r => r.isPublished === false);
    }

    const pri = this.filterPriority();
    if (pri === 'priority') {
      list = list.filter(r => r.isPopular === true);
    }

    return list;
  });

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialog: DialogService
  ) { }

  ngOnInit(): void {
    this.fetchRights();
    this.fetchScenarios();

    this.searchSubject
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(q => {
        this.searchQuery.set(q);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- TAB NAVIGATION ---
  setTab(tab: 'rights' | 'scenarios' | 'analytics'): void {
    this.activeTab.set(tab);
    if (tab === 'scenarios' && this.scenarios().length === 0) {
      this.fetchScenarios();
    } else if (tab === 'analytics' && !this.analyticsData()) {
      this.fetchAnalytics();
    }
  }

  // --- AI GAZETTE CODIFIER ---
  openAiModal(): void {
    this.aiInputText.set('');
    this.isAiModalOpen.set(true);
  }

  closeAiModal(): void {
    this.isAiModalOpen.set(false);
  }

  runAiCodify(): void {
    const text = this.aiInputText().trim();
    if (!text || text.length < 20) {
      this.toast.warning('Please paste legal text (Gazette circular, statute, or judgment) with at least 20 characters.');
      return;
    }

    this.isAiCodifying.set(true);
    this.api.aiCodifyRight(text)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.isAiCodifying.set(false);
          if (res.success && res.data) {
            const codified = res.data;
            this.toast.success(`Successfully codified: "${codified.title}". Loaded into draft editor.`);
            this.closeAiModal();
            this.populateDrawerFromAi(codified);
          } else {
            this.toast.warning('AI was unable to extract statutory structure from the provided text.');
          }
        },
        error: err => {
          this.isAiCodifying.set(false);
          this.toast.error('AI Codification failed: ' + (err?.error?.message || err.message));
        }
      });
  }

  populateDrawerFromAi(codified: any): void {
    this.isEditing.set(false);
    this.editingId.set(null);
    this.form.set({
      id: codified.id || '',
      slug: codified.id || '',
      title: codified.title || '',
      title_hi: codified.title_hi || '',
      category: codified.category || 'Constitutional & Civil Liberties',
      icon: codified.icon || 'scale',
      summary: codified.summary || '',
      summary_hi: codified.summary_hi || '',
      actName: codified.statutoryBasis?.actName || '',
      shortAct: codified.statutoryBasis?.shortAct || '',
      sectionsText: (codified.statutoryBasis?.sections || []).join('\n'),
      actUrl: codified.statutoryBasis?.actUrl || '/laws',
      landmarkCasesText: (codified.statutoryBasis?.landmarkCases || []).join('\n'),
      keyProtectionsText: (codified.keyProtections || []).join('\n'),
      actionableStepsText: (codified.actionableSteps || []).join('\n'),
      legalRemedy: codified.legalRemedy || '',
      penaltiesForViolation: codified.penaltiesForViolation || '',
      scenarioTag: codified.scenarioTag || '',
      whatToSay: codified.whatToSay || '',
      whatToSay_hi: codified.whatToSay_hi || '',
      dosText: (codified.dos || []).join('\n'),
      dontsText: (codified.donts || []).join('\n'),
      helplineName: codified.emergencyHelpline?.name || '',
      helplineNumber: codified.emergencyHelpline?.number || '',
      helplineDesc: codified.emergencyHelpline?.description || '',
      helplineUrl: codified.emergencyHelpline?.portalUrl || '',
      isPopular: !!codified.isPopular,
      isPublished: true,
      verifiedBy: 'LegalConnect AI Codifier'
    });
    this.isDrawerOpen.set(true);
  }

  // --- TELEMETRY & CITIZEN DEMAND ANALYTICS ---
  fetchAnalytics(): void {
    this.isLoadingAnalytics.set(true);
    this.api.getRightsAnalytics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.isLoadingAnalytics.set(false);
          if (res.success) {
            this.analyticsData.set(res.data);
          }
        },
        error: () => {
          this.isLoadingAnalytics.set(false);
          this.toast.error('Failed to load telemetry analytics.');
        }
      });
  }

  // --- STATUTORY RIGHTS DATA ---
  fetchRights(): void {
    this.isLoading.set(true);
    this.api.getRights({ limit: 100 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.isLoading.set(false);
          if (res && res.success) {
            this.rights.set(res.data || []);
          }
        },
        error: err => {
          this.isLoading.set(false);
          this.toast.error('Failed to load citizen rights catalog: ' + (err?.error?.message || err.message));
        }
      });
  }

  fetchScenarios(): void {
    this.isLoadingScenarios.set(true);
    this.api.getRightsScenarios()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.isLoadingScenarios.set(false);
          if (res && res.success) {
            this.scenarios.set(res.data || []);
          }
        },
        error: () => {
          this.isLoadingScenarios.set(false);
        }
      });
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  setCategory(cat: string): void {
    this.selectedCategory.set(cat);
  }

  setStatus(status: 'all' | 'published' | 'draft'): void {
    this.filterStatus.set(status);
  }

  togglePriorityFilter(): void {
    this.filterPriority.set(this.filterPriority() === 'priority' ? 'all' : 'priority');
  }

  syncCatalog(): void {
    if (this.isSyncing()) return;
    this.isSyncing.set(true);
    this.toast.info('Synchronizing statutory catalog and emergency scenarios with MongoDB...');

    this.api.syncRightsCatalog()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.isSyncing.set(false);
          if (res.success) {
            this.toast.success(res.message);
            this.fetchRights();
            this.fetchScenarios();
          } else {
            this.toast.warning('Catalog synchronization completed with warnings.');
          }
        },
        error: err => {
          this.isSyncing.set(false);
          this.toast.error('Catalog synchronization failed: ' + (err?.error?.message || err.message));
        }
      });
  }

  // --- CSV EXPORTER ---
  exportCsv(): void {
    const list = this.filteredRights();
    if (list.length === 0) {
      this.toast.warning('No rights matching the current filter to export.');
      return;
    }

    const headers = [
      'ID',
      'Title',
      'Category',
      'Governing Act',
      'Short Act',
      'Sections',
      'Summary',
      'Legal Remedy',
      'Penalties',
      'Priority',
      'Status',
      'Helpline Number',
      'Verified Date'
    ];

    const rows = list.map(r => [
      r.id,
      r.title,
      r.category,
      r.statutoryBasis?.actName || '',
      r.statutoryBasis?.shortAct || '',
      (r.statutoryBasis?.sections || []).join('; '),
      r.summary,
      r.legalRemedy || '',
      r.penaltiesForViolation || '',
      r.isPopular ? 'Priority' : 'Standard',
      r.isPublished !== false ? 'Published' : 'Draft',
      r.emergencyHelpline?.number || '',
      r.verifiedDate || ''
    ]);

    try {
      CsvExporter.export('Statutory_Citizen_Rights_Catalog', headers, rows);
      this.toast.success(`Exported ${rows.length} statutory rights to CSV spreadsheet.`);
    } catch (err: any) {
      this.toast.error('Failed to export CSV: ' + err.message);
    }
  }

  togglePopular(right: StatutoryRightAdminItem): void {
    this.api.togglePopularRight(right.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          if (res.success) {
            right.isPopular = res.isPopular ?? !right.isPopular;
            this.rights.set([...this.rights()]);
            this.toast.info(res.message);
          }
        },
        error: () => this.toast.error('Failed to toggle priority status.')
      });
  }

  togglePublish(right: StatutoryRightAdminItem): void {
    this.api.togglePublishRight(right.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          if (res.success) {
            right.isPublished = res.isPublished ?? !right.isPublished;
            this.rights.set([...this.rights()]);
            this.toast.success(res.message);
          }
        },
        error: () => this.toast.error('Failed to toggle publish status.')
      });
  }

  openCreate(): void {
    this.isEditing.set(false);
    this.editingId.set(null);
    this.form.set(this.getEmptyForm());
    this.isDrawerOpen.set(true);
  }

  openEdit(right: StatutoryRightAdminItem): void {
    this.isEditing.set(true);
    this.editingId.set(right.id);

    this.form.set({
      id: right.id,
      slug: right.slug || right.id,
      title: right.title,
      title_hi: right.title_hi || '',
      category: right.category,
      icon: right.icon || 'scale',
      summary: right.summary,
      summary_hi: right.summary_hi || '',
      actName: right.statutoryBasis?.actName || '',
      shortAct: right.statutoryBasis?.shortAct || '',
      sectionsText: (right.statutoryBasis?.sections || []).join('\n'),
      actUrl: right.statutoryBasis?.actUrl || '',
      landmarkCasesText: (right.statutoryBasis?.landmarkCases || []).join('\n'),
      keyProtectionsText: (right.keyProtections || []).join('\n'),
      actionableStepsText: (right.actionableSteps || []).join('\n'),
      legalRemedy: right.legalRemedy || '',
      penaltiesForViolation: right.penaltiesForViolation || '',
      scenarioTag: right.scenarioTag || '',
      whatToSay: right.whatToSay || '',
      whatToSay_hi: right.whatToSay_hi || '',
      dosText: (right.dos || []).join('\n'),
      dontsText: (right.donts || []).join('\n'),
      helplineName: right.emergencyHelpline?.name || '',
      helplineNumber: right.emergencyHelpline?.number || '',
      helplineDesc: right.emergencyHelpline?.description || '',
      helplineUrl: right.emergencyHelpline?.portalUrl || '',
      isPopular: !!right.isPopular,
      isPublished: right.isPublished !== false,
      verifiedBy: right.verifiedBy || 'LegalConnect Directorate'
    });

    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
  }

  saveRight(): void {
    const f = this.form();
    if (!f.title.trim() || !f.category || !f.summary.trim() || !f.actName.trim()) {
      this.toast.warning('Mandatory fields: Title, Category, Summary, and Act Name are required.');
      return;
    }

    this.isSubmitting.set(true);

    const payload: any = {
      title: f.title.trim(),
      title_hi: f.title_hi.trim(),
      slug: f.slug.trim() || f.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category: f.category,
      icon: f.icon || 'scale',
      summary: f.summary.trim(),
      summary_hi: f.summary_hi.trim(),
      statutoryBasis: {
        actName: f.actName.trim(),
        shortAct: f.shortAct.trim() || f.actName.trim(),
        sections: f.sectionsText.split('\n').map(s => s.trim()).filter(Boolean),
        actUrl: f.actUrl.trim() || '/laws',
        landmarkCases: f.landmarkCasesText.split('\n').map(s => s.trim()).filter(Boolean)
      },
      keyProtections: f.keyProtectionsText.split('\n').map(s => s.trim()).filter(Boolean),
      actionableSteps: f.actionableStepsText.split('\n').map(s => s.trim()).filter(Boolean),
      legalRemedy: f.legalRemedy.trim(),
      penaltiesForViolation: f.penaltiesForViolation.trim(),
      scenarioTag: f.scenarioTag.trim(),
      whatToSay: f.whatToSay.trim(),
      whatToSay_hi: f.whatToSay_hi.trim(),
      dos: f.dosText.split('\n').map(s => s.trim()).filter(Boolean),
      donts: f.dontsText.split('\n').map(s => s.trim()).filter(Boolean),
      isPopular: f.isPopular,
      isPublished: f.isPublished,
      verifiedBy: f.verifiedBy.trim() || 'LegalConnect Directorate'
    };

    if (f.helplineName || f.helplineNumber) {
      payload.emergencyHelpline = {
        name: f.helplineName.trim(),
        number: f.helplineNumber.trim(),
        description: f.helplineDesc.trim(),
        portalUrl: f.helplineUrl.trim()
      };
    }

    const obs$ = this.isEditing() && this.editingId()
      ? this.api.updateRight(this.editingId()!, payload)
      : this.api.createRight(payload);

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        this.isSubmitting.set(false);
        if (res.success) {
          this.toast.success(res.message || 'Citizen right saved successfully.');
          this.closeDrawer();
          this.fetchRights();
        } else {
          this.toast.warning('Operation finished with warning.');
        }
      },
      error: err => {
        this.isSubmitting.set(false);
        this.toast.error('Failed to save citizen right: ' + (err?.error?.message || err.message));
      }
    });
  }

  confirmDelete(right: StatutoryRightAdminItem): void {
    this.dialog.confirm({
      title: 'Delete Statutory Citizen Right?',
      message: `Are you sure you want to permanently delete "${right.title}"? This cannot be undone.`,
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel',
      type: 'danger'
    }).then(confirmed => {
      if (confirmed) {
        this.api.deleteRight(right.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: res => {
              if (res.success) {
                this.toast.success(res.message || 'Citizen right deleted.');
                this.fetchRights();
              }
            },
            error: err => {
              this.toast.error('Failed to delete citizen right: ' + (err?.error?.message || err.message));
            }
          });
      }
    });
  }

  previewPublic(right: StatutoryRightAdminItem): void {
    window.open(`${this.userAppUrl}/rights#${right.id}`, '_blank');
  }

  // --- EMERGENCY SCENARIO MANAGEMENT ---
  openCreateScenario(): void {
    this.isEditingScenario.set(false);
    this.editingScenarioTag.set(null);
    this.scenarioKeywordsText.set('');
    this.scenarioForm.set({
      tag: '',
      label: '',
      label_hi: '',
      icon: 'shield',
      color: 'blue',
      description: '',
      subtext: '',
      badge: '',
      filterKeywords: [],
      sortOrder: (this.scenarios().length || 0) + 1,
      isActive: true
    });
    this.isScenarioModalOpen.set(true);
  }

  openEditScenario(sc: EmergencyScenarioAdminItem): void {
    this.isEditingScenario.set(true);
    this.editingScenarioTag.set(sc.tag);
    this.scenarioKeywordsText.set((sc.filterKeywords || []).join(', '));
    this.scenarioForm.set({ ...sc });
    this.isScenarioModalOpen.set(true);
  }

  closeScenarioModal(): void {
    this.isScenarioModalOpen.set(false);
  }

  saveScenario(): void {
    const f = this.scenarioForm();
    if (!f.tag.trim() || !f.label.trim() || !f.description.trim()) {
      this.toast.warning('Tag, Label, and Description are required.');
      return;
    }

    // Process filter keywords from comma-separated input
    const keywords = this.scenarioKeywordsText()
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(Boolean);
    f.filterKeywords = keywords;

    const obs$ = this.isEditingScenario() && this.editingScenarioTag()
      ? this.api.updateScenario(this.editingScenarioTag()!, f)
      : this.api.createScenario(f);

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        if (res.success) {
          this.toast.success(res.message || 'Emergency scenario saved.');
          this.closeScenarioModal();
          this.fetchScenarios();
        }
      },
      error: err => {
        this.toast.error('Failed to save scenario: ' + (err?.error?.message || err.message));
      }
    });
  }

  toggleScenarioStatus(sc: EmergencyScenarioAdminItem): void {
    const newStatus = !sc.isActive;
    this.api.updateScenario(sc.tag, { isActive: newStatus })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          sc.isActive = newStatus;
          this.scenarios.set([...this.scenarios()]);
          this.toast.info(`Scenario "${sc.label}" set to ${newStatus ? 'Active' : 'Hidden'}.`);
        },
        error: () => this.toast.error('Failed to toggle scenario status.')
      });
  }

  deleteScenario(sc: EmergencyScenarioAdminItem): void {
    this.dialog.confirm({
      title: 'Delete Emergency Situation Scenario?',
      message: `Are you sure you want to delete "${sc.label}" (${sc.tag})?`,
      confirmText: 'Delete Scenario',
      cancelText: 'Cancel',
      type: 'danger'
    }).then(confirmed => {
      if (confirmed) {
        this.api.deleteScenario(sc.tag)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.toast.success('Scenario deleted.');
              this.fetchScenarios();
            },
            error: err => {
              this.toast.error('Failed to delete scenario: ' + (err?.error?.message || err.message));
            }
          });
      }
    });
  }

  private getEmptyForm(): RightFormModel {
    return {
      id: '',
      slug: '',
      title: '',
      title_hi: '',
      category: 'Constitutional & Civil Liberties',
      icon: 'scale',
      summary: '',
      summary_hi: '',
      actName: '',
      shortAct: '',
      sectionsText: '',
      actUrl: '',
      landmarkCasesText: '',
      keyProtectionsText: '',
      actionableStepsText: '',
      legalRemedy: '',
      penaltiesForViolation: '',
      scenarioTag: '',
      whatToSay: '',
      whatToSay_hi: '',
      dosText: '',
      dontsText: '',
      helplineName: '',
      helplineNumber: '',
      helplineDesc: '',
      helplineUrl: '',
      isPopular: false,
      isPublished: true,
      verifiedBy: 'LegalConnect Directorate'
    };
  }
}