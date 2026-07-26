import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { smartLoading } from '../../core/utils/smart-loading.operator';

@Component({
  selector: 'admin-templates',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent, TooltipDirective, SelectComponent],
  templateUrl: './templates.component.html',
  styleUrl: './templates.component.scss'
})
export class TemplatesComponent implements OnInit {
  stats: any = null;
  templates: any[] = [];
  isLoadingStats = false;
  isLoadingTable = false;
  isInitialLoad = true;
  search = '';
  private searchSubject$ = new Subject<string>();
  selectedCategory = '';

  categoryOptions: SelectOption[] = [
    { label: 'All Categories', value: '' },
    { label: 'Commercial & Contracts', value: 'commercial', icon: 'file-text' },
    { label: 'Property & Real Estate', value: 'property', icon: 'home' },
    { label: 'Corporate & Startup', value: 'corporate', icon: 'briefcase' },
    { label: 'Civil & Court Pleadings', value: 'court', icon: 'scale' },
    { label: 'Affidavits & Notices', value: 'affidavit', icon: 'file' }
  ];

  pagination = {
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  };

  get startRecord(): number {
    if (this.pagination.total === 0) return 0;
    return (this.pagination.page - 1) * this.pagination.limit + 1;
  }

  get endRecord(): number {
    return Math.min(this.pagination.page * this.pagination.limit, this.pagination.total);
  }

  selectedTemplate: any = null;


  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialog: DialogService
  ) { }

  ngOnInit(): void {
    this.searchSubject$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.search = query;
      this.pagination.page = 1;
      this.fetchTemplates();
    });

    this.fetchStats();
    this.fetchTemplates();
  }

  onSearchInput(val: string): void {
    this.searchSubject$.next(val);
  }

  fetchStats(): void {
    this.api.getTemplateStats().pipe(smartLoading(l => this.isLoadingStats = l)).subscribe({
      next: (res) => {
        if (res.success) {
          this.stats = res.data;
        }
      },
      error: (err) => {
        console.error('Failed to load template stats', err);
      }
    });
  }

  fetchTemplates(): void {
    const isFirstTime = this.isInitialLoad;
    this.api.getTemplates({
      search: this.search || undefined,
      category: this.selectedCategory || undefined,
      page: this.pagination.page,
      limit: this.pagination.limit
    }).pipe(smartLoading(l => this.isLoadingTable = l, isFirstTime)).subscribe({
      next: (res) => {
        this.isInitialLoad = false;
        if (res.success) {
          this.templates = res.data;
          this.pagination = res.pagination;
        }
      },
      error: (err) => {
        this.isInitialLoad = false;
        this.toast.error(err?.error?.message || 'Failed to fetch legal custom templates.');
      }
    });
  }

  onSearch(): void {
    this.pagination.page = 1;
    this.fetchTemplates();
  }

  onFilterChange(): void {
    this.pagination.page = 1;
    this.fetchTemplates();
  }

  resetFilters(): void {
    this.search = '';
    this.selectedCategory = '';
    this.pagination.page = 1;
    this.fetchTemplates();
  }

  changePage(newPage: number): void {
    if (newPage >= 1 && newPage <= this.pagination.pages) {
      this.pagination.page = newPage;
      this.fetchTemplates();
    }
  }

  viewTemplate(tpl: any): void {
    this.selectedTemplate = tpl;
  }

  closeModal(): void {
    this.selectedTemplate = null;
  }

  async deleteTemplate(tpl: any): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: 'Confirm Template Deletion',
      message: `Are you sure you want to delete template "${tpl.title}"? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete Template'
    });

    if (confirmed) {
      this.api.deleteTemplate(tpl._id).subscribe({
        next: (res) => {
          this.toast.success(res.message || 'Template deleted successfully.');
          this.closeModal();
          this.fetchStats();
          this.fetchTemplates();
        },
        error: (err) => this.toast.error(err?.error?.message || 'Failed to delete template.')
      });
    }
  }
}