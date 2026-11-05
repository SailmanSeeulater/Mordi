import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Reports from '../pages/Reports';
import client from '../api/client';

vi.mock('../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('../components/AppShell', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

const report = (id, weekStart, weekEnd, achievedEntries) => ({
  id,
  weekStart,
  weekEnd,
  plannedEntries: 10,
  achievedEntries,
  totalBehaviors: achievedEntries,
  completedBehaviors: achievedEntries,
  goalsTotal: 3,
  goalsOnTrack: 1,
  summary: '',
});

describe('Reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('says how each week compares with the one before in days, not points', async () => {
    client.get.mockImplementation((url) =>
      Promise.resolve({
        data:
          url === '/api/reports'
            ? [
                report(3, '2026-09-14', '2026-09-20', 8),
                report(2, '2026-09-07', '2026-09-13', 5),
                report(1, '2026-08-31', '2026-09-06', 6),
              ]
            : [],
      }),
    );
    render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>,
    );

    expect(await screen.findByText('3 more days than the week before')).toBeInTheDocument();
    expect(screen.getByText('1 fewer day than the week before')).toBeInTheDocument();
    expect(screen.getByText('+3 days')).toBeInTheDocument();
    expect(screen.getByText('−1 day')).toBeInTheDocument();
    expect(screen.queryByText(/pts/)).not.toBeInTheDocument();
  });
});
