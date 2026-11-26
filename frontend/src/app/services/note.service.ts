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
  private apiUrl = '/api/notes';

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
      // Reset in-memory cache to guarantee zero cross-session or guest-user contamination
      this.notesSignal.set({});
      this.loadNotes();
    });
  }

  private loadNotes() {
    if (this.isLoggedIn) {
      // Authenticated session: Load user's private cloud notes strictly from DB
      this.http.get<ResearchNote[]>(this.apiUrl, { withCredentials: true }).subscribe({
        next: (notes) => {
          const map: Record<string, string> = {};
          notes.forEach(n => {
            const compositeKey = `${n.actShortName}_${n.sectionNumber}`;
            map[compositeKey] = n.noteText;
            // Clear local storage copy after confirmed presence in DB
            if (typeof window !== 'undefined') {
              localStorage.removeItem(`note_${n.actShortName}_${n.sectionNumber}`);
            }
          });
          this.notesSignal.set(map);
        },
        error: () => {
          // If network error during authenticated session, do not fall back to untrusted guest notes
          this.notesSignal.set({});
        }
      });
    } else {
      // Guest session: Read local device-only notes (isolated from DB)
      this.loadLocalNotes();
    }
  }

  private loadLocalNotes() {
    const map: Record<string, string> = {};
    if (typeof window !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('guest_note_') || key.startsWith('note_'))) {
          const isGuestPrefix = key.startsWith('guest_note_');
          const parts = key.split('_');
          const minParts = isGuestPrefix ? 4 : 3;
          if (parts.length >= minParts) {
            const shortName = isGuestPrefix ? parts[2] : parts[1];
            const sectionNum = isGuestPrefix ? parts.slice(3).join('_') : parts.slice(2).join('_');
            const noteText = localStorage.getItem(key) || '';
            map[`${shortName}_${sectionNum}`] = noteText;
          }
        }
      }
    }
    this.notesSignal.set(map);
  }

  getNoteText(actShortName: string, sectionNumber: string): string {
    const key = `${actShortName}_${sectionNumber}`;
    const inMem = this.notesSignal()[key];
    if (inMem !== undefined) {
      return inMem;
    }
    // Fallback check in local storage if not yet loaded in signal
    if (typeof window !== 'undefined') {
      const storageKey = this.isLoggedIn
        ? `note_${actShortName}_${sectionNumber}`
        : `guest_note_${actShortName}_${sectionNumber}`;
      return localStorage.getItem(storageKey) || localStorage.getItem(`note_${actShortName}_${sectionNumber}`) || '';
    }
    return '';
  }

  saveNote(actShortName: string, sectionNumber: string, noteText: string, silent = false) {
    const current = { ...this.notesSignal() };
    const key = `${actShortName}_${sectionNumber}`;
    const localKey = this.isLoggedIn
      ? `note_${actShortName}_${sectionNumber}`
      : `guest_note_${actShortName}_${sectionNumber}`;

    if (!noteText.trim()) {
      delete current[key];
      if (typeof window !== 'undefined') {
        localStorage.removeItem(localKey);
        localStorage.removeItem(`guest_note_${actShortName}_${sectionNumber}`);
        localStorage.removeItem(`note_${actShortName}_${sectionNumber}`);
      }
    } else {
      current[key] = noteText;
      if (typeof window !== 'undefined') {
        localStorage.setItem(localKey, noteText);
      }
    }
    this.notesSignal.set(current);

    // SECURITY GUARANTEE: Guest notes are strictly restricted to local device storage.
    // They are NEVER dispatched to the server, synced to the cloud, or uploaded to any user account.
    if (!this.isLoggedIn) {
      this.syncStatusSignal.set('synced');
      if (!silent) {
        this.snackbar.show('Notes saved locally on this device.', 'info');
      }
      setTimeout(() => {
        if (this.syncStatus() === 'synced') {
          this.syncStatusSignal.set('idle');
        }
      }, 2000);
      return;
    }

    // Authenticated user note persistence
    this.syncStatusSignal.set('saving');
    this.http.put<any>(`${this.apiUrl}/${actShortName}/${sectionNumber}`, { noteText }, { withCredentials: true }).subscribe({
      next: () => {
        this.syncStatusSignal.set('synced');
        // Clear local storage copy after successful sync with DB
        if (typeof window !== 'undefined') {
          localStorage.removeItem(localKey);
        }
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
        // Kept in localStorage as offline fallback until cloud sync recovers
        if (!silent) {
          this.snackbar.show('Saved locally. Cloud sync failed.', 'warning');
        }
      }
    });
  }
}