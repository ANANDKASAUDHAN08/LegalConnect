import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { smartLoading } from '../../core/utils/smart-loading.operator';

@Component({
  selector: 'admin-resources',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent, TooltipDirective, SelectComponent],
  templateUrl: './resources.component.html',
  styleUrl: './resources.component.scss'
})
export class ResourcesComponent implements OnInit {
  resources: any[] = [];
  isLoading = false;
  isInitialLoad = true;
  search = '';
  private searchSubject$ = new Subject<string>();


  isSaving = false;

  // Global metrics summary from database (so top stat cards don't change per page slice)
  summaryMetrics = {
    total: 0,
    verified: 0,
    courts: 0,
    pending: 0
  };

  // Search & Filters
  selectedType = '';
  selectedCity = '';
  selectedStatus = '';

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalRecords = 0;
  totalPages = 1;

  get startRecord(): number {
    if (this.totalRecords === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get endRecord(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalRecords);
  }

  // Drawer / Modal states

  isModalOpen = false;
  isEditMode = false;
  editingId: string | null = null;

  formData = {
    name: '',
    type: 'LegalAid',
    city: 'Delhi',
    state: 'Delhi',
    address: '',
    phone: '',
    email: '',
    website: '',
    operatingHours: '09:30 AM - 05:00 PM',
    status: 'approved',
    lat: 28.6139,
    lng: 77.2090
  };

  // GIS Location Detail Inspector Modal
  inspectItem: any = null;

  typeOptions: SelectOption[] = [
    { label: 'All Resource Types', value: '' },
    { label: 'Court / Judiciary', value: 'Court', icon: 'map-pin' },
    { label: 'Legal Aid Center', value: 'LegalAid', icon: 'map-pin' },
    { label: 'Police Station', value: 'PoliceStation', icon: 'map-pin' },
    { label: 'Government Office', value: 'GovernmentOffice', icon: 'map-pin' }
  ];

  cityOptions: SelectOption[] = [
    { label: 'All Cities', value: '' },
    { label: 'Delhi', value: 'Delhi' },
    { label: 'Mumbai', value: 'Mumbai' },
    { label: 'Bengaluru', value: 'Bengaluru' },
    { label: 'Gurgaon', value: 'Gurgaon' },
    { label: 'Hyderabad', value: 'Hyderabad' },
    { label: 'Chennai', value: 'Chennai' },
    { label: 'Kolkata', value: 'Kolkata' }
  ];

  statusOptions: SelectOption[] = [
    { label: 'All Approval Statuses', value: '' },
    { label: 'Approved & Verified', value: 'approved' },
    { label: 'Pending Review', value: 'pending' }
  ];

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialogService: DialogService
  ) { }

