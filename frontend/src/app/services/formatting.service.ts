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
        const lastNonEmptyLine = [...cleanedLines].reverse().find(l => l !== '') || '';
        const endsWithSentencePunctuation = /[.!?।’”\]\)]\s*$/.test(lastNonEmptyLine);
        const startsWithLowercase = /^[a-z]/.test(currentLine);

        const isListIndicator = /^\([a-z0-9]+\)/i.test(currentLine) || /^\d+\./.test(currentLine);
        const isContinuation = !isListIndicator && (startsWithLowercase || (lastNonEmptyLine && !endsWithSentencePunctuation));

        const isNewParagraph =
          !isContinuation && (
            prevLine === '' ||
            /^\([a-z0-9]\)/i.test(currentLine) ||
            /^(?:\d+\[)?\s*(Explanation|Illustration|Exception|Proviso|स्पष्टीकरण|दृष्टांत|उदाहरण|उद्देश्य)/i.test(currentLine) ||
            /^(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth)(ly)?\b/i.test(currentLine)
          );

        if (isNewParagraph) {
          if (prevLine === '') {
            cleanedLines[cleanedLines.length - 1] = currentLine;
          } else {
            cleanedLines.push(currentLine);
          }
        } else {
          const lastIdx = cleanedLines.lastIndexOf(lastNonEmptyLine);
          if (lastIdx !== -1) {
            cleanedLines[lastIdx] = (lastNonEmptyLine + ' ' + currentLine).replace(/\s+/g, ' ');
          } else {
            cleanedLines.push(currentLine);
          }
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

  // Dynamic color hashing selector for any Act tags supporting dark/light mode
  getActTagClass(shortName: string): string {
    const act = (shortName || '').toUpperCase().trim();
    if (!act) {
      return 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/50';
    }

    const themes = [
      'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-500/20', // Emerald
      'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-500/20',             // Rose
      'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200/60 dark:border-indigo-500/20', // Indigo
      'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200/60 dark:border-purple-500/20', // Purple
      'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/60 dark:border-blue-500/20',             // Blue
      'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-500/20',       // Amber
      'bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200/60 dark:border-teal-500/20',             // Teal
      'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200/60 dark:border-cyan-500/20',             // Cyan
      'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200/60 dark:border-orange-500/20', // Orange
      'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200/60 dark:border-violet-500/20'  // Violet
    ];

    let hash = 0;
    for (let i = 0; i < act.length; i++) {
      hash = act.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % themes.length;
    return themes[index];
  }

  // Dynamic matching dot color for search histories/lists
  getActDotClass(shortName: string): string {
    const act = (shortName || '').toUpperCase().trim();
    if (!act) return 'bg-slate-400';

    const colors = [
      'bg-emerald-500',
      'bg-rose-500',
      'bg-indigo-500',
      'bg-purple-500',
      'bg-blue-500',
      'bg-amber-500',
      'bg-teal-500',
      'bg-cyan-500',
      'bg-orange-500',
      'bg-violet-500'
    ];

    let hash = 0;
    for (let i = 0; i < act.length; i++) {
      hash = act.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  formatSectionHtml(htmlOrText: string): string {
    if (!htmlOrText) return '';
    const paragraphs = htmlOrText.split('\n\n');
    const processed = paragraphs.map(p => {
      const stripped = p.replace(/<[^>]+>/g, '').trim();
      if (!stripped) return '';

      // 0. Footnote Block
      if (/^\[Footnote:/i.test(stripped) || /^Footnote:/i.test(stripped)) {
        let footnoteContent = stripped;
        const footnoteMatch = stripped.match(/^\[Footnote:\s*([\s\S]+)\]$/i);
        if (footnoteMatch) {
          footnoteContent = footnoteMatch[1].trim();
        } else if (stripped.startsWith('[') && stripped.endsWith(']')) {
          footnoteContent = stripped.substring(1, stripped.length - 1).trim();
          if (footnoteContent.toLowerCase().startsWith('footnote:')) {
            footnoteContent = footnoteContent.substring(9).trim();
          }
        } else if (stripped.toLowerCase().startsWith('footnote:')) {
          footnoteContent = stripped.substring(9).trim();
        }

        return `<div class="my-4 p-3.5 bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/80 rounded-xl flex items-start gap-2.5 shadow-sm text-left">
          <svg class="w-4 h-4 text-indigo-500 dark:text-indigo-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div class="flex-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 font-sans">
            <span class="font-black text-[10px] text-slate-600 dark:text-slate-300 uppercase tracking-widest block mb-1 select-none">Footnote / Commencement Info</span>
            <span class="font-medium">${footnoteContent}</span>
          </div>
        </div>`;
      }

      // 1. Explanation Block
      if (/^(?:\d+\[)?\s*(?:Explanation|स्पष्टीकरण)\b/i.test(stripped)) {
        return `<div class="my-3 p-4 bg-blue-50/50 dark:bg-blue-950/10 border-l-4 border-blue-500 rounded-r-xl flex gap-3 items-start text-left">
          <svg class="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div class="flex-1 text-[13px] sm:text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
            ${p}
          </div>
        </div>`;
      }

      // 2. Illustrations Title
      if (/^Illustrations?\.?$/i.test(stripped)) {
        return `<h6 class="text-[11px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mt-4 mb-2 flex items-center gap-1.5 select-none text-left">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
          </svg>
          ${p}
        </h6>`;
      }

      // 3. Illustration ListItem (a), (b), etc.
      const illusMatch = p.match(/^(\s*(?:<[^>]+>)*\s*)\(([a-z]+)\)\s*(.*)$/i);
      if (illusMatch) {
        const prefixHtml = illusMatch[1];
        const letter = illusMatch[2];
        const body = illusMatch[3];
        return `<div class="flex items-start gap-2 pl-3.5 my-2 border-l border-slate-200 dark:border-white/5 py-0.5 text-left">
          <span class="text-xs font-bold text-indigo-500/70 dark:text-indigo-400/60 select-none min-w-[20px] mt-0.5">${prefixHtml}(${letter})</span>
          <div class="flex-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">${body}</div>
        </div>`;
      }

      // 4. Clause ListItem (1), (2), etc.
      const clauseMatch = p.match(/^(\s*(?:<[^>]+>)*\s*)\((\d+)\)\s*(.*)$/i);
      if (clauseMatch) {
        const prefixHtml = clauseMatch[1];
        const num = clauseMatch[2];
        const body = clauseMatch[3];
        return `<div class="flex items-start gap-2 my-2.5 text-left">
          <span class="text-xs font-extrabold text-[hsl(35,92%,47%)] select-none min-w-[22px] mt-0.5">${prefixHtml}(${num})</span>
          <div class="flex-1 text-[inherit] text-slate-700 dark:text-slate-200 leading-relaxed font-medium">${body}</div>
        </div>`;
      }

      // 5. Normal Paragraph
      return `<p class="text-[inherit] text-slate-600 dark:text-slate-300 leading-relaxed my-2 text-left">${p}</p>`;
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

  getAmendmentTimeline(content: string, actName: string, actYear?: number): { label: string; details: string; year?: number }[] {
    if (!content) return [];
    const timeline: { label: string; details: string; year?: number }[] = [];

    let finalActName = actName;
    let finalActYear = actYear;

    const actLookup: { [key: string]: { name: string; year: number } } = {
      'bns': { name: 'Bharatiya Nyaya Sanhita', year: 2023 },
      'bnss': { name: 'Bharatiya Nagarik Suraksha Sanhita', year: 2023 },
      'bsa': { name: 'Bharatiya Sakshya Adhiniyam', year: 2023 },
      'ipc': { name: 'Indian Penal Code', year: 1860 },
      'crpc': { name: 'Code of Criminal Procedure', year: 1973 },
      'iea': { name: 'Indian Evidence Act', year: 1872 },
      'cpc': { name: 'Code of Civil Procedure', year: 1908 },
      'mva': { name: 'Motor Vehicles Act', year: 1988 },
      'nia': { name: 'Negotiable Instruments Act', year: 1881 },
      'hma': { name: 'Hindu Marriage Act', year: 1955 },
      'ida': { name: 'Industrial Disputes Act', year: 1947 },
      'constitution': { name: 'Constitution of India', year: 1950 }
    };

    const cleanKey = actName.trim().toLowerCase();
    if (actLookup[cleanKey]) {
      finalActName = actLookup[cleanKey].name;
      if (finalActYear === undefined) {
        finalActYear = actLookup[cleanKey].year;
      }
    }

    // 1. Match inline amendments, e.g. 1 [two thousand...] or 1[two thousand...]
    const inlineRegex = /(\d+)\s*\[([^\]\n]+)\]/g;
    let match;
    inlineRegex.lastIndex = 0;
    while ((match = inlineRegex.exec(content)) !== null) {
      const num = match[1];
      const text = match[2];

      const yearMatch = text.match(/\b(19\d{2}|20\d{2})\b/);
      const hasYear = !!yearMatch;
      const hasKeywords = /\b(sub|ins|amend|w\.e\.f|omit|repeal|substituted|inserted|with\s+effect\s+from|act)\b/i.test(text);
      if (!hasYear && !hasKeywords) {
        continue;
      }

      let year: number | undefined;
      if (yearMatch) {
        year = parseInt(yearMatch[1], 10);
      }

      timeline.push({
        label: `Amendment Reference [${num}]`,
        details: text.trim(),
        year
      });
    }

    // 2. Match footnote block at bottom, e.g. [Footnote: ...]
    const footnoteBlockRegex = /\[Footnote:\s*([\s\S]+?)\]/gi;
    let fnMatch;
    footnoteBlockRegex.lastIndex = 0;
    while ((fnMatch = footnoteBlockRegex.exec(content)) !== null) {
      const text = fnMatch[1];

      const yearMatch = text.match(/\b(19\d{2}|20\d{2})\b/);
      const hasYear = !!yearMatch;
      const hasKeywords = /\b(sub|ins|amend|w\.e\.f|omit|repeal|substituted|inserted|with\s+effect\s+from|act)\b/i.test(text);
      if (!hasYear && !hasKeywords) {
        continue;
      }

      let year: number | undefined;
      if (yearMatch) {
        year = parseInt(yearMatch[1], 10);
      }

      timeline.push({
        label: 'Footnote Notification',
        details: text.trim(),
        year
      });
    }

    if (timeline.length > 0 && finalActName) {
      timeline.unshift({
        label: 'Original Enactment',
        details: `Enacted under ${finalActName}`,
        year: finalActYear
      });

      timeline.sort((a, b) => {
        if (a.year && b.year) return a.year - b.year;
        if (a.year) return -1;
        if (b.year) return 1;
        return 0;
      });
    }

    return timeline;
  }

  escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  readonly commonWordsBlocklist = [
    'rate', 'fine', 'file', 'cases', 'date', 'here', 'make', 'what', 'how', 'when', 'where',
    'who', 'why', 'which', 'their', 'there', 'about', 'above', 'after', 'again', 'against',
    'all', 'any', 'are', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
    'can', 'did', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further',
    'had', 'has', 'have', 'having', 'her', 'here', 'hers', 'him', 'his', 'into', 'its', 'just',
    'more', 'most', 'once', 'only', 'other', 'our', 'ours', 'out', 'over', 'own', 'same', 'she',
    'should', 'some', 'such', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these',
    'they', 'this', 'those', 'through', 'too', 'under', 'until', 'up', 'very', 'was', 'were',
    'with', 'you', 'your', 'yours', 'yourself', 'yourselves', 'court', 'legal', 'lawyer', 'act',
    'section', 'clause', 'order', 'right', 'rights', 'guidelines'
  ];

  highlightKeywords(text: string, query: string, blocklist = this.commonWordsBlocklist): string {
    if (!text || !query) return text;
    const words = query.toLowerCase()
      .split(/[\s,.:;'"?()!-]+/)
      .filter(w => w.length > 2 && !blocklist.includes(w));

    if (words.length === 0) return text;

    let highlighted = text;
    words.forEach(w => {
      const escaped = w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark class="bg-yellow-500/20 text-yellow-800 dark:text-yellow-200 px-0.5 rounded font-semibold">$1</mark>');
    });
    return highlighted;
  }

  getLevenshteinDistance(a: string, b: string): number {
    const tmp = [];
    let i, j;
    for (i = 0; i <= a.length; i++) {
      tmp.push([i]);
    }
    for (j = 1; j <= b.length; j++) {
      tmp[0].push(j);
    }
    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        tmp[i][j] = Math.min(
          tmp[i - 1][j] + 1,
          tmp[i][j - 1] + 1,
          tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return tmp[a.length][b.length];
  }

  checkSpelling(query: string, dictionary: string[], blocklist = this.commonWordsBlocklist): string | null {
    const words = query.toLowerCase().split(/\s+/);
    let corrections = [...words];
    let hasChanged = false;

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w.length < 4 || dictionary.includes(w) || blocklist.includes(w)) continue;

      let bestMatch: string | null = null;
      let minDistance = 3;
      const maxAllowedDistance = w.length <= 5 ? 1 : 2;

      for (const dictWord of dictionary) {
        const dist = this.getLevenshteinDistance(w, dictWord);
        if (dist < minDistance && dist <= maxAllowedDistance) {
          minDistance = dist;
          bestMatch = dictWord;
        }
      }

      if (bestMatch) {
        corrections[i] = bestMatch;
        hasChanged = true;
      }
    }

    return hasChanged ? corrections.join(' ') : null;
  }
}