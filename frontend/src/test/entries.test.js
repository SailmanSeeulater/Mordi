import { describe, expect, it } from 'vitest';
import { doneOnDay, entryName, restoreRequest } from '../lib/entries';

const run = { id: 1, title: 'Morning run' };
const read = { id: 2, title: 'Read' };
const e = (id, goal, logDate, completed = true) => ({ id, goal, logDate, completed, note: 'x' });

describe('doneOnDay', () => {
  const behaviors = [
    e(1, run, '2026-09-16'),
    e(2, read, '2026-09-16', false), // logged, not done
    e(3, read, '2026-09-15'),
    e(4, null, '2026-09-16'),
  ];

  it('finds a completed entry for the goal on that day', () => {
    expect(doneOnDay(behaviors, 1, '2026-09-16')).toBe(true);
  });

  it('matches a goal id given as a string, as a form field holds it', () => {
    expect(doneOnDay(behaviors, '1', '2026-09-16')).toBe(true);
  });

  it('ignores entries that were not done, other days, and other goals', () => {
    expect(doneOnDay(behaviors, 2, '2026-09-16')).toBe(false);
    expect(doneOnDay(behaviors, 1, '2026-09-15')).toBe(false);
    expect(doneOnDay(behaviors, 3, '2026-09-16')).toBe(false);
  });

  it('never matches an entry without a goal', () => {
    expect(doneOnDay(behaviors, '', '2026-09-16')).toBe(false);
    expect(doneOnDay(behaviors, null, '2026-09-16')).toBe(false);
    expect(doneOnDay([], 1, '2026-09-16')).toBe(false);
  });
});

describe('entryName', () => {
  it('names an entry by its goal, then by its own words', () => {
    expect(entryName({ goal: run, note: 'Ran 3 miles' })).toBe('Morning run');
    expect(entryName({ goal: null, note: 'Taxes' })).toBe('Taxes');
    expect(entryName({ goal: null, note: '' })).toBe('that entry');
  });
});

describe('restoreRequest', () => {
  it('sends back every field the entry had', () => {
    const entry = {
      id: 9,
      goal: run,
      note: 'Ran 3 miles',
      completed: true,
      mood: 'good',
      logDate: '2026-09-16',
      latitude: 51.5,
      longitude: -0.1,
      placeName: 'Park',
      durationSeconds: 1800,
      loggedAt: '2026-09-16T07:30:00Z',
    };
    expect(restoreRequest(entry)).toEqual({
      goalId: 1,
      note: 'Ran 3 miles',
      completed: true,
      mood: 'good',
      logDate: '2026-09-16',
      latitude: 51.5,
      longitude: -0.1,
      placeName: 'Park',
      durationSeconds: 1800,
      loggedAt: '2026-09-16T07:30:00Z',
    });
  });

  it('fills what a plain entry lacks with nulls, not undefined', () => {
    expect(restoreRequest({ id: 3, goal: null, note: 'Taxes', completed: false, logDate: '2026-09-15' })).toEqual({
      goalId: null,
      note: 'Taxes',
      completed: false,
      mood: null,
      logDate: '2026-09-15',
      latitude: null,
      longitude: null,
      placeName: null,
      durationSeconds: null,
      loggedAt: null,
    });
  });
});
