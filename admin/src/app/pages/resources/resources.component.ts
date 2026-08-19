import { Component, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';

import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { ActionMenuComponent } from '../../shared/components/action-menu/action-menu.component';
import { ColumnCustomizerComponent, ColumnDef } from '../../shared/components/column-customizer/column-customizer.component';
import { AdminSearchInputComponent, AdminEmptyStateComponent, AdminSortHeaderComponent } from '../../shared/components/data-table/data-table-helpers.component';
import { ExportModalComponent, ExportConfig } from '../../shared/components/export-modal/export-modal.component';
import { DateRangePickerComponent, DateRangeEvent } from '../../shared/components/date-range-picker/date-range-picker.component';
import { PhoneDisplayPipe, EmailDisplayPipe } from '../../shared/pipes/contact-display.pipe';
import { ResourceDossierComponent } from './resource-dossier/resource-dossier.component';
import { ResourceModalComponent } from './resource-modal/resource-modal.component';
import { ResourceImportWizardComponent, BatchImportResult, ValidationReport } from './resource-import-wizard/resource-import-wizard.component';

import { TableSelection, handleTableKeyboardNav } from '../../core/utils/table.utils';
import { SwrCacheService } from '../../core/services/admin-swr-cache.service';
import { smartLoading } from '../../core/utils/smart-loading.operator';
import { CsvExporter } from '../../core/utils/csv-exporter';
import { LegalResourceItem } from '../legal-content/legal-content.models';
import { INDIAN_STATES_DISTRICTS, INDIAN_STATES } from '../../core/constants/geo.constants';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'admin-resources',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SkeletonComponent,
    TooltipDirective,
    SelectComponent,
    PaginationComponent,
    ActionMenuComponent,
    ColumnCustomizerComponent,
    AdminSearchInputComponent,
    AdminSortHeaderComponent,
    AdminEmptyStateComponent,
    ExportModalComponent,
    DateRangePickerComponent,
    PhoneDisplayPipe,
    EmailDisplayPipe,
    ResourceDossierComponent,
    ResourceModalComponent,
    ResourceImportWizardComponent
  ],
  templateUrl: './resources.component.html',
  styleUrl: './resources.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResourcesComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroyRef = inject(DestroyRef);

  // Institutional Directory Data & Loading
  resources: LegalResourceItem[] = [];
  isLoading = false;
  isInitialLoad = true;
  isSaving = false;
  isGeocoding = false;
  isVerifyingCycle = false;
  isExporting = false;

  // Search & Filter State
  search = '';
  selectedState = '';
  selectedDistrict = '';
  selectedType = '';
  selectedFacility = '';
  selectedJurisdiction = '';
  selectedStatus = '';
  startDate = '';
  endDate = '';

  // Sorting
  sortBy = 'createdAt';
  sortOrder: 'asc' | 'desc' = 'desc';

  // Subscriptions & Subjects
  private searchSubject$ = new Subject<string>();
  private searchSub?: Subscription;
  private routeSub?: Subscription;
  private fetchSub?: Subscription;

  // Pagination
  pagination = {
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  };

  // Telemetry Metrics
  summaryMetrics = {
    total: 0,
    verified: 0,
    courts: 0,
    legalAid: 0,
    policeStations: 0,
    efilingEnabled: 0,
    ladcsActive: 0,
    pending: 0,
    coveredStatesCount: 0
  };

  // Multi-Selection State
  selection = new TableSelection<string>();

  get resourceIds(): string[] {
    return this.resources.map(r => r._id || r.id || '').filter(Boolean);
  }

  get isAllPageSelected(): boolean {
    return this.resources.length > 0 && this.resources.every(r => this.selection.isSelected(r._id || r.id || ''));
  }

  isAllSelected(): boolean {
    return this.isAllPageSelected;
  }

  toggleSelectAll(): void {
    if (this.isAllPageSelected) {
      this.selection.clear();
    } else {
      this.resources.forEach(r => {
        const id = r._id || r.id;
        if (id) this.selection.selectedIds.add(id);
      });
    }
    this.cdr.markForCheck();
  }

  toggleSelectOne(id: string): void {
    this.selection.toggle(id);
    this.cdr.markForCheck();
  }

  private rowClickTimeout: any = null;

  onRowClick(id: string): void {
    if (this.rowClickTimeout) {
      clearTimeout(this.rowClickTimeout);
    }
    this.rowClickTimeout = setTimeout(() => {
      this.selection.toggle(id);
      this.rowClickTimeout = null;
      this.cdr.markForCheck();
    }, 250);
  }

  onRowDblClick(resource: LegalResourceItem): void {
    if (this.rowClickTimeout) {
      clearTimeout(this.rowClickTimeout);
      this.rowClickTimeout = null;
    }
    this.openDossier(resource);
  }

  // Keyboard Navigation & Row Focus
  focusedRowIndex = -1;

  // Column Customizer Definitions (Streamlined Enterprise Layout)
  columnDefs: ColumnDef[] = [
    { key: 'institution', label: 'Institution & Hierarchy' },
    { key: 'location', label: 'Location & District' },
    { key: 'facilities', label: 'Capabilities & Hours' },
    { key: 'contacts', label: 'Official Contacts' },
    { key: 'compliance', label: 'Audit Compliance' }
  ];

  columnVisibility: Record<string, boolean> = {
    institution: true,
    location: true,
    facilities: true,
    contacts: true,
    compliance: true
  };

  get isNoColumnsVisible(): boolean {
    return Object.values(this.columnVisibility).every(v => !v);
  }

  get isAnyColumnHidden(): boolean {
    return Object.values(this.columnVisibility).some(v => !v);
  }

  resetColumnVisibility(): void {
    const keys = Object.keys(this.columnVisibility);
    const reset: Record<string, boolean> = {};
    keys.forEach(k => reset[k] = true);
    this.columnVisibility = reset;
    this.cdr.markForCheck();
  }

  get visibleColumnKeys(): string[] {
    return Object.entries(this.columnVisibility).filter(([, v]) => v).map(([k]) => k);
  }

  onColumnVisibilityChange(updated: Record<string, boolean>): void {
    this.columnVisibility = updated;
  }

  // Active Query Params for Saved Views
  get activeQueryParamsObj(): Record<string, any> {
    return {
      search: this.search,
      state: this.selectedState,
      district: this.selectedDistrict,
      type: this.selectedType,
      facility: this.selectedFacility,
      jurisdictionLevel: this.selectedJurisdiction,
      status: this.selectedStatus,
      startDate: this.startDate,
      endDate: this.endDate,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder
    };
  }

  // Filter Dropdown Options with Rich Icons & Color Accents
  get typeOptions(): SelectOption[] {
    return [
      { label: `All Types (${this.summaryMetrics.total || 0})`, value: '', icon: 'info', color: '#38bdf8' },
      { label: `Courts (${this.summaryMetrics.courts || 0})`, value: 'Court', icon: 'briefcase', color: '#818cf8' },
      { label: `Legal Aid / DLSA (${this.summaryMetrics.legalAid || 0})`, value: 'LegalAid', icon: 'award', color: '#38bdf8' },
      { label: `Police Stations (${this.summaryMetrics.policeStations || 0})`, value: 'PoliceStation', icon: 'shield', color: '#f59e0b' }
    ];
  }

  jurisdictionOptions: SelectOption[] = [
    { label: 'All Hierarchy Levels', value: '', icon: 'info', color: '#38bdf8' },
    { label: 'Supreme Court (Apex)', value: 'National', icon: 'award', color: '#f43f5e' },
    { label: 'High Court (State)', value: 'State', icon: 'briefcase', color: '#a855f7' },
    { label: 'District Court / DLSA', value: 'District', icon: 'user', color: '#38bdf8' },
    { label: 'Taluka Court / TLSC', value: 'Taluka', icon: 'check', color: '#10b981' },
    { label: 'Special Tribunal', value: 'SpecialTribunal', icon: 'zap', color: '#fb923c' }
  ];

  stateOptions: SelectOption[] = [
    { label: 'All States & UTs', value: '', icon: 'info', color: '#38bdf8' },
    ...INDIAN_STATES.map(st => ({ label: st, value: st, icon: 'map-pin', color: '#38bdf8' }))
  ];

  get districtOptions(): SelectOption[] {
    const st = this.selectedState;
    if (!st || !INDIAN_STATES_DISTRICTS[st]) {
      return [{ label: 'All Districts', value: '', icon: 'info', color: '#38bdf8' }];
    }
    return [
      { label: `All Districts in ${st}`, value: '', icon: 'info', color: '#38bdf8' },
      ...INDIAN_STATES_DISTRICTS[st].map(d => ({ label: d, value: d, icon: 'map-pin', color: '#38bdf8' }))
    ];
  }

  facilityOptions: SelectOption[] = [
    { label: 'All Facilities', value: '', icon: 'info', color: '#38bdf8' },
    { label: 'e-Sewa Kendra (e-Filing)', value: 'hasEfiling', icon: 'zap', color: '#f59e0b' },
    { label: 'LADCS Defense Unit', value: 'hasLADCS', icon: 'shield', color: '#818cf8' },
    { label: 'VC Remand Room', value: 'hasVCRoom', icon: 'refresh', color: '#38bdf8' },
    { label: 'Legal Aid Clinic', value: 'hasLegalAidClinic', icon: 'check', color: '#10b981' },
    { label: 'Wheelchair Accessible', value: 'isWheelchairAccessible', icon: 'user', color: '#a855f7' }
  ];

  statusOptions: SelectOption[] = [
    { label: 'All Statuses', value: '', icon: 'info', color: '#38bdf8' },
    { label: 'Audit Verified', value: 'approved', icon: 'check', color: '#10b981' },
    { label: 'Pending Audit', value: 'pending', icon: 'clock', color: '#f59e0b' }
  ];

  getSelectedTypeLabel(): string {
    const match = this.typeOptions.find(o => o.value === this.selectedType);
    return match ? match.label : this.selectedType;
  }

  getSelectedFacilityLabel(): string {
    const match = this.facilityOptions.find(o => o.value === this.selectedFacility);
    return match ? match.label : this.selectedFacility;
  }

  getSelectedJurisdictionLabel(): string {
    const match = this.jurisdictionOptions.find(o => o.value === this.selectedJurisdiction);
    return match ? match.label : this.selectedJurisdiction;
  }

  // Active Filter Summary Badges
  get hasQueryFilter(): boolean {
    return !!(
      this.search ||
      this.selectedState ||
      this.selectedDistrict ||
      this.selectedType ||
      this.selectedFacility ||
      this.selectedJurisdiction ||
      this.selectedStatus ||
      this.startDate ||
      this.endDate ||
      this.isAnyColumnHidden
    );
  }

  get isFilterActive(): boolean {
    return this.hasQueryFilter || this.selection.size > 0;
  }

  get activeFilterPills(): { key: string; label: string }[] {
    const pills: { key: string; label: string }[] = [];
    if (this.search) pills.push({ key: 'search', label: `Search: "${this.search}"` });
    if (this.selectedState) pills.push({ key: 'state', label: `State: ${this.selectedState}` });
    if (this.selectedDistrict) pills.push({ key: 'district', label: `District: ${this.selectedDistrict}` });
    if (this.selectedType) {
      const match = this.typeOptions.find(o => o.value === this.selectedType);
      pills.push({ key: 'type', label: match ? match.label : `Type: ${this.selectedType}` });
    }
    if (this.selectedFacility) {
      const match = this.facilityOptions.find(o => o.value === this.selectedFacility);
      pills.push({ key: 'facility', label: match ? match.label : `Facility: ${this.selectedFacility}` });
    }
    if (this.selectedJurisdiction) {
      const match = this.jurisdictionOptions.find(o => o.value === this.selectedJurisdiction);
      pills.push({ key: 'jurisdictionLevel', label: match ? match.label : `Hierarchy: ${this.selectedJurisdiction}` });
    }
    if (this.selectedStatus) {
      pills.push({ key: 'status', label: this.selectedStatus === 'approved' ? 'Audit Verified' : 'Pending Audit' });
    }
    if (this.startDate || this.endDate) {
      pills.push({ key: 'dateRange', label: `Date: ${this.startDate || 'Start'} → ${this.endDate || 'End'}` });
    }
    return pills;
  }

  onChipsWheel(event: WheelEvent): void {
    if (event.deltaY !== 0) {
      const target = event.currentTarget as HTMLElement;
      if (target && target.scrollWidth > target.clientWidth) {
        event.preventDefault();
        target.scrollLeft += event.deltaY;
      }
    }
  }

  // Secondary / More Filters Popover Drawer State
  @ViewChild('filtersContainer') filtersContainer?: ElementRef;
  isMoreFiltersOpen = false;

  get activeSecondaryFilterCount(): number {
    let count = 0;
    if (this.selectedDistrict) count++;
    if (this.selectedJurisdiction) count++;
    if (this.selectedStatus) count++;
    if (this.startDate || this.endDate) count++;
    return count;
  }

  toggleMoreFilters(event?: Event): void {
    if (event) event.stopPropagation();
    this.isMoreFiltersOpen = !this.isMoreFiltersOpen;
    this.cdr.markForCheck();
  }

  closeMoreFilters(): void {
    if (this.isMoreFiltersOpen) {
      this.isMoreFiltersOpen = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:click', ['$event'])
  onFiltersClickOutside(event: MouseEvent): void {
    if (this.isMoreFiltersOpen && this.filtersContainer) {
      const isClickInside = this.filtersContainer.nativeElement.contains(event.target as Node);
      if (!isClickInside) {
        this.closeMoreFilters();
      }
    }
  }

  resetSecondaryFilters(): void {
    this.selectedDistrict = '';
    this.selectedJurisdiction = '';
    this.selectedStatus = '';
    this.startDate = '';
    this.endDate = '';
    this.pagination.page = 1;
    this.swrCache.invalidate('resources');
    this.updateUrlParams();
    this.fetchResources();
  }

  removeFilter(key: string): void {
    if (key === 'search') this.search = '';
    else if (key === 'state') {
      this.selectedState = '';
      this.selectedDistrict = '';
    }
    else if (key === 'district') this.selectedDistrict = '';
    else if (key === 'type') this.selectedType = '';
    else if (key === 'facility') this.selectedFacility = '';
    else if (key === 'jurisdictionLevel') this.selectedJurisdiction = '';
    else if (key === 'status') this.selectedStatus = '';
    else if (key === 'dateRange') {
      this.startDate = '';
      this.endDate = '';
    }
    this.pagination.page = 1;
    this.swrCache.invalidate('resources');
    this.updateUrlParams();
    this.fetchResources();
  }

  resetFilters(): void {
    this.search = '';
    this.selectedState = '';
    this.selectedDistrict = '';
    this.selectedType = '';
    this.selectedFacility = '';
    this.selectedJurisdiction = '';
    this.selectedStatus = '';
    this.startDate = '';
    this.endDate = '';
    this.pagination.page = 1;
    this.selection.clear();
    this.resetColumnVisibility();
    this.swrCache.invalidate('resources');
    this.toast.info('Resource filters and search reset to default.');
    this.updateUrlParams();
    this.fetchResources();
  }

  // Interactive Metric Pill Toggles
  filterByTypeMetric(typeVal: string): void {
    if (this.selectedType === typeVal) {
      this.selectedType = '';
    } else {
      this.selectedType = typeVal;
    }
    this.onFilterChange();
  }

  filterByStatusMetric(statusVal: string): void {
    if (this.selectedStatus === statusVal) {
      this.selectedStatus = '';
    } else {
      this.selectedStatus = statusVal;
    }
    this.onFilterChange();
  }

  filterByFacilityMetric(facilityVal: string): void {
    if (this.selectedFacility === facilityVal) {
      this.selectedFacility = '';
    } else {
      this.selectedFacility = facilityVal;
    }
    this.onFilterChange();
  }

  // Master-Detail Dossier Drawer State
  inspectItem: LegalResourceItem | null = null;
  activeDossierTab: 'overview' | 'facilities' | 'leadership' | 'audit' = 'overview';
  pendingInspectId: string | null = null;

  // Create / Edit Modal State
  isModalOpen = false;
  isEditMode = false;
  editingId: string | null = null;

  formData = {
    name: '',
    type: 'Court',
    jurisdictionLevel: 'District',
    city: 'Delhi',
    district: 'New Delhi',
    state: 'Delhi',
    pincode: '110001',
    address: '',
    phone: '',
    fax: '',
    email: '',
    website: '',
    operatingHours: '09:30 AM - 05:00 PM (Mon-Sat)',
    lunchBreak: '01:30 PM - 02:00 PM',
    status: 'approved',
    lat: 28.6139,
    lng: 77.2090,
    hasEfiling: true,
    hasLADCS: true,
    hasVCRoom: true,
    hasLegalAidClinic: true,
    isWheelchairAccessible: true,
    patronInChief: '',
    executiveChairman: '',
    memberSecretary: '',
    sclscChairman: '',
    sclscSecretary: '',
    auditNotes: ''
  };

  // Batch Import Pipeline Wizard State
  showImportModal = false;
  importWizardStep: 'input' | 'validate' | 'success' = 'input';
  bulkJsonText = '';
  isDryRunning = false;
  isBatchImporting = false;
  validationReport: ValidationReport | null = null;
  importResult: BatchImportResult | null = null;

  // Export Modal State & Columns
  isExportModalOpen = false;
  exportColumns = [
    { key: 'name', label: 'Institution Name' },
    { key: 'type', label: 'Type' },
    { key: 'jurisdictionLevel', label: 'Hierarchy Level' },
    { key: 'state', label: 'State' },
    { key: 'district', label: 'District' },
    { key: 'city', label: 'City' },
    { key: 'address', label: 'Street Address' },
    { key: 'pincode', label: 'Pincode' },
    { key: 'contactNumber', label: 'Phone Numbers' },
    { key: 'email', label: 'Official Email' },
    { key: 'website', label: 'Portal Website' },
    { key: 'status', label: 'Audit Status' }
  ];

  // Kebab Action Menu State & Reference
  @ViewChild('actionMenu') actionMenuRef!: ActionMenuComponent;
  openActionMenuId: string | null = null;
  private scrollListener?: () => void;

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialog: DialogService,
    private route: ActivatedRoute,
    private router: Router,
    private elRef: ElementRef,
    public swrCache: SwrCacheService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Read initial params from URL
    this.routeSub = this.route.queryParams.subscribe(params => {
      if (params['search']) this.search = params['search'];
      if (params['state']) this.selectedState = params['state'];
      if (params['district']) this.selectedDistrict = params['district'];
      if (params['type']) this.selectedType = params['type'];
      if (params['facility']) this.selectedFacility = params['facility'];
      if (params['jurisdictionLevel']) this.selectedJurisdiction = params['jurisdictionLevel'];
      if (params['status']) this.selectedStatus = params['status'];
      if (params['startDate']) this.startDate = params['startDate'];
      if (params['endDate']) this.endDate = params['endDate'];
      if (params['sortBy']) this.sortBy = params['sortBy'];
      if (params['sortOrder']) this.sortOrder = params['sortOrder'];
      if (params['page']) this.pagination.page = parseInt(params['page'], 10) || 1;
      if (params['limit']) this.pagination.limit = parseInt(params['limit'], 10) || 10;
      if (params['inspect']) this.pendingInspectId = params['inspect'];
      if (params['dossierTab'] && ['overview', 'facilities', 'leadership', 'audit'].includes(params['dossierTab'])) {
        this.activeDossierTab = params['dossierTab'];
      }
    });

    // Search Debounce Subject
    this.searchSub = this.searchSubject$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.search = query;
      this.pagination.page = 1;
      this.swrCache.invalidate('resources');
      this.updateUrlParams();
      this.fetchResources();
    });

    this.fetchResources();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      const tableWrapper = this.elRef.nativeElement.querySelector('.data-table-wrapper');
      if (tableWrapper) {
        this.scrollListener = () => {
          if (this.openActionMenuId) {
            this.openActionMenuId = null;
            this.cdr.markForCheck();
          }
        };
        tableWrapper.addEventListener('scroll', this.scrollListener, { passive: true });
      }
    });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.routeSub?.unsubscribe();
    this.fetchSub?.unsubscribe();
    if (this.scrollListener) {
      const tableWrapper = this.elRef.nativeElement.querySelector('.data-table-wrapper');
      tableWrapper?.removeEventListener('scroll', this.scrollListener);
    }
  }

  // Kebab Action Menu Controller
  getOpenActionItem(): LegalResourceItem | null {
    if (!this.openActionMenuId) return null;
    return this.resources.find(r => (r._id || r.id) === this.openActionMenuId) || null;
  }

  toggleActionMenu(id: string, buttonEl: HTMLElement, event: Event): void {
    event.stopPropagation();
    if (this.openActionMenuId === id) {
      this.openActionMenuId = null;
      return;
    }
    this.openActionMenuId = id;
    if (this.actionMenuRef) {
      this.actionMenuRef.openAt(buttonEl);
    }
  }

  closeActionMenu(): void {
    this.openActionMenuId = null;
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    this.openActionMenuId = null;
    this.closeMoreFilters();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.openActionMenuId = null;
  }

  onSearchChange(val: string): void {
    this.searchSubject$.next(val);
  }

  onFilterChange(): void {
    this.pagination.page = 1;
    this.swrCache.invalidate('resources');
    this.updateUrlParams();
    this.fetchResources();
  }

  onStateChange(st: string): void {
    this.selectedState = st;
    this.selectedDistrict = '';
    this.onFilterChange();
  }

  onDistrictChange(dst: string): void {
    this.selectedDistrict = dst;
    this.onFilterChange();
  }

  onDateRangeChange(event: DateRangeEvent): void {
    this.startDate = event.startDate;
    this.endDate = event.endDate;
    this.onFilterChange();
  }

  onSavedViewApply(viewParams: Record<string, any>): void {
    this.search = viewParams['search'] || '';
    this.selectedState = viewParams['state'] || '';
    this.selectedDistrict = viewParams['district'] || '';
    this.selectedType = viewParams['type'] || '';
    this.selectedFacility = viewParams['facility'] || '';
    this.selectedJurisdiction = viewParams['jurisdictionLevel'] || '';
    this.selectedStatus = viewParams['status'] || '';
    this.startDate = viewParams['startDate'] || '';
    this.endDate = viewParams['endDate'] || '';
    this.sortBy = viewParams['sortBy'] || 'createdAt';
    this.sortOrder = viewParams['sortOrder'] || 'desc';
    this.pagination.page = 1;
    this.swrCache.invalidate('resources');
    this.updateUrlParams();
    this.fetchResources();
    this.toast.success('Applied saved view preset.');
  }

  updateUrlParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        search: this.search || null,
        state: this.selectedState || null,
        district: this.selectedDistrict || null,
        type: this.selectedType || null,
        facility: this.selectedFacility || null,
        jurisdictionLevel: this.selectedJurisdiction || null,
        status: this.selectedStatus || null,
        startDate: this.startDate || null,
        endDate: this.endDate || null,
        sortBy: this.sortBy !== 'createdAt' ? this.sortBy : null,
        sortOrder: this.sortOrder !== 'desc' ? this.sortOrder : null,
        page: this.pagination.page > 1 ? this.pagination.page : null,
        limit: this.pagination.limit !== 10 ? this.pagination.limit : null,
        inspect: this.inspectItem ? (this.inspectItem._id || this.inspectItem.id) : null,
        dossierTab: this.inspectItem && this.activeDossierTab !== 'overview' ? this.activeDossierTab : null
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  // Fetch Resources with SWR & smartLoading
  fetchResources(forceFresh = false): void {
    const params: any = {
      page: this.pagination.page,
      limit: this.pagination.limit,
      search: this.search || undefined,
      state: this.selectedState || undefined,
      district: this.selectedDistrict || undefined,
      type: this.selectedType || undefined,
      jurisdictionLevel: this.selectedJurisdiction || undefined,
      facility: this.selectedFacility || undefined,
      status: this.selectedStatus || undefined,
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder
    };

    if (!forceFresh) {
      const cached = this.swrCache.get<any>('resources', params);
      if (cached) {
        this.processResponse(cached);
        this.isInitialLoad = false;
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    }

    this.isLoading = true;
    this.cdr.markForCheck();

    this.fetchSub?.unsubscribe();
    this.fetchSub = this.api.getResources(params)
      .pipe(smartLoading(loading => {
        this.isLoading = loading;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (res: any) => {
          this.isInitialLoad = false;
          this.processResponse(res);
          this.swrCache.set('resources', params, res);
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          this.isInitialLoad = false;
          this.toast.error(err?.error?.message || 'Failed to fetch legal institutional registry.');
          this.cdr.markForCheck();
        }
      });
  }

  private processResponse(res: any): void {
    if (res.metrics) {
      this.summaryMetrics = res.metrics;
    }
    if (res.pagination) {
      this.resources = res.data || [];
      this.pagination.total = res.pagination.total || 0;
      this.pagination.pages = res.pagination.pages || 1;
    } else {
      const list = res.data || res || [];
      this.resources = list;
      this.pagination.total = list.length;
      this.pagination.pages = 1;
    }

    if (this.pendingInspectId) {
      const found = this.resources.find(r => (r._id || r.id) === this.pendingInspectId);
      if (found) {
        this.inspectItem = found;
      }
      this.pendingInspectId = null;
    }
  }

  // Sorting
  onSortChange(event: { key: string; order: 'asc' | 'desc' }): void {
    this.sortBy = event.key;
    this.sortOrder = event.order;
    this.pagination.page = 1;
    this.swrCache.invalidate('resources');
    this.updateUrlParams();
    this.fetchResources();
  }

  toggleSort(column: string): void {
    const newOrder = this.sortBy === column ? (this.sortOrder === 'asc' ? 'desc' : 'asc') : 'asc';
    this.onSortChange({ key: column, order: newOrder });
  }

  // Pagination Handlers
  onPageChange(page: number): void {
    this.pagination.page = page;
    this.updateUrlParams();
    this.fetchResources();
  }

  onPageSizeChange(limit: number): void {
    this.pagination.limit = limit;
    this.pagination.page = 1;
    this.updateUrlParams();
    this.fetchResources();
  }

  // Keyboard Shortcuts & Navigation
  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    handleTableKeyboardNav(event, {
      getListLength: () => this.resources.length,
      getFocusedIndex: () => this.focusedRowIndex,
      setFocusedIndex: (idx: number) => { this.focusedRowIndex = idx; this.cdr.markForCheck(); },
      onEnter: (idx: number) => { if (this.resources[idx]) this.openDossier(this.resources[idx]); },
      onEscape: () => {
        if (this.inspectItem) this.closeDossier();
        else if (this.isModalOpen) this.closeModal();
        else if (this.showImportModal) this.closeImportModal();
        else if (this.isExportModalOpen) this.isExportModalOpen = false;
        this.cdr.markForCheck();
      },
      scrollToRow: () => this.scrollToFocusedRow()
    });
  }

  private scrollToFocusedRow(): void {
    setTimeout(() => {
      const rows = document.querySelectorAll('.table-data-row');
      if (rows && rows[this.focusedRowIndex]) {
        (rows[this.focusedRowIndex] as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  }

  // Clipboard Copy with Instant Feedback
  copyToClipboard(text: string, label = 'Content'): void {
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.toast.success(`${label} copied to clipboard.`);
      }).catch(() => {
        this.toast.info(`${label}: ${text}`);
      });
    } else {
      this.toast.info(`${label}: ${text}`);
    }
  }

  // Master Dossier Drawer Handlers
  openDossier(item: LegalResourceItem, tab: 'overview' | 'facilities' | 'leadership' | 'audit' = 'overview'): void {
    this.inspectItem = item;
    this.activeDossierTab = tab;
    this.updateUrlParams();
    this.cdr.markForCheck();
  }

  closeDossier(): void {
    this.inspectItem = null;
    this.updateUrlParams();
    this.cdr.markForCheck();
  }

  // Annual Verification Cycle Renewal (+12 months)
  renewVerificationCycle(item: LegalResourceItem): void {
    const targetId = item._id || item.id;
    if (!targetId) return;

    this.isVerifyingCycle = true;
    this.api.verifyResourceCycle(targetId, {
      notes: 'Annual Bar & Judicial Infrastructure compliance re-verified',
      verifiedBy: 'Judicial Registry Admin'
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => {
        this.isVerifyingCycle = false;
        this.toast.success(`Verification cycle renewed for 12 months for "${item.name}".`);
        if (this.inspectItem && (this.inspectItem._id === targetId || this.inspectItem.id === targetId)) {
          this.inspectItem = res.data;
        }
        this.swrCache.invalidate('resources');
        this.fetchResources(true);
      },
      error: (err: any) => {
        this.isVerifyingCycle = false;
        this.toast.error(err?.error?.message || 'Failed to renew verification cycle.');
        this.cdr.markForCheck();
      }
    });
  }

  // Geocoding Auto-Resolver Studio (Google Maps Geocoding / Fallback)
  resolveAddressGis(): void {
    const query = `${this.formData.address}, ${this.formData.city}, ${this.formData.state}, India`.trim();
    if (!this.formData.address.trim()) {
      this.toast.warning('Please enter a street address first to resolve GIS coordinates.');
      return;
    }

    this.isGeocoding = true;
    this.cdr.markForCheck();

    const googleKey = (environment as any).googleMapsApiKey;
    const endpoint = googleKey
      ? `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${googleKey}`
      : `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;

    fetch(endpoint)
      .then(res => res.json())
      .then(data => {
        this.isGeocoding = false;
        let lat: number | null = null;
        let lng: number | null = null;

        if (googleKey && data.results && data.results.length > 0) {
          lat = data.results[0].geometry.location.lat;
          lng = data.results[0].geometry.location.lng;
        } else if (Array.isArray(data) && data.length > 0) {
          lat = parseFloat(data[0].lat);
          lng = parseFloat(data[0].lon);
        }

        if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
          this.formData.lat = parseFloat(lat.toFixed(6));
          this.formData.lng = parseFloat(lng.toFixed(6));
          this.toast.success(`Google GIS Pinpoint resolved: [${this.formData.lat}, ${this.formData.lng}]`);
        } else {
          this.toast.info('Exact pinpoint not found; defaulting coordinates to district center.');
        }
        this.cdr.markForCheck();
      })
      .catch(() => {
        this.isGeocoding = false;
        this.toast.info('Geocoding service unavailable; please verify coordinates manually.');
        this.cdr.markForCheck();
      });
  }

  // Create / Edit Institution Modal Handlers
  openCreateModal(): void {
    this.isEditMode = false;
    this.editingId = null;
    this.formData = {
      name: '',
      type: 'Court',
      jurisdictionLevel: 'District',
      city: 'Delhi',
      district: 'Central Delhi',
      state: 'Delhi',
      pincode: '110001',
      address: '',
      phone: '',
      fax: '',
      email: '',
      website: '',
      operatingHours: '09:30 AM - 05:00 PM (Mon-Sat)',
      lunchBreak: '01:30 PM - 02:00 PM',
      status: 'approved',
      lat: 28.6139,
      lng: 77.2090,
      hasEfiling: true,
      hasLADCS: true,
      hasVCRoom: true,
      hasLegalAidClinic: true,
      isWheelchairAccessible: true,
      patronInChief: '',
      executiveChairman: '',
      memberSecretary: '',
      sclscChairman: '',
      sclscSecretary: '',
      auditNotes: 'Verified compliant with e-Courts Phase III guidelines'
    };
    this.isModalOpen = true;
    this.cdr.markForCheck();
  }

  openEditModal(item: LegalResourceItem): void {
    this.isEditMode = true;
    this.editingId = item._id || item.id || null;
    const phoneVal = Array.isArray(item.contactNumber) ? item.contactNumber.join(', ') : (item.contactNumber || '');
    const faxVal = Array.isArray(item.faxNumber) ? item.faxNumber.join(', ') : (item.faxNumber || '');
    const emailVal = Array.isArray(item.email) ? item.email.join(', ') : (item.email || '');

    this.formData = {
      name: item.name || '',
      type: item.type || 'Court',
      jurisdictionLevel: item.jurisdictionLevel || 'District',
      city: item.city || 'Delhi',
      district: item.district || item.city || 'Delhi',
      state: item.state || 'Delhi',
      pincode: item.pincode || '',
      address: item.address || '',
      phone: phoneVal,
      fax: faxVal,
      email: emailVal,
      website: item.website || '',
      operatingHours: item.operatingHours || '09:30 AM - 05:00 PM (Mon-Sat)',
      lunchBreak: item.lunchBreak || '01:30 PM - 02:00 PM',
      status: item.status || 'approved',
      lat: item.coordinates?.lat || 28.6139,
      lng: item.coordinates?.lng || 77.2090,
      hasEfiling: item.facilities?.hasEfiling !== false,
      hasLADCS: item.facilities?.hasLADCS !== false,
      hasVCRoom: item.facilities?.hasVCRoom !== false,
      hasLegalAidClinic: item.facilities?.hasLegalAidClinic !== false,
      isWheelchairAccessible: item.facilities?.isWheelchairAccessible !== false,
      patronInChief: item.patronInChief || '',
      executiveChairman: item.executiveChairman || '',
      memberSecretary: item.memberSecretary || '',
      sclscChairman: item.sclscChairman || '',
      sclscSecretary: item.sclscSecretary || '',
      auditNotes: item.auditNotes || ''
    };
    this.isModalOpen = true;
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.cdr.markForCheck();
  }

  saveResource(): void {
    if (!this.formData.name.trim() || !this.formData.address.trim()) {
      this.toast.warning('Institution name and physical street address are required.');
      return;
    }

    this.isSaving = true;
    this.cdr.markForCheck();

    const payload: Partial<LegalResourceItem> = {
      name: this.formData.name.trim(),
      type: this.formData.type,
      jurisdictionLevel: this.formData.jurisdictionLevel,
      city: this.formData.city.trim(),
      district: this.formData.district.trim(),
      state: this.formData.state,
      pincode: this.formData.pincode.trim(),
      address: this.formData.address.trim(),
      contactNumber: this.formData.phone ? this.formData.phone.split(',').map(p => p.trim()) : [],
      faxNumber: this.formData.fax ? this.formData.fax.split(',').map(f => f.trim()) : [],
      email: this.formData.email ? this.formData.email.split(',').map(e => e.trim()) : [],
      website: this.formData.website.trim(),
      operatingHours: this.formData.operatingHours,
      lunchBreak: this.formData.lunchBreak,
      status: this.formData.status,
      isVerified: this.formData.status === 'approved',
      coordinates: {
        lat: Number(this.formData.lat) || 28.6139,
        lng: Number(this.formData.lng) || 77.2090
      },
      facilities: {
        hasEfiling: this.formData.hasEfiling,
        hasLADCS: this.formData.hasLADCS,
        hasVCRoom: this.formData.hasVCRoom,
        hasLegalAidClinic: this.formData.hasLegalAidClinic,
        isWheelchairAccessible: this.formData.isWheelchairAccessible
      },
      patronInChief: this.formData.patronInChief,
      executiveChairman: this.formData.executiveChairman,
      memberSecretary: this.formData.memberSecretary,
      sclscChairman: this.formData.sclscChairman,
      sclscSecretary: this.formData.sclscSecretary,
      auditNotes: this.formData.auditNotes
    };

    if (this.isEditMode && this.editingId) {
      this.api.updateResource(this.editingId, payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.isSaving = false;
          this.toast.success(`Institutional profile "${this.formData.name}" updated successfully.`);
          this.closeModal();
          this.swrCache.invalidate('resources');
          this.fetchResources(true);
        },
        error: (err: any) => {
          this.isSaving = false;
          this.toast.error(err?.error?.message || 'Failed to update legal institution.');
          this.cdr.markForCheck();
        }
      });
    } else {
      this.api.createResource(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.isSaving = false;
          this.toast.success(`New legal institution "${this.formData.name}" onboarded into registry.`);
          this.closeModal();
          this.swrCache.invalidate('resources');
          this.fetchResources(true);
        },
        error: (err: any) => {
          this.isSaving = false;
          this.toast.error(err?.error?.message || 'Failed to create legal resource.');
          this.cdr.markForCheck();
        }
      });
    }
  }

  // Delete Individual Resource
  async openDeleteModal(item: LegalResourceItem): Promise<void> {
    const targetId = item._id || item.id;
    if (!targetId) return;

    const confirmed = await this.dialog.danger(
      'Confirm Institutional Deletion',
      `Are you sure you want to permanently delete "${item.name}"? Citizen location search and legal aid routing will no longer reference this institution.`
    );

    if (confirmed) {
      this.api.deleteResource(targetId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.toast.success(`Institutional profile "${item.name}" deleted.`);
          if (this.inspectItem && (this.inspectItem._id === targetId || this.inspectItem.id === targetId)) {
            this.closeDossier();
          }
          this.selection.selectedIds.delete(targetId);
          this.swrCache.invalidate('resources');
          this.fetchResources(true);
        },
        error: (err: any) => {
          this.toast.error(err?.error?.message || 'Failed to delete resource.');
        }
      });
    }
  }

  // --- Bulk Operations ---
  async bulkUpdateStatus(status: string): Promise<void> {
    const ids = Array.from(this.selection.selectedIds);
    if (!ids.length) return;

    const actionText = status === 'approved' ? 'Approve & Verify' : 'Suspend / Mark Pending';
    const confirmed = await this.dialog.confirm(
      `Confirm Bulk Status Update`,
      `Are you sure you want to ${actionText} ${ids.length} selected institution(s)?`
    );

    if (confirmed) {
      this.api.bulkUpdateResourceStatus(ids, status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res: any) => {
          this.toast.success(res?.message || `Updated status for ${ids.length} institution(s).`);
          this.selection.clear();
          this.swrCache.invalidate('resources');
          this.fetchResources(true);
        },
        error: (err: any) => {
          this.toast.error(err?.error?.message || 'Failed to perform bulk status update.');
        }
      });
    }
  }

  async bulkVerifyCycles(): Promise<void> {
    const ids = Array.from(this.selection.selectedIds);
    if (!ids.length) return;

    const confirmed = await this.dialog.confirm(
      'Confirm Bulk Annual Compliance Renewal',
      `Renew annual compliance cycle for 12 months across all ${ids.length} selected legal institutions?`
    );

    if (confirmed) {
      this.api.bulkVerifyResourceCycles(ids).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res: any) => {
          this.toast.success(res?.message || `Renewed annual verification cycle for ${ids.length} institution(s).`);
          this.selection.clear();
          this.swrCache.invalidate('resources');
          this.fetchResources(true);
        },
        error: (err: any) => {
          this.toast.error(err?.error?.message || 'Failed to renew verification cycles.');
        }
      });
    }
  }

  async bulkDeleteSelected(): Promise<void> {
    const ids = Array.from(this.selection.selectedIds);
    if (!ids.length) return;

    const confirmed = await this.dialog.danger(
      'Confirm Bulk Institutional Deletion',
      `Are you sure you want to permanently delete ${ids.length} selected legal institution(s)? This action cannot be undone.`
    );

    if (confirmed) {
      this.api.bulkDeleteResources(ids).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res: any) => {
          this.toast.success(res?.message || `Deleted ${ids.length} institutional record(s).`);
          this.selection.clear();
          this.swrCache.invalidate('resources');
          this.fetchResources(true);
        },
        error: (err: any) => {
          this.toast.error(err?.error?.message || 'Failed to delete selected resources.');
        }
      });
    }
  }

  // --- Batch Import Pipeline Wizard ---
  openImportModal(): void {
    this.showImportModal = true;
    this.importWizardStep = 'input';
    this.bulkJsonText = '';
    this.validationReport = null;
    this.importResult = null;
    this.cdr.markForCheck();
  }

  closeImportModal(): void {
    this.showImportModal = false;
    this.bulkJsonText = '';
    this.validationReport = null;
    this.importResult = null;
    this.cdr.markForCheck();
  }

  runDryRunValidation(): void {
    if (!this.bulkJsonText.trim()) {
      this.toast.warning('Please paste a JSON array of institutional records.');
      return;
    }

    try {
      const items = JSON.parse(this.bulkJsonText);
      if (!Array.isArray(items)) {
        this.toast.error('Input must be a valid JSON array of objects.');
        return;
      }

      this.isDryRunning = true;
      this.cdr.markForCheck();

      this.api.validateResourceBatch(items).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res: any) => {
          this.isDryRunning = false;
          this.validationReport = res;
          this.importWizardStep = 'validate';
          this.toast.info(`Dry-run validation complete: ${res.validCount} valid / ${res.errorCount} errors.`);
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          this.isDryRunning = false;
          this.toast.error(err?.error?.message || 'Validation request failed.');
          this.cdr.markForCheck();
        }
      });
    } catch (e: any) {
      this.toast.error('Invalid JSON syntax: ' + e.message);
    }
  }

  executeBatchImport(event?: { items: any[]; duplicateStrategy: 'skip' | 'upsert' | 'new' }): void {
    const itemsToImport = event?.items || (this.validationReport?.items?.filter((i: any) => i.status !== 'INVALID' && !i.excluded) ?? []);
    const duplicateStrategy = event?.duplicateStrategy || 'skip';

    if (!itemsToImport.length) {
      this.toast.warning('No valid records selected to import.');
      return;
    }

    this.isBatchImporting = true;
    this.cdr.markForCheck();

    this.api.importResourceBatch(itemsToImport, duplicateStrategy).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => {
        this.isBatchImporting = false;
        const importedCount = res.importedCount ?? itemsToImport.length;
        const updatedCount = res.updatedCount ?? 0;
        const skippedCount = res.skippedCount ?? 0;
        const failedCount = res.failedCount ?? 0;
        const durationMs = res.durationMs ?? 120;
        const batchId = res.batchId || ('BATCH-ETL-' + Math.random().toString(36).substring(2, 8).toUpperCase());

        this.importResult = {
          importedCount,
          updatedCount,
          skippedCount,
          failedCount,
          durationMs,
          batchId,
          timestamp: new Date()
        };
        this.importWizardStep = 'success';
        this.toast.success(res.message || `Successfully committed batch import.`);
        this.swrCache.invalidate('resources');
        this.fetchResources(true);
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.isBatchImporting = false;
        this.toast.error(err?.error?.message || 'Failed to execute batch import.');
        this.cdr.markForCheck();
      }
    });
  }

  // --- Export Modal Handlers ---
  openExportModal(): void {
    this.isExportModalOpen = true;
    this.cdr.markForCheck();
  }

  handleExport(config: ExportConfig): void {
    this.isExporting = true;
    this.cdr.markForCheck();

    // Fetch complete dataset for export matching current filters
    const params: any = {
      page: 1,
      limit: 10000,
      search: this.search || undefined,
      state: this.selectedState || undefined,
      district: this.selectedDistrict || undefined,
      type: this.selectedType || undefined,
      jurisdictionLevel: this.selectedJurisdiction || undefined,
      facility: this.selectedFacility || undefined,
      status: this.selectedStatus || undefined,
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder
    };

    this.api.getResources(params).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => {
        this.isExporting = false;
        let records: LegalResourceItem[] = res.data || res || [];

        if (config.scope === 'selected' && this.selection.size > 0) {
          records = records.filter(r => this.selection.isSelected(r._id || r.id || ''));
        }

        if (!records.length) {
          this.toast.info('No legal resource records to export.');
          return;
        }

        const selectedColKeys = config.columns;
        const headers = selectedColKeys.map(k => {
          const colDef = this.exportColumns.find(c => c.key === k);
          return colDef ? colDef.label : k;
        });

        const rows = records.map(r => {
          return selectedColKeys.map(k => {
            if (k === 'contactNumber') {
              return Array.isArray(r.contactNumber) ? r.contactNumber.join('; ') : (r.contactNumber || '');
            }
            if (k === 'email') {
              return Array.isArray(r.email) ? r.email.join('; ') : (r.email || '');
            }
            if (k === 'hasEfiling') return r.facilities?.hasEfiling ? 'Yes' : 'No';
            if (k === 'hasLADCS') return r.facilities?.hasLADCS ? 'Yes' : 'No';
            if (k === 'hasVCRoom') return r.facilities?.hasVCRoom ? 'Yes' : 'No';
            if (k === 'hasLegalAidClinic') return r.facilities?.hasLegalAidClinic ? 'Yes' : 'No';
            if (k === 'isWheelchairAccessible') return r.facilities?.isWheelchairAccessible ? 'Yes' : 'No';
            if (k === 'lastAuditDate') {
              return r.lastAuditDate ? new Date(r.lastAuditDate).toISOString().slice(0, 10) : 'Pending';
            }
            return (r as any)[k] ?? '';
          });
        });

        const filename = `national_legal_resources_directory_${new Date().toISOString().slice(0, 10)}`;

        if (config.format === 'csv') {
          CsvExporter.export(filename, headers, rows);
        } else if (config.format === 'json') {
          const jsonArray = records.map(r => {
            const obj: any = {};
            selectedColKeys.forEach(k => obj[k] = (r as any)[k]);
            return obj;
          });
          const blob = new Blob([JSON.stringify(jsonArray, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${filename}.json`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          // XLSX fallback or TSV
          const tsvContent = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
          const blob = new Blob([tsvContent], { type: 'text/tab-separated-values' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${filename}.tsv`;
          a.click();
          URL.revokeObjectURL(url);
        }

        this.toast.success(`Exported ${records.length} institutional records successfully.`);
        this.isExportModalOpen = false;
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.isExporting = false;
        this.toast.error(err?.error?.message || 'Export failed.');
        this.cdr.markForCheck();
      }
    });
  }

  // --- Display & Visual Layout Helpers ---
  getJurisdictionBadge(r: LegalResourceItem): { label: string; class: string } {
    if (r.type === 'PoliceStation') {
      return { label: 'Station', class: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    }
    if (r.type === 'LegalAid') {
      const level = r.jurisdictionLevel;
      const label = level === 'State' ? 'SLSA' : (level === 'Taluka' ? 'TLSC' : 'DLSA');
      return { label, class: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' };
    }
    if (r.type === 'GovernmentOffice') {
      return { label: 'Gov Admin', class: 'bg-slate-700/50 text-slate-300 border-slate-600/50' };
    }
    // Court
    switch (r.jurisdictionLevel) {
      case 'National':
        return { label: 'Supreme Court', class: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
      case 'State':
        return { label: 'High Court', class: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
      case 'District':
        return { label: 'District Court', class: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' };
      case 'Taluka':
        return { label: 'Taluka Court', class: 'bg-teal-500/15 text-teal-300 border-teal-500/30' };
      case 'SpecialTribunal':
        return { label: 'Tribunal', class: 'bg-orange-500/15 text-orange-300 border-orange-500/30' };
      default:
        return { label: r.jurisdictionLevel || 'Court', class: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' };
    }
  }

  getDisplayHours(hours?: string, type?: string): string {
    if (type === 'PoliceStation' || hours?.includes('24')) {
      return '24x7 Active';
    }
    if (!hours) return '09:30 AM - 05:00 PM';
    // Strip repetitive parenthesized text like (Mon-Sat) for clean inline rendering
    const cleaned = hours.replace(/\s*\([^)]*\)/g, '').trim();
    return cleaned || hours;
  }

  getFacilityChips(facilities?: any): { label: string; class: string; tooltip: string }[] {
    if (!facilities) return [];
    const list: { label: string; class: string; tooltip: string }[] = [];
    if (facilities.hasEfiling) {
      list.push({ label: 'e-Sewa', class: 'bg-amber-500/15 text-amber-300 border-amber-500/30', tooltip: 'e-Sewa Kendra digital token & filing desk' });
    }
    if (facilities.hasLADCS) {
      list.push({ label: 'LADCS', class: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30', tooltip: 'Legal Aid Defense Counsel System (LADCS)' });
    }
    if (facilities.hasVCRoom) {
      list.push({ label: 'VC Room', class: 'bg-sky-500/15 text-sky-300 border-sky-500/30', tooltip: 'VC Remand video conferencing booth' });
    }
    if (facilities.hasLegalAidClinic) {
      list.push({ label: 'Clinic', class: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', tooltip: 'Free Front Office Legal Aid Clinic' });
    }
    if (facilities.isWheelchairAccessible) {
      list.push({ label: 'Accessible', class: 'bg-slate-800 text-slate-300 border-slate-700', tooltip: 'Barrier-free wheelchair ramp & accessible courtrooms' });
    }
    return list;
  }

  getFacilityMoreTooltip(facilities?: any): string {
    const chips = this.getFacilityChips(facilities);
    if (chips.length <= 2) return '';
    return 'All Capabilities: ' + chips.map(c => c.label).join(', ');
  }
}