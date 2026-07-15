import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ai-roadmap-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-roadmap-widget.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiRoadmapWidgetComponent {
  @Input() roadmap: any = null;
  @Input() loading = false;

  @Output() dismiss = new EventEmitter<void>();

  collapsedRoadmap = true;
  activeRoadmapStepIndex = 0;

  toggleRoadmapCollapse() {
    this.collapsedRoadmap = !this.collapsedRoadmap;
  }

  toggleRoadmapStep(index: number) {
    this.activeRoadmapStepIndex = this.activeRoadmapStepIndex === index ? -1 : index;
  }

  trackByRoadmapStep(_index: number, step: any): string {
    return step.title ?? String(_index);
  }
}