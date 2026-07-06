import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'chessrad_theme';
const ThemeContext = createContext(null);

function readStoredTheme() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    /* ignore */
  }
  return 'light';
}

export function ThemeProvider({ children, userTheme }) {
  const [theme, setThemeState] = useState(() => userTheme || readStoredTheme());

  useEffect(() => {
    if (userTheme === 'dark' || userTheme === 'light') {
      setThemeState(userTheme);
    }
  }, [userTheme]);

  const setTheme = useCallback((next) => {
    const value = next === 'dark' ? 'dark' : 'light';
    setThemeState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute('data-theme', value);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      isDark: theme === 'dark',
    }),
    [theme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
