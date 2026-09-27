import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SystemAnnouncementService } from '../../services/system-announcement.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { replaceEmojisWithSvg } from '../../utils/emoji-to-svg.util';

@Component({
  selector: 'app-whats-new-modal',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './whats-new-modal.component.html',
  styleUrls: ['./whats-new-modal.component.scss']
})
export class WhatsNewModalComponent {
  announcementService = inject(SystemAnnouncementService);
  announcement = this.announcementService.activeModalAnnouncement;

  constructor() {
    effect(() => {
      const active = !!this.announcement();
      if (typeof document !== 'undefined') {
        if (active) {
          document.body.classList.add('overflow-hidden');
        } else {
          document.body.classList.remove('overflow-hidden');
        }
      }
    });
  }

  dismiss() {
    const current = this.announcement();
    if (current) {
      this.announcementService.markAsRead(current.id);
      this.announcementService.dismissModal(current.id);
      if (typeof document !== 'undefined') {
        document.body.classList.remove('overflow-hidden');
      }
    }
  }

  formatMarkdown(md?: string): string {
    if (!md) return '';
    const html = md
      .replace(/^### (.*$)/gim, '<h3 class="font-bold text-amber-400 mt-2 mb-1">$1</h3>')
      .replace(/^- (.*$)/gim, '<li class="ml-3 list-disc text-slate-300">$1</li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>');
    return this.replaceEmojis(html);
  }

  replaceEmojis(text: string): string {
    return replaceEmojisWithSvg(text);
  }
}