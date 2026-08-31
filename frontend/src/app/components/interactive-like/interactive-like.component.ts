import {
  Component, ChangeDetectionStrategy, inject, computed, input, effect,
  OnDestroy, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { InteractionService } from '../../services/interaction.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { IconComponent } from '../icon/icon.component';

/**
 * <app-interactive-like> — Universal Like/Vote Button
 *
 * Zero-configuration: injects InteractionService and auto-hydrates state.
 * Uses Angular 17+ Signal Inputs for reactive route parameter navigation.
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
export class InteractiveLikeComponent implements OnDestroy {
  targetType = input.required<string>();
  targetId = input.required<string>();
  variant = input<'icon-only' | 'pill' | 'counter-badge' | 'thumbs'>('pill');
  size = input<'sm' | 'md' | 'lg'>('sm');

  private interactionService = inject(InteractionService);
  private observer: IntersectionObserver | null = null;
  private elementRef = inject(ElementRef);

  // Computed state from service signals - reacts whenever targetId() or interactions change
  state = computed(() => {
    const type = this.targetType();
    const id = this.targetId();
    if (!type || !id) return { liked: false, count: 0 };
    return this.interactionService.getState(type, id);
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
    const classes = [`size-${this.size()}`, `variant-${this.variant()}`];
    return classes.join(' ');
  });

  get iconPixelSize(): number {
    switch (this.size()) {
      case 'sm': return 14;
      case 'md': return 16;
      case 'lg': return 18;
      default: return 14;
    }
  }

  constructor() {
    // Automatically register hydration whenever targetId changes or element becomes visible
    effect(() => {
      const type = this.targetType();
      const id = this.targetId();
      if (type && id) {
        if (typeof IntersectionObserver !== 'undefined') {
          this.observer?.disconnect();
          this.observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                this.interactionService.registerForHydration(type, id);
                this.observer?.unobserve(entry.target);
              }
            }
          }, { threshold: 0.1 });
          this.observer.observe(this.elementRef.nativeElement);
        } else {
          this.interactionService.registerForHydration(type, id);
        }
      }
    });
  }

  onToggle(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.interactionService.toggle(this.targetType(), this.targetId());
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}