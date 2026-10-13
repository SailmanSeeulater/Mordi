import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CUSTOM_THEMES,
  contrast,
  deriveTokens,
  hexToHsv,
  hsvToHex,
  normalizeHex,
  readability,
  sanitizeCustomThemes,
} from '../lib/customTheme';

describe('custom theme color math', () => {
  it('normalizes hex in its common spellings and rejects the rest', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('a1b2c3')).toBe('#a1b2c3');
    expect(normalizeHex('#12345')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
  });

  it('round-trips through HSV', () => {
    for (const hex of ['#000000', '#ffffff', '#ff0000', '#2f7d4f', '#a58cf0', '#7f7f7f']) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
    expect(hexToHsv('#00ff00').h).toBeCloseTo(120);
  });

  it('derives every role and keeps derived ink readable, even from awkward picks', () => {
    const picks = [
      ...DEFAULT_CUSTOM_THEMES.map((t) => t.colors),
      // A pale accent on a pale ground, and a dark accent on a dark ground.
      { bg: '#ffffff', surface: '#f4f4f4', text: '#111111', accent: '#ffe680' },
      { bg: '#0a0a0a', surface: '#161616', text: '#f0f0f0', accent: '#202060' },
    ];
    for (const colors of picks) {
      const t = deriveTokens(colors);
      for (const ground of ['--color-bg', '--color-surface']) {
        expect(contrast(t['--color-accent-700'], t[ground])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t['--color-signal'], t[ground])).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(t['--color-on-accent'], t['--color-accent'])).toBeGreaterThanOrEqual(3);
      expect(contrast(t['--color-on-pass'], t['--color-pass'])).toBeGreaterThanOrEqual(3);
    }
  });

  it('reads the scheme from the background', () => {
    expect(deriveTokens(DEFAULT_CUSTOM_THEMES[0].colors).scheme).toBe('light');
    expect(deriveTokens(DEFAULT_CUSTOM_THEMES[2].colors).scheme).toBe('dark');
  });

  it('ships defaults that pass their own readability checks', () => {
    for (const t of DEFAULT_CUSTOM_THEMES) {
      expect(readability(t.colors).every((c) => c.ok)).toBe(true);
    }
  });

  it('flags text that is hard to read', () => {
    const low = readability({ bg: '#ffffff', surface: '#ffffff', text: '#cccccc' });
    expect(low.some((c) => !c.ok)).toBe(true);
  });

  it('falls back to the defaults for missing or malformed storage', () => {
    expect(sanitizeCustomThemes(null)).toEqual(DEFAULT_CUSTOM_THEMES);
    const out = sanitizeCustomThemes([{ id: 'custom-2', label: '', colors: { bg: 'zzz', text: '#123456' } }]);
    expect(out[1].label).toBe('Custom 2');
    expect(out[1].colors.bg).toBe(DEFAULT_CUSTOM_THEMES[1].colors.bg);
    expect(out[1].colors.text).toBe('#123456');
  });
});
