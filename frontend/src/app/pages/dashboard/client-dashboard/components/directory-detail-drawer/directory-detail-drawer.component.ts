import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { LawyerCardComponent } from '../../../../../components/lawyer-card/lawyer-card.component';
import { ResourceCardComponent } from '../../../../find-help/components/resource-card/resource-card.component';
import { HelplineCardComponent } from '../../../../find-help/components/helpline-card/helpline-card.component';

@Component({
  selector: 'app-directory-detail-drawer',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LawyerCardComponent,
    ResourceCardComponent,
    HelplineCardComponent
  ],
  templateUrl: './directory-detail-drawer.component.html',
  styleUrls: ['./directory-detail-drawer.component.scss']
})
export class DirectoryDetailDrawerComponent {
  private _isOpen = false;

  @Output() copySummary = new EventEmitter<string>();

  @Input()
  set isOpen(val: boolean) {
    this._isOpen = val;
    if (typeof document !== 'undefined') {
      // Toggle body scroll locking
      if (val) {
        document.body.classList.add('overflow-hidden');
      } else {
        document.body.classList.remove('overflow-hidden');
      }
    }
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  @Input() type: 'lawyer' | 'resource' | 'helpline' | null = null;
  @Input() data: any = null;

  @Output() closeDrawer = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this._isOpen) {
      this.onClose();
    }
  }

  onClose() {
    this.closeDrawer.emit();
  }

  isArray(val: any): boolean {
    return Array.isArray(val);
  }

  copySummaryToClipboard() {
    let text = '';
    const items = Array.isArray(this.data) ? this.data : [this.data];

    if (this.type === 'lawyer') {
      text = `📋 SAVED ADVOCATES LIST\n\n` + items.map((l, idx) =>
        `${idx + 1}. Adv. ${l.name}\n   Specializations: ${l.specializations?.join(', ') || 'General'}\n   Exp: ${l.experience} yrs | Rating: ${l.rating}★`
      ).join('\n\n');
    } else if (this.type === 'resource') {
      text = `📋 SAVED LEGAL AID & COURTS\n\n` + items.map((r, idx) =>
        `${idx + 1}. ${r.name}\n   Type: ${r.type === 'Court' ? 'Court Complex' : 'Legal Aid Center'}\n   Address: ${r.address}`
      ).join('\n\n');
    } else if (this.type === 'helpline') {
      text = `📋 SAVED HELPLINES\n\n` + items.map((h, idx) =>
        `${idx + 1}. ${h.name}\n   Hotline Number: ${h.number}`
      ).join('\n\n');
    }

    this.copySummary.emit(text);
  }

}