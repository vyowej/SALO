/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';

const ThemeContext = createContext(null);
const THEME_STORAGE_KEY = 'salo-theme-v1';
const VALID_THEMES = new Set(['light', 'dark']);

const readStoredTheme = () => {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return VALID_THEMES.has(storedTheme) ? storedTheme : 'light';
  } catch (error) {
    console.error('Unable to read the saved appearance preference.', error);
    return 'light';
  }
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.error('Unable to save the appearance preference.', error);
    }
  }, [theme]);

  const applyTheme = useCallback((nextTheme) => {
    const updateTheme = () => {
      document.documentElement.dataset.theme = nextTheme;
      flushSync(() => setThemeState(nextTheme));
    };

    if (
      typeof document.startViewTransition === 'function'
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      && !window.matchMedia('(prefers-reduced-transparency: reduce)').matches
    ) {
      document.startViewTransition(updateTheme);
      return;
    }

    updateTheme();
  }, []);

  const setTheme = useCallback((nextTheme) => {
    if (!VALID_THEMES.has(nextTheme)) {
      throw new Error(`Unsupported appearance theme: ${nextTheme}`);
    }
    if (nextTheme === theme) return;
    applyTheme(nextTheme);
  }, [applyTheme, theme]);

  const toggleTheme = useCallback(() => {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  }, [applyTheme, theme]);

  const value = useMemo(() => ({
    theme,
    isDarkMode: theme === 'dark',
    setTheme,
    toggleTheme,
  }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
