import {
  Component, Input, ChangeDetectionStrategy, inject, computed,
  OnInit, OnDestroy, ElementRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { InteractionService, InteractionState } from '../../services/interaction.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { IconComponent } from '../icon/icon.component';

/**
 * <app-interactive-like> — Universal Like/Vote Button
 *
 * Zero-configuration: injects InteractionService and auto-hydrates state.
 * Supports multiple visual variants and sizes for different contexts.
 *
 * Usage:
 *   <app-interactive-like targetType="Review" [targetId]="review.id.toString()" />
 *   <app-interactive-like targetType="LegalResource" [targetId]="resource._id" variant="thumbs" size="md" />
 */
@Component({
  selector: 'app-interactive-like',
  standalone: true,
  imports: [CommonModule, TooltipDirective, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './interactive-like.component.html',
  styleUrls: ['./interactive-like.component.scss']
})
export class InteractiveLikeComponent implements OnInit, OnDestroy {
  @Input({ required: true }) targetType!: string;
  @Input({ required: true }) targetId!: string;
  @Input() variant: 'icon-only' | 'pill' | 'counter-badge' | 'thumbs' = 'pill';
  @Input() size: 'sm' | 'md' | 'lg' = 'sm';

  private interactionService = inject(InteractionService);
  private observer: IntersectionObserver | null = null;
  private elementRef = inject(ElementRef);

  // Computed state from service signals
  state = computed(() => {
    return this.interactionService.getState(this.targetType, this.targetId);
  });

  ariaLabel = computed(() => {
    const s = this.state();
    return s.liked
      ? `Unlike. Currently ${s.count} likes`
      : `Like. Currently ${s.count} likes`;
  });

  tooltipText = computed(() => {
    return this.state().liked ? 'Unlike' : 'Mark as helpful';
  });

  buttonClasses = computed(() => {
    const classes = [`size-${this.size}`, `variant-${this.variant}`];
    return classes.join(' ');
  });

  get iconPixelSize(): number {
    switch (this.size) {
      case 'sm': return 14;
      case 'md': return 16;
      case 'lg': return 18;
      default: return 14;
    }
  }

  ngOnInit(): void {
    // Register for lazy batch hydration via IntersectionObserver
    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.interactionService.registerForHydration(this.targetType, this.targetId);
            this.observer?.unobserve(entry.target);
          }
        }
      }, { threshold: 0.1 });

      this.observer.observe(this.elementRef.nativeElement);
    } else {
      // Fallback: register immediately
      this.interactionService.registerForHydration(this.targetType, this.targetId);
    }
  }

  onToggle(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.interactionService.toggle(this.targetType, this.targetId);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}