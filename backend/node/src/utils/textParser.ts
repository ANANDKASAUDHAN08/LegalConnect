export interface ParsedBlock {
  type: 'main' | 'explanation' | 'illustration' | 'clause';
  text: string;
}

export function splitTitle(title: string): { cleanTitle: string; introText: string } {
  if (!title) return { cleanTitle: '', introText: '' };
  
  // Match delimiters like .—, —, –, .-, . —, ।—, etc.
  const match = title.match(/^(.*?)(?:\.—|—|–|(?:\.-\s*)|(?:\.\s+—)|(?:\.\s+-)|(?:।—)|(?:।\s*—))(.*)$/);
  if (match) {
    let cleanTitle = match[1].trim();
    let introText = match[2].trim();
    // Remove trailing punctuation from clean title if present
    if (cleanTitle.endsWith('.')) {
      cleanTitle = cleanTitle.slice(0, -1).trim();
    } else if (cleanTitle.endsWith('।')) {
      cleanTitle = cleanTitle.slice(0, -1).trim();
    }
    return { cleanTitle, introText };
  }
  return { cleanTitle: title, introText: '' };
}

export function hasClauseIndicator(text: string): boolean {
  if (!text) return false;
  return /^(?:\([a-z0-9\u0900-\u097F]+\)|\d+\.)/i.test(text.trim());
}

export function getParsedContent(text: string, introText: string = ''): ParsedBlock[] {
  if (!text) return [];
  const lines = text.split('\n');
  const parsed: ParsedBlock[] = [];
  const footnoteNoiseRegex = /^\s*(?:\[?\d+\]?\s*)?\*[\s\*]*$/;

  let currentBlock: ParsedBlock | null = null;
  let hasPendingParagraphBreak = false;

  lines.forEach(line => {
    const trimmed = line.trim().replace(/ {2,}/g, ' ');
    if (!trimmed) {
      if (currentBlock) {
        hasPendingParagraphBreak = true;
      }
      return;
    }

    // Skip footnote noise lines
    if (footnoteNoiseRegex.test(trimmed)) {
      return;
    }

    const isExplanation = /^(?:explanation|स्पष्टीकरण)\b/i.test(trimmed);
    const isIllustration = /^(?:illustration|illustrations|दृष्टांत|उदाहरण|उद्देश्य)\b/i.test(trimmed);
    const isClause = /^(?:\d+\[)?(?:\([a-z0-9\u0900-\u097F]+\)|\d+\.)/i.test(trimmed);

    if (isExplanation) {
      const isRedundant = /^(?:explanation|स्पष्टीकरण)[\.।\s—–-]*$/i.test(trimmed);
      currentBlock = { type: 'explanation', text: isRedundant ? '' : trimmed };
      parsed.push(currentBlock);
      hasPendingParagraphBreak = false;
    } else if (isIllustration) {
      const isRedundant = /^(?:illustration|illustrations|दृष्टांत|उदाहरण|उद्देश्य)[\.।\s—–-]*$/i.test(trimmed);
      currentBlock = { type: 'illustration', text: isRedundant ? '' : trimmed };
      parsed.push(currentBlock);
      hasPendingParagraphBreak = false;
    } else if (isClause) {
      let actualClause = true;
      if (currentBlock) {
        const prevText = currentBlock.text.trim();
        const isListContinuation = 
          /(?:(?:sub-)?(?:section|clause)s?|धारा|उप-धारा|खंड|उप-खंड)s?\s*\([a-z0-9\u0900-\u097F]+\)\s*(?:and|or|और|या|एवं|अथवा)\s*$/i.test(prevText) &&
          /^\([a-z0-9\u0900-\u097F]+\)/.test(trimmed);
        if (isListContinuation) {
          actualClause = false;
        }
      }

      if (!actualClause) {
        if (hasPendingParagraphBreak) {
          currentBlock!.text += '\n\n' + trimmed;
          hasPendingParagraphBreak = false;
        } else {
          let separator = ' ';
          if (currentBlock!.text.endsWith('-')) {
            currentBlock!.text = currentBlock!.text.slice(0, -1);
            separator = '';
          } else if (currentBlock!.text.endsWith('—') || currentBlock!.text.endsWith('–')) {
            separator = '';
          } else if (!currentBlock!.text) {
            separator = '';
          }
          currentBlock!.text += separator + trimmed;
        }
      } else {
        const isNumericClause = /^(?:\(\d+\)|\d+\.)/.test(trimmed);
        if (currentBlock && (currentBlock.type === 'explanation' || currentBlock.type === 'illustration') && !isNumericClause) {
          // Keep sub-clauses (like (a), (b)) inside explanations or illustrations
          const separator = currentBlock.text ? '\n\n' : '';
          currentBlock.text += separator + trimmed;
          hasPendingParagraphBreak = false;
        } else {
          currentBlock = { type: 'clause', text: trimmed };
          parsed.push(currentBlock);
          hasPendingParagraphBreak = false;
        }
      }
    } else {
      // Normal text line
      if (!currentBlock) {
        currentBlock = { type: 'main', text: trimmed };
        parsed.push(currentBlock);
        hasPendingParagraphBreak = false;
      } else {
        if (hasPendingParagraphBreak) {
          currentBlock.text += '\n\n' + trimmed;
          hasPendingParagraphBreak = false;
        } else {
          let separator = ' ';
          if (currentBlock.text.endsWith('-')) {
            currentBlock.text = currentBlock.text.slice(0, -1);
            separator = '';
          } else if (currentBlock.text.endsWith('—') || currentBlock.text.endsWith('–')) {
            separator = '';
          } else if (!currentBlock.text) {
            separator = '';
          }
          currentBlock.text += separator + trimmed;
        }
      }
    }
  });

  const result = parsed.filter(b => b.text.trim().length > 0);

  // Merge introText into the parsed blocks if present
  if (introText && introText.trim()) {
    const trimmedIntro = introText.trim().replace(/ {2,}/g, ' ');
    const introHasClause = hasClauseIndicator(trimmedIntro);

    if (result.length > 0 && result[0].type === 'main') {
      let connector = ' ';
      if (trimmedIntro.endsWith('—') || trimmedIntro.endsWith('–') || trimmedIntro.endsWith('-') || trimmedIntro.endsWith('—') || trimmedIntro.endsWith('who—')) {
        connector = '';
      }
      result[0].text = trimmedIntro + connector + result[0].text;
      // If the introText starts with a clause indicator like (1), the merged
      // block must be typed as 'clause' so the frontend renders the gold
      // indicator and applies proper indentation.
      if (introHasClause) {
        result[0].type = 'clause';
      }
    } else {
      const type = introHasClause ? 'clause' : 'main';
      result.unshift({ type, text: trimmedIntro });
    }
  }

  return result;
}
