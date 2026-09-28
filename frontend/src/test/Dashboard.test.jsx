import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import client from '../api/client';

// --- Mocks ---------------------------------------------------------------

vi.mock('../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

// The shell is the top bar and the rail: not what this is about, and it wants
// a router and a session of its own.
vi.mock('../components/AppShell', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

// --- Helpers -------------------------------------------------------------

const TODAY = new Date(2026, 8, 16, 9, 0); // Wednesday
const TODAY_ISO = '2026-09-16';

const GOALS = [{ id: 1, title: 'Morning run', category: 'fitness', targetPerWeek: 3, frequency: 'weekly' }];
const entry = (id, logDate) => ({ id, goal: { id: 1 }, logDate, completed: true, note: 'Morning run' });

/** The week card's count, which is the number that counts up. */
const count = () => document.querySelector('.pass__count');

function loadWith(behaviors) {
  client.get.mockImplementation((url) =>
    Promise.resolve({ data: url === '/api/goals' ? GOALS : behaviors }),
  );
}

async function settle() {
  // Flush the fetches, then run the count-up to its end.
  await act(async () => {});
  await act(async () => {
    vi.advanceTimersByTime(600);
  });
}

describe('Dashboard week count', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: TODAY });
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts up to the new total when a goal ring is tapped, and pops while it does', async () => {
    loadWith([entry(10, '2026-09-14')]);
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    await settle();

    expect(count()).toHaveTextContent('1');
    expect(count().className).not.toContain('pass__count--pop');

    client.post.mockResolvedValue({ data: { id: 11 } });
    loadWith([entry(10, '2026-09-14'), entry(11, TODAY_ISO)]);

    fireEvent.click(screen.getByRole('button', { name: /Logs it done today/ }));
    await act(async () => {});

    // The new total is not on screen yet: it is being counted to, with the pop
    // running on the figure.
    expect(count().className).toContain('pass__count--pop');
    expect(count()).toHaveTextContent('1');

    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(count()).toHaveTextContent('2');
    expect(count().className).not.toContain('pass__count--pop');
  });

  it('counts the whole way when the total moves by more than one', async () => {
    loadWith([]);
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    await settle();
    expect(count()).toHaveTextContent('0');

    // Two entries land at once, as an undo or a second device can do.
    loadWith([entry(10, '2026-09-14'), entry(11, '2026-09-15'), entry(12, TODAY_ISO)]);
    client.post.mockResolvedValue({ data: { id: 12 } });
    fireEvent.click(screen.getByRole('button', { name: /Logs it done today/ }));
    await act(async () => {});

    expect(count().className).toContain('pass__count--pop');
    await act(async () => {
      vi.advanceTimersByTime(80);
    });
    const midway = Number(count().textContent);
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(3);

    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(count()).toHaveTextContent('3');
  });

  it('does not count on load when nothing has changed', async () => {
    loadWith([entry(10, '2026-09-14')]);
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    await act(async () => {});

    // The week arriving is itself a change, so it counts from zero — but it
    // lands on the real total and stops there.
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(count()).toHaveTextContent('1');
    expect(count().className).not.toContain('pass__count--pop');

    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(count()).toHaveTextContent('1');
    expect(count().className).not.toContain('pass__count--pop');
  });
});
