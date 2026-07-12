import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';

export interface LocalAct {
  id?: number;
  shortName: string;
  actName: string;
  year: string;
  description: string;
  fullText: string;
  chapters?: any[];
  lastSynced: Date;
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService extends Dexie {
  acts!: Table<LocalAct, number>;
  sections!: Table<any, number>;

  constructor() {
    super('LegalConnectDB');
    this.version(2).stores({
      acts: '++id, shortName, actName, fullText',
      sections: '++id, actShortName, section_number, [actShortName+section_number]'
    });
  }

  /** Sync a list of acts from the API into IndexedDB for offline access */
  async syncActs(apiActs: any[]) {
    const now = new Date();
    for (const act of apiActs) {
      // Build a flat fullText blob from all section contents for search
      const fullText = (act.chapters || [])
        .flatMap((ch: any) => ch.sections || [])
        .map((s: any) => `${s.title} ${s.content || ''}`)
        .join(' ');

      const localAct: LocalAct = {
        shortName: act.shortName,
        actName: act.actName,
        year: String(act.year),
        description: act.description || '',
        fullText,
        chapters: act.chapters || [],
        lastSynced: now
      };

      await this.saveAct(localAct);
    }
  }

  async saveAct(act: LocalAct) {
    const existing = await this.getActByShortName(act.shortName);
    if (existing?.id) {
      act.id = existing.id;
    }
    await this.acts.put(act);
  }

  async getActByShortName(shortName: string): Promise<LocalAct | undefined> {
    return this.acts.where('shortName').equals(shortName).first();
  }

  async getAllActs(): Promise<LocalAct[]> {
    return this.acts.toArray();
  }

  async searchActs(query: string): Promise<LocalAct[]> {
    const q = query.toLowerCase();
    return this.acts.filter(act =>
      act.actName.toLowerCase().includes(q) ||
      act.shortName.toLowerCase().includes(q) ||
      act.description.toLowerCase().includes(q) ||
      act.fullText.toLowerCase().includes(q)
    ).toArray();
  }

  async getCount(): Promise<number> {
    return this.acts.count();
  }

  // --- Section-level caching methods ---
  async getLocalSection(actShortName: string, sectionNumber: string): Promise<any | undefined> {
    return this.sections.where('[actShortName+section_number]').equals([actShortName, sectionNumber]).first();
  }

  async saveLocalSection(section: any) {
    const existing = await this.getLocalSection(section.actShortName, section.section_number);
    if (existing?.id) {
      section.id = existing.id;
    }
    await this.sections.put(section);
  }

  async searchSections(query: string): Promise<any[]> {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    // Parse potential Act and Section Number
    let actMatch: string | null = null;
    let sectionMatch: string | null = null;

    // Common Act Shortnames
    const acts = ['bns', 'bnss', 'bsa', 'ipc', 'crpc', 'iea', 'cpc', 'nia', 'hma', 'ida', 'mv', 'mva'];
    for (const act of acts) {
      if (new RegExp(`\\b${act}\\b`, 'i').test(q)) {
        actMatch = act.toUpperCase();
        break;
      }
    }

    // Section number pattern (e.g. "Section 19", "Sec 19", "Sec. 19", or just "19" in context of act)
    const secRegex = /(?:section|sec\.?)\s*([0-9A-Za-z]+)/i;
    const match = q.match(secRegex);
    if (match) {
      sectionMatch = match[1];
    } else {
      // If we matched an act and there is a number in the query, treat it as the section number
      const numMatch = q.match(/\b([0-9A-Za-z]+)\b/);
      if (numMatch && actMatch) {
        sectionMatch = numMatch[1];
      }
    }

    // If we have an explicit act and section number, try to do a fast indexed query first
    if (actMatch && sectionMatch) {
      const direct = await this.sections
        .where('[actShortName+section_number]')
        .equals([actMatch, sectionMatch])
        .toArray();
      if (direct.length > 0) {
        return direct;
      }
    }

    // Split query into keywords (longer than 2 characters) for basic word matching
    const keywords = q.split(/[\s,.:;'"?()!-]+/)
      .filter(w => w.length > 2 && !['section', 'under', 'acts', 'laws', 'clause'].includes(w));

    if (keywords.length === 0) {
      return this.sections.filter(sec => 
        (sec.title && sec.title.toLowerCase().includes(q)) ||
        (sec.content && sec.content.toLowerCase().includes(q))
      ).toArray();
    }

    // Check if sections contain keywords (must match at least 50% of the keywords or contain the section number)
    return this.sections.filter(sec => {
      // If section number is specified in query and this matches, prioritize
      if (sectionMatch && sec.section_number && sec.section_number.toLowerCase() === sectionMatch.toLowerCase()) {
        if (!actMatch || (sec.actShortName && sec.actShortName.toUpperCase() === actMatch)) {
          return true;
        }
      }

      let matchCount = 0;
      const titleLower = (sec.title || '').toLowerCase();
      const contentLower = (sec.content || '').toLowerCase();

      for (const kw of keywords) {
        if (titleLower.includes(kw) || contentLower.includes(kw)) {
          matchCount++;
        }
      }

      // Return true if at least 1 keyword matches (or at least half if there are multiple keywords)
      const threshold = Math.max(1, Math.ceil(keywords.length / 2));
      return matchCount >= threshold;
    }).toArray();
  }
}

