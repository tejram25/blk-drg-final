import { Injectable } from '@angular/core';
import { LANGUAGES, TRANSLATIONS, DATA_TRANSLATIONS, Language } from './translations';

const STORAGE_KEY = 'diagram.lang';

/**
 * Runtime UI translation. Holds the active language, looks up strings from the
 * generated TRANSLATIONS table, and persists the choice in localStorage so it
 * survives reloads. Switching language is instant — no per-locale build.
 */
@Injectable({ providedIn: 'root' })
export class TranslateService {
  readonly languages: Language[] = LANGUAGES;
  lang = 'en';

  constructor() {
    let saved = '';
    try { saved = localStorage.getItem(STORAGE_KEY) || ''; } catch { /* ignore */ }
    // An explicit, saved choice wins; otherwise follow the browser/system language.
    this.lang = saved && TRANSLATIONS[saved] ? saved : this.detectSystemLang();
    this.applyDocumentLang();
  }

  /** Best supported language from the browser's preference list, else English. */
  private detectSystemLang(): string {
    if (typeof navigator === 'undefined') return 'en';
    const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const pref of prefs) {
      const code = (pref || '').toLowerCase().split('-')[0]; // 'es-ES' -> 'es', 'zh-CN' -> 'zh'
      if (TRANSLATIONS[code]) return code;
    }
    return 'en';
  }

  setLang(code: string): void {
    if (!TRANSLATIONS[code] || code === this.lang) return;
    this.lang = code;
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
    this.applyDocumentLang();
  }

  /** Translate a key; falls back to English, then to the key itself. */
  t(key: string): string {
    return TRANSLATIONS[this.lang]?.[key] ?? TRANSLATIONS['en']?.[key] ?? key;
  }

  /**
   * Translate a data-driven label (palette category or component name), keyed
   * by its English text. Unknown text (e.g. a user-renamed block) is returned
   * unchanged.
   */
  td(text: string): string {
    if (!text) return text;
    return DATA_TRANSLATIONS[this.lang]?.[text] ?? text;
  }

  get currentLabel(): string {
    return this.languages.find((l) => l.code === this.lang)?.label ?? 'English';
  }

  private applyDocumentLang(): void {
    if (typeof document !== 'undefined') document.documentElement.lang = this.lang;
  }
}
