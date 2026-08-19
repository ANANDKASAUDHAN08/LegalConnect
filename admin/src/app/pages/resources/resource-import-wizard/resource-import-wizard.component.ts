import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, HostListener, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ToastService } from '../../../shared/services/toast.service';

export interface ValidationItem {
  index: number;
  name: string;
  type: string;
  jurisdictionLevel?: string;
  city: string;
  state: string;
  district?: string;
  address?: string;
  pincode?: string;
  email?: string;
  website?: string;
  lat?: number;
  lng?: number;
  contactNumber?: string;
  status: 'VALID' | 'WARNING' | 'INVALID';
  excluded?: boolean;
  errors?: string[];
  warnings?: string[];
  validationNotes?: string[];
}

export interface BatchImportResult {
  importedCount: number;
  updatedCount?: number;
  skippedCount?: number;
  failedCount?: number;
  durationMs?: number;
  batchId?: string;
  timestamp?: Date;
}

export interface ValidationReport {
  totalCount: number;
  validCount: number;
  errorCount: number;
  warningCount: number;
  items: ValidationItem[];
}

export interface BatchImportExecutionPayload {
  items: ValidationItem[];
  duplicateStrategy: 'skip' | 'upsert' | 'new';
}

@Component({
  selector: 'admin-resource-import-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective],
  templateUrl: './resource-import-wizard.component.html',
  styleUrl: './resource-import-wizard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResourceImportWizardComponent implements OnChanges {
  @Input({ required: true }) isOpen = false;
  @Input() step: 'input' | 'validate' | 'success' = 'input';
  @Input() bulkJsonText = '';
  @Input() isDryRunning = false;
  @Input() isBatchImporting = false;
  @Input() validationReport: ValidationReport | null = null;
  @Input() importResult: BatchImportResult | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() bulkJsonTextChange = new EventEmitter<string>();
  @Output() stepChange = new EventEmitter<'input' | 'validate' | 'success'>();
  @Output() runDryRun = new EventEmitter<void>();
  @Output() executeImport = new EventEmitter<BatchImportExecutionPayload>();

  // Input source mode: 'file' or 'text'
  inputMode: 'file' | 'text' = 'file';

  // Conflict Resolution Strategy
  duplicateStrategy: 'skip' | 'upsert' | 'new' = 'skip';

  // File Upload State
  uploadedFileName = '';
  uploadedFileSize = '';
  parsedRecordCount = 0;
  isDragging = false;
  fileParseError = '';

  // Validation Report Filtering & Search
  validationFilter: 'ALL' | 'VALID' | 'WARNING' | 'INVALID' = 'ALL';
  validationSearch = '';

  // Performance-Optimized Memoized State (Replaces CD template getters)
  cleanCount = 0;
  warningCount = 0;
  errorCount = 0;
  importableCount = 0;
  filteredValidationItems: ValidationItem[] = [];
  paginatedValidationItems: ValidationItem[] = [];

  // Table Preview Pagination
  currentPage = 1;
  pageSize = 25;
  totalPages = 1;

  // Max upload size guard (25MB)
  private readonly MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

  constructor(
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['validationReport']) {
      this.recalculateValidationStatsAndFilter();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen && !this.isBatchImporting && !this.isDryRunning) {
      this.close();
    }
  }

  // --- Input Source Switching ---
  setInputMode(mode: 'file' | 'text'): void {
    this.inputMode = mode;
  }

  // --- Drag and Drop File Handlers ---
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.processUploadedFile(event.dataTransfer.files[0]);
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processUploadedFile(input.files[0]);
    }
  }

  private processUploadedFile(file: File): void {
    this.fileParseError = '';

    // Safety guard on file size
    if (file.size > this.MAX_FILE_SIZE_BYTES) {
      this.fileParseError = `File size exceeds 25MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB). Please upload a smaller batch.`;
      this.toast.error(this.fileParseError);
      return;
    }

    this.uploadedFileName = file.name;
    this.uploadedFileSize = (file.size / 1024).toFixed(1) + ' KB';

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'json') {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (!Array.isArray(parsed)) {
            this.fileParseError = 'JSON file must contain an array of institutional records.';
            this.cdr.markForCheck();
            return;
          }
          this.parsedRecordCount = parsed.length;
          this.onJsonChange(JSON.stringify(parsed, null, 2));
          this.toast.success(`Parsed ${parsed.length} records from JSON.`);
          this.cdr.markForCheck();
        } catch (err: any) {
          this.fileParseError = 'Invalid JSON syntax: ' + err.message;
          this.cdr.markForCheck();
        }
      };
      reader.readAsText(file);
    } else if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (!rawRows || rawRows.length === 0) {
            this.fileParseError = 'Spreadsheet is empty or headers could not be found.';
            this.cdr.markForCheck();
            return;
          }

          // Normalize keys to camelCase LegalResourceItem schema
          const normalized = rawRows.map(row => {
            const getVal = (...keys: string[]) => {
              for (const k of keys) {
                if (row[k] !== undefined && row[k] !== '') return String(row[k]).trim();
                const matchedKey = Object.keys(row).find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === k.toLowerCase().replace(/[^a-z0-9]/g, ''));
                if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== '') return String(row[matchedKey]).trim();
              }
              return '';
            };

            const parseBool = (...keys: string[]) => {
              const val = getVal(...keys).toLowerCase();
              return val === 'true' || val === 'yes' || val === '1' || val === 'y';
            };

            const name = getVal('name', 'institutionName', 'courtName', 'institution');
            const type = getVal('type', 'institutionType') || 'Court';
            const jurisdictionLevel = getVal('jurisdictionLevel', 'jurisdiction', 'hierarchy') || 'District';
            const state = getVal('state', 'stateUt');
            const city = getVal('city');
            const district = getVal('district') || city || state;
            const address = getVal('address', 'streetAddress', 'physicalAddress');
            const pincode = getVal('pincode', 'postalCode', 'pin');
            const phone = getVal('phone', 'contactNumber', 'officialPhone');
            const email = getVal('email', 'officialEmail');
            const website = getVal('website', 'portal', 'url');
            const rawLat = getVal('lat', 'latitude');
            const rawLng = getVal('lng', 'longitude', 'lon');
            const lat = rawLat && !isNaN(parseFloat(rawLat)) ? parseFloat(rawLat) : undefined;
            const lng = rawLng && !isNaN(parseFloat(rawLng)) ? parseFloat(rawLng) : undefined;

            const record: any = {
              name,
              type,
              jurisdictionLevel,
              state,
              city,
              district,
              address,
              pincode,
              contactNumber: phone,
              email,
              website,
              lat,
              lng,
              facilities: {
                hasEfiling: parseBool('hasEfiling', 'efiling', 'eSewa'),
                hasLADCS: parseBool('hasLADCS', 'ladcs'),
                hasVCRoom: parseBool('hasVCRoom', 'vcRoom', 'videoConferencing'),
                hasLegalAidClinic: parseBool('hasLegalAidClinic', 'legalAidClinic', 'clinic'),
                isWheelchairAccessible: parseBool('isWheelchairAccessible', 'wheelchair', 'accessible')
              }
            };

            if (lat !== undefined && lng !== undefined) {
              record.coordinates = { lat, lng };
            }

            return record;
          });

          this.parsedRecordCount = normalized.length;
          this.onJsonChange(JSON.stringify(normalized, null, 2));
          this.toast.success(`Successfully parsed ${normalized.length} records from ${file.name}.`);
          this.cdr.markForCheck();
        } catch (err: any) {
          this.fileParseError = 'Failed to parse file: ' + err.message;
          this.cdr.markForCheck();
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      this.fileParseError = 'Unsupported file type. Please upload a .CSV, .XLSX, or .JSON file.';
      this.cdr.markForCheck();
    }
  }

  // --- Prettify / Format JSON ---
  formatJson(): void {
    if (!this.bulkJsonText.trim()) return;
    try {
      const parsed = JSON.parse(this.bulkJsonText);
      this.bulkJsonText = JSON.stringify(parsed, null, 2);
      this.bulkJsonTextChange.emit(this.bulkJsonText);
      this.toast.success('JSON formatted & validated.');
    } catch (e: any) {
      this.toast.error('JSON Syntax Error: ' + e.message);
    }
  }

  clearInput(): void {
    this.bulkJsonText = '';
    this.uploadedFileName = '';
    this.uploadedFileSize = '';
    this.parsedRecordCount = 0;
    this.fileParseError = '';
    this.bulkJsonTextChange.emit('');
  }

  // --- Sample Template Generators ---
  downloadSampleTemplate(format: 'csv' | 'json'): void {
    const sampleData = [
      {
        name: 'District & Sessions Court Tis Hazari',
        type: 'Court',
        jurisdictionLevel: 'District',
        state: 'Delhi',
        district: 'Central Delhi',
        city: 'Delhi',
        pincode: '110054',
        address: 'Tis Hazari Court Complex, Central Delhi, Delhi - 110054',
        phone: '011-23951234',
        email: 'districtcourt.tishazari@delhicourts.nic.in',
        website: 'https://delhidistrictcourts.nic.in',
        lat: 28.6675,
        lng: 77.2185,
        hasEfiling: true,
        hasLADCS: true,
        hasVCRoom: true,
        hasLegalAidClinic: true,
        isWheelchairAccessible: true
      },
      {
        name: 'Guwahati Cyber Crime Police Station',
        type: 'PoliceStation',
        jurisdictionLevel: 'District',
        state: 'Assam',
        district: 'Kamrup Metropolitan (Guwahati)',
        city: 'Guwahati',
        pincode: '781007',
        address: 'CID Headquarters, Ulubari, Guwahati, Assam - 781007',
        phone: '0361-2524315',
        email: 'cyberps-assam@gov.in',
        website: 'https://police.assam.gov.in',
        lat: 26.1685,
        lng: 91.7512,
        hasEfiling: false,
        hasLADCS: false,
        hasVCRoom: true,
        hasLegalAidClinic: false,
        isWheelchairAccessible: true
      },
      {
        name: 'District Legal Services Authority (DLSA) Pune',
        type: 'LegalAid',
        jurisdictionLevel: 'District',
        state: 'Maharashtra',
        district: 'Pune',
        city: 'Pune',
        pincode: '411005',
        address: 'District Court Compound, Shivajinagar, Pune - 411005',
        phone: '020-25534211',
        email: 'dlsa.pune@mah.gov.in',
        website: 'https://legalservices.maharashtra.gov.in',
        lat: 18.5314,
        lng: 73.8553,
        hasEfiling: true,
        hasLADCS: true,
        hasVCRoom: true,
        hasLegalAidClinic: true,
        isWheelchairAccessible: true
      }
    ];

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(sampleData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'legal_institutions_sample_template.json';
      a.click();
      URL.revokeObjectURL(url);
      this.toast.success('Downloaded Sample JSON Template.');
    } else {
      const worksheet = XLSX.utils.json_to_sheet(sampleData);
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'legal_institutions_sample_template.csv';
      a.click();
      URL.revokeObjectURL(url);
      this.toast.success('Downloaded Sample CSV Template.');
    }
  }

  // --- Export Error Report CSV ---
  downloadErrorReport(): void {
    if (!this.validationReport || !this.validationReport.items) return;
    const errorItems = this.validationReport.items.filter(i => i.status === 'INVALID' || i.status === 'WARNING');
    if (!errorItems.length) {
      this.toast.info('No errors or warnings to export.');
      return;
    }

    const exportRows = errorItems.map(item => ({
      RowNumber: item.index,
      Status: item.status,
      ExcludedFromCommit: item.excluded ? 'YES' : 'NO',
      InstitutionName: item.name || '',
      Type: item.type || '',
      JurisdictionLevel: item.jurisdictionLevel || '',
      State: item.state || '',
      District: item.district || '',
      City: item.city || '',
      Address: item.address || '',
      ContactNumber: item.contactNumber || '',
      Email: item.email || '',
      Errors: (item.errors || []).join('; '),
      Warnings: (item.warnings || []).join('; '),
      Notes: (item.validationNotes || []).join('; ')
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation_error_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success(`Exported ${errorItems.length} issue records to CSV.`);
  }

  // --- Reactive Memoized Validation & Filtering Engine ---
  recalculateValidationStatsAndFilter(): void {
    if (!this.validationReport?.items) {
      this.cleanCount = 0;
      this.warningCount = 0;
      this.errorCount = 0;
      this.importableCount = 0;
      this.filteredValidationItems = [];
      this.paginatedValidationItems = [];
      this.totalPages = 1;
      this.currentPage = 1;
      return;
    }

    const items = this.validationReport.items;
    let clean = 0;
    let warn = 0;
    let err = 0;
    let importable = 0;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.status === 'VALID') clean++;
      else if (it.status === 'WARNING') warn++;
      else if (it.status === 'INVALID') err++;

      if (it.status !== 'INVALID' && !it.excluded) {
        importable++;
      }
    }

    this.cleanCount = clean;
    this.warningCount = warn;
    this.errorCount = err;
    this.importableCount = importable;

    // Filter computation
    const filter = this.validationFilter;
    const query = this.validationSearch.toLowerCase().trim();

    this.filteredValidationItems = items.filter(item => {
      if (filter !== 'ALL' && item.status !== filter) {
        return false;
      }
      if (query) {
        const matchesName = item.name?.toLowerCase().includes(query);
        const matchesCity = item.city?.toLowerCase().includes(query);
        const matchesDistrict = item.district?.toLowerCase().includes(query);
        const matchesState = item.state?.toLowerCase().includes(query);
        const matchesType = item.type?.toLowerCase().includes(query);
        if (!matchesName && !matchesCity && !matchesDistrict && !matchesState && !matchesType) {
          return false;
        }
      }
      return true;
    });

    this.totalPages = Math.max(1, Math.ceil(this.filteredValidationItems.length / this.pageSize));
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }

    this.updatePaginatedItems();
    this.cdr.markForCheck();
  }

  // --- Pagination Handlers ---
  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedItems();
      this.cdr.markForCheck();
    }
  }

  setPageSize(size: number): void {
    this.pageSize = size;
    this.totalPages = Math.max(1, Math.ceil(this.filteredValidationItems.length / this.pageSize));
    this.currentPage = 1;
    this.updatePaginatedItems();
    this.cdr.markForCheck();
  }

  private updatePaginatedItems(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedValidationItems = this.filteredValidationItems.slice(startIndex, startIndex + this.pageSize);
  }

  // --- Row Level Exclusion Controls ---
  toggleItemExclusion(item: ValidationItem): void {
    item.excluded = !item.excluded;
    this.recalculateImportableCount();
    this.cdr.markForCheck();
  }

  selectAllValid(): void {
    if (!this.validationReport?.items) return;
    this.validationReport.items.forEach(i => {
      if (i.status !== 'INVALID') i.excluded = false;
    });
    this.recalculateImportableCount();
    this.cdr.markForCheck();
  }

  deselectAllValid(): void {
    if (!this.validationReport?.items) return;
    this.validationReport.items.forEach(i => {
      if (i.status !== 'INVALID') i.excluded = true;
    });
    this.recalculateImportableCount();
    this.cdr.markForCheck();
  }

  get areAllValidSelected(): boolean {
    if (!this.validationReport?.items) return false;
    const validItems = this.validationReport.items.filter(i => i.status !== 'INVALID');
    if (!validItems.length) return false;
    return validItems.every(i => !i.excluded);
  }

  private recalculateImportableCount(): void {
    if (!this.validationReport?.items) {
      this.importableCount = 0;
      return;
    }
    this.importableCount = this.validationReport.items.filter(i => i.status !== 'INVALID' && !i.excluded).length;
  }

  // --- Filter & Search Triggers ---
  setValidationFilter(filter: 'ALL' | 'VALID' | 'WARNING' | 'INVALID'): void {
    this.validationFilter = filter;
    this.currentPage = 1;
    this.recalculateValidationStatsAndFilter();
  }

  onValidationSearchChange(search: string): void {
    this.validationSearch = search;
    this.currentPage = 1;
    this.recalculateValidationStatsAndFilter();
  }

  // --- Pipeline Controls ---
  resetWizard(): void {
    this.clearInput();
    this.validationReport = null;
    this.importResult = null;
    this.cleanCount = 0;
    this.warningCount = 0;
    this.errorCount = 0;
    this.importableCount = 0;
    this.filteredValidationItems = [];
    this.paginatedValidationItems = [];
    this.setStep('input');
  }

  onJsonChange(val: string): void {
    this.bulkJsonText = val;
    this.bulkJsonTextChange.emit(val);
  }

  setStep(s: 'input' | 'validate' | 'success'): void {
    this.step = s;
    this.stepChange.emit(s);
  }

  close(): void {
    this.closed.emit();
  }

  onRunDryRun(): void {
    this.runDryRun.emit();
  }

  onExecuteImport(): void {
    if (!this.validationReport?.items) return;
    const importableItems = this.validationReport.items.filter(i => i.status !== 'INVALID' && !i.excluded);
    if (!importableItems.length) {
      this.toast.warning('No active valid records selected for import.');
      return;
    }

    this.executeImport.emit({
      items: importableItems,
      duplicateStrategy: this.duplicateStrategy
    });
  }
}