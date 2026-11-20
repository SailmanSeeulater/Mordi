import { describe, it, expect, vi, beforeEach } from 'vitest';
import client from '../api/client';
import {
  SAVE_ACCOUNT,
  askToSave,
  guestEndsOn,
  guestRefusal,
  isGuest,
  sessionUser,
  startGuest,
  startGuestError,
} from '../lib/guest';

vi.mock('../api/client', () => ({
  default: { post: vi.fn() },
  SAVE_ACCOUNT: 'mordi:save-account',
}));

describe('guest helpers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('knows a guest by the day it goes', () => {
    expect(isGuest({ email: 'a@b.c', guestUntil: '2026-11-26T22:30:00' })).toBe(true);
    expect(isGuest({ email: 'a@b.c', guestUntil: null })).toBe(false);
    expect(isGuest(null)).toBe(false);
  });

  it('names the day the demo goes, by its date alone', () => {
    expect(guestEndsOn({ guestUntil: '2026-11-26T23:59:00' }, 'en-US')).toBe('Thursday, November 26');
    expect(guestEndsOn({ guestUntil: null }, 'en-US')).toBe('');
  });

  it('reads only a guest refusal as one', () => {
    const blocked = { response: { status: 403, data: { guest: 'blocked', error: 'Save it.' } } };
    expect(guestRefusal(blocked)).toBe('Save it.');
    expect(guestRefusal({ response: { status: 403, data: { error: 'Nope' } } })).toBeNull();
    expect(guestRefusal({ response: { status: 500 } })).toBeNull();
  });

  it('opens the save dialog with a reason', () => {
    const seen = vi.fn();
    window.addEventListener(SAVE_ACCOUNT, seen);
    askToSave('Sharing needs it.');
    window.removeEventListener(SAVE_ACCOUNT, seen);
    expect(seen.mock.calls[0][0].detail.reason).toBe('Sharing needs it.');
  });

  it('starts a demo in the browser’s own zone, with the sample', async () => {
    client.post.mockResolvedValue({ data: { token: 't', email: 'g@guest.invalid', name: 'Guest', guestUntil: 'x' } });
    const session = await startGuest();
    expect(client.post).toHaveBeenCalledWith('/api/auth/guest', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      sample: true,
    });
    expect(sessionUser(session)).toEqual({ email: 'g@guest.invalid', name: 'Guest', guestUntil: 'x' });
  });

  it('passes on the server’s reason when the demo is busy or used up', () => {
    const busy = { response: { status: 503, data: { error: 'The demo is busy.' } } };
    const many = { response: { status: 429, data: { error: 'Lots of demos.' } } };
    expect(startGuestError(busy)).toBe('The demo is busy.');
    expect(startGuestError(many)).toBe('Lots of demos.');
    expect(startGuestError(new Error('offline'))).toMatch(/connection/);
  });

  it('keeps a saved account without a deletion day', () => {
    expect(sessionUser({ email: 'a@b.c', name: 'A' })).toEqual({ email: 'a@b.c', name: 'A', guestUntil: null });
  });
});
