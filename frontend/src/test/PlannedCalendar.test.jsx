import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlannedChip from '../components/PlannedChip';
import MonthGrid from '../components/MonthGrid';
import CalendarModal from '../components/CalendarModal';
import client from '../api/client';
import { plannedGoalsOn } from '../lib/plannedDays';

vi.mock('../api/client', () => ({
  default: { get: vi.fn() },
}));

// Thursday 17 September 2026. The run is planned Monday, Wednesday, Friday.
const TODAY = new Date(2026, 8, 17);
const run = { id: 1, title: 'Morning run', category: 'fitness', targetPerWeek: 3, plannedDays: 0b001_0101 };
const read = { id: 2, title: 'Read', targetPerWeek: 3 };
const ENTRIES = [{ id: 10, goal: { id: 1, title: 'Morning run' }, logDate: '2026-09-14', completed: true, note: 'Loop' }];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.removeItem('mordi-week-start');
  client.get.mockResolvedValue({ data: ENTRIES });
});

describe('PlannedChip', () => {
  it('is a filled button on a done day, and logs that goal for that day', async () => {
    const user = userEvent.setup();
    const onLog = vi.fn();
    const { container } = render(
      <PlannedChip goal={run} done iso="2026-09-14" todayIso="2026-09-17" dayName="Monday, September 14" onLog={onLog} />,
    );
    const chip = screen.getByRole('button', { name: 'Morning run, planned, done. Log it for Monday, September 14.' });
    expect(chip).toHaveClass('planner__goal--done');
    expect(container.querySelector('svg')).not.toBeNull();
    await user.click(chip);
    expect(onLog).toHaveBeenCalledTimes(1);
  });

  it('is outlined until done, and says when a past day was not done', () => {
    render(<PlannedChip goal={run} done={false} iso="2026-09-16" todayIso="2026-09-17" dayName="Wednesday" onLog={() => {}} />);
    const chip = screen.getByRole('button', { name: /Morning run, planned, not done\./ });
    expect(chip).not.toHaveClass('planner__goal--done');
  });

  it('only shows the plan on a day still to come', () => {
    render(<PlannedChip goal={run} done={false} iso="2026-09-18" todayIso="2026-09-17" dayName="Friday" onLog={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Morning run, planned, still to come')).toBeInTheDocument();
  });
});

describe('MonthGrid planned marks', () => {
  it('marks planned days, filled once done, and names them on the date', () => {
    const days = Array.from({ length: 7 }, (_, i) => new Date(2026, 8, 14 + i));
    const { container } = render(
      <MonthGrid
        days={days}
        month={8}
        events={[]}
        now={TODAY}
        planned={(day) => plannedGoalsOn([run, read], ENTRIES, day)}
        onOpenDay={() => {}}
        onNew={() => {}}
        onOpenEvent={() => {}}
      />,
    );
    expect(container.querySelectorAll('.month__goal')).toHaveLength(3);
    expect(container.querySelectorAll('.month__goal--done')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /September 14, planned: Morning run, done$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /September 16, planned: Morning run$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /September 15$/ })).toBeInTheDocument();
  });

  it('draws nothing extra without planned goals', () => {
    const days = [new Date(2026, 8, 14)];
    const { container } = render(
      <MonthGrid days={days} month={8} events={[]} now={TODAY} onOpenDay={() => {}} onNew={() => {}} onOpenEvent={() => {}} />,
    );
    expect(container.querySelector('.month__goals')).toBeNull();
  });
});

describe('CalendarModal planned marks', () => {
  it('rings planned days and lists them under the picked day', async () => {
    const { container } = render(
      <CalendarModal
        goals={[run, read]}
        behaviors={ENTRIES}
        today={TODAY}
        initialSelected="2026-09-16"
        onClose={() => {}}
        onLogDay={() => {}}
      />,
    );
    await waitFor(() => expect(client.get).toHaveBeenCalled());
    expect(container.querySelectorAll('.cal__plan--done')).toHaveLength(1);
    expect(container.querySelectorAll('.cal__plan').length).toBeGreaterThan(10);
    expect(screen.getByText('Planned: Morning run, not done')).toBeInTheDocument();
    const grid = screen.getByRole('group', { name: /Days in/ });
    expect(
      within(grid).getByRole('button', { name: /Monday, September 14, 1 entry, planned: Morning run, done/ }),
    ).toBeInTheDocument();
  });

  it('is unchanged for goals without planned days', async () => {
    const { container } = render(
      <CalendarModal goals={[read]} behaviors={ENTRIES} today={TODAY} onClose={() => {}} onLogDay={() => {}} />,
    );
    await waitFor(() => expect(client.get).toHaveBeenCalled());
    expect(container.querySelector('.cal__plans')).toBeNull();
    expect(screen.queryByText(/^Planned:/)).toBeNull();
  });
});
