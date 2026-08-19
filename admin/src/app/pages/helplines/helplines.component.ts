import { Component, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { CsvExporter } from '../../core/utils/csv-exporter';
import { HelplineItem } from '../legal-content/legal-content.models';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { INDIAN_STATES } from '../../core/constants/geo.constants';

@Component({
  selector: 'admin-helplines',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent, TooltipDirective, SelectComponent],
  templateUrl: './helplines.component.html',
  styleUrl: './helplines.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelplinesComponent implements OnInit {
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
  selectedIds = signal<Set<string>>(new Set());

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

  fetchHelplines(): void {
    this.isLoading.set(true);
    const params: any = {};
    if (this.selectedPriority()) params.priorityTier = this.selectedPriority();
    if (this.selectedState()) params.state = this.selectedState();
    if (this.selectedCategory()) params.category = this.selectedCategory();
    if (this.selectedStatus()) params.isActive = this.selectedStatus() === 'active';
    if (this.searchQuery()) params.search = this.searchQuery();

    this.api.getHelplines(params).subscribe({
      next: (res: any) => {
        this.isLoading.set(false);
        this.isInitialLoad.set(false);
        const data = Array.isArray(res) ? res : (res?.data || res?.helplines || []);
        this.helplines.set(data);
        if (res?.metrics) {
          this.metrics.set(res.metrics);
        } else {
          this.calculateLocalMetrics(data);
        }
      },
      error: (err: any) => {
        this.isLoading.set(false);
        this.isInitialLoad.set(false);
        this.toast.error(err?.error?.message || 'Failed to sync helpline telemetry.');
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

  // Selection for bulk actions
  toggleSelectAll(checked: boolean): void {
    if (checked) {
      const allIds = new Set(this.filteredHelplines().map(h => h._id || h.id || '').filter(Boolean));
      this.selectedIds.set(allIds);
      this.toast.info(`Selected all ${allIds.size} visible helplines.`);
    } else {
      this.selectedIds.set(new Set());
    }
  }

  toggleSelectOne(id: string): void {
    const current = new Set(this.selectedIds());
    if (current.has(id)) current.delete(id);
    else current.add(id);
    this.selectedIds.set(current);
  }

  isAllSelected(): boolean {
    const list = this.filteredHelplines();
    if (!list.length) return false;
    return list.every(h => this.selectedIds().has(h._id || h.id || ''));
  }

  // Bulk Status Update
  bulkSetStatus(isActive: boolean): void {
    const ids = Array.from(this.selectedIds());
    if (!ids.length) {
      this.toast.warning('Please select at least one helpline line.');
      return;
    }

    this.api.bulkUpdateHelplineStatus(ids, isActive).subscribe({
      next: () => {
        this.toast.success(`Updated ${ids.length} helpline(s) to ${isActive ? 'Active' : 'Offline'}.`);
        this.selectedIds.set(new Set());
        this.fetchHelplines();
      },
      error: (err: any) => {
        this.toast.error(err?.error?.message || 'Failed to update helpline statuses.');
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
      this.api.updateHelpline(this.editingId, payload).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.toast.success(`Helpline "${this.formData.name}" updated successfully.`);
          this.closeModal();
          this.fetchHelplines();
        },
        error: (err: any) => {
          this.isSaving.set(false);
          this.toast.error(err?.error?.message || 'Failed to update helpline.');
        }
      });
    } else {
      this.api.createHelpline(payload).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.toast.success(`New helpline "${this.formData.name}" onboarded successfully.`);
          this.closeModal();
          this.fetchHelplines();
        },
        error: (err: any) => {
          this.isSaving.set(false);
          this.toast.error(err?.error?.message || 'Failed to create helpline.');
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
    this.api.verifyHelplinePing(targetId, { notes: this.pingNotes, verifiedBy: 'Security & Telemetry Dispatch' }).subscribe({
      next: () => {
        this.isPinging.set(false);
        this.toast.success(`Telemetry Ping recorded: "${this.pingModalItem?.name}" marked verified.`);
        this.closePingModal();
        this.fetchHelplines();
      },
      error: (err: any) => {
        this.isPinging.set(false);
        this.toast.error(err?.error?.message || 'Failed to record line ping.');
      }
    });
  }

  toggleActive(item: HelplineItem): void {
    const newStatus = item.isActive === false;
    const targetId = item._id || item.id;
    if (!targetId) return;

    this.api.updateHelpline(targetId, { isActive: newStatus }).subscribe({
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
      this.api.deleteHelpline(targetId).subscribe({
        next: () => {
          this.toast.success(`Helpline "${item.name || item.title}" permanently removed.`);
          this.fetchHelplines();
        },
        error: (err: any) => {
          this.toast.error(err?.error?.message || 'Failed to remove helpline record.');
        }
      });
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
    } catch (err: any) {
      this.toast.error(err.message || 'Export failed.');
    }
  }
}