  ngOnInit(): void {
    this.searchSubject$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.search = query;
      this.currentPage = 1;
      this.fetchResources();
    });

    this.fetchResources();
  }

  onSearchInput(val: string): void {
    this.searchSubject$.next(val);
  }

  fetchResources(): void {
    const isFirstTime = this.isInitialLoad;
    const params: any = {
      page: this.currentPage,
      limit: this.pageSize,
      search: this.search || undefined,
      type: this.selectedType || undefined,
      city: this.selectedCity || undefined,
      status: this.selectedStatus || undefined
    };

    this.api.getResources(params).pipe(smartLoading(l => this.isLoading = l, isFirstTime)).subscribe({
      next: (res: any) => {
        this.isInitialLoad = false;
        if (res.metrics) {
          this.summaryMetrics = res.metrics;
        }
        if (res.pagination) {
          this.resources = res.data || [];
          this.totalRecords = res.pagination.total || 0;
          this.totalPages = res.pagination.pages || 1;
        } else {
          this.resources = res.data || res || [];
          this.totalRecords = this.resources.length;
          this.totalPages = 1;
        }
      },
      error: (err: any) => {
        this.isInitialLoad = false;
        this.toast.error(err?.error?.message || 'Failed to fetch legal resources.');
      }
    });
  }

  // Global Metrics getters (independent of pagination slice)
  get verifiedCount(): number {
    return this.summaryMetrics.verified || this.resources.filter(r => r.isVerified || r.status === 'approved').length;
  }

  get courtsCount(): number {
    return this.summaryMetrics.courts || this.resources.filter(r => r.type === 'Court').length;
  }

  get legalAidCount(): number {
    return this.resources.filter(r => r.type === 'LegalAid').length;
  }

  get pendingCount(): number {
    return this.summaryMetrics.pending ?? this.resources.filter(r => r.status === 'pending').length;
  }

  // Filter Handlers
  onFilterChange(): void {
    this.currentPage = 1;
    this.fetchResources();
  }

  resetFilters(): void {
    this.search = '';
    this.selectedType = '';
    this.selectedCity = '';
    this.selectedStatus = '';
    this.currentPage = 1;
    this.fetchResources();
  }

  // Pagination Handlers
  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.fetchResources();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.fetchResources();
    }
  }

  // Modal Handlers
  openCreateModal(): void {
    this.isEditMode = false;
    this.editingId = null;
    this.formData = {
      name: '',
      type: 'LegalAid',
      city: 'Delhi',
      state: 'Delhi',
      address: '',
      phone: '',
      email: '',
      website: '',
      operatingHours: '09:30 AM - 05:00 PM',
      status: 'approved',
      lat: 28.6139,
      lng: 77.2090
    };
    this.isModalOpen = true;
  }

  openEditModal(item: any): void {
    this.isEditMode = true;
    this.editingId = item._id || item.id;
    const phoneVal = Array.isArray(item.contactNumber) ? item.contactNumber.join(', ') : (item.contactNumber || '');
    const emailVal = Array.isArray(item.email) ? item.email.join(', ') : (item.email || '');

    this.formData = {
      name: item.name || '',
      type: item.type || 'LegalAid',
      city: item.city || 'Delhi',
      state: item.state || 'Delhi',
      address: item.address || '',
      phone: phoneVal,
      email: emailVal,
      website: item.website || '',
      operatingHours: item.operatingHours || '09:30 AM - 05:00 PM',
      status: item.status || 'approved',
      lat: item.coordinates?.lat || 28.6139,
      lng: item.coordinates?.lng || 77.2090
    };
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  saveResource(): void {
    if (!this.formData.name.trim() || !this.formData.address.trim()) {
      this.toast.warning('Resource name and physical address are required.');
      return;
    }

    this.isSaving = true;

    const payload = {
      name: this.formData.name,
      type: this.formData.type,
      city: this.formData.city,
      state: this.formData.state,
      address: this.formData.address,
      contactNumber: this.formData.phone ? this.formData.phone.split(',').map(p => p.trim()) : [],
      email: this.formData.email ? this.formData.email.split(',').map(e => e.trim()) : [],
      website: this.formData.website,
      operatingHours: this.formData.operatingHours,
      status: this.formData.status,
      isVerified: this.formData.status === 'approved',
      coordinates: {
        lat: Number(this.formData.lat) || 28.6139,
        lng: Number(this.formData.lng) || 77.2090
      }
    };

    if (this.isEditMode && this.editingId) {
      this.api.updateResource(this.editingId, payload).subscribe({
        next: () => {
          this.isSaving = false;
          this.toast.success('Legal resource updated successfully.');
          this.closeModal();
          this.fetchResources();
        },
        error: (err) => {
          this.isSaving = false;
          this.toast.error(err?.error?.message || 'Failed to update legal resource.');
        }
      });
    } else {
      this.api.createResource(payload).subscribe({
        next: () => {
          this.isSaving = false;
          this.toast.success('New legal resource onboarded successfully.');
          this.closeModal();
          this.fetchResources();
        },
        error: (err) => {
          this.isSaving = false;
          this.toast.error(err?.error?.message || 'Failed to create legal resource.');
        }
      });
    }
  }

  // Approval Workflow
  approveResource(item: any): void {
    const targetId = item._id || item.id;
    if (!targetId) return;

    this.api.updateResource(targetId, { status: 'approved', isVerified: true }).subscribe({
      next: () => {
        item.status = 'approved';
        item.isVerified = true;
        this.toast.success(`Resource "${item.name}" verified and approved.`);
        this.fetchResources();
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'Failed to approve resource.');
      }
    });
  }

  // GIS Inspector Modal
  openInspector(item: any): void {
    this.inspectItem = item;
  }

  closeInspector(): void {
    this.inspectItem = null;
  }

  // Global Confirm Dialog for Deletion
  async openDeleteModal(item: any): Promise<void> {
    const targetId = item._id || item.id;
    if (!targetId) return;

    const confirmed = await this.dialogService.danger(
      'Confirm Resource Deletion',
      `Are you sure you want to delete legal resource "${item.name}"? Action cannot be undone.`
    );

    if (confirmed) {
      this.api.deleteResource(targetId).subscribe({
        next: () => {
          this.toast.success(`Resource "${item.name}" deleted.`);
          this.fetchResources();
        },
        error: (err) => {
          this.toast.error(err?.error?.message || 'Failed to delete resource.');
        }
      });
    }
  }

  // Export CSV
  exportCSV(): void {
    if (!this.resources.length) {
      this.toast.info('No legal resources to export.');
      return;
    }

    const headers = ['Name', 'Type', 'City', 'Address', 'Phone', 'Status', 'Verified', 'Latitude', 'Longitude'];
    const rows = this.resources.map(r => [
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${(r.type || '').replace(/"/g, '""')}"`,
      `"${(r.city || '').replace(/"/g, '""')}"`,
      `"${(r.address || '').replace(/"/g, '""')}"`,
      `"${(Array.isArray(r.contactNumber) ? r.contactNumber.join('; ') : r.contactNumber || '').replace(/"/g, '""')}"`,
      r.status || 'approved',
      r.isVerified ? 'Yes' : 'No',
      r.coordinates?.lat || '',
      r.coordinates?.lng || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `legal_resources_directory_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Legal resources directory exported to CSV.');
  }

  // Bulk Import Modal
  showImportModal = false;
  bulkJsonText = '';

  openImportModal(): void {
    this.showImportModal = true;
    this.bulkJsonText = '';
  }

  closeImportModal(): void {
    this.showImportModal = false;
    this.bulkJsonText = '';
  }

  processBulkImport(): void {
    if (!this.bulkJsonText.trim()) {
      this.toast.warning('Please paste a valid JSON array of legal resources.');
      return;
    }

    try {
      const items = JSON.parse(this.bulkJsonText);
      if (!Array.isArray(items)) {
        this.toast.error('Input must be a JSON array of resource objects.');
        return;
      }

      let imported = 0;
      items.forEach(item => {
        this.api.createResource(item).subscribe({
          next: () => {
            imported++;
            if (imported === items.length) {
              this.toast.success(`Successfully imported ${imported} legal resource records.`);
              this.closeImportModal();
              this.fetchResources();
            }
          }
        });
      });
    } catch (e: any) {
      this.toast.error('Invalid JSON syntax: ' + e.message);
    }
  }
}