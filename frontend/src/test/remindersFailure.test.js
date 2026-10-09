import { describe, expect, it } from 'vitest';
import { turnOnFailure } from '../lib/push';

describe('turnOnFailure', () => {
  it('names a blocked permission', () => {
    expect(turnOnFailure(new Error('denied'))).toMatch(/blocked/);
  });

  it('passes the server’s own reason through', () => {
    const err = { response: { status: 400, data: { error: 'That is not a known push service' } } };
    expect(turnOnFailure(err)).toBe('The server said: That is not a known push service');
  });

  it('reports a server status without a reason', () => {
    expect(turnOnFailure({ response: { status: 502 } })).toMatch(/502/);
  });

  it('explains a refusing push service', () => {
    const err = new DOMException('Registration failed', 'AbortError');
    expect(turnOnFailure(err)).toMatch(/AbortError/);
  });

  it('falls back to the error’s message', () => {
    expect(turnOnFailure(new Error('Failed to fetch'))).toBe('Couldn’t turn reminders on: Failed to fetch.');
  });
});
