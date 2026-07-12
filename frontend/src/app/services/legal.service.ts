import { Injectable } from '@angular/core';
import { Observable, shareReplay, map, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';

export interface ContentBlock {
  type: 'main' | 'explanation' | 'illustration' | 'clause';
  text: string;
  sentences?: { text: string; globalIndex: number }[];
  clauseIndicator?: string;
}

export interface Section {
  section_number: string;
  title: string;
  title_hi?: string;
  content: string;
  content_hi?: string;
  aiSummary?: string;
  clean_title?: string;
  clean_title_hi?: string;
  introduction_text?: string;
  introduction_text_hi?: string;
  content_blocks?: ContentBlock[];
  content_blocks_hi?: ContentBlock[];
}

export interface Chapter {
  chapterNumber: string;
  title: string;
  sections: Section[];
  cleanTitle?: string;
}

export interface BareAct {
  _id: string;
  actName: string;
  shortName: string;
  year: number;
  description: string;
  chapters: Chapter[];
}

export interface SearchResultItem {
  _id: string;
  section_number: string;
  title: string;
  title_hi?: string;
  actName: string;
  shortName: string;
  year?: number;
  chapterNumber: string;
  snippet: string;
}

export interface MappingSectionDetail {
  section_number: string;
  title: string;
  content: string;
  content_hi?: string;
  chapter: string;
}

export interface MappingActInfo {
  shortName: string;
  actName: string;
}

export interface TransitionMappingResult {
  success: boolean;
  oldAct: MappingActInfo;
  oldSection: MappingSectionDetail | null;
  newAct: MappingActInfo;
  newSection: MappingSectionDetail | null;
  comparison: string;
  fromCache?: boolean;
}

export interface MappingSuggestion {
  act: string;
  section: string;
  title: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  resourceCount: number;
  description: string;
  subcategories: string[];
  breakdown: {
    legalAid: number;
    courts: number;
    govOffices: number;
    helplines: number;
    lawyers: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class LegalService {
  private apiUrl = 'http://localhost:8888/api/legal';
  private actsCache$: Observable<ApiResponse<BareAct[]>> | null = null;
  private actDetailsCache = new Map<string, Observable<ApiResponse<BareAct>>>();
  private actOutlineCache = new Map<string, Observable<ApiResponse<BareAct>>>();

  constructor(private http: HttpClient) { }

  getActs(refresh = false): Observable<ApiResponse<BareAct[]>> {
    if (refresh || !this.actsCache$) {
      const url = refresh ? `${this.apiUrl}/acts?refresh=true&t=${Date.now()}` : `${this.apiUrl}/acts?t=${Date.now()}`;
      this.actsCache$ = this.http.get<ApiResponse<BareAct[]>>(url).pipe(
        map(res => {
          if (res && res.data) {
            res.data = res.data.map(act => {
              const cleanedAct = {
                ...act,
                actName: this.cleanActName(act.actName)
              };
              if (cleanedAct.chapters) {
                cleanedAct.chapters = cleanedAct.chapters.map(ch => this.cleanChapter(ch));
              }
              return cleanedAct;
            });
          }
          return res;
        }),
        shareReplay(1)
      );
    }
    return this.actsCache$;
  }

  getHelpCategories(location: string, lat?: number, lng?: number): Observable<ApiResponse<Category[]>> {
    let url = `${this.apiUrl}/help/categories?location=${encodeURIComponent(location)}`;
    if (lat !== undefined && lng !== undefined) {
      url += `&lat=${lat}&lng=${lng}`;
    }
    return this.http.get<ApiResponse<Category[]>>(url);
  }

  getHelpStats(): Observable<ApiResponse<{ legalClinics: number, distCourts: number, verifiedLawyers: number }>> {
    return this.http.get<ApiResponse<{ legalClinics: number, distCourts: number, verifiedLawyers: number }>>(`${this.apiUrl}/help/stats`);
  }

  getHelpNearMe(category: string, location: string, state?: string, lat?: number, lng?: number): Observable<ApiResponse<any>> {
    let url = `${this.apiUrl}/help-near-me?category=${encodeURIComponent(category)}&location=${encodeURIComponent(location)}`;
    if (state) {
      url += `&state=${encodeURIComponent(state)}`;
    }
    if (lat !== undefined && lat !== null) {
      url += `&lat=${lat}`;
    }
    if (lng !== undefined && lng !== null) {
      url += `&lng=${lng}`;
    }
    return this.http.get<ApiResponse<any>>(url);
  }

  /** Fetch all SLSA + NALSA authorities (for the Legal Authorities Hub state picker) */
  private allAuthoritiesCache$: Observable<any[]> | null = null;
  getAllAuthorities(): Observable<any[]> {
    if (!this.allAuthoritiesCache$) {
      this.allAuthoritiesCache$ = this.http.get<ApiResponse<any[]>>(
        `${this.apiUrl}/all-authorities`
      ).pipe(
        map(res => res?.data || []),
        shareReplay(1)
      );
    }
    return this.allAuthoritiesCache$;
  }

  getActByShortName(shortName: string, refresh = false): Observable<ApiResponse<BareAct>> {
    if (refresh || !this.actDetailsCache.has(shortName)) {
      const url = refresh ? `${this.apiUrl}/acts/${shortName}?refresh=true&t=${Date.now()}` : `${this.apiUrl}/acts/${shortName}?t=${Date.now()}`;
      const obs = this.http.get<ApiResponse<BareAct>>(url).pipe(
        map(res => {
          if (res && res.data) {
            res.data.actName = this.cleanActName(res.data.actName);
            if (res.data.chapters) {
              res.data.chapters = res.data.chapters.map(ch => this.cleanChapter(ch));
            }
          }
          return res;
        }),
        shareReplay(1)
      );
      this.actDetailsCache.set(shortName, obs);
    }
    return this.actDetailsCache.get(shortName)!;
  }

  getActOutline(shortName: string, refresh = false): Observable<ApiResponse<BareAct>> {
    if (refresh || !this.actOutlineCache.has(shortName)) {
      const url = refresh ? `${this.apiUrl}/acts/${shortName}/outline?refresh=true&t=${Date.now()}` : `${this.apiUrl}/acts/${shortName}/outline?t=${Date.now()}`;
      const obs = this.http.get<ApiResponse<BareAct>>(url).pipe(
        map(res => {
          if (res && res.data) {
            res.data.actName = this.cleanActName(res.data.actName);
            if (res.data.chapters) {
              res.data.chapters = res.data.chapters.map(ch => this.cleanChapter(ch));
            }
          }
          return res;
        }),
        shareReplay(1)
      );
      this.actOutlineCache.set(shortName, obs);
    }
    return this.actOutlineCache.get(shortName)!;
  }

  cleanChapter(ch: Chapter): Chapter {
    let chapterNumber = ch.chapterNumber || '';
    let title = ch.title || '';

    // Remove "CHAPTER " or "Chapter " prefix from chapterNumber
    if (chapterNumber.toUpperCase().startsWith('CHAPTER ')) {
      chapterNumber = chapterNumber.substring(8).trim();
    } else if (chapterNumber.toUpperCase().startsWith('CHAPTER')) {
      chapterNumber = chapterNumber.substring(7).trim();
    }

    // Fix spacing typos in title (e.g. "Authorityof" -> "Authority of")
    const cleanTitle = this.fixTitleSpacing(title);

    return {
      ...ch,
      chapterNumber,
      title: cleanTitle
    };
  }

  fixTitleSpacing(title: string): string {
    if (!title) return '';
    return title
      // Fix uppercase joined words
      .replace(/\b([A-Z]+)OF\b/g, '$1 OF')
      .replace(/\b([A-Z]+)AND\b/g, '$1 AND')
      .replace(/\b([A-Z]+)OR\b/g, '$1 OR')
      .replace(/\b([A-Z]+)IN\b/g, '$1 IN')
      .replace(/\b([A-Z]+)TO\b/g, '$1 TO')
      // Fix mixed/lowercase joined words
      .replace(/\b([A-Za-z]+)of\b/g, '$1 of')
      .replace(/\b([A-Za-z]+)and\b/g, '$1 and')
      .replace(/\b([A-Za-z]+)or\b/g, '$1 or')
      .replace(/\b([A-Za-z]+)in\b/g, '$1 in')
      .replace(/\b([A-Za-z]+)to\b/g, '$1 to')
      // Fix specific case-insensitive word pairs
      .replace(/\b(Authority)of(India)\b/ig, '$1 of $2')
      .replace(/\b(Protection)of(Information)\b/ig, '$1 of $2')
      .replace(/\b(Offences)and(Penalties)\b/ig, '$1 and $2')
      .replace(/\s+/g, ' ')
      .trim();
  }

  getSection(shortName: string, sectionNumber: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/acts/${shortName}/sections/${sectionNumber}?t=${Date.now()}`);
  }

  searchLaws(query: string, page = 1, limit = 20): Observable<ApiResponse<SearchResultItem[]>> {
    const url = `${this.apiUrl}/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
    return this.http.get<ApiResponse<SearchResultItem[]>>(url).pipe(
      map(res => {
        if (res && res.data) {
          res.data = res.data.map(item => ({
            ...item,
            actName: this.cleanActName(item.actName)
          }));
        }
        return res;
      })
    );
  }

  searchHub(query: string, city = '', limit = 3, lat?: number, lng?: number): Observable<ApiResponse<{ laws: any[], lawyers: any[], resources: any[] }>> {
    let url = `${this.apiUrl}/search-hub?q=${encodeURIComponent(query)}&city=${encodeURIComponent(city)}&limit=${limit}`;
    if (lat !== undefined && lng !== undefined) {
      url += `&lat=${lat}&lng=${lng}`;
    }
    return this.http.get<ApiResponse<any>>(url).pipe(
      map(res => {
        if (res && res.data) {
          if (res.data.laws) {
            res.data.laws = res.data.laws.map((item: any) => ({
              ...item,
              actName: this.cleanActName(item.actName)
            }));
          }
          if (res.data.lawyers) {
            res.data.lawyers = res.data.lawyers.map((item: any) => ({
              ...item,
              name: this.cleanActName(item.name)
            }));
          }
        }
        return res;
      })
    );
  }

  getTransitionMapping(act: string, section: string): Observable<TransitionMappingResult> {
    return this.http.get<TransitionMappingResult>(`${this.apiUrl}/mapping?act=${encodeURIComponent(act)}&section=${encodeURIComponent(section)}`).pipe(
      map(res => {
        if (res) {
          if (res.oldAct) res.oldAct.actName = this.cleanActName(res.oldAct.actName);
          if (res.newAct) res.newAct.actName = this.cleanActName(res.newAct.actName);
        }
        return res;
      })
    );
  }

  getMappingSuggestions(query: string): Observable<ApiResponse<MappingSuggestion[]>> {
    return this.http.get<ApiResponse<MappingSuggestion[]>>(`${this.apiUrl}/mapping/suggestions?q=${encodeURIComponent(query)}`);
  }

  getSectionSummary(shortName: string, sectionNumber: string): Observable<ApiResponse<{ summary: string, cached: boolean }>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/acts/${shortName}/sections/${sectionNumber}/summary?t=${Date.now()}`);
  }

  getSectionSummaryStream(shortName: string, sectionNumber: string): Observable<string> {
    return new Observable<string>(observer => {
      const url = `${this.apiUrl}/acts/${shortName}/sections/${sectionNumber}/summary/stream`;
      const eventSource = new EventSource(url);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.chunk) {
            observer.next(data.chunk);
          }
        } catch (e) {
          console.error('Failed to parse SSE message:', e);
        }
      };

      eventSource.addEventListener('end', () => {
        observer.complete();
        eventSource.close();
      });

      eventSource.addEventListener('error', (event: any) => {
        console.error('SSE Error:', event);
        observer.error(new Error('Streaming failed or was interrupted.'));
        eventSource.close();
      });

      return () => {
        eventSource.close();
      };
    });
  }

  askLegalQuestion(question: string): Observable<{ success: boolean; answer: string; suggestedActs: string[] }> {
    return this.http.post<{ success: boolean; answer: string; suggestedActs: string[] }>(
      `${this.apiUrl}/ask`,
      { question }
    );
  }

  translateSection(shortName: string, sectionNumber: string, force = false): Observable<ApiResponse<{ content_hi: string; title_hi: string; clean_title_hi?: string; introduction_text_hi?: string; content_blocks_hi?: ContentBlock[]; cached: boolean }>> {
    return this.http.post<ApiResponse<{ content_hi: string; title_hi: string; clean_title_hi?: string; introduction_text_hi?: string; content_blocks_hi?: ContentBlock[]; cached: boolean }>>(
      `${this.apiUrl}/acts/${shortName}/sections/${sectionNumber}/translate`,
      { force }
    );
  }

  chatAboutSection(shortName: string, sectionNumber: string, question: string): Observable<{ success: boolean; answer: string }> {
    return this.http.post<{ success: boolean; answer: string }>(
      `${this.apiUrl}/acts/${shortName}/sections/${sectionNumber}/chat`,
      { question }
    );
  }

  cleanActName(name: string): string {
    if (!name) return '';
    let cleaned = name.trim();

    // 1. Remove leading backticks, stray quotes, or symbols
    cleaned = cleaned.replace(/^[`'\s",.—-]+/, '');
    cleaned = cleaned.replace(/[`'\s",.—-]+$/, '');

    // 2. Fix spaced-out letters (e.g. "T H E   L I G H T H O U S E   A C T")
    const spaceCharMatch = cleaned.match(/\b([A-Z0-9]\s){3,}/g);
    if (spaceCharMatch) {
      cleaned = cleaned.replace(/\s{2,}/g, ' _WORD_SEP_ ');
      cleaned = cleaned.replace(/([A-Z0-9])\s+(?=[A-Z0-9]\b)/g, '$1');
      cleaned = cleaned.replace(/_WORD_SEP_/g, ' ');
      cleaned = cleaned.replace(/\s+/g, ' ');
    }

    // 3. Fix spacing around punctuation (e.g. "ACT , 1927" -> "ACT, 1927")
    cleaned = cleaned.replace(/\s+([,.:;?!])\s*/g, '$1 ');

    // 4. Convert to Title Case for readability
    return this.toTitleCase(cleaned);
  }

  private toTitleCase(str: string): string {
    const minorWords = ['and', 'or', 'but', 'a', 'an', 'the', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'per', 'to', 'is', 'with', 'from', 'into'];
    return str.toLowerCase().split(' ').map((word, index) => {
      let cleanWord = word;
      let prefix = '';
      let suffix = '';
      if (word.startsWith('(')) {
        prefix = '(';
        cleanWord = word.slice(1);
      }
      if (word.endsWith(')')) {
        suffix = ')';
        cleanWord = cleanWord.slice(0, -1);
      }

      if (index > 0 && minorWords.includes(cleanWord) && !word.startsWith('(')) {
        return word;
      }

      // Keep Roman numerals and legal acronyms uppercase
      if (/^(ix|iv|v?i{0,3}|bns|bnss|bsa|ipc|crpc|iea|cpc|mva|nia|hma|ida)$/i.test(cleanWord)) {
        return prefix + cleanWord.toUpperCase() + suffix;
      }

      return prefix + cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1) + suffix;
    }).join(' ');
  }

  suggestResource(resource: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/suggest-resource`, resource);
  }

  getAdminResources(filters: any): Observable<ApiResponse<any>> {
    let params = `?page=${filters.page || 1}&limit=${filters.limit || 10}`;
    if (filters.status) params += `&status=${encodeURIComponent(filters.status)}`;
    if (filters.city) params += `&city=${encodeURIComponent(filters.city)}`;
    if (filters.type) params += `&type=${encodeURIComponent(filters.type)}`;
    if (filters.search) params += `&search=${encodeURIComponent(filters.search)}`;
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/admin/resources${params}`);
  }

  createAdminResource(resource: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/admin/resources`, resource);
  }

  updateAdminResource(id: string, resource: any): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.apiUrl}/admin/resources/${id}`, resource);
  }

  deleteAdminResource(id: string): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/admin/resources/${id}`);
  }

  // AI Scenario Solver — calls Gemini to parse natural-language legal situations
  solveAiScenario(description: string): Observable<{
    success: boolean;
    category: string;
    subcategories: string[];
    caseSummary: string;
    roadmapSteps: { title: string; detail: string }[];
  }> {
    return this.http.post<any>(`${this.apiUrl}/help/ai-solve`, { description });
  }

  // Offline Case Pack Sync — sends all localStorage case packs to the server (requires auth)
  syncCasePacks(packs: any[]): Observable<{ success: boolean; synced: number; message: string }> {
    return this.http.post<any>(`${this.apiUrl}/case-packs/sync`, { packs }, { withCredentials: true });
  }

  // Fetch user's server-synced case packs
  getSyncedCasePacks(): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<any>(`${this.apiUrl}/case-packs`, { withCredentials: true });
  }

  // Fetch details for a single resource by its MongoDB ID
  getResourceById(id: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/resources/${id}`);
  }

  // Fetch all emergency helplines
  getAllHelplines(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/helplinesAll`);
  }

  // Fetch all approved legal aid/courts resources
  getAllResources(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/resourcesAll`);
  }

  // Fetch helplines details for specific IDs
  getHelplinesByIds(ids: string[]): Observable<ApiResponse<any[]>> {
    if (!ids || ids.length === 0) {
      return of({ success: true, data: [] });
    }
    return this.http.post<ApiResponse<any[]>>(`${this.apiUrl}/helplines/batch`, { ids });
  }

  // Fetch resources details for specific IDs
  getResourcesByIds(ids: string[]): Observable<ApiResponse<any[]>> {
    if (!ids || ids.length === 0) {
      return of({ success: true, data: [] });
    }
    return this.http.post<ApiResponse<any[]>>(`${this.apiUrl}/resources/batch`, { ids });
  }

  // Delete a synced case pack roadmap from server
  deleteCasePack(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<any>(`${this.apiUrl}/case-packs/${id}`, { withCredentials: true });
  }
}