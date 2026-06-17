import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FormattingService {

  cleanSectionContent(content: string): string {
    if (!content) return '';
    const lines = content.split(/\r?\n/);
    const cleanedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i].trim();
      if (!currentLine) {
        cleanedLines.push('');
        continue;
      }

      if (cleanedLines.length === 0) {
        cleanedLines.push(currentLine);
      } else {
        const prevLine = cleanedLines[cleanedLines.length - 1];

        // Decide if we start a new paragraph/line:
        // 1. If previous line was empty.
        // 2. If current line starts with (a), (1), etc.
        // 3. If current line starts with Explanation, Illustrations, etc.
        // 4. If current line starts with First.—, Secondly.—, etc.
        const isNewParagraph =
          prevLine === '' ||
          /^\([a-z0-9]\)/i.test(currentLine) ||
          /^(Explanation|Illustration|Exception|Proviso)/i.test(currentLine) ||
          /^(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth)(ly)?\b/i.test(currentLine);

        if (isNewParagraph) {
          if (prevLine === '') {
            cleanedLines[cleanedLines.length - 1] = currentLine;
          } else {
            cleanedLines.push(currentLine);
          }
        } else {
          cleanedLines[cleanedLines.length - 1] = (prevLine + ' ' + currentLine).replace(/\s+/g, ' ');
        }
      }
    }

    return cleanedLines.filter(line => line !== '').join('\n\n');
  }

  healTitleAndContent(title: string, content: string): { title: string, content: string } {
    if (!title) return { title: '', content };
    const idx = title.indexOf('.—');
    if (idx !== -1) {
      const cleanTitle = title.substring(0, idx).trim();
      const prefix = title.substring(idx + 2).trim();
      if (prefix) {
        const needsSpace = /\w$/.test(prefix) && /^\w/.test(content);
        const joinedContent = prefix + (needsSpace ? ' ' : '') + content;
        return { title: cleanTitle, content: joinedContent };
      }
      return { title: cleanTitle, content };
    }
    return { title, content };
  }

  formatSectionHtml(htmlOrText: string): string {
    if (!htmlOrText) return '';
    const paragraphs = htmlOrText.split('\n\n');
    const processed = paragraphs.map(p => {
      const stripped = p.replace(/<[^>]+>/g, '').trim();
      if (!stripped) return '';

      // 1. Explanation Block
      if (/^Explanation/i.test(stripped)) {
        let sepIdx = p.indexOf('.—');
        if (sepIdx === -1) sepIdx = p.indexOf(':');

        if (sepIdx !== -1) {
          const header = p.substring(0, sepIdx + 2).trim();
          const body = p.substring(sepIdx + 2).trim();
          return `<div class="my-3 pl-3.5 border-l-2 border-amber-500 dark:border-amber-400 bg-amber-500/[0.02] py-1 rounded-r-lg">
            <span class="block text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1 select-none">${header}</span>
            <div class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">${body}</div>
          </div>`;
        } else {
          return `<div class="my-3 pl-3.5 border-l-2 border-amber-500 dark:border-amber-400 bg-amber-500/[0.02] py-1 rounded-r-lg">
            <div class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">${p}</div>
          </div>`;
        }
      }

      // 2. Illustrations Title
      if (/^Illustrations?\.?$/i.test(stripped)) {
        return `<h6 class="text-[11px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mt-4 mb-2 flex items-center gap-1.5 select-none">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
          </svg>
          ${p}
        </h6>`;
      }

      // 3. Illustration ListItem (a), (b), etc.
      const illusMatch = p.match(/^(\s*(?:<[^>]+>)*\s*)\(([a-z])\)\s*(.*)$/i);
      if (illusMatch) {
        const prefixHtml = illusMatch[1];
        const letter = illusMatch[2];
        const body = illusMatch[3];
        return `<div class="flex items-start gap-2 pl-3.5 my-2 border-l border-slate-200 dark:border-white/5 py-0.5">
          <span class="text-xs font-bold text-indigo-500/70 dark:text-indigo-400/60 select-none min-w-[20px] mt-0.5">${prefixHtml}(${letter})</span>
          <div class="flex-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">${body}</div>
        </div>`;
      }

      // 4. Clause ListItem (1), (2), etc.
      const clauseMatch = p.match(/^(\s*(?:<[^>]+>)*\s*)\((\d+)\)\s*(.*)$/i);
      if (clauseMatch) {
        const prefixHtml = clauseMatch[1];
        const num = clauseMatch[2];
        const body = clauseMatch[3];
        return `<div class="flex items-start gap-2 my-2.5">
          <span class="text-xs font-extrabold text-[hsl(35,92%,47%)] select-none min-w-[22px] mt-0.5">${prefixHtml}(${num})</span>
          <div class="flex-1 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">${body}</div>
        </div>`;
      }

      // 5. Normal Paragraph
      return `<p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed my-2">${p}</p>`;
    });

    return processed.filter(Boolean).join('\n');
  }

  formatMarkdown(text: string): string {
    if (!text) return '';

    const lines = text.split(/\r?\n/);
    let htmlLines: string[] = [];

    for (let line of lines) {
      const listMatch = line.match(/^(\s*)\*\s+(.*)$/);
      if (listMatch) {
        const indent = listMatch[1].length;
        const content = listMatch[2];
        const paddingClass = indent > 2 ? 'pl-6' : 'pl-3';
        const formattedContent = this.formatInlineMarkdown(content);
        htmlLines.push(`<div class="flex items-start gap-2 ${paddingClass} my-1">
          <span class="text-indigo-500 dark:text-indigo-400 select-none mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-current"></span>
          <span class="flex-1 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">${formattedContent}</span>
        </div>`);
      } else {
        const trimmed = line.trim();
        if (!trimmed) {
          htmlLines.push('<div class="h-2"></div>');
          continue;
        }

        if (trimmed.startsWith('###')) {
          const headerText = this.formatInlineMarkdown(trimmed.substring(3).trim());
          htmlLines.push(`<h5 class="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-4 mb-2 uppercase tracking-wider">${headerText}</h5>`);
        } else if (trimmed.startsWith('##')) {
          const headerText = this.formatInlineMarkdown(trimmed.substring(2).trim());
          htmlLines.push(`<h4 class="text-sm font-bold text-slate-900 dark:text-white mt-4 mb-2">${headerText}</h4>`);
        } else if (trimmed.startsWith('#')) {
          const headerText = this.formatInlineMarkdown(trimmed.substring(1).trim());
          htmlLines.push(`<h3 class="text-base font-bold text-slate-900 dark:text-white mt-4 mb-2">${headerText}</h3>`);
        } else {
          htmlLines.push(`<p class="my-1.5 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">${this.formatInlineMarkdown(trimmed)}</p>`);
        }
      }
    }

    return htmlLines.join('\n');
  }

  private formatInlineMarkdown(text: string): string {
    let html = this.escapeHtml(text);
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900 dark:text-white">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="italic text-slate-800 dark:text-slate-300">$1</em>');
    html = html.replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono text-xs text-indigo-600 dark:text-indigo-400">$1</code>');
    return html;
  }

  parseMarkdown(text: string): string {
    if (!text) return '';

    // Escaped HTML to prevent injection
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold: **text** -> <strong>text</strong>
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>');

    // Italics: *text* -> <em>text</em>
    html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

    const lines = html.split(/\r?\n/);
    let inList = false;
    const formattedLines: string[] = [];

    for (let line of lines) {
      const trimmed = line.trim();

      // Support list items starting with '* ' or '- '
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        const itemContent = trimmed.substring(2);
        if (!inList) {
          formattedLines.push('<ul class="list-disc pl-5 my-2 flex flex-col gap-1.5">');
          inList = true;
        }
        formattedLines.push(`<li class="text-sm leading-relaxed">${itemContent}</li>`);
        continue;
      }

      // Close list block if we hit a non-list item
      if (inList) {
        formattedLines.push('</ul>');
        inList = false;
      }

      if (/^\d+\.\s/.test(trimmed)) {
        const match = trimmed.match(/^(\d+)\.\s(.*)$/);
        if (match) {
          formattedLines.push(`<div class="font-bold text-sm text-accent mt-4 mb-2 flex items-start gap-1.5"><span>${match[1]}.</span> <span>${match[2]}</span></div>`);
        }
      } else {
        formattedLines.push(trimmed ? `<p class="mb-2 leading-relaxed">${trimmed}</p>` : '');
      }
    }

    if (inList) {
      formattedLines.push('</ul>');
    }

    return formattedLines.join('\n');
  }

  escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
