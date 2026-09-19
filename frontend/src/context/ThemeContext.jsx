import { useCallback, useMemo, useState } from 'react';
import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, ThemeContext } from './theme-context-value';

const isKnown = (id) => THEMES.some((t) => t.id === id);

/**
 * Lets the colours ease across for the length of a switch (see
 * html.theme-easing in index.css). Repeated switches restart the window
 * rather than stacking timers.
 */
let easingTimer;
function easeThemeChange() {
  const html = document.documentElement;
  html.classList.add('theme-easing');
  clearTimeout(easingTimer);
  easingTimer = setTimeout(() => html.classList.remove('theme-easing'), 600);
}

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isKnown(stored) ? stored : DEFAULT_THEME;
  } catch {
    // Private mode or blocked site data: fall back to the default.
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);

  const setTheme = useCallback((id) => {
    if (!isKnown(id)) return;
    easeThemeChange();
    setThemeState(id);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      // Preference just won't persist; the session still themes correctly.
    }
  }, []);

  const cycleTheme = useCallback(() => {
    easeThemeChange();
    setThemeState((current) => {
      const next = THEMES[(THEMES.findIndex((t) => t.id === current) + 1) % THEMES.length].id;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Ignored, as above.
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, setTheme, cycleTheme }), [theme, setTheme, cycleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
