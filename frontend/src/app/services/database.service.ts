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
    const q = query.toLowerCase();
    return this.sections.filter(sec => 
      (sec.title && sec.title.toLowerCase().includes(q)) ||
      (sec.content && sec.content.toLowerCase().includes(q))
    ).toArray();
  }
}

