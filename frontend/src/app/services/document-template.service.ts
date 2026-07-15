import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface TemplateField {
  key: string;
  label: string;
  placeholder: string;
  type: string;
  defaultValue: string;
  helpTip?: string;
}

export interface Template {
  id: string;
  title: string;
  actRef: string;
  category: string;
  description: string;
  fields: TemplateField[];
  body: string;
  isCustom?: boolean;
  synced?: boolean;
  jurisdiction?: string;
  highlightedTitle?: string;
  highlightedDescription?: string;
}

export interface Draft {
  id: string;
  templateId: string;
  title: string;
  updatedAt: string;
  values: { [key: string]: string };
  customBody?: string;
  synced?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentTemplateService {
  private draftsKey = 'lc_vault_drafts_v2';
  private customTemplatesKey = 'lc_custom_templates';

  private draftsUrl = 'http://localhost:8888/api/legal/drafts';
  private templatesUrl = 'http://localhost:8888/api/legal/templates';

  private draftsSubject = new BehaviorSubject<Draft[]>([]);
  drafts$ = this.draftsSubject.asObservable();

  private customTemplatesSubject = new BehaviorSubject<Template[]>([]);
  customTemplates$ = this.customTemplatesSubject.asObservable();

  private isLoggedIn = false;

  // Throttled autosave queue
  private autosaveQueue = new Subject<{ draft: Draft, triggerApi: boolean }>();

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {
    // Reactive Auth State Sync
    this.auth.isLoggedIn$.subscribe(loggedIn => {
      this.isLoggedIn = loggedIn;
      this.loadAllData();
    });

    // Wire up debounced save processing (500ms)
    this.autosaveQueue.pipe(
      debounceTime(500)
    ).subscribe(item => {
      if (item) {
        this.executeAutosave(item.draft, item.triggerApi);
      }
    });

    // Offline auto-sync listener
    window.addEventListener('online', () => {
      console.log('Browser back online, syncing pending drafts and custom templates...');
      this.syncPendingDrafts();
      this.syncPendingTemplates();
    });
  }

  private loadAllData() {
    this.loadCustomTemplates();
    this.loadDrafts();
  }

  // --- DRAFTS PERSISTENCE FLOW ---

  private loadDrafts() {
    if (this.isLoggedIn) {
      this.http.get<{ success: boolean; data: Draft[] }>(this.draftsUrl).subscribe({
        next: (res) => {
          if (res && res.success && res.data) {
            const draftsWithSync = res.data.map(d => ({ ...d, synced: true }));
            this.draftsSubject.next(draftsWithSync);
            localStorage.setItem(this.draftsKey, JSON.stringify(draftsWithSync));
          } else {
            this.loadLocalDrafts();
          }
        },
        error: (err) => {
          console.warn('Backend drafts fetch failed, using local storage fallback:', err);
          this.loadLocalDrafts();
        }
      });
    } else {
      this.loadLocalDrafts();
    }
  }

  private loadLocalDrafts() {
    const localData = localStorage.getItem(this.draftsKey);
    if (localData) {
      try {
        const parsed = JSON.parse(localData) as Draft[];
        this.draftsSubject.next(parsed);
      } catch (e) {
        console.error('Failed to parse local drafts:', e);
        this.draftsSubject.next([]);
      }
    } else {
      this.draftsSubject.next([]);
    }
  }

  // Save/Autosave a draft (Updates local state immediately, schedules debounced persistence)
  saveDraft(draft: Draft) {
    const currentList = this.draftsSubject.value;
    const existingIdx = currentList.findIndex(d => d.id === draft.id);
    let updatedList = [...currentList];

    draft.updatedAt = new Date().toISOString();
    draft.synced = false;

    if (existingIdx !== -1) {
      updatedList[existingIdx] = draft;
    } else {
      updatedList.push(draft);
    }

    // Sort by updatedAt descending
    updatedList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Update local state instantly so UI responds immediately
    this.draftsSubject.next(updatedList);

    // Queue debounced storage write + API sync
    this.autosaveQueue.next({ draft, triggerApi: this.isLoggedIn });
  }

  private executeAutosave(draft: Draft, triggerApi: boolean) {
    // Write full list to localStorage
    localStorage.setItem(this.draftsKey, JSON.stringify(this.draftsSubject.value));

    // Write individual draft to backend DB
    if (triggerApi) {
      this.http.post(this.draftsUrl, draft).subscribe({
        next: () => {
          console.log(`Draft ${draft.id} successfully synced to backend database`);
          this.markDraftAsSynced(draft.id, true);
        },
        error: (err) => {
          console.error(`Failed to sync draft ${draft.id} to backend:`, err.message);
          this.markDraftAsSynced(draft.id, false);
        }
      });
    } else {
      this.markDraftAsSynced(draft.id, false);
    }
  }

  private markDraftAsSynced(draftId: string, syncedStatus: boolean) {
    const currentList = this.draftsSubject.value;
    const idx = currentList.findIndex(d => d.id === draftId);
    if (idx !== -1) {
      const updated = [...currentList];
      updated[idx] = { ...updated[idx], synced: syncedStatus };
      this.draftsSubject.next(updated);
      localStorage.setItem(this.draftsKey, JSON.stringify(updated));
    }
  }

  private syncPendingDrafts() {
    if (!this.isLoggedIn) return;
    const pending = this.draftsSubject.value.filter(d => !d.synced);
    if (pending.length === 0) return;
    console.log(`Syncing ${pending.length} pending draft(s) to backend...`);
    pending.forEach(draft => {
      this.http.post(this.draftsUrl, draft).subscribe({
        next: () => {
          console.log(`Pending draft ${draft.id} successfully synced to backend`);
          this.markDraftAsSynced(draft.id, true);
        },
        error: (err) => console.error(`Retry sync failed for draft ${draft.id}:`, err.message)
      });
    });
  }

  deleteDraft(draftId: string) {
    const updated = this.draftsSubject.value.filter(d => d.id !== draftId);
    this.draftsSubject.next(updated);
    localStorage.setItem(this.draftsKey, JSON.stringify(updated));

    if (this.isLoggedIn) {
      this.http.delete(`${this.draftsUrl}/${draftId}`).subscribe({
        next: () => console.log(`Draft ${draftId} deleted on backend`),
        error: (err) => console.error(`Failed to delete draft ${draftId} on backend:`, err.message)
      });
    }
  }

  clearAllDrafts() {
    this.draftsSubject.next([]);
    localStorage.setItem(this.draftsKey, JSON.stringify([]));

    if (this.isLoggedIn) {
      this.http.delete(this.draftsUrl).subscribe({
        next: () => console.log('Wiped all drafts on backend'),
        error: (err) => console.error('Failed to wipe drafts on backend:', err.message)
      });
    }
  }


  // --- CUSTOM TEMPLATES PERSISTENCE FLOW ---

  private loadCustomTemplates() {
    if (this.isLoggedIn) {
      this.http.get<{ success: boolean; data: Template[] }>(this.templatesUrl).subscribe({
        next: (res) => {
          if (res && res.success && res.data) {
            const templatesWithSync = res.data.map(t => ({ ...t, synced: true }));
            this.customTemplatesSubject.next(templatesWithSync);
            localStorage.setItem(this.customTemplatesKey, JSON.stringify(templatesWithSync));
          } else {
            this.loadLocalCustomTemplates();
          }
        },
        error: (err) => {
          console.warn('Backend custom templates fetch failed, using local storage fallback:', err);
          this.loadLocalCustomTemplates();
        }
      });
    } else {
      this.loadLocalCustomTemplates();
    }
  }

  private loadLocalCustomTemplates() {
    const localData = localStorage.getItem(this.customTemplatesKey);
    if (localData) {
      try {
        const parsed = JSON.parse(localData) as Template[];
        this.customTemplatesSubject.next(parsed);
      } catch (e) {
        console.error('Failed to parse local templates:', e);
        this.customTemplatesSubject.next([]);
      }
    } else {
      this.customTemplatesSubject.next([]);
    }
  }

  saveCustomTemplate(template: Template) {
    const currentList = this.customTemplatesSubject.value;
    const existingIdx = currentList.findIndex(t => t.id === template.id);
    let updatedList = [...currentList];

    template.isCustom = true;
    template.synced = false;

    if (existingIdx !== -1) {
      updatedList[existingIdx] = template;
    } else {
      updatedList.push(template);
    }

    this.customTemplatesSubject.next(updatedList);
    localStorage.setItem(this.customTemplatesKey, JSON.stringify(updatedList));

    if (this.isLoggedIn) {
      this.http.post(this.templatesUrl, template).subscribe({
        next: () => {
          console.log(`Custom template ${template.id} synced to backend`);
          this.markTemplateAsSynced(template.id, true);
        },
        error: (err) => {
          console.error(`Failed to sync custom template ${template.id}:`, err.message);
          this.markTemplateAsSynced(template.id, false);
        }
      });
    } else {
      this.markTemplateAsSynced(template.id, false);
    }
  }

  private markTemplateAsSynced(templateId: string, syncedStatus: boolean) {
    const currentList = this.customTemplatesSubject.value;
    const idx = currentList.findIndex(t => t.id === templateId);
    if (idx !== -1) {
      const updated = [...currentList];
      updated[idx] = { ...updated[idx], synced: syncedStatus };
      this.customTemplatesSubject.next(updated);
      localStorage.setItem(this.customTemplatesKey, JSON.stringify(updated));
    }
  }

  private syncPendingTemplates() {
    if (!this.isLoggedIn) return;
    const pending = this.customTemplatesSubject.value.filter(t => !t.synced);
    if (pending.length === 0) return;
    console.log(`Syncing ${pending.length} pending custom template(s) to backend...`);
    pending.forEach(template => {
      this.http.post(this.templatesUrl, template).subscribe({
        next: () => {
          console.log(`Pending custom template ${template.id} successfully synced to backend`);
          this.markTemplateAsSynced(template.id, true);
        },
        error: (err) => console.error(`Retry sync failed for custom template ${template.id}:`, err.message)
      });
    });
  }

  deleteCustomTemplate(templateId: string) {
    const updated = this.customTemplatesSubject.value.filter(t => t.id !== templateId);
    this.customTemplatesSubject.next(updated);
    localStorage.setItem(this.customTemplatesKey, JSON.stringify(updated));

    if (this.isLoggedIn) {
      this.http.delete(`${this.templatesUrl}/${templateId}`).subscribe({
        next: () => console.log(`Deleted custom template ${templateId} on backend`),
        error: (err) => console.error(`Failed to delete custom template ${templateId}:`, err.message)
      });
    }
  }
}