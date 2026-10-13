import { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, ThemeContext } from './theme-context-value';
import {
  DEFAULT_CUSTOM_THEMES,
  cleanLabel,
  customThemeCss,
  normalizeHex,
  readCustomThemes,
  schemeOf,
  writeCustomThemes,
} from '../lib/customTheme';

// The custom slots are fixed, so an id is known whether or not it was edited.
const KNOWN_IDS = new Set([...THEMES, ...DEFAULT_CUSTOM_THEMES].map((t) => t.id));
const isKnown = (id) => KNOWN_IDS.has(id);

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
  const [customThemes, setCustomThemes] = useState(readCustomThemes);

  // Built-in themes first, then the person's own, in picker and cycle order.
  const allThemes = useMemo(
    () => [
      ...THEMES,
      ...customThemes.map((t) => ({ id: t.id, label: t.label, scheme: schemeOf(t.colors.bg), custom: true })),
    ],
    [customThemes],
  );

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
        const next = allThemes[(allThemes.findIndex((t) => t.id === current) + 1) % allThemes.length].id;
        try {
          localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // Ignored, as above.
        }
        return next;
      }),
    );
  }, [allThemes]);

  /** Changes a custom slot's name or any of its four colors. No crossfade: this runs per drag frame. */
  const updateCustomTheme = useCallback((id, { label, colors } = {}) => {
    setCustomThemes((list) =>
      list.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, colors: { ...t.colors } };
        if (label !== undefined) next.label = cleanLabel(label, t.label);
        for (const [key, value] of Object.entries(colors ?? {})) {
          const hex = normalizeHex(value);
          if (hex && key in next.colors) next.colors[key] = hex;
        }
        return next;
      }),
    );
  }, []);

  const resetCustomTheme = useCallback((id) => {
    const base = DEFAULT_CUSTOM_THEMES.find((t) => t.id === id);
    if (!base) return;
    setCustomThemes((list) => list.map((t) => (t.id === id ? base : t)));
  }, []);

  useEffect(() => {
    writeCustomThemes(customThemes);
  }, [customThemes]);

  const css = useMemo(() => customThemeCss(customThemes), [customThemes]);

  const value = useMemo(
    () => ({ theme, setTheme, cycleTheme, allThemes, customThemes, updateCustomTheme, resetCustomTheme }),
    [theme, setTheme, cycleTheme, allThemes, customThemes, updateCustomTheme, resetCustomTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {/* The custom themes as ordinary [data-theme] blocks, so they paint
          everything themes.css does. Inline, so edits apply on the same frame. */}
      <style data-custom-themes="">{css}</style>
      {children}
    </ThemeContext.Provider>
  );
}
