import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserProfileService } from '../../../../services/user-profile.service';
import { DataExportService } from '../../../../services/data-export.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-danger-zone-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './danger-zone-tab.component.html'
})
export class DangerZoneTabComponent implements OnDestroy {
  showDeleteConfirmPopup = false;
  confirmText = '';
  deleting = false;

  showExportPopup = false;
  exportFormat = 'json';
  exporting = false;

  constructor(
    private userProfileService: UserProfileService,
    private dataExportService: DataExportService,
    private snackbar: SnackbarService,
    private router: Router
  ) { }

  ngOnDestroy() {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden');
    }
  }

  updateScroll() {
    if (typeof document !== 'undefined') {
      if (this.showDeleteConfirmPopup || this.showExportPopup) {
        document.body.classList.add('overflow-hidden');
      } else {
        document.body.classList.remove('overflow-hidden');
      }
    }
  }

  openDeletePopup() {
    this.showDeleteConfirmPopup = true;
    this.updateScroll();
  }

  closeDeletePopup() {
    this.showDeleteConfirmPopup = false;
    this.confirmText = '';
    this.updateScroll();
  }

  openExportPopup() {
    this.showExportPopup = true;
    this.updateScroll();
  }

  closeExportPopup() {
    if (this.exporting) return;
    this.showExportPopup = false;
    this.updateScroll();
  }

  get canDelete(): boolean {
    return this.confirmText === 'DELETE';
  }

  deleteAccount() {
    if (!this.canDelete) return;
    this.deleting = true;
    this.userProfileService.deleteAccount().subscribe({
      next: () => {
        this.snackbar.show('Account permanently deleted.', 'success');
        this.showDeleteConfirmPopup = false;
        this.confirmText = '';
        this.updateScroll();
        this.router.navigate(['/']);
      },
      error: (err: any) => {
        this.deleting = false;
        this.snackbar.show(err.error || 'Failed to delete account.', 'error');
      }
    });
  }

  triggerDownload() {
    this.exporting = true;
    this.snackbar.show('Fetching your data from the server...', 'info');

    this.userProfileService.downloadDataDossier().subscribe({
      next: async (blob: Blob) => {
        try {
          const rawText = await blob.text();
          const data = JSON.parse(rawText);

          const result = this.dataExportService.processExport(
            data,
            this.exportFormat,
            () => this.snackbar.show('Popups are blocked! Please enable popups to download PDF.', 'warning')
          );

          if (result.status !== 'error') {
            this.snackbar.show(result.message, 'success');
          } else {
            this.snackbar.show(result.message, 'warning');
          }
        } catch (e) {
          const dateFileStr = new Date().toISOString().slice(0, 10);
          this.dataExportService.downloadBlob(
            await blob.text(),
            'application/json;charset=utf-8',
            `LegalConnect-DataExport-${dateFileStr}.json`
          );
          this.snackbar.show('Data exported successfully!', 'success');
        } finally {
          this.showExportPopup = false;
          this.updateScroll();
          this.exporting = false;
        }
      },
      error: () => {
        this.exporting = false;
        this.snackbar.show('Failed to retrieve data from server.', 'error');
      }
    });
  }
}