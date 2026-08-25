import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Lightweight service to coordinate command palette open/close from anywhere in the app.
 * This avoids tight coupling between NavbarComponent and CommandPaletteComponent.
 */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private toggleSubject = new Subject<void>();
  toggle$ = this.toggleSubject.asObservable();

  toggle() {
    this.toggleSubject.next();
  }
}