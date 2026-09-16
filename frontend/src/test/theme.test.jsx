import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../context/ThemeContext';
import { useTheme } from '../context/useTheme';
import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY } from '../context/theme-context-value';

function Probe() {
  const { theme, setTheme, cycleTheme } = useTheme();
  return (
    <div>
      <output>{theme}</output>
      <button type="button" onClick={cycleTheme}>
        cycle
      </button>
      <button type="button" onClick={() => setTheme('forest')}>
        forest
      </button>
      <button type="button" onClick={() => setTheme('not-a-theme')}>
        bogus
      </button>
    </div>
  );
}

const renderProbe = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

const current = () => screen.getByRole('status').textContent;

describe('themes', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('ships ten combinations, six light and four dark', () => {
    expect(THEMES).toHaveLength(10);
    expect(THEMES.filter((t) => t.scheme === 'light')).toHaveLength(6);
    expect(THEMES.filter((t) => t.scheme === 'dark')).toHaveLength(4);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(10);
  });

  it('starts on Sorbet, the site-wide default', () => {
    renderProbe();
    expect(current()).toBe(DEFAULT_THEME);
    expect(DEFAULT_THEME).toBe('sorbet');
  });

  it('cycles through every combination and wraps back around', () => {
    renderProbe();
    const cycle = screen.getByRole('button', { name: 'cycle' });

    const start = THEMES.findIndex((t) => t.id === DEFAULT_THEME);
    const expected = THEMES.map((_, i) => THEMES[(start + i) % THEMES.length].id);

    const seen = [current()];
    for (let i = 0; i < THEMES.length - 1; i += 1) {
      fireEvent.click(cycle);
      seen.push(current());
    }
    expect(seen).toEqual(expected);

    fireEvent.click(cycle);
    expect(current()).toBe(DEFAULT_THEME);
  });

  it('persists the choice and restores it on the next visit', () => {
    const first = renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'forest' }));
    expect(current()).toBe('forest');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('forest');

    first.unmount();
    renderProbe();
    expect(current()).toBe('forest');
  });

  it('ignores an unknown id, in storage or from a caller', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'chartreuse');
    renderProbe();
    expect(current()).toBe(DEFAULT_THEME);

    fireEvent.click(screen.getByRole('button', { name: 'bogus' }));
    expect(current()).toBe(DEFAULT_THEME);
  });

  it('still themes the session when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    renderProbe();
    expect(current()).toBe(DEFAULT_THEME);
    fireEvent.click(screen.getByRole('button', { name: 'forest' }));
    expect(current()).toBe('forest');
  });
});
