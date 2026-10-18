import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Settings from '../pages/Settings';
import client from '../api/client';

vi.mock('../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('../components/AppShell', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: { name: 'Sam', email: 'sam@example.test' }, logout: vi.fn() }),
}));
vi.mock('../context/useTheme', () => ({
  useTheme: () => ({ theme: 'sorbet', setTheme: vi.fn(), allThemes: [{ id: 'sorbet', label: 'Sorbet' }] }),
}));
// Panels with their own data and contexts: not what this is about.
vi.mock('../components/ThemeGrid', () => ({ default: () => null }));
vi.mock('../components/CustomThemeEditor', () => ({ default: () => null }));
vi.mock('../components/RemindersSettings', () => ({ default: () => null }));
vi.mock('../components/LayoutSettings', () => ({ default: () => null }));
vi.mock('../components/ChangePasswordForm', () => ({ default: () => null }));
vi.mock('../components/DeleteAccount', () => ({ default: () => null }));

const FEED = {
  id: 1,
  name: 'Work',
  color: 'violet',
  addressHint: 'calendar.google.com/…sam',
  lastSyncedAt: '2026-10-18T11:56:00Z',
  lastError: null,
  eventCount: 128,
};

let saved;

beforeEach(() => {
  vi.clearAllMocks();
  saved = null;
  URL.createObjectURL = vi.fn((blob) => {
    saved = blob;
    return 'blob:mordi-export';
  });
  URL.revokeObjectURL = vi.fn();
  // jsdom cannot navigate to a download; the click is all that matters.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const download = async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { name: 'Download my data' }));
  await waitFor(() => expect(saved).not.toBeNull());
  return JSON.parse(await saved.text());
};

describe('Download my data', () => {
  it('includes connected calendars by name, colour and counts, never their addresses', async () => {
    client.get.mockImplementation((url) =>
      Promise.resolve({ data: url === '/api/calendar-feeds' ? [FEED] : [] }),
    );

    const exported = await download();

    expect(exported.connectedCalendars).toEqual([
      { name: 'Work', color: 'violet', eventCount: 128, lastSyncedAt: FEED.lastSyncedAt, lastError: null },
    ]);
    expect(JSON.stringify(exported)).not.toMatch(/calendar\.google\.com|addressHint|private-/);
  });

  it('still downloads when the server has Google Calendar sync off', async () => {
    client.get.mockImplementation((url) =>
      url === '/api/calendar-feeds'
        ? Promise.reject({ response: { status: 404 } })
        : Promise.resolve({ data: [] }),
    );

    const exported = await download();

    expect(exported.connectedCalendars).toEqual([]);
  });
});
