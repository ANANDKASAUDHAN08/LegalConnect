import { Component, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { smartLoading } from '../../core/utils/smart-loading.operator';
import { TableSelection, handleTableKeyboardNav } from '../../core/utils/table.utils';
import { CsvExporter } from '../../core/utils/csv-exporter';
import { TemplateItem, TemplateStats } from '../../core/models/admin.models';
import { AdminIconComponent } from '../../shared/components/icon/icon.component';
import { AdminSavedViewsComponent } from '../../shared/components/saved-views/saved-views.component';
import { ExportModalComponent, ExportConfig } from '../../shared/components/export-modal/export-modal.component';
import { ColumnDef } from '../../shared/components/column-customizer/column-customizer.component';

@Component({
  selector: 'admin-templates',
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
  templateUrl: './templates.component.html',
  styleUrl: './templates.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplatesComponent implements OnInit, OnDestroy {
  stats: TemplateStats | null = null;
  templates: TemplateItem[] = [];
  isLoadingStats = false;
  isLoadingTable = false;
  isInitialLoad = true;
  search = '';
  private searchSubject$ = new Subject<string>();
  private searchSub?: Subscription;
  private destroy$ = new Subject<void>();
  selectedCategory = '';

  selection = new TableSelection<string>();
  focusedRowIndex = -1;

  // Export Modal & Saved Views State
  isExportModalOpen = false;
  isExporting = false;

  columnDefs: ColumnDef[] = [
    { key: 'title', label: 'Template Title' },
    { key: 'actRef', label: 'Act Reference' },
    { key: 'category', label: 'Category' },
    { key: 'fields', label: 'Fields Count' },
    { key: 'description', label: 'Description' },
    { key: 'updatedAt', label: 'Last Updated' }
  ];

  get activeQueryParamsObj(): Record<string, any> {
    const obj: Record<string, any> = {};
    if (this.search) obj['search'] = this.search;
    if (this.selectedCategory) obj['category'] = this.selectedCategory;
    return obj;
  }

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

  selectedTemplate: TemplateItem | null = null;

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialog: DialogService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.searchSub = this.searchSubject$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.search = query;
      this.pagination.page = 1;
      this.fetchTemplates();
    });

    this.fetchStats();
    this.fetchTemplates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchSub?.unsubscribe();
    this.searchSubject$.complete();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    handleTableKeyboardNav(event, {
      getListLength: () => this.templates.length,
      getFocusedIndex: () => this.focusedRowIndex,
      setFocusedIndex: (idx) => { this.focusedRowIndex = idx; this.cdr.markForCheck(); },
      onEnter: (idx) => { if (this.templates[idx]) this.viewTemplate(this.templates[idx]); },
      onEscape: () => { this.closeModal(); }
    });
  }

  onSearchInput(val: string): void {
    this.searchSubject$.next(val);
  }

  fetchStats(): void {
    this.api.getTemplateStats().pipe(
      smartLoading(l => { this.isLoadingStats = l; this.cdr.markForCheck(); }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (res) => {
        if (res.success) {
          this.stats = res.data;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.warning('Failed to load template statistics.');
        this.cdr.markForCheck();
      }
    });
  }

  fetchTemplates(): void {
    const isFirstTime = this.isInitialLoad;
    const params = {
      search: this.search || undefined,
      category: this.selectedCategory || undefined,
      page: this.pagination.page,
      limit: this.pagination.limit
    };

    // SWR Cache Hydration
    const cached = this.api.getCachedTemplates(params);
    if (cached && cached.success) {
      this.templates = cached.data;
      if (cached.pagination) this.pagination = cached.pagination;
      this.isInitialLoad = false;
      this.isLoadingTable = false;
      this.cdr.markForCheck();
    }

    this.api.getTemplates(params).pipe(
      smartLoading(l => { this.isLoadingTable = l; this.cdr.markForCheck(); }, isFirstTime),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (res) => {
        this.isInitialLoad = false;
        if (res.success) {
          this.templates = res.data;
          this.pagination = res.pagination || this.pagination;
        }
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse | Error) => {
        this.isInitialLoad = false;
        const msg = err instanceof HttpErrorResponse ? err.error?.message || err.message : err.message;
        this.toast.error(msg || 'Failed to fetch legal custom templates.');
        this.cdr.markForCheck();
      }
    });
  }

  onSavedViewApply(savedParams: Record<string, any>): void {
    this.search = savedParams?.['search'] || '';
    this.selectedCategory = savedParams?.['category'] || '';
    this.pagination.page = 1;
    this.toast.info('Applied saved template view preset.');
    this.fetchTemplates();
  }

  openExportModal(): void {
    this.isExportModalOpen = true;
  }

  closeExportModal(): void {
    this.isExportModalOpen = false;
  }

  onExportConfirm(config: ExportConfig): void {
    const dataToExport = this.templates;

    if (!dataToExport.length) {
      this.toast.info('No template records to export.');
      return;
    }

    this.isExporting = true;
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `legal_templates_${config.scope}_${dateStr}`;

      if (config.format === 'json') {
        const jsonRows = dataToExport.map(t => {
          const row: Record<string, any> = {};
          if (config.columns.includes('title')) row['Title'] = t.title || '';
          if (config.columns.includes('actRef')) row['ActReference'] = t.actRef || '';
          if (config.columns.includes('category')) row['Category'] = t.category || 'General';
          if (config.columns.includes('fields')) row['FieldsCount'] = t.fields?.length || 0;
          if (config.columns.includes('description')) row['Description'] = t.description || '';
          if (config.columns.includes('updatedAt')) row['LastUpdated'] = t.updatedAt ? new Date(t.updatedAt).toISOString().slice(0, 10) : '';
          return row;
        });

        const blob = new Blob([JSON.stringify(jsonRows, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast.success(`Exported ${jsonRows.length} template(s) as JSON.`);
      } else {
        const colMap: Record<string, { label: string; get: (t: TemplateItem) => string }> = {
          title: { label: 'Template Title', get: t => t.title || '' },
          actRef: { label: 'Act Reference', get: t => t.actRef || '' },
          category: { label: 'Category', get: t => t.category || 'General' },
          fields: { label: 'Fields Count', get: t => String(t.fields?.length || 0) },
          description: { label: 'Description', get: t => t.description || '' },
          updatedAt: { label: 'Last Updated', get: t => t.updatedAt ? new Date(t.updatedAt).toISOString().slice(0, 10) : '' }
        };

        const selectedCols = config.columns.filter(c => colMap[c]);
        const headers = selectedCols.map(c => colMap[c].label);
        const rows = dataToExport.map(t => selectedCols.map(c => colMap[c].get(t)));

        CsvExporter.export(filename, headers, rows);
        this.toast.success(`Exported ${rows.length} templates to CSV.`);
      }
      this.closeExportModal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      this.toast.error(msg);
    } finally {
      this.isExporting = false;
      this.cdr.markForCheck();
    }
  }

  exportCSV(): void {
    if (!this.templates.length) {
      this.toast.info('No template records to export.');
      return;
    }
    const headers = ['Template Title', 'Act Reference', 'Category', 'Fields Count', 'Last Updated'];
    const rows = this.templates.map(t => [
      t.title || '',
      t.actRef || '',
      t.category || 'General',
      t.fields?.length || 0,
      t.updatedAt ? new Date(t.updatedAt).toISOString().slice(0, 10) : ''
    ]);
    try {
      CsvExporter.export(`legal_templates_${new Date().toISOString().slice(0, 10)}`, headers, rows);
      this.toast.success(`Exported ${rows.length} templates to CSV.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed.';
      this.toast.error(msg);
    }
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

  viewTemplate(tpl: TemplateItem): void {
    this.selectedTemplate = tpl;
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.selectedTemplate = null;
    this.cdr.markForCheck();
  }

  async deleteTemplate(tpl: TemplateItem): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: 'Confirm Template Deletion',
      message: `Are you sure you want to delete template "${tpl.title}"? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete Template'
    });

    if (confirmed) {
      this.api.deleteTemplate(tpl._id).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          this.toast.success(res.message || 'Template deleted successfully.');
          this.closeModal();
          this.fetchStats();
          this.fetchTemplates();
        },
        error: (err: HttpErrorResponse | Error) => {
          const msg = err instanceof HttpErrorResponse ? err.error?.message || err.message : err.message;
          this.toast.error(msg || 'Failed to delete template.');
        }
      });
    }
  }
}