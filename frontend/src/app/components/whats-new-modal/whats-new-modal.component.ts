import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SystemAnnouncementService } from '../../services/system-announcement.service';
import { TooltipDirective } from '../../directives/tooltip.directive';

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
    if (!text) return '';
    return text
      .replace(/🚀/g, `<svg class="w-5 h-5 text-amber-400 inline-block align-middle mr-1.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.63 8.41a14.98 14.98 0 00-6.16 12.12A14.98 14.98 0 0015.59 14.37z" /></svg>`)
      .replace(/📱/g, `<svg class="w-4 h-4 text-blue-500 inline-block align-middle mr-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`)
      .replace(/⚡/g, `<svg class="w-4 h-4 text-amber-500 inline-block align-middle mr-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>`)
      .replace(/🛠️/g, `<svg class="w-4 h-4 text-indigo-500 inline-block align-middle mr-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>`)
      .replace(/🛠/g, `<svg class="w-4 h-4 text-indigo-500 inline-block align-middle mr-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>`)
      .replace(/🔔/g, `<svg class="w-4 h-4 text-emerald-500 inline-block align-middle mr-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>`);
  }
}