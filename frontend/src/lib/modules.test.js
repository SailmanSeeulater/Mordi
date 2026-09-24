import { afterEach, describe, expect, it } from 'vitest';
import { MODULE_IDS, enableModule, initialPrefs, isOn, savePrefs, setMode, setModule } from './modules';

const stored = () => JSON.parse(localStorage.getItem('mordi-modules'));
const days = (n) => Array.from({ length: n }, (_, i) => ({ logDate: `2026-09-${String(i + 1).padStart(2, '0')}` }));

afterEach(() => localStorage.clear());

describe('modules', () => {
  it('undecided shows everything, so nothing vanishes before the dashboard decides', () => {
    expect(isOn(null, 'notes')).toBe(true);
  });

  it('a new account starts focused; weeks of logging start with everything', () => {
    expect(initialPrefs(days(3))).toEqual({ mode: 'focused', on: [] });
    // Several entries on one day are still one day.
    expect(initialPrefs([...days(5), ...days(5)]).mode).toBe('focused');
    expect(initialPrefs(days(14)).mode).toBe('everything');
  });

  it('adding and removing modules by hand', () => {
    savePrefs({ mode: 'focused', on: [] });
    setModule('todo', true);
    expect(stored()).toEqual({ mode: 'focused', on: ['todo'] });
    expect(isOn(stored(), 'todo')).toBe(true);
    expect(isOn(stored(), 'notes')).toBe(false);
    setModule('todo', false);
    expect(stored().on).toEqual([]);
  });

  it('turning one off from everything keeps the rest', () => {
    savePrefs({ mode: 'everything', on: [...MODULE_IDS] });
    setModule('activity', false);
    expect(stored().mode).toBe('focused');
    expect(stored().on).toHaveLength(MODULE_IDS.length - 1);
    expect(stored().on).not.toContain('activity');
  });

  it('switching to focused from everything starts clean; to everything turns all on', () => {
    savePrefs({ mode: 'everything', on: [...MODULE_IDS] });
    setMode('focused');
    expect(stored()).toEqual({ mode: 'focused', on: [] });
    setMode('everything');
    expect(stored().on).toHaveLength(MODULE_IDS.length);
  });

  it('turning itself on never overrides an undecided browser, and never turns anything off', () => {
    enableModule('together');
    expect(localStorage.getItem('mordi-modules')).toBeNull();
    savePrefs({ mode: 'focused', on: ['todo'] });
    enableModule('together');
    expect(stored().on).toEqual(['todo', 'together']);
  });
});
