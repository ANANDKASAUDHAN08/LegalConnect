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
  type: 'subsection' | 'clause' | 'subclause' | 'subsubclause' | 'proviso' | 'explanation' | 'illustration' | 'preamble';
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
    const footnotesMap: Map<string, LegalFootnote> = new Map();

    const { textWithFootnoteMarkers, footnotes } = this.extractFootnotes(trimmed, footnotesMap);

    const preambleMatch = textWithFootnoteMarkers.match(/^(In this Act[^—\n]*[—:]?|Provided that|Save as otherwise provided[^—\n]*[—:]?)/i);
    let preamble = '';
    let bodyText = textWithFootnoteMarkers;

    if (preambleMatch && preambleMatch[0].length < 150) {
      preamble = preambleMatch[0].trim();
      bodyText = textWithFootnoteMarkers.substring(preamble.length).trim();
    }

    const nodes = this.parseClauseTree(bodyText, footnotesMap);
    const definedTerms = this.extractAllDefinedTerms(nodes);
    const laymanSummary = this.generateLaymanSummary(sectionTitle, preamble, nodes, rawText);

    return {
      preamble,
      nodes,
      footnotes,
      laymanSummary,
      definedTerms,
      hasStructure: nodes.length > 0 || preamble.length > 0
    };
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

    result = result.replace(/\s+/g, ' ').trim();
    return { textWithFootnoteMarkers: result, footnotes };
  }

  private static parseClauseTree(bodyText: string, footnotesMap: Map<string, LegalFootnote>): LegalClauseNode[] {
    const nodes: LegalClauseNode[] = [];
    if (!bodyText) return nodes;

    const markerRegex = /(?:\s|^)(?:\(([0-9]{1,3}[A-Z]*)\)|\(([a-z]{1,3})\)|\(([ivxlcdm]+)\)|\(([A-Z]{1,2})\)|(Provided\s+that|Provided\s+further\s+that)|(Explanation\s*\d*\.?—?)|(Illustration\s*\d*\.?—?))/gi;

    const matches: { index: number; marker: string; type: LegalClauseNode['type']; level: LegalClauseNode['level'] }[] = [];
    let match: RegExpExecArray | null;

    while ((match = markerRegex.exec(bodyText)) !== null) {
      const matchIndex = match.index;
      const precedingText = bodyText.substring(Math.max(0, matchIndex - 35), matchIndex).trim();

      const isCrossReference = /\b(sub-section|subsection|section|sec|clause|sub-clause|subclause|article|art|rule|paragraph|para|item|under|of)\s*$/i.test(precedingText);

      if (isCrossReference) {
        continue;
      }

      const fullMarker = match[0].trim();
      let type: LegalClauseNode['type'] = 'clause';
      let level: LegalClauseNode['level'] = 2;

      if (match[1]) {
        type = 'subsection';
        level = 1;
      } else if (match[2]) {
        type = 'clause';
        level = 2;
      } else if (match[3]) {
        type = 'subclause';
        level = 3;
      } else if (match[4]) {
        type = 'subsubclause';
        level = 4;
      } else if (match[5]) {
        type = 'proviso';
        level = 2;
      } else if (match[6]) {
        type = 'explanation';
        level = 2;
      } else if (match[7]) {
        type = 'illustration';
        level = 2;
      }

      matches.push({ index: matchIndex, marker: fullMarker, type, level });
    }

    if (matches.length === 0) {
      nodes.push(this.createNode('node-1', 1, '', bodyText, 'clause', footnotesMap));
      return nodes;
    }

    const flatNodes: LegalClauseNode[] = [];
    for (let i = 0; i < matches.length; i++) {
      const curr = matches[i];
      const start = curr.index + curr.marker.length;
      const end = (i + 1 < matches.length) ? matches[i + 1].index : bodyText.length;
      const rawTextSlice = bodyText.substring(start, end).trim();

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
    const cleanedRaw = rawText.replace(/^[\s\)\.\:-]+/, '').trim();
    const termMatch = cleanedRaw.match(/["“]([^"”]+)["”]/);
    const term = termMatch ? termMatch[1].trim() : undefined;

    let cleanText = cleanedRaw.replace(/\{FN:(\d+)\}/g, '<sup class="fn-badge" data-fn="$1">[$1]</sup>');

    if (term) {
      const termRegex = new RegExp(`(["“]${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}["”])`, 'g');
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
    if (secTitle.toLowerCase().includes('short title') || secTitle.toLowerCase().includes('commencement')) {
      return 'Defines the legal title of the Act, geographical jurisdiction, and official date of enforcement.';
    }

    if (secTitle.toLowerCase().includes('definition')) {
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