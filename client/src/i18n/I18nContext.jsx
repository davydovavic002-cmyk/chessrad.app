import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { formatMoveLabel, translations } from './translations';

const STORAGE_KEY = 'chessrad_lang';
const I18nContext = createContext(null);

function readStoredLang() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'en' || v === 'ru') return v;
  } catch {
    /* ignore */
  }
  return 'ru';
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(readStoredLang);

  const setLang = useCallback((next) => {
    const value = next === 'en' ? 'en' : 'ru';
    setLangState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = value;
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key, vars) => {
      const dict = translations[lang] || translations.ru;
      let text = dict[key] ?? translations.ru[key] ?? key;
      if (Array.isArray(text)) return text;
      if (vars && typeof text === 'string') {
        Object.entries(vars).forEach(([k, v]) => {
          text = text.replaceAll(`{${k}}`, String(v));
        });
      }
      return text;
    },
    [lang]
  );

  const moveLabel = useCallback(
    (pieceType, from, to) => formatMoveLabel(pieceType, from, to, lang),
    [lang]
  );

  const value = useMemo(
    () => ({
      lang,
      setLang,
      toggleLang: () => setLang(lang === 'ru' ? 'en' : 'ru'),
      t,
      moveLabel,
    }),
    [lang, setLang, t, moveLabel]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
