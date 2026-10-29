/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.error('Unable to save the appearance preference.', error);
    }
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    if (!VALID_THEMES.has(nextTheme)) {
      throw new Error(`Unsupported appearance theme: ${nextTheme}`);
    }
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark');
  }, []);

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
