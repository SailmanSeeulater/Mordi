import { describe, expect, it } from 'vitest';
import { groupByDay, mergeFeed, todoFeedItem } from '../lib/feed';

const entry = (id, logDate, loggedAt) => ({ id, logDate, loggedAt, note: `Entry ${id}` });
const todo = (id, completedOn, completedAt) => ({ id, text: `Todo ${id}`, done: true, completedOn, completedAt });

describe('todoFeedItem', () => {
  it('puts a finished to-do in the feed on the day and moment it was ticked off', () => {
    expect(todoFeedItem(todo(7, '2026-10-05', '2026-10-05T21:30:00Z'))).toEqual({
      kind: 'todo',
      id: 'todo-7',
      logDate: '2026-10-05',
      loggedAt: '2026-10-05T21:30:00Z',
      note: 'Todo 7',
    });
  });
});

describe('mergeFeed', () => {
  it('interleaves entries and to-dos newest first, by day and then by moment', () => {
    const feed = mergeFeed(
      [entry(1, '2026-10-05', '2026-10-05T10:00:00Z'), entry(2, '2026-10-04', '2026-10-04T12:00:00Z')],
      [todo(1, '2026-10-05', '2026-10-05T15:00:00Z'), todo(2, '2026-10-04', '2026-10-04T08:00:00Z')],
      10,
    );
    expect(feed.map((i) => i.id)).toEqual(['todo-1', 1, 2, 'todo-2']);
    expect(feed.map((i) => i.kind)).toEqual(['todo', 'entry', 'entry', 'todo']);
  });

  it('a to-do ids never collide with an entry of the same number', () => {
    const feed = mergeFeed([entry(3, '2026-10-05', null)], [todo(3, '2026-10-05', null)], 10);
    expect(new Set(feed.map((i) => i.id)).size).toBe(2);
  });

  it('leaves out to-dos with no finish day, and keeps to the count', () => {
    const feed = mergeFeed(
      [entry(1, '2026-10-05', null), entry(2, '2026-10-04', null)],
      [{ id: 9, text: 'Open', done: false, completedOn: null }, todo(4, '2026-10-03', null)],
      2,
    );
    expect(feed.map((i) => i.id)).toEqual([1, 2]);
  });

  it('groups by day with the entries and to-dos together', () => {
    const groups = groupByDay(
      mergeFeed([entry(1, '2026-10-05', '2026-10-05T10:00:00Z')], [todo(1, '2026-10-05', '2026-10-05T11:00:00Z')], 10),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].entries.map((i) => i.kind)).toEqual(['todo', 'entry']);
  });
});
