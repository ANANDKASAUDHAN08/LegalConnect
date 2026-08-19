import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

import {
  BareAct,
  CreateActPayload,
  EditMetaPayload,
  ApiResponse,
  UpdateSectionPayload,
  AiTranslateSectionRequest,
  AiTranslateSectionResponse,
  AiEnhanceSectionRequest,
  AiEnhanceSectionResponse,
  PinnedSectionsResponse,
  TogglePinnedSectionResponse,
  ToggleFavoriteResponse,
  LegalResourceItem,
  HelplineItem,
  LegalTemplateItem
} from '../../pages/legal-content/legal-content.models';

@Injectable({ providedIn: 'root' })
export class AdminContentService {
  private readonly NODE_API = environment.nodeUrl;
  private helplinesCache$?: Observable<ApiResponse<HelplineItem[]>>;
  private actDetailCache = new Map<string, Observable<BareAct>>();

  constructor(private http: HttpClient) { }

  // -- Legal Content (Bare Acts & Sections) --
  getActs(): Observable<ApiResponse<BareAct[]> | BareAct[] | { data?: BareAct[]; acts?: BareAct[]; items?: BareAct[] }> {
    return this.http.get<any>(`${this.NODE_API}/acts?refresh=true`);
  }

  createAct(data: CreateActPayload | any): Observable<BareAct> {
    return this.http.post<BareAct>(`${this.NODE_API}/admin/acts`, data);
  }

  getActDetail(shortName: string): Observable<BareAct> {
    const key = shortName.toUpperCase();
    if (!this.actDetailCache.has(key)) {
      this.actDetailCache.set(
        key,
        this.http.get<BareAct>(`${this.NODE_API}/acts/${shortName}`).pipe(
          shareReplay({ bufferSize: 1, refCount: true })
        )
      );
    }
    return this.actDetailCache.get(key)!;
  }

  /** Invalidate cached act detail after mutations (save, delete, metadata change) */
  private invalidateActDetailCache(shortName?: string): void {
    if (shortName) {
      this.actDetailCache.delete(shortName.toUpperCase());
    } else {
      this.actDetailCache.clear();
    }
  }

  updateSection(shortName: string, sectionId: string, data: Partial<UpdateSectionPayload> | any): Observable<ApiResponse<void>> {
    this.invalidateActDetailCache(shortName);
    return this.http.put<ApiResponse<void>>(`${this.NODE_API}/admin/sections/${sectionId}`, { shortName, ...data });
  }

  translateSectionWithAi(data: AiTranslateSectionRequest): Observable<AiTranslateSectionResponse> {
    return this.http.post<AiTranslateSectionResponse>(`${this.NODE_API}/admin/ai/translate-section`, data);
  }

  enhanceSectionWithAi(data: AiEnhanceSectionRequest): Observable<AiEnhanceSectionResponse> {
    return this.http.post<AiEnhanceSectionResponse>(`${this.NODE_API}/admin/ai/enhance-section`, data);
  }

  patchActMetadata(shortName: string, data: EditMetaPayload): Observable<ApiResponse<{ actName: string; shortName: string; year: number; description: string }>> {
    this.invalidateActDetailCache(shortName);
    return this.http.patch<ApiResponse<any>>(`${this.NODE_API}/admin/acts/${shortName}/metadata`, data);
  }

  deleteAct(shortName: string): Observable<ApiResponse<void>> {
    this.invalidateActDetailCache(shortName);
    return this.http.delete<ApiResponse<void>>(`${this.NODE_API}/admin/acts/${shortName}`);
  }

  getFavorites(): Observable<ApiResponse<string[]>> {
    return this.http.get<ApiResponse<string[]>>(`${this.NODE_API}/admin/favorites`);
  }

  toggleFavorite(shortName: string): Observable<ToggleFavoriteResponse> {
    return this.http.post<ToggleFavoriteResponse>(`${this.NODE_API}/admin/favorites/toggle`, { shortName });
  }

  getPinnedSections(shortName: string): Observable<PinnedSectionsResponse> {
    return this.http.get<PinnedSectionsResponse>(`${this.NODE_API}/admin/acts/${shortName}/pinned-sections`);
  }

