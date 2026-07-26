import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class AdminThemeService {
  currentTheme = signal<ThemeMode>('dark');

  constructor() {
    this.initTheme();
  }

  private initTheme(): void {
    const savedTheme = (localStorage.getItem('lc_theme') || localStorage.getItem('theme')) as ThemeMode;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      this.currentTheme.set(savedTheme);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.currentTheme.set(prefersDark ? 'dark' : 'light');
    }
    this.applyTheme();
  }

  toggleTheme(): void {
    const nextTheme: ThemeMode = this.currentTheme() === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  setTheme(theme: ThemeMode): void {
    this.currentTheme.set(theme);
    localStorage.setItem('lc_theme', theme);
    localStorage.setItem('theme', theme);
    this.applyTheme();
  }

  private applyTheme(): void {
    const theme = this.currentTheme();
    document.documentElement.setAttribute('data-theme', theme);
  }

  get isDark(): boolean {
    return this.currentTheme() === 'dark';
  }
}