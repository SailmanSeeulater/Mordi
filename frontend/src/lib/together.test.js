import { describe, expect, it } from 'vitest';
import { initials, inviteUrl, readInviteCode, sharedGoals, sinceLabel, togetherLabel } from './together';

const CODE = 'q3Zb8XkR2yT0vN5mL1wP9sD4fG6hJ7aK0cE2uI8oY1x';

describe('invite links', () => {
  it('put the code after a # so it never reaches the server', () => {
    const url = inviteUrl(CODE, 'https://mordi.latesailor.dev');
    expect(url).toBe(`https://mordi.latesailor.dev/join#${CODE}`);
    expect(new URL(url).pathname).toBe('/join');
  });

  it('read the code back, and nothing that is not one', () => {
    expect(readInviteCode(`#${CODE}`)).toBe(CODE);
    expect(readInviteCode('')).toBe('');
    expect(readInviteCode('#short')).toBe('');
    expect(readInviteCode('#<script>alert(1)</script>xxxxxxxxxxxx')).toBe('');
  });
});

describe('people', () => {
  it('initials use the first and last name', () => {
    expect(initials('Sam Rivera')).toBe('SR');
    expect(initials('alex')).toBe('A');
    expect(initials('  ')).toBe('?');
  });

  it('a shared goal is one someone else owns, or one with others in it', () => {
    const goals = [
      { id: 1, role: 'owner', memberCount: 1 },
      { id: 2, role: 'owner', memberCount: 3 },
      { id: 3, role: 'member', memberCount: 2 },
    ];
    expect(sharedGoals(goals).map((g) => g.id)).toEqual([2, 3]);
  });

  it('labels say whose goal it is and who is in it', () => {
    expect(togetherLabel({ role: 'owner', memberCount: 1 })).toBe('Just you');
    expect(togetherLabel({ role: 'owner', memberCount: 2 })).toBe('You and 1 other');
    expect(togetherLabel({ role: 'owner', memberCount: 4 })).toBe('You and 3 others');
    expect(togetherLabel({ role: 'member', memberCount: 3, ownerName: 'Sam Rivera' })).toBe(
      'Sam’s goal · 3 people',
    );
  });
});

describe('sinceLabel', () => {
  const now = new Date(2026, 8, 23, 15, 0, 0);
  it('is short for recent messages and a date for older ones', () => {
    expect(sinceLabel(new Date(2026, 8, 23, 14, 59, 30).toISOString(), now)).toBe('Just now');
    expect(sinceLabel(new Date(2026, 8, 23, 14, 45).toISOString(), now)).toBe('15m');
    expect(sinceLabel(new Date(2026, 8, 23, 12, 0).toISOString(), now)).toBe('3h');
    expect(sinceLabel(new Date(2026, 8, 20, 12, 0).toISOString(), now)).toMatch(/20/);
  });
});
