import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SnackbarService } from './snackbar.service';
import { AuthService } from './auth.service';

export interface ResearchNote {
  actShortName: string;
  sectionNumber: string;
  noteText: string;
  updatedAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class NoteService {
  private notesKeyPrefix = 'legalconnect_note_';
  private apiUrl = 'http://localhost:8888/api/notes';

  private notesSignal = signal<Record<string, string>>({}); // key: "shortName_secNum" -> noteText
  notes = this.notesSignal.asReadonly();

  private syncStatusSignal = signal<'idle' | 'saving' | 'synced' | 'error'>('idle');
  syncStatus = this.syncStatusSignal.asReadonly();

  setSyncStatus(status: 'idle' | 'saving' | 'synced' | 'error') {
    this.syncStatusSignal.set(status);
  }

  private isLoggedIn = false;

  constructor(
    private http: HttpClient,
    private snackbar: SnackbarService,
    private auth: AuthService
  ) {
    this.auth.isLoggedIn$.subscribe(loggedIn => {
      this.isLoggedIn = loggedIn;
      this.loadNotes();
    });
  }

  private loadNotes() {
    if (this.isLoggedIn) {
      this.http.get<ResearchNote[]>(this.apiUrl, { withCredentials: true }).subscribe({
        next: (notes) => {
          const map: Record<string, string> = {};
          notes.forEach(n => {
            map[`${n.actShortName}_${n.sectionNumber}`] = n.noteText;
          });
          this.notesSignal.set(map);
        },
        error: () => {
          this.loadLocalNotes();
        }
      });
    } else {
      this.loadLocalNotes();
    }
  }

  private loadLocalNotes() {
    const map: Record<string, string> = {};
    if (typeof window !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('note_')) {
          const parts = key.split('_'); // note_shortName_sectionNum
          if (parts.length >= 3) {
            const shortName = parts[1];
            const sectionNum = parts.slice(2).join('_');
            const noteText = localStorage.getItem(key) || '';
            map[`${shortName}_${sectionNum}`] = noteText;
          }
        }
      }
    }
    this.notesSignal.set(map);
  }

  getNoteText(actShortName: string, sectionNumber: string): string {
    return this.notesSignal()[`${actShortName}_${sectionNumber}`] || '';
  }

  saveNote(actShortName: string, sectionNumber: string, noteText: string, silent = false) {
    const current = { ...this.notesSignal() };
    const key = `${actShortName}_${sectionNumber}`;
    const localKey = `note_${actShortName}_${sectionNumber}`;

    if (!noteText.trim()) {
      delete current[key];
      if (typeof window !== 'undefined') {
        localStorage.removeItem(localKey);
      }
    } else {
      current[key] = noteText;
      if (typeof window !== 'undefined') {
        localStorage.setItem(localKey, noteText);
      }
    }
    this.notesSignal.set(current);

    if (this.isLoggedIn) {
      this.syncStatusSignal.set('saving');
      this.http.put<any>(`${this.apiUrl}/${actShortName}/${sectionNumber}`, { noteText }, { withCredentials: true }).subscribe({
        next: () => {
          this.syncStatusSignal.set('synced');
          if (!silent) {
            this.snackbar.show('Notes synced with cloud.', 'success');
          }
          setTimeout(() => {
            if (this.syncStatus() === 'synced') {
              this.syncStatusSignal.set('idle');
            }
          }, 2000);
        },
        error: () => {
          this.syncStatusSignal.set('error');
          if (!silent) {
            this.snackbar.show('Saved locally. Cloud sync failed.', 'warning');
          }
        }
      });
    } else {
      this.syncStatusSignal.set('synced');
      if (!silent) {
        this.snackbar.show('Notes saved locally.', 'success');
      }
      setTimeout(() => {
        if (this.syncStatus() === 'synced') {
          this.syncStatusSignal.set('idle');
        }
      }, 2000);
    }
  }
}
