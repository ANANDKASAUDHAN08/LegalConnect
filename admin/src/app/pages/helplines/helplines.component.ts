import { Component, OnInit, OnDestroy, HostListener, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { CsvExporter } from '../../core/utils/csv-exporter';
import { HelplineItem } from '../legal-content/legal-content.models';
import { ApiResponse } from '../../core/models/admin.models';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { INDIAN_STATES } from '../../core/constants/geo.constants';
import { TableSelection, handleTableKeyboardNav } from '../../core/utils/table.utils';
import { AdminIconComponent } from '../../shared/components/icon/icon.component';
import { AdminSavedViewsComponent } from '../../shared/components/saved-views/saved-views.component';
import { ExportModalComponent, ExportConfig } from '../../shared/components/export-modal/export-modal.component';
import { ColumnDef } from '../../shared/components/column-customizer/column-customizer.component';

@Component({
  selector: 'admin-helplines',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SkeletonComponent,
    TooltipDirective,
    SelectComponent,
    AdminIconComponent,
    AdminSavedViewsComponent,
    ExportModalComponent
  ],
  templateUrl: './helplines.component.html',
  styleUrl: './helplines.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelplinesComponent implements OnInit, OnDestroy {
  helplines = signal<HelplineItem[]>([]);
  isLoading = signal(false);
  isInitialLoad = signal(true);
  isSaving = signal(false);
  isPinging = signal(false);

  // Search & Filter Signals
  searchQuery = signal('');
  selectedCategory = signal('');
  selectedPriority = signal('');
  selectedState = signal('');
  selectedStatus = signal('');

  // Selected item IDs for bulk operations
  selection = new TableSelection<string>();
  selectedIds = signal<Set<string>>(new Set());

  focusedRowIndex = -1;
  private destroy$ = new Subject<void>();

  // Backend Metrics summary
  metrics = signal({
    total: 0,
    active: 0,
    p0Critical: 0,
    p1Urgent: 0,
    p2Advisory: 0,
    national: 0,
    offline: 0
  });

  // Export Modal & Saved Views State
  isExportModalOpen = false;
  isExporting = false;

  columnDefs: ColumnDef[] = [
    { key: 'name', label: 'Helpline Title' },
    { key: 'number', label: 'Toll-Free / Number' },
    { key: 'category', label: 'Category' },
    { key: 'priorityTier', label: 'Priority Tier' },
    { key: 'state', label: 'Jurisdiction State' },
    { key: 'operatingHours', label: 'Operating Schedule' },
    { key: 'languages', label: 'Languages' },
    { key: 'isActive', label: 'Carrier Status' },
    { key: 'lastVerifiedAt', label: 'Last Verified Date' }
  ];

  get activeQueryParamsObj(): Record<string, any> {
    const obj: Record<string, any> = {};
    if (this.selectedPriority()) obj['priority'] = this.selectedPriority();
    if (this.selectedCategory()) obj['category'] = this.selectedCategory();
    if (this.selectedState()) obj['state'] = this.selectedState();
    if (this.selectedStatus()) obj['status'] = this.selectedStatus();
    if (this.searchQuery()) obj['search'] = this.searchQuery();
    return obj;
  }

  // Modal drawer states
  isModalOpen = false;
  isEditMode = false;
  editingId: string | null = null;

  // Verification Ping Modal
  pingModalItem: HelplineItem | null = null;
  pingNotes = 'Direct carrier dial test verified operational with live agent response';

  formData = {
    name: '',
    number: '',
    category: 'General',
    priorityTier: 'P0_CRITICAL' as 'P0_CRITICAL' | 'P1_URGENT' | 'P2_ADVISORY',
    description: '',
    isActive: true,
    is24x7: true,
    operatingHours: '24 Hours / 7 Days',
    languagesStr: 'English, Hindi',
    state: 'All India',
    tollFree: true,
    alternateNumbersStr: ''
  };

  categoryOptions: SelectOption[] = [
    { label: 'All Categories', value: '' },
    { label: 'General / Public Services', value: 'General' },
    { label: 'Women Safety & Crisis', value: 'Women Safety' },
    { label: 'Cyber Crime & Financial Fraud', value: 'Cyber' },
    { label: 'Child Protection & Welfare', value: 'Child Care' },
    { label: 'Family & Senior Citizens', value: 'Family' },
    { label: 'Legal Aid (NALSA / Tele-Law)', value: 'LegalAid' }
  ];

  priorityOptions: SelectOption[] = [
    { label: 'All Severity Tiers', value: '' },
    { label: 'P0 - Critical Life Safety (112, 1091)', value: 'P0_CRITICAL' },
    { label: 'P1 - Urgent Cyber / Fraud (1930)', value: 'P1_URGENT' },
    { label: 'P2 - Advisory & Legal Aid (15100)', value: 'P2_ADVISORY' }
  ];

  stateOptions: SelectOption[] = [
    { label: 'All Jurisdictions', value: '' },
    { label: 'National (All India)', value: 'National' },
    ...INDIAN_STATES.map(st => ({ label: st, value: st }))
  ];

  statusOptions: SelectOption[] = [
    { label: 'All Statuses', value: '' },
    { label: 'Active 24/7 Lines', value: 'active' },
    { label: 'Offline / Maintenance', value: 'offline' }
  ];

  // Computed Filtered List
  filteredHelplines = computed(() => {
    const list = this.helplines();
    const query = this.searchQuery().trim().toLowerCase();
    const cat = this.selectedCategory().toLowerCase();
    const priority = this.selectedPriority();
    const stateVal = this.selectedState().toLowerCase();
    const statusVal = this.selectedStatus();

    return list.filter(h => {
      const matchSearch = !query ||
        (h.name || h.title || '').toLowerCase().includes(query) ||
        (h.number || h.phone || '').includes(query) ||
        (h.description || '').toLowerCase().includes(query) ||
        (h.state || '').toLowerCase().includes(query);

      const matchCat = !cat || (h.category || '').toLowerCase().includes(cat);
      const matchPriority = !priority || h.priorityTier === priority;

      const matchState = !stateVal ||
        (stateVal === 'national' ? (h.state || 'All India').toLowerCase().includes('all india') : (h.state || '').toLowerCase().includes(stateVal));

      const matchStatus = !statusVal ||
        (statusVal === 'active' ? h.isActive !== false : h.isActive === false);

      return matchSearch && matchCat && matchPriority && matchState && matchStatus;
    });
  });

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialogService: DialogService
  ) { }

  ngOnInit(): void {
    this.fetchHelplines();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    handleTableKeyboardNav(event, {
      getListLength: () => this.filteredHelplines().length,
      getFocusedIndex: () => this.focusedRowIndex,
      setFocusedIndex: (idx) => { this.focusedRowIndex = idx; },
      onEnter: (idx) => {
        const item = this.filteredHelplines()[idx];
        if (item) this.openEditModal(item);
      },
      onEscape: () => {
        this.closeModal();
        this.closePingModal();
      }
    });
  }

  onSavedViewApply(savedParams: Record<string, any>): void {
    this.selectedPriority.set(savedParams?.['priority'] || '');
    this.selectedCategory.set(savedParams?.['category'] || '');
    this.selectedState.set(savedParams?.['state'] || '');
    this.selectedStatus.set(savedParams?.['status'] || '');
    this.searchQuery.set(savedParams?.['search'] || '');
    this.toast.info('Applied saved helpline view preset.');
    this.fetchHelplines();
  }

  fetchHelplines(): void {
    const params: Record<string, string | boolean | undefined> = {};
    if (this.selectedPriority()) params['priorityTier'] = this.selectedPriority();
    if (this.selectedState()) params['state'] = this.selectedState();
    if (this.selectedCategory()) params['category'] = this.selectedCategory();
    if (this.selectedStatus()) params['isActive'] = this.selectedStatus() === 'active';
    if (this.searchQuery()) params['search'] = this.searchQuery();

    // SWR Cache Hydration
    const cached = this.api.getCachedHelplines(params);
    if (cached) {
      const data: HelplineItem[] = Array.isArray(cached) ? cached : (cached?.data || (cached as any)?.helplines || []);
      this.helplines.set(data);
      if (cached?.metrics) {
        this.metrics.set(cached.metrics);
      } else {
        this.calculateLocalMetrics(data);
      }
      this.isLoading.set(false);
      this.isInitialLoad.set(false);
    } else {
      this.isLoading.set(true);
    }

    this.api.getHelplines(params).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: ApiResponse<HelplineItem[]> | { data?: HelplineItem[]; helplines?: HelplineItem[]; metrics?: any } | HelplineItem[]) => {
        this.isLoading.set(false);
        this.isInitialLoad.set(false);
        const data: HelplineItem[] = Array.isArray(res) ? res : (res?.data || (res as any)?.helplines || []);
        this.helplines.set(data);
        if (res && 'metrics' in res && res.metrics) {
          this.metrics.set(res.metrics);
        } else {
          this.calculateLocalMetrics(data);
        }
      },
      error: (err: HttpErrorResponse | Error) => {
        this.isLoading.set(false);
        this.isInitialLoad.set(false);
        const msg = err instanceof HttpErrorResponse ? err.error?.message || err.message : err.message;
        this.toast.error(msg || 'Failed to sync helpline telemetry.');
      }
    });
  }

  private calculateLocalMetrics(data: HelplineItem[]): void {
    this.metrics.set({
      total: data.length,
      active: data.filter(h => h.isActive !== false).length,
      p0Critical: data.filter(h => h.priorityTier === 'P0_CRITICAL').length,
      p1Urgent: data.filter(h => h.priorityTier === 'P1_URGENT').length,
      p2Advisory: data.filter(h => !h.priorityTier || h.priorityTier === 'P2_ADVISORY').length,
      national: data.filter(h => !h.state || h.state === 'All India').length,
      offline: data.filter(h => h.isActive === false).length
    });
  }

  onFilterChange(): void {
    this.fetchHelplines();
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedCategory.set('');
    this.selectedPriority.set('');
    this.selectedState.set('');
    this.selectedStatus.set('');
    this.toast.info('Helpline filters reset to default.');
    this.fetchHelplines();
  }

  // Copy to clipboard with instant toast notification
  copyToClipboard(text: string, label = 'Number'): void {
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.toast.success(`${label} "${text}" copied to clipboard.`);
      }).catch(() => {
        this.toast.info(`${label}: ${text}`);
      });
    } else {
      this.toast.info(`${label}: ${text}`);
    }
  }

  toggleSelectAll(checked?: boolean): void {
    const list = this.filteredHelplines();
    const allIds = list.map(h => h._id || h.id || '').filter(Boolean);
    if (checked !== undefined) {
      if (checked) {
        allIds.forEach(id => this.selection.selectedIds.add(id));
      } else {
        this.selection.clear();
      }
    } else {
      this.selection.toggleAll(allIds);
    }
    this.selectedIds.set(new Set(this.selection.selectedIds));
  }

  toggleSelectOne(id: string): void {
    this.selection.toggle(id);
    this.selectedIds.set(new Set(this.selection.selectedIds));
  }

  isAllSelected(): boolean {
    const list = this.filteredHelplines();
    if (!list.length) return false;
    const allIds = list.map(h => h._id || h.id || '').filter(Boolean);
    return this.selection.isAllSelected(allIds);
  }

  // Bulk Status Update
  bulkSetStatus(isActive: boolean): void {
    const ids = this.selection.toArray();
    if (!ids.length) {
      this.toast.warning('Please select at least one helpline line.');
      return;
    }

    this.api.bulkUpdateHelplineStatus(ids, isActive).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toast.success(`Updated ${ids.length} helpline(s) to ${isActive ? 'Active' : 'Offline'}.`);
        this.selection.clear();
        this.selectedIds.set(new Set());
        this.fetchHelplines();
      },
      error: (err: HttpErrorResponse | Error) => {
        const msg = err instanceof HttpErrorResponse ? err.error?.message || err.message : err.message;
        this.toast.error(msg || 'Failed to update helpline statuses.');
      }
    });
  }

  // Modal Handlers
  openCreateModal(): void {
    this.isEditMode = false;
    this.editingId = null;
    this.formData = {
      name: '',
      number: '',
      category: 'General',
      priorityTier: 'P0_CRITICAL',
      description: '',
      isActive: true,
      is24x7: true,
      operatingHours: '24 Hours / 7 Days',
      languagesStr: 'English, Hindi',
      state: 'All India',
      tollFree: true,
      alternateNumbersStr: ''
    };
    this.isModalOpen = true;
  }

  openEditModal(item: HelplineItem): void {
    this.isEditMode = true;
    this.editingId = item._id || item.id || null;
    this.formData = {
      name: item.name || item.title || '',
      number: item.number || item.phone || '',
      category: item.category || 'General',
      priorityTier: item.priorityTier || 'P2_ADVISORY',
      description: item.description || '',
      isActive: item.isActive !== false,
      is24x7: item.is24x7 !== false,
      operatingHours: item.operatingHours || (item.is24x7 !== false ? '24 Hours / 7 Days' : '09:30 AM - 05:30 PM'),
      languagesStr: Array.isArray(item.languages) ? item.languages.join(', ') : 'English, Hindi',
      state: item.state || 'All India',
      tollFree: item.tollFree !== false,
      alternateNumbersStr: Array.isArray(item.alternateNumbers) ? item.alternateNumbers.join(', ') : ''
    };
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  saveHelpline(): void {
    if (!this.formData.name.trim() || !this.formData.number.trim()) {
      this.toast.warning('Helpline service title and contact number are required.');
      return;
    }

    this.isSaving.set(true);

    const payload: Partial<HelplineItem> = {
      name: this.formData.name.trim(),
      number: this.formData.number.trim(),
      category: this.formData.category,
      priorityTier: this.formData.priorityTier,
      description: this.formData.description.trim(),
      isActive: this.formData.isActive,
      is24x7: this.formData.is24x7,
      operatingHours: this.formData.is24x7 ? '24 Hours / 7 Days' : this.formData.operatingHours,
      languages: this.formData.languagesStr.split(',').map(l => l.trim()).filter(Boolean),
      state: this.formData.state,
      tollFree: this.formData.tollFree,
      alternateNumbers: this.formData.alternateNumbersStr.split(',').map(n => n.trim()).filter(Boolean)
    };

    if (this.isEditMode && this.editingId) {
      this.api.updateHelpline(this.editingId, payload).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.toast.success(`Helpline "${this.formData.name}" updated successfully.`);
          this.closeModal();
          this.fetchHelplines();
        },
        error: (err: HttpErrorResponse | Error) => {
          this.isSaving.set(false);
          const msg = err instanceof HttpErrorResponse ? err.error?.message || err.message : err.message;
          this.toast.error(msg || 'Failed to update helpline.');
        }
      });
    } else {
      this.api.createHelpline(payload).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.toast.success(`New helpline "${this.formData.name}" onboarded successfully.`);
          this.closeModal();
          this.fetchHelplines();
        },
        error: (err: HttpErrorResponse | Error) => {
          this.isSaving.set(false);
          const msg = err instanceof HttpErrorResponse ? err.error?.message || err.message : err.message;
          this.toast.error(msg || 'Failed to create helpline.');
        }
      });
    }
  }

  // Verification Ping Action
  openPingModal(item: HelplineItem): void {
    this.pingModalItem = item;
    this.pingNotes = 'Direct carrier dial test verified operational with live agent response';
  }

  closePingModal(): void {
    this.pingModalItem = null;
  }

  executePing(): void {
    if (!this.pingModalItem) return;
    const targetId = this.pingModalItem._id || this.pingModalItem.id;
    if (!targetId) return;

    this.isPinging.set(true);
    this.api.verifyHelplinePing(targetId, { notes: this.pingNotes, verifiedBy: 'Security & Telemetry Dispatch' }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isPinging.set(false);
        this.toast.success(`Telemetry Ping recorded: "${this.pingModalItem?.name}" marked verified.`);
        this.closePingModal();
        this.fetchHelplines();
      },
      error: (err: HttpErrorResponse | Error) => {
        this.isPinging.set(false);
        const msg = err instanceof HttpErrorResponse ? err.error?.message || err.message : err.message;
        this.toast.error(msg || 'Failed to record line ping.');
      }
    });
  }

  toggleActive(item: HelplineItem): void {
    const newStatus = item.isActive === false;
    const targetId = item._id || item.id;
    if (!targetId) return;

    this.api.updateHelpline(targetId, { isActive: newStatus }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        item.isActive = newStatus;
        this.toast.success(`Line "${item.name || item.title}" status set to ${newStatus ? 'Operational' : 'Offline'}.`);
        this.calculateLocalMetrics(this.helplines());
      },
      error: () => {
        this.toast.error('Failed to toggle line status.');
      }
    });
  }

  async openDeleteModal(item: HelplineItem): Promise<void> {
    const targetId = item._id || item.id;
    if (!targetId) return;

    const confirmed = await this.dialogService.danger(
      'Confirm Emergency Helpline Removal',
      `Are you sure you want to remove helpline "${item.name || item.title}"? Citizen SOS routing will no longer display this number.`
    );

    if (confirmed) {
      this.api.deleteHelpline(targetId).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.toast.success(`Helpline "${item.name || item.title}" permanently removed.`);
          this.fetchHelplines();
        },
        error: (err: HttpErrorResponse | Error) => {
          const msg = err instanceof HttpErrorResponse ? err.error?.message || err.message : err.message;
          this.toast.error(msg || 'Failed to remove helpline record.');
        }
      });
    }
  }

  // Export Modal Handlers
  openExportModal(): void {
    this.isExportModalOpen = true;
  }

  closeExportModal(): void {
    this.isExportModalOpen = false;
  }

  onExportConfirm(config: ExportConfig): void {
    let dataToExport = this.filteredHelplines();
    if (config.scope === 'selected' && this.selectedIds().size > 0) {
      dataToExport = dataToExport.filter(h => this.selectedIds().has(h._id || h.id || ''));
    }

    if (!dataToExport.length) {
      this.toast.info('No helpline records to export.');
      return;
    }

    this.isExporting = true;
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `helplines_directory_${config.scope}_${dateStr}`;

      if (config.format === 'json') {
        const jsonRows = dataToExport.map(h => {
          const row: Record<string, any> = {};
          if (config.columns.includes('name')) row['Title'] = h.name || h.title || '';
          if (config.columns.includes('number')) row['Number'] = h.number || h.phone || '';
          if (config.columns.includes('category')) row['Category'] = h.category || 'General';
          if (config.columns.includes('priorityTier')) row['PriorityTier'] = h.priorityTier || 'P2_ADVISORY';
          if (config.columns.includes('state')) row['State'] = h.state || 'All India';
          if (config.columns.includes('operatingHours')) row['Schedule'] = h.is24x7 ? '24/7 Continuous' : (h.operatingHours || 'Shift');
          if (config.columns.includes('languages')) row['Languages'] = Array.isArray(h.languages) ? h.languages.join('; ') : 'English; Hindi';
          if (config.columns.includes('isActive')) row['Status'] = h.isActive !== false ? 'Active' : 'Offline';
          if (config.columns.includes('lastVerifiedAt')) row['LastVerified'] = h.lastVerifiedAt ? new Date(h.lastVerifiedAt).toISOString().slice(0, 10) : 'Pending';
          return row;
        });

        const blob = new Blob([JSON.stringify(jsonRows, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast.success(`Exported ${jsonRows.length} helpline(s) as JSON.`);
      } else {
        const colMap: Record<string, { label: string; get: (h: HelplineItem) => string }> = {
          name: { label: 'Helpline Title', get: h => h.name || h.title || '' },
          number: { label: 'Toll-Free / Number', get: h => h.number || h.phone || '' },
          category: { label: 'Category', get: h => h.category || 'General' },
          priorityTier: { label: 'Priority Tier', get: h => h.priorityTier || 'P2_ADVISORY' },
          state: { label: 'Jurisdiction State', get: h => h.state || 'All India' },
          operatingHours: { label: 'Operating Schedule', get: h => h.is24x7 ? '24/7 Continuous' : (h.operatingHours || 'Shift') },
          languages: { label: 'Languages', get: h => Array.isArray(h.languages) ? h.languages.join('; ') : 'English; Hindi' },
          isActive: { label: 'Status', get: h => h.isActive !== false ? 'Active' : 'Offline' },
          lastVerifiedAt: { label: 'Last Verified', get: h => h.lastVerifiedAt ? new Date(h.lastVerifiedAt).toISOString().slice(0, 10) : 'Pending' }
        };

        const selectedCols = config.columns.filter(c => colMap[c]);
        const headers = selectedCols.map(c => colMap[c].label);
        const rows = dataToExport.map(h => selectedCols.map(c => colMap[c].get(h)));

        CsvExporter.export(filename, headers, rows);
        this.toast.success(`Exported ${rows.length} helpline records to CSV.`);
      }
      this.closeExportModal();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Export failed';
      this.toast.error(message);
    } finally {
      this.isExporting = false;
    }
  }

  exportCSV(): void {
    const list = this.filteredHelplines();
    if (!list.length) {
      this.toast.info('No helpline records to export.');
      return;
    }

    const headers = [
      'Helpline Title',
      'Toll-Free / Number',
      'Category',
      'Priority Tier',
      'State / Region',
      'Operating Schedule',
      'Supported Languages',
      'Status',
      'Last Verified'
    ];

    const rows = list.map(h => [
      h.name || h.title || '',
      h.number || h.phone || '',
      h.category || 'General',
      h.priorityTier || 'P2_ADVISORY',
      h.state || 'All India',
      h.is24x7 ? '24/7 Continuous' : (h.operatingHours || 'Shift'),
      Array.isArray(h.languages) ? h.languages.join('; ') : 'English; Hindi',
      h.isActive !== false ? 'Active' : 'Offline',
      h.lastVerifiedAt ? new Date(h.lastVerifiedAt).toISOString().slice(0, 10) : 'Pending'
    ]);

    try {
      CsvExporter.export(`national_helplines_directory_${new Date().toISOString().slice(0, 10)}`, headers, rows);
      this.toast.success(`Exported ${rows.length} helpline records to CSV.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed.';
      this.toast.error(msg);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}