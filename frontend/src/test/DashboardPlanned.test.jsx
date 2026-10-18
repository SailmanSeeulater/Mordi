import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import client from '../api/client';

vi.mock('../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('../components/AppShell', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

const TODAY = new Date(2026, 8, 16, 9, 0); // Wednesday 16 September 2026

const RUN = { id: 1, title: 'Morning run', category: 'fitness', targetPerWeek: 3, frequency: 'weekly' };
const entry = (id, logDate) => ({ id, goal: { id: 1, title: 'Morning run' }, logDate, completed: true, note: 'Run' });

function show(goals, behaviors) {
  client.get.mockImplementation((url) => Promise.resolve({ data: url === '/api/goals' ? goals : behaviors }));
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

async function settle() {
  await act(async () => {});
  await act(async () => {
    vi.advanceTimersByTime(600);
  });
}

const pace = () => document.querySelector('.pass__pace').firstChild.textContent;

describe('Dashboard with planned days', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: TODAY });
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('without planned days, spreads the target as before: 1 of 3 by Wednesday is on pace', async () => {
    show([RUN], [entry(10, '2026-09-14')]);
    await settle();
    expect(pace()).toBe('On pace');
    expect(screen.getByRole('button', { name: /1 of 3 logged this week\. Logs it done/ })).toBeInTheDocument();
  });

  it('with Monday, Wednesday and Friday picked, owes two by Wednesday and says the days on the ring', async () => {
    show([{ ...RUN, plannedDays: 0b001_0101 }], [entry(10, '2026-09-14')]);
    await settle();
    expect(pace()).toBe('Log 1 to be on pace');
    expect(
      screen.getByRole('button', { name: /1 of 3 logged this week\. Planned for Mon, Wed, Fri\. Logs it done/ }),
    ).toBeInTheDocument();
    // Today is a run day, not done yet, so it is in what is left.
    expect(document.querySelector('.pass__left')).toHaveTextContent('Morning run: 2 of 3 left');
  });

  it('counts a run moved to Tuesday, and says nothing on a day the goal isn’t planned for', async () => {
    // Monday, Thursday: Wednesday is not a run day.
    show([{ ...RUN, targetPerWeek: 2, plannedDays: 0b000_1001 }], [entry(10, '2026-09-15')]);
    await settle();
    // Due by Wednesday: Monday only. Done: Tuesday's run. On pace.
    expect(pace()).toBe('On pace');
    expect(document.querySelector('.pass__left')).toBeNull();
  });
});
