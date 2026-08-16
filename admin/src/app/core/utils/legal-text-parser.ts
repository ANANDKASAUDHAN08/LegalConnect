export interface LegalFootnote {
  id: string;
  number: string;
  text?: string;
}

export interface LegalClauseNode {
  id: string;
  level: 1 | 2 | 3 | 4;
  marker: string;
  term?: string;
  rawText: string;
  cleanText: string;
  type: 'subsection' | 'clause' | 'subclause' | 'subsubclause' | 'proviso' | 'explanation' | 'illustration' | 'exception' | 'preamble';
  children: LegalClauseNode[];
  footnotes: LegalFootnote[];
}

export interface ParsedLegalSection {
  preamble: string;
  nodes: LegalClauseNode[];
  footnotes: LegalFootnote[];
  laymanSummary: string;
  definedTerms: string[];
  hasStructure: boolean;
}

export class LegalTextParser {
  private static readonly MAX_CACHE_SIZE = 1000;
  private static parseCache = new Map<string, ParsedLegalSection>();

  private static getFromCache(key: string): ParsedLegalSection | undefined {
    const value = this.parseCache.get(key);
    if (value) {
      // Re-insert to refresh LRU access order
      this.parseCache.delete(key);
      this.parseCache.set(key, value);
    }
    return value;
  }

