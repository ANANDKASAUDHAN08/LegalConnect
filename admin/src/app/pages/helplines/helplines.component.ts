import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { CsvExporter } from '../../core/utils/csv-exporter';

@Component({
  selector: 'admin-helplines',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent, TooltipDirective],
  templateUrl: './helplines.component.html',
  styleUrl: './helplines.component.scss'
})
export class HelplinesComponent implements OnInit {
  helplines: any[] = [];
  isLoading = false;
  isSaving = false;
  searchQuery = '';
  selectedCategory = '';

  // Modal drawer states
  isModalOpen = false;
  isEditMode = false;
  editingId: string | null = null;
  formData = {
    name: '',
    number: '',
    category: 'General',
    description: '',
    isActive: true
  };

  categories = [
    { label: 'All Categories', value: '' },
    { label: 'General / Public', value: 'General' },
    { label: 'Women Safety', value: 'Women Safety' },
    { label: 'Cyber Crime', value: 'Cyber' },
    { label: 'Family & Elder Support', value: 'Family' },
    { label: 'Child Helpline', value: 'Child Care' }
  ];

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialogService: DialogService
  ) { }

  ngOnInit(): void {
    this.fetchHelplines();
  }

  fetchHelplines(): void {
    this.isLoading = true;
    this.api.getHelplines().subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.helplines = Array.isArray(res) ? res : (res?.data || res?.helplines || res?.items || []);
      },
      error: (err: any) => {
        this.isLoading = false;
        this.toast.error(err?.error?.message || 'Failed to fetch helpline numbers.');
      }
    });
  }

  get filteredHelplines(): any[] {
    return this.helplines.filter(h => {
      const matchSearch = !this.searchQuery ||
        (h.name || h.title || '').toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (h.number || '').includes(this.searchQuery) ||
        (h.description || '').toLowerCase().includes(this.searchQuery.toLowerCase());

      const matchCat = !this.selectedCategory ||
        (h.category || '').toLowerCase().includes(this.selectedCategory.toLowerCase());

      return matchSearch && matchCat;
    });
  }

  // Metrics
  get totalCount(): number {
    return this.helplines.length;
  }

  get activeCount(): number {
    return this.helplines.filter(h => h.isActive !== false).length;
  }

  get emergencyCount(): number {
    return this.helplines.filter(h =>
      (h.category || '').toLowerCase().includes('cyber') ||
      (h.category || '').toLowerCase().includes('women') ||
      (h.category || '').toLowerCase().includes('emergency')
    ).length;
  }

  get inactiveCount(): number {
    return this.helplines.filter(h => h.isActive === false).length;
  }

  // Modal Handlers
  openCreateModal(): void {
    this.isEditMode = false;
    this.editingId = null;
    this.formData = {
      name: '',
      number: '',
      category: 'General',
      description: '',
      isActive: true
    };
    this.isModalOpen = true;
  }

  openEditModal(item: any): void {
    this.isEditMode = true;
    this.editingId = item._id || item.id;
    this.formData = {
      name: item.name || item.title || '',
      number: item.number || item.phone || '',
      category: item.category || 'General',
      description: item.description || '',
      isActive: item.isActive !== false
    };
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  saveHelpline(): void {
    if (!this.formData.name.trim() || !this.formData.number.trim()) {
      this.toast.warning('Helpline title and number are required.');
      return;
    }

    this.isSaving = true;

    if (this.isEditMode && this.editingId) {
      this.api.updateHelpline(this.editingId, this.formData).subscribe({
        next: () => {
          this.isSaving = false;
          this.toast.success('Helpline details updated successfully.');
          this.closeModal();
          this.fetchHelplines();
        },
        error: (err) => {
          this.isSaving = false;
          this.toast.error(err?.error?.message || 'Failed to update helpline.');
        }
      });
    } else {
      this.api.createHelpline(this.formData).subscribe({
        next: () => {
          this.isSaving = false;
          this.toast.success('New helpline created successfully.');
          this.closeModal();
          this.fetchHelplines();
        },
        error: (err) => {
          this.isSaving = false;
          this.toast.error(err?.error?.message || 'Failed to create helpline.');
        }
      });
    }
  }

  toggleActive(item: any): void {
    const newStatus = item.isActive === false;
    const targetId = item._id || item.id;

    if (targetId) {
      this.api.updateHelpline(targetId, { isActive: newStatus }).subscribe({
        next: () => {
          item.isActive = newStatus;
          this.toast.success(`Helpline "${item.name || item.title}" status updated to ${newStatus ? 'Active' : 'Offline'}.`);
        },
        error: () => {
          item.isActive = !newStatus;
          this.toast.error('Failed to update status.');
        }
      });
    } else {
      item.isActive = newStatus;
      this.toast.success(`Status updated for ${item.name}.`);
    }
  }

  // Global Confirm Dialog for Deletion
  async openDeleteModal(item: any): Promise<void> {
    const targetId = item._id || item.id;
    if (!targetId) return;

    const confirmed = await this.dialogService.danger(
      'Confirm Helpline Deletion',
      `Are you sure you want to delete helpline "${item.name || item.title}"? Action cannot be undone.`
    );

    if (confirmed) {
      this.api.deleteHelpline(targetId).subscribe({
        next: () => {
          this.toast.success(`Helpline "${item.name || item.title}" deleted.`);
          this.fetchHelplines();
        },
        error: (err) => {
          this.toast.error(err?.error?.message || 'Failed to delete helpline record.');
        }
      });
    }
  }

  exportCSV(): void {
    if (!this.helplines.length) {
      this.toast.info('No helpline records to export.');
      return;
    }

    const headers = ['Name', 'Number', 'Category', 'Description', 'Status'];
    const rows = this.filteredHelplines.map(h => [
      h.name || h.title || '',
      h.number || h.phone || '',
      h.category || '',
      h.description || '',
      h.isActive !== false ? 'Active' : 'Offline'
    ]);

    try {
      CsvExporter.export('helplines_directory', headers, rows);
      this.toast.success('Helpline directory exported to CSV.');
    } catch (err: any) {
      this.toast.error(err.message || 'Export failed.');
    }
  }
}