import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { turnOnFailure } from '../lib/push';

// The person sees what happened and what to do; the technical cause goes to
// the console for whoever is fixing it.
describe('turnOnFailure', () => {
  let warn;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('names a blocked permission', () => {
    expect(turnOnFailure(new Error('denied'))).toMatch(/blocked/);
  });

  it('passes the server’s own reason through', () => {
    const err = { response: { status: 400, data: { error: 'That is not a known push service' } } };
    expect(turnOnFailure(err)).toBe('That is not a known push service');
  });

  it('keeps a server status out of the message and logs it instead', () => {
    const text = turnOnFailure({ response: { status: 502 } });
    expect(text).not.toMatch(/502/);
    expect(text).toMatch(/try again/i);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/502/));
  });

  it('explains a refusing push service without the error name', () => {
    const err = new DOMException('Registration failed', 'AbortError');
    const text = turnOnFailure(err);
    expect(text).not.toMatch(/AbortError/);
    expect(text).toMatch(/home screen/);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/AbortError/));
  });

  it('falls back to a plain line and logs the error’s message', () => {
    expect(turnOnFailure(new Error('Failed to fetch'))).toBe(
      'Couldn’t turn reminders on. Check your connection and try again.',
    );
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Failed to fetch/));
  });
});
