import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface BareActSummary {
  _id: string;
  actName: string;
  shortName: string;
  year: number;
  description: string;
}

export interface Section {
  section_number: string;
  title: string;
  content: string;
}

export interface Chapter {
  chapterNumber: string;
  title: string;
  sections: Section[];
}

export interface BareAct extends BareActSummary {
  chapters: Chapter[];
}

@Injectable({ providedIn: 'root' })
export class LegalService {
  private apiUrl = 'http://localhost:8888/api/legal';

  constructor(private http: HttpClient) {}

  getAllActs() {
    return this.http.get<{ success: boolean; count: number; data: BareActSummary[] }>
      (`${this.apiUrl}/acts`);
  }

  getActByShortName(shortName: string) {
    return this.http.get<{ success: boolean; data: BareAct }>
      (`${this.apiUrl}/acts/${shortName}`);
  }
}