  private static setToCache(key: string, value: ParsedLegalSection): void {
    if (this.parseCache.has(key)) {
      this.parseCache.delete(key);
    } else if (this.parseCache.size >= this.MAX_CACHE_SIZE) {
      // Evict least recently used entry (first in insertion order)
      const oldestKey = this.parseCache.keys().next().value;
      if (oldestKey) this.parseCache.delete(oldestKey);
    }
    this.parseCache.set(key, value);
  }

  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  public static parse(rawText: string, sectionTitle?: string): ParsedLegalSection {
    if (!rawText || typeof rawText !== 'string') {
      return {
        preamble: '',
        nodes: [],
        footnotes: [],
        laymanSummary: '',
        definedTerms: [],
        hasStructure: false
      };
    }

    const trimmed = rawText.trim();
    const cacheKey = `${sectionTitle || ''}__${trimmed}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const footnotesMap: Map<string, LegalFootnote> = new Map();
    const { textWithFootnoteMarkers, footnotes } = this.extractFootnotes(trimmed, footnotesMap);

    // Preamble should ONLY match dedicated statutory intro preambles in Definition sections (Section 2),
    // such as "In this Act, unless the context otherwise requires,—" or "इस अधिनियम में, जब तक कि संदर्भ से अन्यथा अपेक्षित न हो,—"
    // It must NEVER consume Section 1 "This Act may be called..." or "इस अधिनियम का संक्षिप्त नाम..."
    let preamble = '';
    let bodyText = textWithFootnoteMarkers;

    const defPreambleRegex = /^(?:In this Act,\s*unless the context otherwise requires[—:\s,]*|जब तक कि संदर्भ से अन्यथा अपेक्षित न हो[—:\s,]*|इस अधिनियम में,\s*जब तक कि संदर्भ से अन्यथा अपेक्षित न हो[—:\s,]*)/i;
    const defPreambleMatch = textWithFootnoteMarkers.match(defPreambleRegex);
    if (defPreambleMatch) {
      preamble = defPreambleMatch[0].replace(/[—:\s,]+$/, '').trim() + '—';
      bodyText = textWithFootnoteMarkers.substring(defPreambleMatch[0].length).trim();
    }

    const nodes = this.parseClauseTree(bodyText, footnotesMap);
    const definedTerms = this.extractAllDefinedTerms(nodes);
    const laymanSummary = this.generateLaymanSummary(sectionTitle, preamble, nodes, rawText);

    const parsedResult: ParsedLegalSection = {
      preamble,
      nodes,
      footnotes,
      laymanSummary,
      definedTerms,
      hasStructure: nodes.length > 0 || preamble.length > 0
    };

    this.setToCache(cacheKey, parsedResult);

    return parsedResult;
  }

  private static extractFootnotes(text: string, footnotesMap: Map<string, LegalFootnote>): { textWithFootnoteMarkers: string; footnotes: LegalFootnote[] } {
    let result = text;
    const footnotes: LegalFootnote[] = [];
    const fnPattern = /(\d+)\[([^\]]+)\]/g;

    let fnCounter = 1;
    result = result.replace(fnPattern, (_fullMatch, fnNum, fnContent) => {
      const fnId = `fn-${fnNum}-${fnCounter++}`;
      footnotesMap.set(fnId, {
        id: fnId,
        number: fnNum,
        text: `Statutory Amendment Marker [${fnNum}]`
      });
      footnotes.push({ id: fnId, number: fnNum, text: `Amendment Footnote [${fnNum}]` });
      return ` {FN:${fnNum}} ${fnContent} `;
    });

    // Collapse horizontal whitespace (spaces/tabs) but preserve newlines for boundary detection
    result = result.replace(/[^\S\r\n]+/g, ' ').replace(/[\r\n][\s]*/g, '\n').trim();
    return { textWithFootnoteMarkers: result, footnotes };
  }

  private static parseClauseTree(bodyText: string, footnotesMap: Map<string, LegalFootnote>): LegalClauseNode[] {
    const nodes: LegalClauseNode[] = [];
    if (!bodyText) return nodes;

    // Strict Legal Marker Regex matching:
    // (1), (2), (1A), (1B), (1क), (१), (२)...
    // (a), (b), (ba), (क), (ख), (ग)...
    // (i), (ii), (iii), (iv), (v)... or (कक), (खख)...
    // (A), (B), (C)...
    // Callouts: Provided that, Explanation, Illustration, Exception (English & Hindi)
    // Boundary anchors: start of text, newlines, period/semicolon/colon, Devanagari danda (।), or double space
    // Boundary: start-of-text, newline, common punctuation (period/semicolon/colon/comma/em-dash/danda/closing-paren) + optional whitespace, OR any single whitespace.
    // Using \s (not \s{2,}) ensures markers after a single space are detected — the cross-reference filter prevents false positives.
    const markerRegex = /(?:^|[\r\n]+|[.;:।॥,—]\s*|\)\s*|\s)(?:\(([0-9]{1,3}[A-Za-z]?|[०-९]{1,3}[क-ह]?)\)|\(([a-z]{1,2}|[क-ह])\)|\(([ivxlcdm]{1,4}|[क-ह]{2})\)|\(([A-Z])\)|(Provided\s+(?:further\s+)?that|परन्तु\s*(?:यह\s*और\s*कि|यह\s*कि|कि)?)|(Explanation\s*\d*\.?[-—:]?|स्पष्टीकरण\s*[\d०-९]*\.?[-—:]?)|(Illustration\s*\d*\.?[-—:]?|दृष्टांत\s*[\d०-९]*\.?[-—:]?)|(Exception\s*\d*\.?[-—:]?|अपवाद\s*[\d०-९]*\.?[-—:]?))/gi;

    interface MatchItem {
      index: number;
      markerLength: number;
      marker: string;
      type: LegalClauseNode['type'];
      level: LegalClauseNode['level'];
    }

    const matches: MatchItem[] = [];
    let match: RegExpExecArray | null;

    while ((match = markerRegex.exec(bodyText)) !== null) {
      let rawMarker = '';
      let type: LegalClauseNode['type'] = 'clause';
      let level: LegalClauseNode['level'] = 2;

      if (match[1]) {
        rawMarker = `(${match[1]})`;
        type = 'subsection';
        level = 1;
      } else if (match[2]) {
        rawMarker = `(${match[2]})`;
        type = 'clause';
        level = 2;
      } else if (match[3]) {
        rawMarker = `(${match[3]})`;
        type = 'subclause';
        level = 3;
      } else if (match[4]) {
        rawMarker = `(${match[4]})`;
        type = 'subsubclause';
        level = 4;
      } else if (match[5]) {
        rawMarker = match[5].trim();
        type = 'proviso';
        level = 2;
      } else if (match[6]) {
        rawMarker = match[6].trim();
        type = 'explanation';
        level = 2;
      } else if (match[7]) {
        rawMarker = match[7].trim();
        type = 'illustration';
        level = 2;
      } else if (match[8]) {
        rawMarker = match[8].trim();
        type = 'exception';
        level = 2;
      } else {
        continue;
      }

      // Calculate exact start index of rawMarker in bodyText (skipping any matched punctuation like ; or .)
      const matchOffset = match[0].lastIndexOf(rawMarker);
      const markerStartIndex = matchOffset !== -1 ? match.index + matchOffset : match.index;
      const precedingText = bodyText.substring(Math.max(0, markerStartIndex - 40), markerStartIndex).trim();

      // Ignore cross references like "sub-section (3) of section 3" or "उपधारा (1) के अधीन"
      const isCrossReference = /\b(sub-section|subsection|section|sec|clause|sub-clause|subclause|article|art|rule|paragraph|para|item|under|of|part|schedule|entry|proviso|explanation|referred\s+to\s+in|specified\s+in|mentioned\s+in)\s*$/i.test(precedingText) ||
        /(?:उपधारा|उप-धारा|धारा|खंड|उप-खंड|उपखंड|अनुच्छेद|नियम|विनियम|पैरा|प्रस्तर|के\s+अधीन|के\s+अनुसार|में\s+निर्दिष्ट|में\s+उल्लिखित)\s*$/.test(precedingText);

      if (isCrossReference) {
        continue;
      }

      matches.push({
        index: markerStartIndex,
        markerLength: rawMarker.length,
        marker: rawMarker,
        type,
        level
      });
    }

    if (matches.length === 0) {
      nodes.push(this.createNode('node-1', 1, '', bodyText, 'clause', footnotesMap));
      return nodes;
    }

    const flatNodes: LegalClauseNode[] = [];
    for (let i = 0; i < matches.length; i++) {
      const curr = matches[i];
      const start = curr.index + curr.markerLength;
      const end = (i + 1 < matches.length) ? matches[i + 1].index : bodyText.length;
      let rawTextSlice = bodyText.substring(start, end).trim();

      // Clean leading punctuation noise (periods, semicolons, colons, commas, dashes, dandas) and trailing noise.
      // These characters are separators between the marker and the clause content, not part of the text itself.
      rawTextSlice = rawTextSlice.replace(/^[\s.;:,\-–—।॥]+/, '').replace(/[\s.;।॥]+$/, '').trim();

      if (!rawTextSlice && i === 0 && matches.length > 1) {
        continue;
      }

      const node = this.createNode(`node-${i + 1}`, curr.level, curr.marker, rawTextSlice, curr.type, footnotesMap);
      flatNodes.push(node);
    }

    return this.buildTreeFromFlatNodes(flatNodes);
  }

  private static createNode(
    id: string,
    level: LegalClauseNode['level'],
    marker: string,
    rawText: string,
    type: LegalClauseNode['type'],
    _footnotesMap: Map<string, LegalFootnote>
  ): LegalClauseNode {
    // Strip all leading noise: whitespace, closing parens, and common punctuation separators.
    // Includes commas, semicolons, hyphens, dashes which may appear as artifacts from data truncation.
    const cleanedRaw = rawText.replace(/^[\s).,:;\-–—।॥]+/, '').trim();
    const termMatch = cleanedRaw.match(/["“]([^"”]+)["”]/);
    const term = termMatch ? termMatch[1].trim() : undefined;

    // First escape any raw HTML entities to prevent XSS / broken layouts
    let cleanText = this.escapeHtml(cleanedRaw);

    // Replace footnote tokens safely
    cleanText = cleanText.replace(/\{FN:(\d+)\}/g, '<sup class="fn-badge" data-fn="$1">[$1]</sup>');

    // Highlight defined terms naturally inline in sentence
    if (term) {
      const escapedTerm = this.escapeHtml(term);
      const termRegex = new RegExp(`(["“]${escapedTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}["”])`, 'g');
      cleanText = cleanText.replace(termRegex, '<strong class="defined-term-inline text-amber-300 font-bold">$1</strong>');
    }

    const fnMatches = Array.from(cleanedRaw.matchAll(/\{FN:(\d+)\}/g));
    const nodeFootnotes: LegalFootnote[] = fnMatches.map(m => ({
      id: `fn-${m[1]}`,
      number: m[1],
      text: `Statutory Amendment Reference [${m[1]}]`
    }));

    return {
      id,
      level,
      marker,
      term,
      rawText: cleanedRaw,
      cleanText,
      type,
      children: [],
      footnotes: nodeFootnotes
    };
  }

  private static buildTreeFromFlatNodes(flatNodes: LegalClauseNode[]): LegalClauseNode[] {
    const rootNodes: LegalClauseNode[] = [];
    const stack: LegalClauseNode[] = [];

    for (const node of flatNodes) {
      while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        rootNodes.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
    }

    return rootNodes;
  }

  private static extractAllDefinedTerms(nodes: LegalClauseNode[]): string[] {
    const terms: string[] = [];

    const collect = (nodeList: LegalClauseNode[]) => {
      for (const n of nodeList) {
        if (n.term && !terms.includes(n.term)) {
          terms.push(n.term);
        }
        if (n.children && n.children.length > 0) {
          collect(n.children);
        }
      }
    };

    collect(nodes);
    return terms;
  }

  private static generateLaymanSummary(title?: string, preamble?: string, nodes?: LegalClauseNode[], rawText?: string): string {
    const secTitle = title || '';
    if (secTitle.toLowerCase().includes('short title') || secTitle.toLowerCase().includes('commencement') || secTitle.includes('संक्षिप्त नाम') || secTitle.includes('प्रारंभ')) {
      return 'Defines the legal title of the Act, geographical jurisdiction, and official date of enforcement.';
    }

    if (secTitle.toLowerCase().includes('definition') || secTitle.includes('परिभाषा')) {
      const termsCount = nodes ? this.extractAllDefinedTerms(nodes).length : 0;
      return `Establishes official legal definitions for ${termsCount > 0 ? termsCount : 'key'} statutory terms used throughout this Act.`;
    }

    if (preamble && nodes && nodes.length > 0) {
      const clausesCount = nodes.length;
      return `Specifies core statutory guidelines and obligations across ${clausesCount} structured clause points.`;
    }

    if (rawText && rawText.length > 50) {
      return `Outlines regulatory requirements, duties, and statutory provisions under this section.`;
    }

    return 'Provides statutory provisions and operational guidelines under this section.';
  }
}