import { Injectable } from '@angular/core';

/**
 * Translates chat messages into the reader's language.
 *
 * 1. Prefers Chrome's built-in **on-device** Translator API (Chrome 138+) —
 *    private, free, nothing leaves the browser.
 * 2. Falls back to the free **MyMemory** web API on other browsers, so
 *    translation works everywhere (message text is sent to that service).
 *
 * The message's source language is detected from the text itself (an exact
 * detector on Chrome, a script heuristic elsewhere), with the sender's UI
 * language as a last-resort hint — people often type in a language other than
 * their interface language.
 */
@Injectable({ providedIn: 'root' })
export class MessageTranslateService {
  private translators = new Map<string, Promise<any>>();
  private detector: Promise<any> | null = null;

  /** Always true: on-device when available, otherwise the MyMemory fallback. */
  get supported(): boolean {
    return true;
  }

  private get onDevice(): boolean {
    return typeof (globalThis as any).Translator !== 'undefined';
  }

  /**
   * Translate `text` into `target`. `taggedSource` is the sender's UI language
   * (a weak hint). Returns `{ same: true }` only when the text is actually in
   * the target language.
   */
  async translate(text: string, taggedSource: string, target: string): Promise<{ text: string; same: boolean }> {
    const t = (target || 'en').split('-')[0];

    // Best source-language signal first.
    let s = '';
    if (this.onDevice) { try { s = await this.detect(text); } catch { /* ignore */ } }
    if (!s) s = this.detectScript(text);            // script heuristic (CJK, Cyrillic, …)
    if (!s) s = (taggedSource || '').split('-')[0]; // sender's UI language (hint)
    if (!s) s = 'en';

    if (s === t) return { text, same: true };

    // Prefer the private on-device translator; fall back to MyMemory anywhere else.
    if (this.onDevice) {
      try {
        const tr = await this.getTranslator(s, t);
        return { text: await tr.translate(text), same: false };
      } catch { /* fall through */ }
    }
    return this.viaMyMemory(text, s, t);
  }

  /** Fast script-based language guess (no model); returns '' when undetermined. */
  private detectScript(text: string): string {
    if (/[぀-ヿ]/.test(text)) return 'ja';                 // hiragana / katakana
    if (/[가-힯]/.test(text)) return 'ko';                 // hangul
    if (/[一-鿿㐀-䶿]/.test(text)) return 'zh';    // han ideographs
    if (/[Ѐ-ӿ]/.test(text)) return 'ru';                 // cyrillic
    if (/[؀-ۿ]/.test(text)) return 'ar';                 // arabic
    if (/[ऀ-ॿ]/.test(text)) return 'hi';                 // devanagari
    return '';
  }

  private async detect(text: string): Promise<string> {
    const g = globalThis as any;
    if (typeof g.LanguageDetector === 'undefined') return '';
    if (!this.detector) this.detector = g.LanguageDetector.create();
    const det = await this.detector;
    const results = await det.detect(text);
    return results?.[0]?.detectedLanguage?.split('-')[0] ?? '';
  }

  private getTranslator(source: string, target: string): Promise<any> {
    const key = `${source}->${target}`;
    const existing = this.translators.get(key);
    if (existing) return existing;
    const created: Promise<any> = (globalThis as any).Translator.create({
      sourceLanguage: source,
      targetLanguage: target,
    });
    this.translators.set(key, created);
    return created;
  }

  /** MyMemory expects region-qualified Chinese. */
  private mmCode(code: string): string {
    return code === 'zh' ? 'zh-CN' : code;
  }

  private async viaMyMemory(text: string, source: string, target: string): Promise<{ text: string; same: boolean }> {
    if (source === target) return { text, same: true };
    const pair = `${this.mmCode(source)}|${this.mmCode(target)}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`mymemory ${res.status}`);
    const data: any = await res.json();
    const out = data?.responseData?.translatedText;
    if (!out || (typeof data.responseStatus === 'number' && data.responseStatus >= 400)) {
      throw new Error('mymemory: no translation');
    }
    return { text: out, same: false };
  }
}
