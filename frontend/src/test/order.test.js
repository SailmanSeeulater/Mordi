import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  moveBefore,
  nudgeBy,
  orderedIds,
  readOrder,
  sortByIds,
  writeOrder,
} from '../lib/order';

const items = (...ids) => ids.map((id) => ({ id }));

describe('orderedIds', () => {
  it('follows the saved order', () => {
    expect(orderedIds(items(1, 2, 3), ['3', '1', '2'])).toEqual(['3', '1', '2']);
  });

  it('drops saved ids that no longer exist', () => {
    expect(orderedIds(items(1, 3), ['3', '2', '1'])).toEqual(['3', '1']);
  });

  it('appends items the saved order has never seen, in their natural order', () => {
    // A new goal must not be hidden, and must not jump to the front either.
    expect(orderedIds(items(1, 2, 9, 10), ['2', '1'])).toEqual(['2', '1', '9', '10']);
  });

  it('is the natural order when nothing is saved', () => {
    expect(orderedIds(items(4, 5, 6), [])).toEqual(['4', '5', '6']);
  });

  it('survives a saved order that is entirely stale', () => {
    expect(orderedIds(items(1, 2), ['88', '99'])).toEqual(['1', '2']);
  });
});

describe('sortByIds', () => {
  it('rearranges the items to match', () => {
    expect(sortByIds(items(1, 2, 3), ['2', '3', '1']).map((i) => i.id)).toEqual([2, 3, 1]);
  });

  it('leaves the input array alone', () => {
    const input = items(1, 2, 3);
    sortByIds(input, ['3', '2', '1']);
    expect(input.map((i) => i.id)).toEqual([1, 2, 3]);
  });
});

describe('moveBefore', () => {
  it('moves an item to where the target sits', () => {
    expect(moveBefore(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
    expect(moveBefore(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
  });

  it('returns the same array when nothing would change, so callers can skip a write', () => {
    const ids = ['a', 'b', 'c'];
    expect(moveBefore(ids, 'b', 'b')).toBe(ids);
    expect(moveBefore(ids, 'zzz', 'a')).toBe(ids);
    expect(moveBefore(ids, 'a', 'zzz')).toBe(ids);
  });
});

describe('nudgeBy', () => {
  it('moves one place in either direction', () => {
    expect(nudgeBy(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(nudgeBy(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
  });

  it('clamps at both ends instead of wrapping', () => {
    const ids = ['a', 'b', 'c'];
    expect(nudgeBy(ids, 'a', -1)).toBe(ids);
    expect(nudgeBy(ids, 'c', 1)).toBe(ids);
  });

  it('ignores an id that is not in the list', () => {
    const ids = ['a', 'b'];
    expect(nudgeBy(ids, 'zzz', 1)).toBe(ids);
  });
});

describe('persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips an order', () => {
    writeOrder('k', ['b', 'a']);
    expect(readOrder('k')).toEqual(['b', 'a']);
  });

  it('is empty when nothing is stored', () => {
    expect(readOrder('k')).toEqual([]);
  });

  it('survives a corrupted entry', () => {
    localStorage.setItem('k', '{not json');
    expect(readOrder('k')).toEqual([]);
  });

  it('ignores a stored value that is not a list of ids', () => {
    localStorage.setItem('k', JSON.stringify({ a: 1 }));
    expect(readOrder('k')).toEqual([]);
    localStorage.setItem('k', JSON.stringify(['a', 7, null]));
    expect(readOrder('k')).toEqual(['a']);
  });

  it('does not throw when storage is unavailable', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeOrder('k', ['a'])).not.toThrow();
    setItem.mockRestore();
  });
});
