import { createContext } from 'react';

/** The twenty-five combinations in src/themes.css, in picker order: light, then dark. */
export const THEMES = [
  { id: 'paper', label: 'Paper', scheme: 'light' },
  { id: 'sorbet', label: 'Sorbet', scheme: 'light' },
  { id: 'mint', label: 'Mint', scheme: 'light' },
  { id: 'lagoon', label: 'Lagoon', scheme: 'light' },
  { id: 'lilac', label: 'Lilac', scheme: 'light' },
  { id: 'sand', label: 'Sand', scheme: 'light' },
  { id: 'linen', label: 'Linen', scheme: 'light' },
  { id: 'slate', label: 'Slate', scheme: 'light' },
  { id: 'sage', label: 'Sage', scheme: 'light' },
  { id: 'clover', label: 'Clover', scheme: 'light' },
  { id: 'harbor', label: 'Harbor', scheme: 'light' },
  { id: 'cobalt', label: 'Cobalt', scheme: 'light' },
  { id: 'orchid', label: 'Orchid', scheme: 'light' },
  { id: 'rose', label: 'Rose', scheme: 'light' },
  { id: 'clay', label: 'Clay', scheme: 'light' },
  { id: 'marigold', label: 'Marigold', scheme: 'light' },
  { id: 'graphite', label: 'Graphite', scheme: 'dark' },
  { id: 'midnight', label: 'Midnight', scheme: 'dark' },
  { id: 'forest', label: 'Forest', scheme: 'dark' },
  { id: 'ember', label: 'Ember', scheme: 'dark' },
  { id: 'dusk', label: 'Dusk', scheme: 'dark' },
  { id: 'ocean', label: 'Ocean', scheme: 'dark' },
  { id: 'cocoa', label: 'Cocoa', scheme: 'dark' },
  { id: 'ink', label: 'Ink', scheme: 'dark' },
  { id: 'moss', label: 'Moss', scheme: 'dark' },
];

export const DEFAULT_THEME = 'sorbet';
export const THEME_STORAGE_KEY = 'mordi-theme';

export const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  cycleTheme: () => {},
});
