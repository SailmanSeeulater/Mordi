import { describe, expect, it } from 'vitest';
import { ICONS, ICON_KEYS, ICON_LABELS, goalCategory, goalIcon, goalIconKey } from '../lib/categories';

const MINE = [{ id: 7, key: 'custom:7', name: 'Reading', icon: 'book' }];

describe('the icon set', () => {
  it('draws every key at one stroke on one grid, and names each', () => {
    expect(ICON_KEYS[0]).toBe('thumbtack');
    expect(ICON_KEYS.length).toBeGreaterThanOrEqual(20);
    for (const key of ICON_KEYS) {
      expect(ICONS[key].props.viewBox).toBe('0 0 24 24');
      expect(ICONS[key].props.strokeWidth).toBe(1.9);
      expect(ICON_LABELS[key]).toMatch(/^[A-Z]/);
    }
  });

  it('matches the list the backend accepts', () => {
    // Icons.KEYS in the backend. Change both together.
    expect([...ICON_KEYS].sort()).toEqual(
      [
        'thumbtack', 'fitness', 'sleep', 'productivity', 'health', 'book', 'run', 'water',
        'pen', 'music', 'leaf', 'sun', 'coffee', 'laptop', 'lightbulb', 'coin', 'people',
        'paw', 'speech', 'sparkle', 'check',
      ].sort(),
    );
  });
});

describe('goalIcon', () => {
  it('uses the goal’s own icon first', () => {
    expect(goalIconKey({ icon: 'music', category: 'fitness' }, MINE)).toBe('music');
    expect(goalIcon({ icon: 'music', category: 'fitness' }, MINE)).toBe(ICONS.music);
  });

  it('falls back to a built-in category’s icon', () => {
    expect(goalIconKey({ icon: null, category: 'sleep' })).toBe('sleep');
  });

  it('falls back to one of the person’s own categories', () => {
    expect(goalIconKey({ category: 'custom:7' }, MINE)).toBe('book');
  });

  it('prefers the person’s list to what the goal was loaded with, so a re-icon shows at once', () => {
    const goal = { category: 'custom:7', categoryName: 'Old', categoryIcon: 'pen' };
    expect(goalIconKey(goal, [{ ...MINE[0], icon: 'leaf' }])).toBe('leaf');
  });

  it('uses the category the server described when the list doesn’t have it, as in a shared goal', () => {
    const shared = { category: 'custom:40', categoryName: 'Choir', categoryIcon: 'music' };
    expect(goalIconKey(shared, MINE)).toBe('music');
    expect(goalCategory(shared, MINE)).toEqual({ label: 'Choir', icon: 'music' });
  });

  it('shows the thumbtack with no category, an unknown one, or an icon it can’t draw', () => {
    expect(goalIconKey({})).toBe('thumbtack');
    expect(goalIconKey({ category: null, icon: null })).toBe('thumbtack');
    expect(goalIconKey({ category: 'custom:99' }, MINE)).toBe('thumbtack');
    expect(goalIconKey({ icon: 'rocket' })).toBe('thumbtack');
    expect(goalIconKey({ icon: 'toString' })).toBe('thumbtack');
    expect(goalIconKey(null)).toBe('thumbtack');
  });

  it('labels built-in and custom categories, and none as null', () => {
    expect(goalCategory({ category: 'productivity' })).toEqual({ label: 'Productivity', icon: 'productivity' });
    expect(goalCategory({ category: 'custom:7' }, MINE)).toEqual({ label: 'Reading', icon: 'book' });
    expect(goalCategory({ category: '' })).toBeNull();
    expect(goalCategory({ category: 'custom:99' })).toBeNull();
  });
});
