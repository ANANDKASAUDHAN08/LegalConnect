import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostListener,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { isValidEvidenceUrl } from '../../../../core/services/admin-moderation.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { AdminIconComponent } from '../../../../shared/components/icon/icon.component';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';

@Component({
  selector: 'moderation-evidence-lightbox',
  standalone: true,
  imports: [CommonModule, AdminIconComponent, TooltipDirective],
  templateUrl: './moderation-evidence-lightbox.component.html',
  styleUrls: ['./moderation-evidence-lightbox.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModerationEvidenceLightboxComponent {
  private cdr = inject(ChangeDetectorRef);
  private toast = inject(ToastService);

  @Input() set isOpen(val: boolean) {
    this._isOpen = val;
    if (val) {
      this.zoom = 1;
      this.rotation = 0;
    }
  }
  get isOpen(): boolean {
    return this._isOpen;
  }
  private _isOpen = false;

  @Input() imageUrl: string | null = null;
  @Output() closed = new EventEmitter<void>();

  zoom = 1;
  rotation = 0;

  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    if (!this.isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }
  }

  zoomIn(): void {
    if (this.zoom < 3) {
      this.zoom = Math.min(3, +(this.zoom + 0.25).toFixed(2));
      this.cdr.markForCheck();
    }
  }

  zoomOut(): void {
    if (this.zoom > 0.5) {
      this.zoom = Math.max(0.5, +(this.zoom - 0.25).toFixed(2));
      this.cdr.markForCheck();
    }
  }

  rotate(): void {
    this.rotation = (this.rotation + 90) % 360;
    this.cdr.markForCheck();
  }

  copyEvidenceUrl(): void {
    if (this.imageUrl) {
      navigator.clipboard.writeText(this.imageUrl);
      this.toast.success('Evidence proof URL copied to clipboard');
    }
  }

  isValidUrl(url: string | null): boolean {
    return isValidEvidenceUrl(url || undefined);
  }

  close(): void {
    this.closed.emit();
  }
}