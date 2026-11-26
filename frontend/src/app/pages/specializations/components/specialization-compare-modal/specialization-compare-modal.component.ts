import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PracticeArea } from '../../../../services/practice-areas.service';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { IconComponent } from '../../../../components/icon/icon.component';

@Component({
  selector: 'app-specialization-compare-modal',
  standalone: true,
  imports: [CommonModule, TooltipDirective, IconComponent],
  templateUrl: './specialization-compare-modal.component.html',
  styleUrls: ['./specialization-compare-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpecializationCompareModalComponent {
  @Input({ required: true }) pinnedSpecs: PracticeArea[] = [];
  @Input({ required: true }) isCompareOpen = false;
  @Input() isHindi = false;

  @Output() openCompare = new EventEmitter<void>();
  @Output() closeCompare = new EventEmitter<void>();
  @Output() unpin = new EventEmitter<PracticeArea>();
  @Output() clearCompare = new EventEmitter<void>();
  @Output() findAdvocatesClick = new EventEmitter<PracticeArea>();
  @Output() printClick = new EventEmitter<PracticeArea>();

  activeSlideIndex = 0;

  onScrollDeck(event: Event) {
    const el = event.target as HTMLElement;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const cardWidth = el.offsetWidth * 0.84;
    if (cardWidth > 0) {
      this.activeSlideIndex = Math.min(
        this.pinnedSpecs.length - 1,
        Math.max(0, Math.round(scrollLeft / cardWidth))
      );
    }
  }

  scrollToSlide(index: number, container: HTMLElement) {
    this.activeSlideIndex = index;
    const cardWidth = container.offsetWidth * 0.84;
    container.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
  }

  onOpenCompare() {
    this.activeSlideIndex = 0;
    this.openCompare.emit();
  }

  onCloseCompare() {
    this.closeCompare.emit();
  }

  onUnpin(spec: PracticeArea, event?: Event) {
    if (event) event.stopPropagation();
    this.unpin.emit(spec);
  }

  onClearAll() {
    this.clearCompare.emit();
  }

  onFindAdvocates(spec: PracticeArea) {
    this.findAdvocatesClick.emit(spec);
    this.onCloseCompare();
  }

  onPrint(spec: PracticeArea, event?: Event) {
    if (event) event.stopPropagation();
    this.printClick.emit(spec);
  }

  trackBySpecId(_index: number, spec: PracticeArea): string {
    return spec.id;
  }

  trackByString(_index: number, item: string): string {
    return item;
  }
}