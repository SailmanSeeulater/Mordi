import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CalendarModal from '../components/CalendarModal';
import client from '../api/client';

vi.mock('../api/client', () => ({
  default: { get: vi.fn() },
}));

const TODAY = new Date(2026, 8, 17); // Thursday 17 September 2026

const entry = (id, logDate, completed, extra = {}) => ({
  id,
  logDate,
  completed,
  note: `note ${id}`,
  mood: 'good',
  goal: { id: 1, title: 'Walk the dog' },
  ...extra,
});

const SEPTEMBER = [
  entry(1, '2026-09-01', true),
  entry(2, '2026-09-02', false), // logged, nothing completed
  entry(3, '2026-09-17', true, { note: 'Quick loop' }),
  entry(4, '2026-09-17', true, { note: 'Second entry today', goal: null }),
];

function renderCalendar(props = {}) {
  return render(
    <CalendarModal
      behaviors={SEPTEMBER}
      today={TODAY}
      onClose={() => {}}
      onLogDay={() => {}}
      {...props}
    />,
  );
}

describe('CalendarModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.get.mockResolvedValue({ data: SEPTEMBER });
  });

  it('fetches only the visible month', async () => {
    renderCalendar();
    await waitFor(() =>
      expect(client.get).toHaveBeenCalledWith('/api/behaviors/range', {
        params: { start: '2026-09-01', end: '2026-09-30' },
      }),
    );
  });

  it('renders six weeks and marks today', async () => {
    const { container } = renderCalendar();
    await waitFor(() => expect(container.querySelectorAll('.cal__day')).toHaveLength(42));
    expect(container.querySelectorAll('.cal__day--today')).toHaveLength(1);
    // September 2026 starts on a Tuesday, so one August day pads the first row.
    expect(container.querySelectorAll('.cal__day--outside').length).toBeGreaterThan(0);
  });

  it('separates logged, logged-but-not-done, and empty past days', async () => {
    const { container } = renderCalendar();
    await waitFor(() => expect(container.querySelectorAll('.cal__day--done').length).toBe(2));
    expect(container.querySelectorAll('.cal__day--partial')).toHaveLength(1);
    // Every past September day with nothing logged, plus the padded August day.
    expect(container.querySelectorAll('.cal__day--missed').length).toBeGreaterThan(10);
  });

  it('opens on today and lists that day’s entries', async () => {
    renderCalendar();
    expect(await screen.findByText('Quick loop')).toBeInTheDocument();
    expect(screen.getByText('Second entry today')).toBeInTheDocument();
    // An entry with no goal says so rather than showing a blank.
    expect(screen.getByText('No goal')).toBeInTheDocument();
  });

  it('shows another day when picked', async () => {
    renderCalendar();
    const first = await screen.findByRole('button', { name: /Tuesday, September 1,/ });
    fireEvent.click(first);

    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Tuesday, September 1');
    expect(screen.getByText('note 1')).toBeInTheDocument();
  });

  it('says so when a day has nothing on it', async () => {
    renderCalendar();
    const empty = await screen.findByRole('button', { name: /Friday, September 4, nothing logged/ });
    fireEvent.click(empty);

    expect(screen.getByText('Nothing logged on this day.')).toBeInTheDocument();
  });

  it('pages to the previous month and refetches that range', async () => {
    renderCalendar();
    await waitFor(() => expect(client.get).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));

    await waitFor(() =>
      expect(client.get).toHaveBeenLastCalledWith('/api/behaviors/range', {
        params: { start: '2026-08-01', end: '2026-08-31' },
      }),
    );
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('August 2026');
  });

  it('keeps the grid usable when the month request fails', async () => {
    client.get.mockRejectedValueOnce(new Error('offline'));
    const { container } = renderCalendar();

    expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn’t load this month/);
    // The seeded entries are still shown rather than a blank month.
    expect(container.querySelectorAll('.cal__day')).toHaveLength(42);
  });

  it('treats a non-list response as an error instead of rendering it', async () => {
    client.get.mockResolvedValueOnce({ data: { error: 'unauthorized' } });
    const { container } = renderCalendar();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(container.querySelectorAll('.cal__day')).toHaveLength(42);
  });
});
