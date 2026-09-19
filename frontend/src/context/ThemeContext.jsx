import { useCallback, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, ThemeContext } from './theme-context-value';

const isKnown = (id) => THEMES.some((t) => t.id === id);

/**
 * Swaps the theme inside a view transition: the browser snapshots the page,
 * applies the new colours in one synchronous render, and crossfades the two
 * pictures on the compositor (see ::view-transition in index.css).
 *
 * This replaced a transition on every element's colours, which made the
 * browser restyle and repaint the whole tree each frame for half a second and
 * visibly stuttered on busy pages. Without view transitions, or with reduced
 * motion, the switch is simply instant.
 */
function withThemeTransition(update) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce || typeof document.startViewTransition !== 'function') {
    update();
    return;
  }
  const transition = document.startViewTransition(() => flushSync(update));
  // A switch made while another is still fading skips the older one, which
  // rejects its promises. The new theme is applied either way.
  transition.ready.catch(() => {});
  transition.finished.catch(() => {});
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
    withThemeTransition(() => setThemeState(id));
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      // Preference just won't persist; the session still themes correctly.
    }
  }, []);

  const cycleTheme = useCallback(() => {
    withThemeTransition(() =>
      setThemeState((current) => {
        const next = THEMES[(THEMES.findIndex((t) => t.id === current) + 1) % THEMES.length].id;
        try {
          localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // Ignored, as above.
        }
        return next;
      }),
    );
  }, []);

  const value = useMemo(() => ({ theme, setTheme, cycleTheme }), [theme, setTheme, cycleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
