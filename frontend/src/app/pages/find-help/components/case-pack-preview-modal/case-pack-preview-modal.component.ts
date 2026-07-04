import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Case Pack preview modal + print logic — deferred loaded on demand.
 * Extracts ~150 lines of modal HTML from the parent component.
 */
@Component({
  selector: 'app-case-pack-preview-modal',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './case-pack-preview-modal.component.html',
  styleUrls: ['./case-pack-preview-modal.component.scss']
})
export class CasePackPreviewModalComponent implements OnInit, OnDestroy {
  @Input() activeCategory = '';
  @Input() locationQuery = '';
  @Input() roadmap: any = null;
  @Input() filteredResources: any[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() print = new EventEmitter<void>();

  ngOnInit() {
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
  }

  get todayDateString(): string {
    return new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  trackByIndex(index: number): number {
    return index;
  }
}