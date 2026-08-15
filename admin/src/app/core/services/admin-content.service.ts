import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

import { BareAct, CreateActPayload, EditMetaPayload } from '../../pages/legal-content/legal-content.models';

@Injectable({ providedIn: 'root' })
export class AdminContentService {
  private readonly NODE_API = environment.nodeUrl;
  private helplinesCache$?: Observable<any>;

  constructor(private http: HttpClient) { }

  // -- Legal Content (Bare Acts & Sections) --
  getActs(): Observable<BareAct[] | { data?: BareAct[]; acts?: BareAct[]; items?: BareAct[] }> {
    return this.http.get<any>(`${this.NODE_API}/acts?refresh=true`);
  }

  createAct(data: CreateActPayload | any): Observable<BareAct> {
    return this.http.post<BareAct>(`${this.NODE_API}/admin/acts`, data);
  }

  getActDetail(shortName: string): Observable<BareAct> {
    return this.http.get<BareAct>(`${this.NODE_API}/acts/${shortName}?refresh=true`);
  }

  updateSection(shortName: string, sectionId: string, data: any): Observable<any> {
    return this.http.put(`${this.NODE_API}/admin/sections/${sectionId}`, { shortName, ...data });
  }

  translateSectionWithAi(data: { actName: string; shortName: string; section_number: string; title: string; introduction_text: string }): Observable<any> {
    return this.http.post(`${this.NODE_API}/admin/ai/translate-section`, data);
  }

  enhanceSectionWithAi(data: { actName: string; shortName: string; section_number: string; title: string; introduction_text: string }): Observable<any> {
    return this.http.post(`${this.NODE_API}/admin/ai/enhance-section`, data);
  }

  patchActMetadata(shortName: string, data: EditMetaPayload): Observable<any> {
    return this.http.patch(`${this.NODE_API}/admin/acts/${shortName}/metadata`, data);
  }

  deleteAct(shortName: string): Observable<any> {
    return this.http.delete(`${this.NODE_API}/admin/acts/${shortName}`);
  }

  getFavorites(): Observable<any> {
    return this.http.get(`${this.NODE_API}/admin/favorites`);
  }

  toggleFavorite(shortName: string): Observable<any> {
    return this.http.post(`${this.NODE_API}/admin/favorites/toggle`, { shortName });
  }

  getPinnedSections(shortName: string): Observable<{ success: boolean; data: string[] }> {
    return this.http.get<{ success: boolean; data: string[] }>(`${this.NODE_API}/admin/acts/${shortName}/pinned-sections`);
  }

  togglePinnedSection(shortName: string, sectionId: string): Observable<any> {
    return this.http.post(`${this.NODE_API}/admin/acts/${shortName}/pinned-sections/toggle`, { sectionId });
  }

  syncPinnedSections(shortName: string, sectionIds: string[]): Observable<any> {
    return this.http.post(`${this.NODE_API}/admin/acts/${shortName}/pinned-sections/sync`, { sectionIds });
  }

  // -- Legal Resources --
  getResources(params: any = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get(`${this.NODE_API}/admin/resources`, { params: httpParams });
  }

  createResource(data: any): Observable<any> {
    return this.http.post(`${this.NODE_API}/admin/resources`, data);
  }

  updateResource(id: string, data: any): Observable<any> {
    return this.http.put(`${this.NODE_API}/admin/resources/${id}`, data);
  }

  deleteResource(id: string): Observable<any> {
    return this.http.delete(`${this.NODE_API}/admin/resources/${id}`);
  }

  // -- Helplines & Emergency Directories --
  getHelplines(): Observable<any> {
    if (!this.helplinesCache$) {
      this.helplinesCache$ = this.http.get(`${this.NODE_API}/admin/helplines`).pipe(
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }
    return this.helplinesCache$;
  }

  createHelpline(data: any): Observable<any> {
    this.helplinesCache$ = undefined;
    return this.http.post(`${this.NODE_API}/admin/helplines`, data);
  }

  updateHelpline(id: string, data: any): Observable<any> {
    this.helplinesCache$ = undefined;
    return this.http.put(`${this.NODE_API}/admin/helplines/${id}`, data);
  }

  deleteHelpline(id: string): Observable<any> {
    this.helplinesCache$ = undefined;
    return this.http.delete(`${this.NODE_API}/admin/helplines/${id}`);
  }

  // -- Template & Draft Catalog --
  getTemplates(params: any = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get(`${this.NODE_API}/admin/templates`, { params: httpParams });
  }

  deleteTemplate(id: string): Observable<any> {
    return this.http.delete(`${this.NODE_API}/admin/templates/${id}`);
  }
}