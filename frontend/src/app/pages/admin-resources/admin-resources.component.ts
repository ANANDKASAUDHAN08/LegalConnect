import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LegalService } from '../../services/legal.service';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-admin-resources',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
  templateUrl: './admin-resources.component.html',
  styleUrls: ['./admin-resources.component.scss']
})
export class AdminResourcesComponent implements OnInit {
  // Modal Dialog variables
  isConfirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmType: 'danger' | 'warning' | 'info' = 'warning';
  onConfirmAction: (() => void) | null = null;

  triggerConfirm(title: string, message: string, type: 'danger' | 'warning' | 'info', action: () => void) {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.confirmType = type;
    this.onConfirmAction = action;
    this.isConfirmOpen = true;
  }

  onConfirmDialog() {
    this.isConfirmOpen = false;
    if (this.onConfirmAction) {
      this.onConfirmAction();
    }
  }

  onCancelDialog() {
    this.isConfirmOpen = false;
    this.onConfirmAction = null;
  }

  resources: any[] = [];
  totalItems = 0;
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  filters = {
    status: '',
    city: '',
    type: '',
    search: ''
  };

  selectedResource: any = null;
  isFormOpen = false;
  isSaving = false;
  successMessage = '';
  errorMessage = '';

  // Form Model
  formModel = {
    _id: '',
    name: '',
    type: 'LegalAid',
    categories: 'General',
    subcategories: '',
    city: '',
    state: '',
    address: '',
    contactNumber: '',
    website: '',
    operatingHours: '10:00 AM - 5:00 PM',
    languages: 'English, Hindi',
    coordinates: {
      lat: 28.6139,
      lng: 77.2090
    },
    status: 'approved'
  };

  constructor(private legalService: LegalService) { }

  ngOnInit() {
    this.fetchResources();
  }

  fetchResources() {
    const apiFilters = {
      page: this.currentPage,
      limit: this.pageSize,
      status: this.filters.status || undefined,
      city: this.filters.city || undefined,
      type: this.filters.type || undefined,
      search: this.filters.search || undefined
    };

    this.legalService.getAdminResources(apiFilters).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.resources = res.data;
          if (res.pagination) {
            this.totalItems = res.pagination.total;
            this.totalPages = res.pagination.pages;
          }
        }
      },
      error: (err) => console.error('Failed to load resources:', err)
    });
  }

  onFilterChange() {
    this.currentPage = 1;
    this.fetchResources();
  }

  resetFilters() {
    this.filters = { status: '', city: '', type: '', search: '' };
    this.currentPage = 1;
    this.fetchResources();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.fetchResources();
    }
  }

  openCreateForm() {
    this.selectedResource = null;
    this.formModel = {
      _id: '',
      name: '',
      type: 'LegalAid',
      categories: 'General',
      subcategories: '',
      city: '',
      state: '',
      address: '',
      contactNumber: '',
      website: '',
      operatingHours: '10:00 AM - 5:00 PM',
      languages: 'English, Hindi',
      coordinates: { lat: 28.6139, lng: 77.2090 },
      status: 'approved'
    };
    this.successMessage = '';
    this.errorMessage = '';
    this.isFormOpen = true;
  }

  openEditForm(resource: any) {
    this.selectedResource = resource;
    this.formModel = {
      _id: resource._id,
      name: resource.name || '',
      type: resource.type || 'LegalAid',
      categories: Array.isArray(resource.categories) ? resource.categories.join(', ') : (resource.categories || 'General'),
      subcategories: Array.isArray(resource.subcategories) ? resource.subcategories.join(', ') : (resource.subcategories || ''),
      city: resource.city || '',
      state: resource.state || '',
      address: resource.address || '',
      contactNumber: resource.contactNumber || '',
      website: resource.website || '',
      operatingHours: resource.operatingHours || '10:00 AM - 5:00 PM',
      languages: Array.isArray(resource.languages) ? resource.languages.join(', ') : (resource.languages || 'English, Hindi'),
      coordinates: {
        lat: resource.coordinates?.lat || 28.6139,
        lng: resource.coordinates?.lng || 77.2090
      },
      status: resource.status || 'approved'
    };
    this.successMessage = '';
    this.errorMessage = '';
    this.isFormOpen = true;
  }

  closeForm() {
    this.isFormOpen = false;
    this.selectedResource = null;
  }

  saveResource() {
    if (!this.formModel.name || !this.formModel.type || !this.formModel.city || !this.formModel.address) {
      this.errorMessage = 'Please enter name, type, city and address.';
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Format fields
    const categories = this.formModel.categories.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const subcategories = this.formModel.subcategories.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const languages = this.formModel.languages.split(',').map(s => s.trim()).filter(s => s.length > 0);

    const payload = {
      ...this.formModel,
      categories,
      subcategories,
      languages
    };

    if (this.selectedResource) {
      // Edit mode
      this.legalService.updateAdminResource(this.selectedResource._id, payload).subscribe({
        next: (res) => {
          this.isSaving = false;
          if (res.success) {
            this.successMessage = 'Resource updated successfully!';
            this.fetchResources();
            setTimeout(() => this.closeForm(), 1500);
          } else {
            this.errorMessage = 'Update failed.';
          }
        },
        error: (err) => {
          this.isSaving = false;
          this.errorMessage = err?.error?.message || 'Error updating resource.';
        }
      });
    } else {
      // Create mode
      this.legalService.createAdminResource(payload).subscribe({
        next: (res) => {
          this.isSaving = false;
          if (res.success) {
            this.successMessage = 'Resource created successfully!';
            this.fetchResources();
            setTimeout(() => this.closeForm(), 1500);
          } else {
            this.errorMessage = 'Creation failed.';
          }
        },
        error: (err) => {
          this.isSaving = false;
          this.errorMessage = err?.error?.message || 'Error creating resource.';
        }
      });
    }
  }

  approveResource(resource: any) {
    const payload = { ...resource, status: 'approved', isVerified: true };
    this.legalService.updateAdminResource(resource._id, payload).subscribe({
      next: (res) => {
        if (res.success) {
          this.fetchResources();
        }
      },
      error: (err) => console.error('Approval failed:', err)
    });
  }

  deleteResource(id: string) {
    this.triggerConfirm(
      'Delete Legal Resource',
      'Are you sure you want to permanently delete this legal resource? This action cannot be undone and will remove it from search listings.',
      'danger',
      () => {
        this.legalService.deleteAdminResource(id).subscribe({
          next: (res) => {
            if (res.success) {
              this.fetchResources();
            }
          },
          error: (err) => console.error('Deletion failed:', err)
        });
      }
    );
  }
}