import { describe, expect, it } from 'vitest';
import { composeReminder, daysLeft } from '../lib/reminder';

const row = (title, target, done) => ({ goal: { title }, target, done });

describe('composeReminder', () => {
  it('lists what is left, most pressing first, in the push wording', () => {
    const r = composeReminder([row('Read before bed', 7, 3), row('Morning run', 4, 1)], 3);
    expect(r.title).toBe('4 days left this week');
    expect(r.body).toBe('Morning run: 3 of 4 left · Read before bed: 4 of 7 left');
    expect(r.items.map((i) => i.title)).toEqual(['Morning run', 'Read before bed']);
  });

  it('is nothing when every target is met', () => {
    expect(composeReminder([row('Run', 4, 4), row('Read', 7, 9)], 3)).toBeNull();
    expect(composeReminder([], 0)).toBeNull();
  });

  it('breaks ties by title and lists at most three', () => {
    const r = composeReminder(
      [row('Dog walk', 2, 1), row('Call home', 2, 1), row('Stretch', 2, 1), row('Yoga', 2, 1)],
      0,
    );
    expect(r.body).toBe('Call home: 1 of 2 left · Dog walk: 1 of 2 left · Stretch: 1 of 2 left · and 1 more');
    expect(r.more).toBe(1);
  });

  it('says last day on Sunday', () => {
    expect(composeReminder([row('Run', 4, 2)], 6).title).toBe('Last day of the week');
    expect(daysLeft(0)).toBe(7);
    expect(daysLeft(6)).toBe(1);
  });
});
