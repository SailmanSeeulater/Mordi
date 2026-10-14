import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminUsage from '../pages/AdminUsage';
import client from '../api/client';

// --- Mocks ---------------------------------------------------------------

vi.mock('../api/client', () => ({
  default: { get: vi.fn() },
}));

// The shell wants a session, a theme and a router of its own; it is not what
// this is about, but its title is: the page is called "Usage".
vi.mock('../components/AppShell', () => ({
  default: ({ title, children }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

// --- Helpers -------------------------------------------------------------

const row = (day, overrides = {}) => ({
  day,
  totalUsers: 1200,
  newUsers: 4,
  activeUsers: 31,
  weeklyActiveUsers: 88,
  monthlyActiveUsers: 240,
  entriesLogged: 305,
  todosDone: 77,
  goalsCreated: 6,
  cohortSize: 20,
  cohortRetained: 7,
  ...overrides,
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/usage']}>
      <Routes>
        <Route path="/admin/usage" element={<AdminUsage />} />
        <Route path="/" element={<p>Home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows today as headline facts and the saved days as a table, newest first', async () => {
    client.get.mockResolvedValue({
      data: {
        today: row('2026-10-14'),
        days: [
          row('2026-10-13', { activeUsers: 29 }),
          row('2026-10-12', { activeUsers: 25, goalsCreated: 2 }),
        ],
      },
    });
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Usage' })).toBeInTheDocument();
    expect(client.get).toHaveBeenCalledWith('/api/admin/stats');

    const today = screen.getByRole('region', { name: 'Today so far' });
    const fact = (name) => within(today).getByText(name).nextElementSibling;
    expect(fact('Active today')).toHaveTextContent('31');
    expect(fact('Active this week')).toHaveTextContent('88');
    expect(fact('Active this month')).toHaveTextContent('240');
    expect(fact('Total accounts').textContent).toBe((1200).toLocaleString());
    expect(fact('4-week retention')).toHaveTextContent('7 of 20 (35%)');

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Day', 'Active', 'Weekly', 'Monthly', 'New', 'Entries', 'To-dos done', 'Goals created',
    ]);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    // Newest first, as sent: the 13th, then the 12th.
    expect(within(rows[0]).getByRole('rowheader')).toHaveTextContent(/13/);
    expect(within(rows[1]).getByRole('rowheader')).toHaveTextContent(/12/);
    expect(within(rows[0]).getAllByRole('cell')[0]).toHaveTextContent('29');
    expect(within(rows[1]).getAllByRole('cell')[0]).toHaveTextContent('25');
    expect(within(rows[1]).getAllByRole('cell')[6]).toHaveTextContent('2');
  });

  it('shows a dash for retention while the cohort is empty', async () => {
    client.get.mockResolvedValue({
      data: { today: row('2026-10-14', { cohortSize: 0, cohortRetained: 0 }), days: [] },
    });
    renderPage();

    const today = await screen.findByRole('region', { name: 'Today so far' });
    expect(within(today).getByText('4-week retention').nextElementSibling).toHaveTextContent('—');
  });

  it('says when the first snapshot is due while there are no saved days', async () => {
    client.get.mockResolvedValue({ data: { today: row('2026-10-14'), days: [] } });
    renderPage();

    expect(
      await screen.findByText(
        'The first daily snapshot is taken at 23:55 UTC. Today’s live numbers are above.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('is not found for anyone the server answers 404: it goes where any unknown address goes', async () => {
    client.get.mockRejectedValue({ response: { status: 404 } });
    renderPage();

    expect(await screen.findByText('Home')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Usage' })).not.toBeInTheDocument();
  });

  it('offers to try again when the numbers cannot be loaded, and then loads them', async () => {
    client.get.mockRejectedValueOnce({ response: { status: 500 } });
    renderPage();

    expect(await screen.findByText('Couldn’t load the numbers.')).toBeInTheDocument();

    client.get.mockResolvedValueOnce({ data: { today: row('2026-10-14'), days: [] } });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('region', { name: 'Today so far' })).toBeInTheDocument();
  });
});
