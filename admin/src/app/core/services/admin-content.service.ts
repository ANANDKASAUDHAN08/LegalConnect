import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminContentService {
  private readonly NODE_API = environment.nodeUrl;
  private helplinesCache$?: Observable<any>;

  constructor(private http: HttpClient) { }

  // ── Legal Content (Bare Acts & Sections) ──
  getActs(): Observable<any> {
    return this.http.get(`${this.NODE_API}/legal/acts?refresh=true`);
  }

  getActDetail(shortName: string): Observable<any> {
    return this.http.get(`${this.NODE_API}/legal/acts/${shortName}?refresh=true`);
  }

  updateSection(shortName: string, sectionId: string, data: any): Observable<any> {
    return this.http.put(`${this.NODE_API}/legal/admin/sections/${sectionId}`, { shortName, ...data });
  }

  // ── Legal Resources ──
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

  // ── Helplines & Emergency Directories ──
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

  // ── Template & Draft Catalog ──
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