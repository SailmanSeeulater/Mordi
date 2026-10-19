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

const EXPORT = {
  exportedAt: '2026-10-19T12:00:00Z',
  account: { name: 'Sam', email: 'sam@example.test' },
  goals: [{ id: 1, title: 'Run' }],
  entries: [{ id: 5, goalId: 1 }, { id: 6, goalId: 1 }],
  notes: [{ title: 'Shoes', body: 'Size 10' }],
  todos: [{ text: 'Book dentist', done: true }],
  messages: [{ goalTitle: 'Read together', body: 'Chapter 3 done' }],
  connectedCalendars: [{ name: 'Work', color: 'violet', eventCount: 128 }],
};

describe('Download my data', () => {
  it('saves the server’s full export as it came', async () => {
    client.get.mockResolvedValue({ data: EXPORT });

    const exported = await download();

    expect(client.get).toHaveBeenCalledWith('/api/account/export');
    expect(exported).toEqual(EXPORT);
    expect(await screen.findByText('Downloaded 1 goals and 2 entries.')).toBeInTheDocument();
  });

  it('says so when the export fails, and saves nothing', async () => {
    client.get.mockRejectedValue({ response: { status: 500 } });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Download my data' }));

    expect(await screen.findByText('Couldn’t build your export. Try again in a moment.')).toBeInTheDocument();
    expect(saved).toBeNull();
  });
});
