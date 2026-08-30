import { Component, ChangeDetectionStrategy, HostListener, OnDestroy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrintExportService, ExportFormat, ExportExecutionParams } from '../../services/print-export.service';
import { IconComponent } from '../icon/icon.component';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { CustomSelectComponent } from '../custom-select/custom-select.component';
import { SelectOption } from '../custom-select/custom-select.types';

@Component({
  selector: 'app-print-export-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, TooltipDirective, CustomSelectComponent],
  templateUrl: './print-export-modal.component.html',
  styleUrls: ['./print-export-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrintExportModalComponent implements OnDestroy {
  exportService = inject(PrintExportService);

  // Form State Signals
  selectedFormat = signal<ExportFormat>('pdf');
  selectedScope = signal<string>('current');
  selectedWatermark = signal<string>('NONE');
  includeQr = signal<boolean>(true);
  includeCharts = signal<boolean>(true);
  tableDensity = signal<'standard' | 'compact'>('standard');

  readonly WATERMARK_OPTIONS: SelectOption[] = [
    { value: 'NONE', label: 'None (Clean)', sublabel: 'No watermark stamp', icon: 'check' },
    { value: 'OFFICIAL COPY', label: 'Official Copy', sublabel: 'Institutional record', icon: 'shield' },
    { value: 'CONFIDENTIAL', label: 'Confidential', sublabel: 'Restricted distribution', icon: 'lock' },
    { value: 'DRAFT', label: 'Draft Instrument', sublabel: 'Non-final review copy', icon: 'edit' },
    { value: 'ATTORNEY-CLIENT PRIVILEGED', label: 'Privileged', sublabel: 'Protected legal work product', icon: 'scale' },
  ];

  constructor() {
    // Body scroll lock effect
    effect(() => {
      const isOpen = this.exportService.isOpen();
      if (typeof document !== 'undefined') {
        if (isOpen) {
          document.body.classList.add('overflow-hidden');
        } else {
          document.body.classList.remove('overflow-hidden');
        }
      }
    });

    // Reset/hydrate defaults whenever a new config is opened
    effect(() => {
      const cfg = this.exportService.config();
      if (cfg) {
        if (cfg.formats && cfg.formats.length > 0) {
          this.selectedFormat.set(cfg.formats[0]);
        } else {
          this.selectedFormat.set('pdf');
        }

        if (cfg.scopes && cfg.scopes.length > 0) {
          this.selectedScope.set(cfg.defaultScope || cfg.scopes[0].id);
        } else {
          this.selectedScope.set('current');
        }

        this.selectedWatermark.set(cfg.defaultWatermark || 'NONE');
        this.includeQr.set(cfg.defaultIncludeQr !== undefined ? cfg.defaultIncludeQr : true);
        this.includeCharts.set(cfg.defaultIncludeCharts !== undefined ? cfg.defaultIncludeCharts : true);
      }
    }, { allowSignalWrites: true });
  }

  ngOnDestroy() {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden');
    }
  }

  isFormatAvailable(fmt: ExportFormat): boolean {
    const formats = this.exportService.config()?.formats;
    if (!formats || formats.length === 0) return true;
    return formats.includes(fmt);
  }

  setFormat(fmt: ExportFormat): void {
    this.selectedFormat.set(fmt);
  }

  setScope(scopeId: string): void {
    this.selectedScope.set(scopeId);
  }

  get activeScopeDetails() {
    const scopes = this.exportService.config()?.scopes || [];
    return scopes.find(s => s.id === this.selectedScope());
  }

  onClose(): void {
    this.exportService.close();
  }

  async onConfirmExport(): Promise<void> {
    const params: ExportExecutionParams = {
      format: this.selectedFormat(),
      scope: this.selectedScope(),
      watermark: this.selectedWatermark(),
      includeQr: this.includeQr(),
      includeCharts: this.includeCharts(),
      tableDensity: this.tableDensity()
    };
    await this.exportService.executeExport(params);
  }

  @HostListener('window:keydown.escape')
  handleEscape(): void {
    if (this.exportService.isOpen()) {
      this.onClose();
    }
  }
}