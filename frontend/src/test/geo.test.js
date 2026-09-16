import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readCachedPlace, round, shortPlace, writeCachedPlace } from '../lib/geo';

describe('shortPlace', () => {
  it('keeps the street line and the town', () => {
    expect(shortPlace('1200 Harbor Dr, San Diego, CA 92101, USA'))
      .toBe('1200 Harbor Dr, San Diego');
  });

  it('handles an address with one part', () => {
    expect(shortPlace('Balboa Park')).toBe('Balboa Park');
  });

  it('is empty for nothing', () => {
    expect(shortPlace('')).toBe('');
    expect(shortPlace(undefined)).toBe('');
  });

  it('drops empty segments rather than leaving a dangling comma', () => {
    expect(shortPlace('Harbor Dr, , San Diego')).toBe('Harbor Dr, San Diego');
  });
});

describe('round', () => {
  it('cuts precision to about eleven metres', () => {
    expect(round(32.71573829)).toBe(32.7157);
    expect(round(-117.16109999)).toBe(-117.1611);
  });
});

describe('the last-place cache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips a place', () => {
    writeCachedPlace({ latitude: 32.7157, longitude: -117.1611, placeName: 'Balboa Park' });
    expect(readCachedPlace()).toEqual({
      latitude: 32.7157,
      longitude: -117.1611,
      placeName: 'Balboa Park',
    });
  });

  it('is null when nothing has been stored', () => {
    expect(readCachedPlace()).toBeNull();
  });

  it('rejects a stored value without usable coordinates', () => {
    localStorage.setItem('mordi-last-place', JSON.stringify({ placeName: 'The gym' }));
    expect(readCachedPlace()).toBeNull();
  });

  it('survives a corrupted entry', () => {
    localStorage.setItem('mordi-last-place', 'not json');
    expect(readCachedPlace()).toBeNull();
  });

  it('does not throw when storage is unavailable', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    expect(() => writeCachedPlace({ latitude: 1, longitude: 2 })).not.toThrow();
    setItem.mockRestore();
  });
});
