import { Injectable, signal } from '@angular/core';

export type AppTheme = 'dark' | 'light';

const STORAGE_KEY = 'diagram.theme';

/**
 * Owns the app's light/dark theme. The palette itself lives in CSS custom
 * properties (styles.css); this only flips `data-theme` on <html>, which
 * re-points every token at once.
 *
 * Consumers that cannot read CSS variables — notably the GoJS canvas, which
 * needs real colour strings — should subscribe to {@link theme} and re-read
 * their brushes when it changes.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** Current theme; read this to react to changes. */
  readonly theme = signal<AppTheme>(this.initial());

  constructor() {
    this.apply(this.theme());
  }

  /** Switch to the other theme and remember the choice. */
  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  set(theme: AppTheme): void {
    this.theme.set(theme);
    this.apply(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* private mode / storage disabled — the theme still applies for this session */
    }
  }

  /** Resolve a CSS custom property to a concrete colour (for canvas brushes). */
  cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  private apply(theme: AppTheme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  /** Stored choice, else the OS preference, else dark. */
  private initial(): AppTheme {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      /* ignore */
    }
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
}
