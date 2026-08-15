export interface BareActSection {
  section_number: string;
  title: string;
  clean_title?: string;
  introduction_text?: string;
}

export interface BareActChapter {
  chapterNumber: string;
  title: string;
  sections?: BareActSection[];
}

export interface BareAct {
  _id?: string;
  id?: string;
  shortName: string;
  actName: string;
  name?: string;       // legacy fallback
  title?: string;      // legacy fallback
  year: number;
  description?: string;
  chapterCount?: number;
  sectionCount?: number;
  chapters?: BareActChapter[];
  // Gazette & Regulatory Metadata
  jurisdiction?: string;
  category?: string;
  ministry?: string;
  assentDate?: string;
  commencementDate?: string;
  gazetteRef?: string;
  actNumber?: string;
  tags?: string;
  // Performance pre-calculated cache
  cachedChapterCount?: number;
  cachedSectionCount?: number;
  // Legacy & Alias Resolution Metadata
  legacy_short_names?: string[];
  act_code?: string;
  hierarchical_id?: string;
}

export interface CreateActForm {
  actName: string;
  shortName: string;
  year: number;
  actNumber: string;
  jurisdiction: string;
  category: string;
  ministry: string;
  assentDate: string;
  commencementDate: string;
  gazetteRef: string;
  description: string;
  tags: string;
  initialChapterTitle: string;
  initialSectionTitle: string;
  initialSectionContent: string;
}

export interface CreateActPayload {
  actName: string;
  shortName: string;
  year: number;
  description: string;
  chapters: BareActChapter[];
}

export interface EditMetaForm {
  actName: string;
  shortName: string;
  year: number;
  description: string;
  originalShortName: string;
  jurisdiction?: string;
  category?: string;
  ministry?: string;
  assentDate?: string;
  commencementDate?: string;
  gazetteRef?: string;
  actNumber?: string;
}

export interface EditMetaPayload {
  actName?: string;
  newShortName?: string;
  year?: number;
  description?: string;
  jurisdiction?: string;
  category?: string;
  ministry?: string;
  assentDate?: string;
  commencementDate?: string;
  gazetteRef?: string;
  actNumber?: string;
}