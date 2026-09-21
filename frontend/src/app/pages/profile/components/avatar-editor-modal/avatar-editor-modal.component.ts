import {
  Component, Input, Output, EventEmitter, inject,
  signal, ChangeDetectionStrategy, ChangeDetectorRef,
  OnChanges, SimpleChanges, OnInit, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { IconComponent } from '../../../../components/icon/icon.component';

@Component({
  selector: 'app-avatar-editor-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TooltipDirective, IconComponent],
  templateUrl: './avatar-editor-modal.component.html'
})
export class AvatarEditorModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() currentAvatarUrl?: string;
  @Input() isSaving = false;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<string>();
  @Output() remove = new EventEmitter<void>();

  private cdr = inject(ChangeDetectorRef);

  // Responsive aperture diameter: 240px on mobile (<640px), 280px on desktop (>=640px)
  apertureDiameter = 280;

  // Reactive state signals for instant UI transitions under OnPush
  step = signal<'menu' | 'crop' | 'preview'>('menu');
  isFlipped = signal<boolean>(false);

  rawImage: string | null = null;
  baseScale = 1;
  zoomScale = 1;
  rotation = 0;
  dragX = 0;
  dragY = 0;

  imageNaturalWidth = 0;
  imageNaturalHeight = 0;

  // Mouse drag tracking
  isDragging = false;
  private startX = 0;
  private startY = 0;

  // Touch pinch-to-zoom tracking
  private isPinching = false;
  private initialPinchDist = 0;
  private initialPinchZoom = 1;

  // Window listeners for ultra-smooth drag tracking across boundaries & responsive resize
  private onWindowMouseMove = (e: MouseEvent) => this.handleWindowMouseMove(e);
  private onWindowMouseUp = () => this.handleWindowMouseUp();
  private onWindowResize = () => {
    if (this.step() === 'crop') {
      this.updateApertureDiameter();
      this.computeBaseScale();
      this.clampOffsets();
      this.cdr.markForCheck();
    }
  };

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onWindowResize);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.resetAllState();
      this.step.set('menu');
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.removeWindowListeners();
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onWindowResize);
    }
  }

  private updateApertureDiameter(): void {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      this.apertureDiameter = 240;
    } else {
      this.apertureDiameter = 280;
    }
  }

  private resetAllState(): void {
    this.rawImage = null;
    this.zoomScale = 1;
    this.rotation = 0;
    this.isFlipped.set(false);
    this.dragX = 0;
    this.dragY = 0;
    this.baseScale = 1;
    this.imageNaturalWidth = 0;
    this.imageNaturalHeight = 0;
    this.isDragging = false;
    this.isPinching = false;
    this.removeWindowListeners();
  }

  modifyExistingPhoto(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!this.currentAvatarUrl) return;
    this.resetAllState();
    this.rawImage = this.currentAvatarUrl;
    this.updateApertureDiameter();
    this.step.set('crop');
    this.cdr.markForCheck();
  }

  previewExistingPhoto(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!this.currentAvatarUrl) return;
    this.step.set('preview');
    this.cdr.markForCheck();
  }

  backToMenu(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.step.set('menu');
    this.cdr.markForCheck();
  }

  triggerFileInput(): void {
    const fileInput = document.getElementById('avatar-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      this.resetAllState();
      this.rawImage = reader.result as string;
      this.updateApertureDiameter();
      this.step.set('crop');
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  onImageLoaded(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && img.naturalWidth && img.naturalHeight) {
      this.imageNaturalWidth = img.naturalWidth;
      this.imageNaturalHeight = img.naturalHeight;
      this.updateApertureDiameter();
      this.computeBaseScale();
      this.clampOffsets();
      this.cdr.markForCheck();
    }
  }

  private computeBaseScale(): void {
    if (!this.imageNaturalWidth || !this.imageNaturalHeight) return;
    const isRotated90 = this.rotation === 90 || this.rotation === 270;
    const w = isRotated90 ? this.imageNaturalHeight : this.imageNaturalWidth;
    const h = isRotated90 ? this.imageNaturalWidth : this.imageNaturalHeight;
    const scaleX = this.apertureDiameter / w;
    const scaleY = this.apertureDiameter / h;
    this.baseScale = Math.max(scaleX, scaleY);
  }

  private clampOffsets(): void {
    if (!this.imageNaturalWidth || !this.imageNaturalHeight) return;
    const isRotated90 = this.rotation === 90 || this.rotation === 270;
    const w = isRotated90 ? this.imageNaturalHeight : this.imageNaturalWidth;
    const h = isRotated90 ? this.imageNaturalWidth : this.imageNaturalHeight;
    const effectiveWidth = w * this.baseScale * this.zoomScale;
    const effectiveHeight = h * this.baseScale * this.zoomScale;
    const maxDragX = Math.max(0, (effectiveWidth - this.apertureDiameter) / 2);
    const maxDragY = Math.max(0, (effectiveHeight - this.apertureDiameter) / 2);

    this.dragX = Math.min(maxDragX, Math.max(-maxDragX, this.dragX));
    this.dragY = Math.min(maxDragY, Math.max(-maxDragY, this.dragY));
  }

  // --- MOUSE DRAG ENGINE ---
  onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return; // Only primary click
    this.isDragging = true;
    this.startX = event.clientX - this.dragX;
    this.startY = event.clientY - this.dragY;
    window.addEventListener('mousemove', this.onWindowMouseMove);
    window.addEventListener('mouseup', this.onWindowMouseUp);
    event.preventDefault();
  }

  private handleWindowMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;
    this.dragX = event.clientX - this.startX;
    this.dragY = event.clientY - this.startY;
    this.clampOffsets();
    this.cdr.markForCheck();
  }

  private handleWindowMouseUp(): void {
    this.isDragging = false;
    this.removeWindowListeners();
    this.cdr.markForCheck();
  }

  private removeWindowListeners(): void {
    window.removeEventListener('mousemove', this.onWindowMouseMove);
    window.removeEventListener('mouseup', this.onWindowMouseUp);
  }

  // --- MOUSE WHEEL ZOOM ---
  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.12 : -0.12;
    this.setZoom(this.zoomScale + delta);
  }

  // --- TOUCH GESTURE ENGINE (1-Finger Pan & 2-Finger Pinch Zoom) ---
  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.isDragging = true;
      this.isPinching = false;
      this.startX = event.touches[0].clientX - this.dragX;
      this.startY = event.touches[0].clientY - this.dragY;
    } else if (event.touches.length >= 2) {
      this.isDragging = false;
      this.isPinching = true;
      this.initialPinchDist = this.getTouchDistance(event.touches);
      this.initialPinchZoom = this.zoomScale;
    }
  }

  onTouchMove(event: TouchEvent): void {
    event.preventDefault(); // Prevent page scroll on touch devices

    if (this.isPinching && event.touches.length >= 2) {
      const currentDist = this.getTouchDistance(event.touches);
      if (this.initialPinchDist > 0) {
        const factor = currentDist / this.initialPinchDist;
        this.setZoom(this.initialPinchZoom * factor);
      }
    } else if (this.isDragging && event.touches.length === 1) {
      this.dragX = event.touches[0].clientX - this.startX;
      this.dragY = event.touches[0].clientY - this.startY;
      this.clampOffsets();
      this.cdr.markForCheck();
    }
  }

  onTouchEnd(event: TouchEvent): void {
    if (event.touches.length === 0) {
      this.isDragging = false;
      this.isPinching = false;
    } else if (event.touches.length === 1) {
      this.isPinching = false;
      this.isDragging = true;
      this.startX = event.touches[0].clientX - this.dragX;
      this.startY = event.touches[0].clientY - this.dragY;
    }
    this.cdr.markForCheck();
  }

  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  // --- ZOOM CONTROLS ---
  setZoom(zoom: number): void {
    this.zoomScale = Math.min(4.0, Math.max(1.0, Math.round(zoom * 100) / 100));
    this.clampOffsets();
    this.cdr.markForCheck();
  }

  zoomIn(): void {
    this.setZoom(this.zoomScale + 0.25);
  }

  zoomOut(): void {
    this.setZoom(this.zoomScale - 0.25);
  }

  onZoomInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setZoom(parseFloat(input.value));
  }

  // --- TRANSFORM CONTROLS ---
  rotateImage(): void {
    this.rotation = (this.rotation + 90) % 360;
    this.computeBaseScale();
    this.clampOffsets();
    this.cdr.markForCheck();
  }

  toggleFlip(): void {
    this.isFlipped.update(f => !f);
    this.cdr.markForCheck();
  }

  resetFrame(): void {
    this.zoomScale = 1;
    this.rotation = 0;
    this.isFlipped.set(false);
    this.dragX = 0;
    this.dragY = 0;
    this.computeBaseScale();
    this.cdr.markForCheck();
  }

  // --- CSS TRANSFORM STRING GENERATORS ---
  getMainTransform(): string {
    const flip = this.isFlipped() ? -1 : 1;
    const s = this.baseScale * this.zoomScale;
    return `translate(${this.dragX}px, ${this.dragY}px) rotate(${this.rotation}deg) scaleX(${flip}) scale(${s})`;
  }

  getPreviewTransform(chipSize: number): string {
    const r = chipSize / this.apertureDiameter;
    const flip = this.isFlipped() ? -1 : 1;
    const s = this.baseScale * this.zoomScale * r;
    return `translate(${this.dragX * r}px, ${this.dragY * r}px) rotate(${this.rotation}deg) scaleX(${flip}) scale(${s})`;
  }

  // --- RETINA 512x512 HIGH-DPI CANVAS EXPORT ---
  executeCrop(): void {
    if (!this.rawImage) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const exportSize = 512;
      const canvas = document.createElement('canvas');
      canvas.width = exportSize;
      canvas.height = exportSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Solid neutral background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, exportSize, exportSize);

      const exportScale = exportSize / this.apertureDiameter;

      ctx.save();
      // Move to canvas center + scaled user drag offset
      ctx.translate(exportSize / 2 + this.dragX * exportScale, exportSize / 2 + this.dragY * exportScale);

      // Rotate
      ctx.rotate((this.rotation * Math.PI) / 180);

      // Horizontal flip
      if (this.isFlipped()) {
        ctx.scale(-1, 1);
      }

      // Scale
      const totalScale = this.baseScale * this.zoomScale * exportScale;
      ctx.scale(totalScale, totalScale);

      // Draw image centered at origin
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.restore();

      try {
        const croppedBase64 = canvas.toDataURL('image/jpeg', 0.90);
        this.save.emit(croppedBase64);
      } catch (err) {
        console.error('Failed to export canvas:', err);
        if (this.rawImage && this.rawImage.startsWith('data:')) {
          this.save.emit(this.rawImage);
        }
      }
    };
    img.src = this.rawImage;
  }

  onRemove(): void {
    this.remove.emit();
  }

  onCancel(): void {
    if (this.isSaving) return;
    this.resetAllState();
    this.step.set('menu');
    this.cdr.markForCheck();
    this.close.emit();
  }
}