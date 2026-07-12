import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { SnackbarService } from './snackbar.service';

export interface SavedLawyerInfo {
  lawyerId: string;
  lawyerName: string;
}

export interface SavedHelplineInfo {
  helplineId: string;
  helplineName: string;
}

export interface SavedResourceInfo {
  resourceId: string;
  resourceName: string;
}

@Injectable({ providedIn: 'root' })
export class SavedItemsService {
  private apiBase = 'http://localhost:8888/api';
  private isLoggedIn = false;

  // Public signals containing list of saved items
  public savedLawyers = signal<SavedLawyerInfo[]>([]);
  public savedHelplines = signal<SavedHelplineInfo[]>([]);
  public savedResources = signal<SavedResourceInfo[]>([]);
  public initialLoadComplete = signal(false);

  // Derived sets for fast isSaved check
  public savedLawyerIds = computed(() => new Set(this.savedLawyers().map(l => l.lawyerId)));
  public savedHelplineIds = computed(() => new Set(this.savedHelplines().map(h => h.helplineId)));
  public savedResourceIds = computed(() => new Set(this.savedResources().map(r => r.resourceId)));

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private snackbar: SnackbarService,
    private router: Router
  ) {
    this.auth.isLoggedIn$.subscribe(loggedIn => {
      this.isLoggedIn = loggedIn;
      this.loadAll();
    });
  }

  // ─── LOAD ──────────────────────────────────────────────────────────────────

  private loadAll() {
    if (this.isLoggedIn) {
      this.initialLoadComplete.set(false);
      const lawyers$ = this.http.get<SavedLawyerInfo[]>(`${this.apiBase}/favouritelawyer`, { withCredentials: true }).pipe(catchError(() => of([])));
      const resources$ = this.http.get<SavedResourceInfo[]>(`${this.apiBase}/favouriteresource`, { withCredentials: true }).pipe(catchError(() => of([])));
      const helplines$ = this.http.get<SavedHelplineInfo[]>(`${this.apiBase}/helpline/favourites`, { withCredentials: true }).pipe(catchError(() => of([])));

      forkJoin([lawyers$, resources$, helplines$]).subscribe({
        next: ([lawyers, resources, helplines]) => {
          this.savedLawyers.set(lawyers || []);
          this.savedResources.set(resources || []);
          this.savedHelplines.set(helplines || []);
          this.initialLoadComplete.set(true);
        },
        error: () => {
          this.initialLoadComplete.set(true);
        }
      });
    } else {
      // Clear all state when logged out
      this.savedLawyers.set([]);
      this.savedResources.set([]);
      this.savedHelplines.set([]);
      this.initialLoadComplete.set(true);
    }
  }

  private loadLawyersFromApi() {
    this.http.get<SavedLawyerInfo[]>(`${this.apiBase}/favouritelawyer`, { withCredentials: true }).subscribe({
      next: (res) => this.savedLawyers.set(res || []),
      error: () => this.savedLawyers.set([])
    });
  }

  private loadResourcesFromApi() {
    this.http.get<SavedResourceInfo[]>(`${this.apiBase}/favouriteresource`, { withCredentials: true }).subscribe({
      next: (res) => this.savedResources.set(res || []),
      error: () => this.savedResources.set([])
    });
  }

  private loadHelplinesFromApi() {
    this.http.get<SavedHelplineInfo[]>(`${this.apiBase}/helpline/favourites`, { withCredentials: true }).subscribe({
      next: (res) => this.savedHelplines.set(res || []),
      error: () => this.savedHelplines.set([])
    });
  }

  // ─── QUERY ─────────────────────────────────────────────────────────────────

  isSavedLawyer(lawyerId: string): boolean {
    return this.savedLawyerIds().has(lawyerId);
  }

  isSavedHelpline(helplineId: string): boolean {
    // Correct helper to check helplineIds set
    const ids = new Set(this.savedHelplines().map(h => h.helplineId));
    return ids.has(helplineId);
  }

  isSavedResource(resourceId: string): boolean {
    const ids = new Set(this.savedResources().map(r => r.resourceId));
    return ids.has(resourceId);
  }

  // ─── TOGGLE LAWYER ─────────────────────────────────────────────────────────

  toggleLawyer(lawyerId: string, lawyerName: string) {
    if (!this.isLoggedIn) {
      this.snackbar.show(
        'Login to save lawyers to your profile',
        'warning',
        5000,
        'Login →',
        () => this.router.navigate(['/login'])
      );
      return;
    }

    if (this.isSavedLawyer(lawyerId)) {
      this.removeLawyer(lawyerId, lawyerName);
    } else {
      this.saveLawyer(lawyerId, lawyerName);
    }
  }

  private saveLawyer(lawyerId: string, lawyerName: string) {
    this.http.post<any>(`${this.apiBase}/favouritelawyer`, { lawyerId, lawyerName }, { withCredentials: true }).subscribe({
      next: () => {
        const updated = [...this.savedLawyers()];
        updated.push({ lawyerId, lawyerName });
        this.savedLawyers.set(updated);
        this.snackbar.show(`${lawyerName} saved to your favourites!`, 'success');
      },
      error: (err) => {
        this.snackbar.show(err?.error?.message || 'Failed to save. Please try again.', 'error');
      }
    });
  }

  private removeLawyer(lawyerId: string, lawyerName: string) {
    this.http.delete<any>(`${this.apiBase}/favouritelawyer/${lawyerId}`, { withCredentials: true }).subscribe({
      next: () => {
        const updated = this.savedLawyers().filter(l => l.lawyerId !== lawyerId);
        this.savedLawyers.set(updated);
        this.snackbar.show(`${lawyerName} removed from your favourites.`, 'info');
      },
      error: () => {
        this.snackbar.show('Failed to remove. Please try again.', 'error');
      }
    });
  }

  // ─── TOGGLE RESOURCE ───────────────────────────────────────────────────────

  toggleResource(resourceId: string, resourceName: string) {
    if (!this.isLoggedIn) {
      this.snackbar.show(
        'Login to save legal resources to your profile',
        'warning',
        5000,
        'Login →',
        () => this.router.navigate(['/login'])
      );
      return;
    }

    if (this.isSavedResource(resourceId)) {
      this.removeResource(resourceId, resourceName);
    } else {
      this.saveResource(resourceId, resourceName);
    }
  }

  private saveResource(resourceId: string, resourceName: string) {
    this.http.post<any>(`${this.apiBase}/favouriteresource`, { resourceId, resourceName }, { withCredentials: true }).subscribe({
      next: () => {
        const updated = [...this.savedResources()];
        updated.push({ resourceId, resourceName });
        this.savedResources.set(updated);
        this.snackbar.show(`${resourceName} saved to your bookmarks!`, 'success');
      },
      error: (err) => {
        this.snackbar.show(err?.error?.message || 'Failed to save. Please try again.', 'error');
      }
    });
  }

  private removeResource(resourceId: string, resourceName: string) {
    this.http.delete<any>(`${this.apiBase}/favouriteresource/${resourceId}`, { withCredentials: true }).subscribe({
      next: () => {
        const updated = this.savedResources().filter(r => r.resourceId !== resourceId);
        this.savedResources.set(updated);
        this.snackbar.show(`${resourceName} removed from bookmarks.`, 'info');
      },
      error: () => {
        this.snackbar.show('Failed to remove. Please try again.', 'error');
      }
    });
  }

  // ─── TOGGLE HELPLINE ───────────────────────────────────────────────────────

  toggleHelpline(helplineId: string, helplineName: string) {
    if (!this.isLoggedIn) {
      this.snackbar.show(
        'Login to save helplines to your profile',
        'warning',
        5000,
        'Login →',
        () => this.router.navigate(['/login'])
      );
      return;
    }

    if (this.isSavedHelpline(helplineId)) {
      this.removeHelpline(helplineId, helplineName);
    } else {
      this.saveHelpline(helplineId, helplineName);
    }
  }

  private saveHelpline(helplineId: string, helplineName: string) {
    this.http.post<any>(`${this.apiBase}/helpline/favourites`, { helplineId, helplineName }, { withCredentials: true }).subscribe({
      next: () => {
        const updated = [...this.savedHelplines()];
        updated.push({ helplineId, helplineName });
        this.savedHelplines.set(updated);
        this.snackbar.show(`${helplineName} saved for quick access!`, 'success');
      },
      error: (err) => {
        this.snackbar.show(err?.error?.message || 'Failed to save. Please try again.', 'error');
      }
    });
  }

  private removeHelpline(helplineId: string, helplineName: string) {
    this.http.delete<any>(`${this.apiBase}/helpline/favourites/${helplineId}`, { withCredentials: true }).subscribe({
      next: () => {
        const updated = this.savedHelplines().filter(h => h.helplineId !== helplineId);
        this.savedHelplines.set(updated);
        this.snackbar.show(`${helplineName} removed from saved.`, 'info');
      },
      error: () => {
        this.snackbar.show('Failed to remove. Please try again.', 'error');
      }
    });
  }
}