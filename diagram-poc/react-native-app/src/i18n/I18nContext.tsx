import React, { createContext, useContext, useMemo, useState } from 'react';
import { LANGUAGES, TKey, TRANSLATIONS } from './translations';

interface I18n {
  lang: string;
  setLang: (code: string) => void;
  t: (key: TKey) => string;
  languages: typeof LANGUAGES;
}

const I18nCtx = createContext<I18n | null>(null);

/** Pick a starting language from the device/browser, falling back to English. */
function detectLang(): string {
  try {
    const nav = (globalThis as any).navigator;
    const prefs: string[] = nav?.languages?.length ? nav.languages : [nav?.language].filter(Boolean);
    for (const p of prefs) {
      const code = String(p).slice(0, 2).toLowerCase();
      if (TRANSLATIONS[code]) return code;
    }
  } catch {
    // no navigator on native — default below
  }
  return 'en';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState(detectLang);
  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      languages: LANGUAGES,
      t: (key) => TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key,
    }),
    [lang],
  );
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
