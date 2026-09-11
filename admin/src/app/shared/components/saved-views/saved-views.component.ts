import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { ToastService } from '../../services/toast.service';
import { AdminApiService } from '../../../core/admin-api.service';
import { AdminIconComponent } from '../icon/icon.component';
import { ApiResponse } from '../../../core/models/admin.models';

export interface SavedViewPreset {
  id: string;
  name: string;
  params: Record<string, any>;
  isDefault?: boolean;
}

@Component({
  selector: 'admin-saved-views',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective, AdminIconComponent],
  templateUrl: './saved-views.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminSavedViewsComponent implements OnInit {
  private readonly MAX_PRESETS = 20;
  @Input() storageKey = 'users';

  private _currentParams: Record<string, any> = {};
  @Input()
  set currentParams(params: Record<string, any>) {
    this._currentParams = params || {};
    this.syncActivePresetWithParams();
  }
  get currentParams(): Record<string, any> {
    return this._currentParams;
  }

  @Output() viewApply = new EventEmitter<Record<string, any>>();

  isOpen = false;
  isNamingView = false;
  newPresetName = '';
  activePresetId: string | null = null;
  activePresetName: string | null = null;
  presets: SavedViewPreset[] = [];

  constructor(
    private elementRef: ElementRef,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private api: AdminApiService
  ) { }

  ngOnInit(): void {
    this.loadSavedPresets();
    this.syncActivePresetWithParams();
  }

  toggleMenu(): void {
    this.isOpen = !this.isOpen;
    if (!this.isOpen) this.isNamingView = false;
    this.cdr.markForCheck();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen && !this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
      this.isNamingView = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.isNamingView = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.isNamingView = false;
      this.cdr.markForCheck();
    }
  }

  private loadSavedPresets(): void {
    const raw = localStorage.getItem(`legalconnect_views_${this.storageKey}`);
    const defaultPreset: SavedViewPreset = {
      id: 'default',
      name: 'Default View (All)',
      params: {},
      isDefault: true
    };

    let localList: SavedViewPreset[] = [];
    if (raw) {
      try { localList = JSON.parse(raw); } catch { localList = []; }
    }
    this.presets = [defaultPreset, ...localList];
    this.syncActivePresetWithParams();

    // Background Async Cloud Revalidation & DB Sync
    this.api.getSavedViews(this.storageKey).subscribe({
      next: (res: ApiResponse<any[]> | any) => {
        const dbViews = res?.data || res || [];
        if (Array.isArray(dbViews) && dbViews.length > 0) {
          const remotePresets: SavedViewPreset[] = dbViews.map((v: any) => ({
            id: String(v.id || v._id),
            name: v.name,
            params: typeof v.paramsJson === 'string' ? JSON.parse(v.paramsJson) : (v.params || {}),
            isDefault: false
          }));
          const merged = [...localList];
          for (const rp of remotePresets) {
            if (!merged.some(m => m.name === rp.name)) merged.push(rp);
          }
          this.presets = [defaultPreset, ...merged];
          localStorage.setItem(`legalconnect_views_${this.storageKey}`, JSON.stringify(merged));
          this.syncActivePresetWithParams();
          this.cdr.markForCheck();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.toast.warning('Saved views cloud sync failed. Using local views only.');
        console.warn('[SavedViews] Cloud revalidation failed:', err?.status, err?.message);
      }
    });
  }

  private syncActivePresetWithParams(): void {
    if (!this.presets || this.presets.length === 0) return;
    const currentKeys = Object.keys(this._currentParams).filter(k => this._currentParams[k] !== '' && this._currentParams[k] !== undefined && this._currentParams[k] !== null);
    if (currentKeys.length === 0) {
      this.activePresetId = null;
      this.activePresetName = null;
      return;
    }
    const matched = this.presets.find(p => {
      if (p.isDefault) return false;
      const pKeys = Object.keys(p.params).filter(k => p.params[k] !== '' && p.params[k] !== undefined && p.params[k] !== null);
      if (pKeys.length !== currentKeys.length) return false;
      return pKeys.every(k => String(p.params[k]) === String(this._currentParams[k]));
    });
    this.activePresetId = matched ? matched.id : null;
    this.activePresetName = matched ? matched.name : null;
  }

  applyPreset(preset: SavedViewPreset, event?: Event): void {
    if (event) event.stopPropagation();
    this.activePresetId = preset.id === 'default' ? null : preset.id;
    this.activePresetName = preset.id === 'default' ? null : preset.name;
    this.isOpen = false;
    this.isNamingView = false;
    this.viewApply.emit(preset.params);
    this.toast.info(`Applied saved view "${preset.name}".`);
    this.cdr.markForCheck();
  }

  startNamingView(event?: Event): void {
    if (event) event.stopPropagation();
    this.isNamingView = true;
    this.newPresetName = '';
    this.cdr.markForCheck();
  }

  cancelSaveView(event?: Event): void {
    if (event) event.stopPropagation();
    this.isNamingView = false;
    this.newPresetName = '';
    this.cdr.markForCheck();
  }

  saveCurrentView(event?: Event): void {
    if (event) event.stopPropagation();
    if (!this.newPresetName || !this.newPresetName.trim()) {
      this.toast.warning('Please enter a descriptive name for this view.');
      return;
    }
    const userPresetCount = this.presets.filter(p => !p.isDefault).length;
    if (userPresetCount >= this.MAX_PRESETS) {
      this.toast.warning(`Maximum of ${this.MAX_PRESETS} saved views reached. Please delete an existing view first.`);
      return;
    }
    const name = this.newPresetName.trim();
    const params = { ...this.currentParams };
    const newPreset: SavedViewPreset = {
      id: 'preset_' + Date.now(),
      name,
      params
    };

    const userPresets = this.presets.filter(p => !p.isDefault);
    userPresets.push(newPreset);
    localStorage.setItem(`legalconnect_views_${this.storageKey}`, JSON.stringify(userPresets));

    this.presets = [{ id: 'default', name: 'Default View (All)', params: {}, isDefault: true }, ...userPresets];
    this.activePresetId = newPreset.id;
    this.activePresetName = newPreset.name;
    this.isNamingView = false;
    this.isOpen = false;
    this.toast.success(`Saved view "${name}" to bookmarks!`);
    this.cdr.markForCheck();

    // Async DB Cloud Persistence
    this.api.saveSavedView({
      pageKey: this.storageKey,
      name,
      paramsJson: JSON.stringify(params)
    }).subscribe({
      next: (res: ApiResponse<any> | any) => {
        if (res?.data?.id) {
          newPreset.id = String(res.data.id);
          this.cdr.markForCheck();
        }
      },
      error: (_err: HttpErrorResponse) => {
        this.toast.info('View saved locally (cloud sync offline).');
      }
    });
  }

  deletePreset(id: string, event: Event): void {
    event.stopPropagation();
    const userPresets = this.presets.filter(p => !p.isDefault && p.id !== id);
    localStorage.setItem(`legalconnect_views_${this.storageKey}`, JSON.stringify(userPresets));
    this.presets = [{ id: 'default', name: 'Default View (All)', params: {}, isDefault: true }, ...userPresets];
    if (this.activePresetId === id) {
      this.activePresetId = null;
      this.activePresetName = null;
    }
    this.toast.info('Saved view deleted.');
    this.cdr.markForCheck();

    if (id && !id.startsWith('preset_')) {
      this.api.deleteSavedView(id).subscribe({
        error: (_err: HttpErrorResponse) => {
          this.toast.info('View removed locally (cloud sync offline).');
        }
      });
    }
  }
}