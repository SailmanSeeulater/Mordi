import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CalendarModal from '../components/CalendarModal';
import client from '../api/client';

vi.mock('../api/client', () => ({
  default: { get: vi.fn() },
}));

// Removing an entry from the month's day list. Its Undo stays in its place,
// inside the dialog, rather than in a toast the dialog would cover.

const TODAY = new Date(2026, 8, 17);
const RUN = { id: 5, logDate: '2026-09-17', completed: true, note: 'Quick loop', mood: 'good', goal: { id: 1, title: 'Walk the dog' } };
const OTHER = { id: 6, logDate: '2026-09-17', completed: true, note: 'Second entry today', goal: null };

function renderCalendar(props) {
  return render(
    <CalendarModal behaviors={[RUN, OTHER]} today={TODAY} onClose={() => {}} onLogDay={() => {}} {...props} />,
  );
}

describe('CalendarModal removing an entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.get.mockResolvedValue({ data: [RUN, OTHER] });
  });

  it('offers no Remove when the page gives it no way to remove', async () => {
    renderCalendar({});
    await screen.findByText('Quick loop');
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
  });

  it('removes an entry, holds its Undo in place, and puts it back', async () => {
    const onRemove = vi.fn().mockResolvedValue();
    const onRestore = vi.fn().mockResolvedValue({ ...RUN, id: 50 });
    renderCalendar({ onRemove, onRestore });
    await screen.findByText('Quick loop');
    const today = () => screen.getByRole('button', { name: /Thursday, September 17,/ });
    expect(today()).toHaveAccessibleName(/2 entries/);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Quick loop' }));
    await act(async () => {});

    expect(onRemove).toHaveBeenCalledWith(RUN);
    expect(screen.queryByText('Quick loop')).toBeNull();
    expect(screen.getByText('Removed Walk the dog')).toBeInTheDocument();
    const undo = screen.getByRole('button', { name: 'Undo removing Walk the dog' });
    // Focus moves to the Undo, so it never drops out of the dialog.
    expect(undo).toHaveFocus();
    // The day's count leaves the removed entry out.
    expect(today()).toHaveAccessibleName(/1 entry/);

    fireEvent.click(undo);
    await act(async () => {});

    expect(onRestore).toHaveBeenCalledWith(RUN);
    expect(screen.getByText('Quick loop')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Quick loop' })).toHaveFocus();
    expect(today()).toHaveAccessibleName(/2 entries/);
  });

  it('keeps the entry and says so when removing fails', async () => {
    const onRemove = vi.fn().mockRejectedValue(new Error('offline'));
    renderCalendar({ onRemove, onRestore: vi.fn() });
    await screen.findByText('Quick loop');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Quick loop' }));
    await act(async () => {});

    expect(screen.getByText('Quick loop')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/Couldn’t remove that entry/);
  });
});