  togglePinnedSection(shortName: string, sectionId: string): Observable<TogglePinnedSectionResponse> {
    return this.http.post<TogglePinnedSectionResponse>(`${this.NODE_API}/admin/acts/${shortName}/pinned-sections/toggle`, { sectionId });
  }

  syncPinnedSections(shortName: string, sectionIds: string[]): Observable<ApiResponse<{ pinnedCount: number }>> {
    return this.http.post<ApiResponse<any>>(`${this.NODE_API}/admin/acts/${shortName}/pinned-sections/sync`, { sectionIds });
  }

  // -- Legal Resources --
  getResources(params: Record<string, any> = {}): Observable<ApiResponse<LegalResourceItem[]>> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get<ApiResponse<LegalResourceItem[]>>(`${this.NODE_API}/admin/resources`, { params: httpParams });
  }

  createResource(data: Partial<LegalResourceItem>): Observable<ApiResponse<LegalResourceItem>> {
    return this.http.post<ApiResponse<LegalResourceItem>>(`${this.NODE_API}/admin/resources`, data);
  }

  updateResource(id: string, data: Partial<LegalResourceItem>): Observable<ApiResponse<LegalResourceItem>> {
    return this.http.put<ApiResponse<LegalResourceItem>>(`${this.NODE_API}/admin/resources/${id}`, data);
  }

  deleteResource(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.NODE_API}/admin/resources/${id}`);
  }

  validateResourceBatch(items: any[]): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.NODE_API}/admin/resources/batch-validate`, { items });
  }

  importResourceBatch(items: any[], duplicateStrategy: string = 'skip'): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.NODE_API}/admin/resources/batch-import`, { items, duplicateStrategy });
  }

  verifyResourceCycle(id: string, data: any = {}): Observable<ApiResponse<LegalResourceItem>> {
    return this.http.patch<ApiResponse<LegalResourceItem>>(`${this.NODE_API}/admin/resources/${id}/verify-cycle`, data);
  }

  bulkUpdateResourceStatus(ids: string[], status: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.NODE_API}/admin/resources/bulk-status`, { ids, status });
  }

  bulkVerifyResourceCycles(ids: string[], notes?: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.NODE_API}/admin/resources/bulk-verify`, { ids, notes });
  }

  bulkDeleteResources(ids: string[]): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.NODE_API}/admin/resources/bulk-delete`, { ids });
  }

  // -- Helplines & Emergency Directories --
  getHelplines(params: Record<string, any> = {}): Observable<ApiResponse<HelplineItem[]>> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get<ApiResponse<HelplineItem[]>>(`${this.NODE_API}/admin/helplines`, { params: httpParams });
  }

  createHelpline(data: Partial<HelplineItem>): Observable<ApiResponse<HelplineItem>> {
    return this.http.post<ApiResponse<HelplineItem>>(`${this.NODE_API}/admin/helplines`, data);
  }

  updateHelpline(id: string, data: Partial<HelplineItem>): Observable<ApiResponse<HelplineItem>> {
    return this.http.put<ApiResponse<HelplineItem>>(`${this.NODE_API}/admin/helplines/${id}`, data);
  }

  deleteHelpline(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.NODE_API}/admin/helplines/${id}`);
  }

  verifyHelplinePing(id: string, data: any = {}): Observable<ApiResponse<HelplineItem>> {
    return this.http.post<ApiResponse<HelplineItem>>(`${this.NODE_API}/admin/helplines/${id}/verify-ping`, data);
  }

  bulkUpdateHelplineStatus(ids: string[], isActive: boolean): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.NODE_API}/admin/helplines/bulk-status`, { ids, isActive });
  }

  // -- Template & Draft Catalog --
  getTemplates(params: Record<string, any> = {}): Observable<ApiResponse<LegalTemplateItem[]>> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get<ApiResponse<LegalTemplateItem[]>>(`${this.NODE_API}/admin/templates`, { params: httpParams });
  }

  deleteTemplate(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.NODE_API}/admin/templates/${id}`);
  }
}