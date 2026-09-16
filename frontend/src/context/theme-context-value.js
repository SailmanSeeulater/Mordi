import { createContext } from 'react';

/** The ten combinations defined in src/themes.css, in picker order. */
export const THEMES = [
  { id: 'paper', label: 'Paper', scheme: 'light' },
  { id: 'sorbet', label: 'Sorbet', scheme: 'light' },
  { id: 'mint', label: 'Mint', scheme: 'light' },
  { id: 'lagoon', label: 'Lagoon', scheme: 'light' },
  { id: 'lilac', label: 'Lilac', scheme: 'light' },
  { id: 'sand', label: 'Sand', scheme: 'light' },
  { id: 'graphite', label: 'Graphite', scheme: 'dark' },
  { id: 'midnight', label: 'Midnight', scheme: 'dark' },
  { id: 'forest', label: 'Forest', scheme: 'dark' },
  { id: 'ember', label: 'Ember', scheme: 'dark' },
];

export const DEFAULT_THEME = 'sorbet';
export const THEME_STORAGE_KEY = 'mordi-theme';

export const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  cycleTheme: () => {},
});
