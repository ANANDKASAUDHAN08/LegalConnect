import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Section {
  section_number: string;
  title: string;
  content: string;
  aiSummary?: string;
}

export interface Chapter {
  chapterNumber: string;
  title: string;
  sections: Section[];
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
  actName: string;
  shortName: string;
  year: number;
  description: string;
  chapters: { chapterNumber: string, title: string, sectionsCount: number }[];
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
  private apiUrl = 'http://localhost:5000/api/legal';

  constructor(private http: HttpClient) { }

  getActs(): Observable<ApiResponse<BareAct[]>> {
    return this.http.get<ApiResponse<BareAct[]>>(`${this.apiUrl}/acts`);
  }

  getActByShortName(shortName: string): Observable<ApiResponse<BareAct>> {
    return this.http.get<ApiResponse<BareAct>>(`${this.apiUrl}/acts/${shortName}`);
  }

  getSection(shortName: string, sectionNumber: string): Observable<ApiResponse<{chapter: string, section_number: string, title: string, content: string, aiSummary?: string}>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/acts/${shortName}/sections/${sectionNumber}`);
  }

  searchLaws(query: string): Observable<ApiResponse<SearchResultItem[]>> {
    return this.http.get<ApiResponse<SearchResultItem[]>>(`${this.apiUrl}/search?q=${encodeURIComponent(query)}`);
  }

  getSectionSummary(shortName: string, sectionNumber: string): Observable<ApiResponse<{summary: string, cached: boolean}>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/acts/${shortName}/sections/${sectionNumber}/summary`);
  }
}
