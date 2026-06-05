import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnDestroy, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stat-card.component.html',
  styleUrls: ['./stat-card.component.scss']
})
export class StatCardComponent implements OnInit, OnChanges, OnDestroy {
  @Input() count = 0;
  @Input() label = '';
  @Input() type: 'saved' | 'collections' | 'acts' | 'inquiries' | string = 'saved';
  @Input() titleAttr = '';
  @Input() ariaLabelAttr = '';

  @Output() cardClick = new EventEmitter<void>();

  displayCount = 0;
  displayValue = '0';
  private animationFrameId: number | null = null;

  ngOnInit() {
    this.animateCount(this.count);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['count'] && !changes['count'].firstChange) {
      this.animateCount(changes['count'].currentValue);
    }
  }

  @HostListener('window:focus')
  onWindowFocus() {
    this.animateCount(this.count);
  }

  ngOnDestroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private animateCount(targetValue: number, durationMs = 1300) {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const startValue = 0; // Always animate count-up from 0
    const startTime = performance.now();
    const isDecimal = targetValue % 1 !== 0;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      
      // Cubic ease-out formula for a smoother final deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentVal = startValue + (targetValue - startValue) * eased;
      this.displayCount = currentVal;
      this.displayValue = isDecimal ? currentVal.toFixed(1) : Math.round(currentVal).toString();

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.displayCount = targetValue;
        this.displayValue = isDecimal ? targetValue.toFixed(1) : targetValue.toString();
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  onClick() {
    this.cardClick.emit();
  }
}
