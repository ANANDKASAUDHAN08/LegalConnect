import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
}

@Injectable({
  providedIn: 'root'
})
export class LegalService {
  private apiUrl = 'http://localhost:8888/api/legal';

  constructor(private http: HttpClient) { }

  getActs(): Observable<ApiResponse<BareAct[]>> {
    return this.http.get<ApiResponse<BareAct[]>>(`${this.apiUrl}/acts`);
  }

  getHelpNearMe(category: string, location: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/help-near-me?category=${encodeURIComponent(category)}&location=${encodeURIComponent(location)}`);
  }

  getActByShortName(shortName: string, refresh = false): Observable<ApiResponse<BareAct>> {
    const url = refresh ? `${this.apiUrl}/acts/${shortName}?refresh=true` : `${this.apiUrl}/acts/${shortName}`;
    return this.http.get<ApiResponse<BareAct>>(url);
  }

  getActOutline(shortName: string, refresh = false): Observable<ApiResponse<BareAct>> {
    const url = refresh ? `${this.apiUrl}/acts/${shortName}/outline?refresh=true` : `${this.apiUrl}/acts/${shortName}/outline`;
    return this.http.get<ApiResponse<BareAct>>(url);
  }

  getSection(shortName: string, sectionNumber: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/acts/${shortName}/sections/${sectionNumber}?t=${Date.now()}`);
  }

  searchLaws(query: string): Observable<ApiResponse<SearchResultItem[]>> {
    return this.http.get<ApiResponse<SearchResultItem[]>>(`${this.apiUrl}/search?q=${encodeURIComponent(query)}`);
  }

  getTransitionMapping(act: string, section: string): Observable<TransitionMappingResult> {
    return this.http.get<TransitionMappingResult>(`${this.apiUrl}/mapping?act=${encodeURIComponent(act)}&section=${encodeURIComponent(section)}`);
  }

  getMappingSuggestions(query: string): Observable<ApiResponse<MappingSuggestion[]>> {
    return this.http.get<ApiResponse<MappingSuggestion[]>>(`${this.apiUrl}/mapping/suggestions?q=${encodeURIComponent(query)}`);
  }

  getSectionSummary(shortName: string, sectionNumber: string): Observable<ApiResponse<{summary: string, cached: boolean}>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/acts/${shortName}/sections/${sectionNumber}/summary`);
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
}
