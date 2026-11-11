import { Injectable, signal } from '@angular/core';

export interface KebabMenuContract {
  close(): void;
  isOpen(): boolean;
}

@Injectable({
  providedIn: 'root'
})
export class KebabMenuService {
  private _activeMenu = signal<KebabMenuContract | null>(null);
  readonly activeMenu = this._activeMenu.asReadonly();

  registerOpen(menu: KebabMenuContract): void {
    const current = this._activeMenu();
    if (current && current !== menu) {
      current.close();
    }
    this._activeMenu.set(menu);
  }

  registerClose(menu: KebabMenuContract): void {
    if (this._activeMenu() === menu) {
      this._activeMenu.set(null);
    }
  }

  closeAll(): void {
    const current = this._activeMenu();
    if (current) {
      current.close();
      this._activeMenu.set(null);
    }
  }
}