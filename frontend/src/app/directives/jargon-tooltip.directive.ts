import { Directive, ElementRef, HostListener, OnDestroy, Renderer2 } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Directive({
  selector: '[appJargonTooltip]',
  standalone: true
})
export class JargonTooltipDirective implements OnDestroy {
  private tooltipEl: HTMLElement | null = null;
  private clickListener: (() => void) | null = null;

  constructor(
    private el: ElementRef,
    private http: HttpClient,
    private renderer: Renderer2
  ) { }

  @HostListener('mouseup', ['$event'])
  @HostListener('dblclick', ['$event'])
  onMouseUpOrDblClick(event: MouseEvent) {
    // Small timeout to allow the browser selection state to update
    setTimeout(() => {
      this.handleSelection(event);
    }, 50);
  }

  private handleSelection(event: MouseEvent) {
    const selection = window.getSelection();
    if (!selection) return;

    const term = selection.toString().trim();
    // Only explain terms that are 2-40 characters long and not empty
    if (!term || term.length < 2 || term.length > 40 || term.includes('\n')) {
      this.removeTooltip();
      return;
    }

    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();
    if (rects.length === 0) return;

    const rect = rects[0];
    this.createTooltip(term, rect);
  }

  private createTooltip(term: string, rect: DOMRect) {
    this.removeTooltip();

    // Create tooltip container element
    const tooltip = this.renderer.createElement('div');
    this.renderer.addClass(tooltip, 'jargon-tooltip-bubble');

    // Position the tooltip centered above the selection rect
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;
    const top = rect.top + scrollY - 10; // offset above text
    const left = rect.left + scrollX + rect.width / 2;

    this.renderer.setStyle(tooltip, 'position', 'absolute');
    this.renderer.setStyle(tooltip, 'top', `${top}px`);
    this.renderer.setStyle(tooltip, 'left', `${left}px`);
    this.renderer.setStyle(tooltip, 'transform', 'translate(-50%, -100%)');
    this.renderer.setStyle(tooltip, 'z-index', '9999');

    // Add default CSS styles for premium glassmorphic styling
    this.renderer.setStyle(tooltip, 'background', 'rgba(15, 23, 42, 0.95)'); // dark tailwind slate-900
    this.renderer.setStyle(tooltip, 'color', '#f8fafc'); // slate-50
    this.renderer.setStyle(tooltip, 'padding', '8px 12px');
    this.renderer.setStyle(tooltip, 'border-radius', '8px');
    this.renderer.setStyle(tooltip, 'font-size', '11px');
    this.renderer.setStyle(tooltip, 'max-width', '250px');
    this.renderer.setStyle(tooltip, 'width', 'max-content');
    this.renderer.setStyle(tooltip, 'box-shadow', '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05)');
    this.renderer.setStyle(tooltip, 'border', '1px solid rgba(255, 255, 255, 0.1)');
    this.renderer.setStyle(tooltip, 'font-family', 'sans-serif');
    this.renderer.setStyle(tooltip, 'pointer-events', 'auto');

    // Loader content
    tooltip.innerHTML = `<div class="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-accent mb-0.5">
      <span>Jargon Explainer</span>
      <span class="animate-pulse">...</span>
    </div>
    <div class="italic opacity-60">Loading definition...</div>`;

    this.renderer.appendChild(document.body, tooltip);
    this.tooltipEl = tooltip;

    // Fetch definition from backend
    this.http.get<any>(`http://localhost:8888/api/legal/jargon?term=${encodeURIComponent(term)}`).subscribe({
      next: (res) => {
        if (this.tooltipEl === tooltip) {
          tooltip.innerHTML = `<div class="font-bold uppercase tracking-wider text-[9px] text-amber-500 mb-0.5">Jargon Explainer: "${term}"</div>
          <div class="leading-relaxed font-sans">${res.definition}</div>`;
        }
      },
      error: () => {
        if (this.tooltipEl === tooltip) {
          tooltip.innerHTML = `<div class="font-bold uppercase tracking-wider text-[9px] text-red-500 mb-0.5">Jargon Explainer</div>
          <div class="leading-relaxed opacity-80">Could not retrieve explanation for this term.</div>`;
        }
      }
    });

    // Close when clicking outside
    this.clickListener = this.renderer.listen('document', 'mousedown', (event: MouseEvent) => {
      const clickTarget = event.target as HTMLElement;
      if (tooltip && !tooltip.contains(clickTarget)) {
        this.removeTooltip();
      }
    });
  }

  private removeTooltip() {
    if (this.tooltipEl) {
      this.renderer.removeChild(document.body, this.tooltipEl);
      this.tooltipEl = null;
    }
    if (this.clickListener) {
      this.clickListener();
      this.clickListener = null;
    }
  }

  ngOnDestroy() {
    this.removeTooltip();
  }
}