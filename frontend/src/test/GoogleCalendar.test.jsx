import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Calendar from '../pages/Calendar';
import GoogleCalendarDialog from '../components/GoogleCalendarDialog';
import MonthGrid from '../components/MonthGrid';
import PlanToday from '../components/PlanToday';
import client from '../api/client';
import { isStale, syncedLabel } from '../lib/calendarFeeds';
import { toLocalIso } from '../lib/planner';

vi.mock('../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

// The shell is the top bar and the rail: not what this is about.
vi.mock('../components/AppShell', () => ({
  default: ({ children, action }) => (
    <div>
      {action}
      {children}
    </div>
  ),
}));

const URL_ = 'https://calendar.google.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics';
const minutesAgo = (n) => new Date(Date.now() - n * 60_000).toISOString();
const at = (h, m = 0) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return toLocalIso(d);
};

const WORK = {
  id: 1,
  name: 'Work',
  color: 'violet',
  addressHint: 'calendar.google.com/…sam',
  lastSyncedAt: minutesAgo(4),
  lastError: null,
  eventCount: 128,
};
const FROM_GOOGLE = {
  id: 50,
  feedId: 1,
  title: 'Standup',
  startsAt: at(10),
  endsAt: at(11),
  allDay: false,
  color: 'violet',
  placeName: 'Room 4',
  notes: 'Bring the numbers',
};
const OWN = { id: 51, feedId: null, title: 'Gym', startsAt: at(13), endsAt: at(14), allDay: false, color: 'sage' };

function serve({ enabled = true, feeds = [WORK], events = [FROM_GOOGLE, OWN] } = {}) {
  client.get.mockImplementation((url) => {
    if (url === '/api/calendar-feeds/config') return Promise.resolve({ data: { enabled } });
    if (url === '/api/calendar-feeds') return Promise.resolve({ data: feeds });
    if (url === '/api/events') return Promise.resolve({ data: events });
    return Promise.resolve({ data: [] });
  });
}

const renderCalendar = async () => {
  render(
    <MemoryRouter>
      <Calendar />
    </MemoryRouter>,
  );
  await act(async () => {});
  await act(async () => {});
};

const eventsRequests = () => client.get.mock.calls.filter(([url]) => url === '/api/events').length;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the Google Calendar button', () => {
  it('shows when the server can connect calendars', async () => {
    serve();
    await renderCalendar();
    expect(screen.getByRole('button', { name: 'Google Calendar' })).toBeInTheDocument();
  });

  it('is hidden when the server says the feature is off', async () => {
    serve({ enabled: false, feeds: [] });
    await renderCalendar();
    expect(screen.getByRole('button', { name: /Import \.ics/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Google Calendar' })).toBeNull();
    expect(client.get).not.toHaveBeenCalledWith('/api/calendar-feeds');
  });
});

describe('events from Google on the calendar', () => {
  it('say where they come from and cannot be resized', async () => {
    serve();
    await renderCalendar();

    const google = screen.getByRole('button', { name: /^Standup, .*from Google Calendar · Work$/ });
    const own = screen.getByRole('button', { name: /^Gym, / });
    expect(google.closest('.planner__event')).toHaveClass('planner__event--feed');
    expect(google.closest('.planner__event').querySelector('.planner__resize')).toBeNull();
    expect(google.closest('.planner__event').querySelector('.feed-mark')).not.toBeNull();
    expect(own.closest('.planner__event').querySelector('.planner__resize')).not.toBeNull();
  });

  it('do not move when dragged, and open read-only', async () => {
    serve();
    await renderCalendar();
    const body = screen.getByRole('button', { name: /^Standup, / });
    const block = body.closest('.planner__event');

    fireEvent.pointerDown(block, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(block, { clientX: 10, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(block, { clientX: 10, clientY: 200, pointerId: 1 });
    expect(client.put).not.toHaveBeenCalled();
    expect(block).not.toHaveClass('planner__event--held');

    fireEvent.click(body);
    const dialog = screen.getByRole('dialog', { name: 'Standup' });
    expect(within(dialog).getByText('From Google Calendar · Work')).toBeInTheDocument();
    expect(within(dialog).getByText('Change it in Google Calendar.')).toBeInTheDocument();
    expect(within(dialog).getByText('Room 4')).toBeInTheDocument();
    expect(within(dialog).getByText('Bring the numbers')).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('leave Mordi’s own events editable', async () => {
    serve();
    await renderCalendar();

    fireEvent.click(screen.getByRole('button', { name: /^Gym, / }), { detail: 0 });
    expect(screen.getByRole('dialog', { name: 'Edit event' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('open read-only from the month too, with their mark', async () => {
    const onOpenEvent = vi.fn();
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    render(
      <MonthGrid
        days={[day]}
        month={day.getMonth()}
        events={[FROM_GOOGLE, OWN]}
        now={new Date()}
        onOpenDay={() => {}}
        onNew={() => {}}
        onOpenEvent={onOpenEvent}
        sourceLabel={(e) => (e.feedId ? ', from Google Calendar · Work' : '')}
      />,
    );
    const chip = screen.getByRole('button', { name: 'Standup, from Google Calendar · Work' });
    expect(chip).toHaveClass('month__event--feed');
    expect(chip.querySelector('.feed-mark')).not.toBeNull();
    fireEvent.click(chip);
    expect(onOpenEvent).toHaveBeenCalledWith(FROM_GOOGLE);
  });

  it('are never asked “did it happen?” on the dashboard', async () => {
    // Mid-afternoon, so the block that ended is today's whatever the real clock says.
    vi.useFakeTimers({ now: new Date(2026, 9, 18, 15, 0), toFake: ['Date'] });
    const earlier = new Date(2026, 9, 18, 11, 0);
    const later = new Date(earlier.getTime() + 30 * 60_000);
    const ended = { ...FROM_GOOGLE, startsAt: toLocalIso(earlier), endsAt: toLocalIso(later) };
    const mine = { ...OWN, id: 52, title: 'Write', startsAt: toLocalIso(earlier), endsAt: toLocalIso(later) };
    client.get.mockResolvedValue({ data: [ended, mine] });
    render(
      <MemoryRouter>
        <PlanToday today={new Date()} goals={[]} />
      </MemoryRouter>,
    );
    await screen.findByText('Standup');

    // Only Mordi's own block gets Done and Skip.
    expect(screen.getAllByRole('button', { name: 'Skip' })).toHaveLength(1);
    expect(screen.getByText('Did Write happen?')).toBeInTheDocument();
    expect(screen.queryByText('Did Standup happen?')).toBeNull();
  });
});

describe('opening the calendar catches up stale feeds', () => {
  it('syncs a feed the timer has not reached, once, then refetches events', async () => {
    const stale = { ...WORK, lastSyncedAt: minutesAgo(20) };
    serve({ feeds: [stale, { ...WORK, id: 2, name: 'Home' }] });
    client.post.mockResolvedValue({ data: { ...stale, lastSyncedAt: minutesAgo(0), eventCount: 130 } });

    await renderCalendar();

    await waitFor(() => expect(eventsRequests()).toBe(2));
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.post).toHaveBeenCalledWith('/api/calendar-feeds/1/sync', expect.objectContaining({ timeZone: expect.any(String) }));
  });

  it('leaves fresh feeds alone', async () => {
    serve();
    await renderCalendar();

    expect(client.post).not.toHaveBeenCalled();
    expect(eventsRequests()).toBe(1);
  });

  it('takes a 429 quietly and does not refetch', async () => {
    serve({ feeds: [{ ...WORK, lastSyncedAt: null }] });
    client.post.mockRejectedValue({ response: { status: 429, data: { error: 'Synced a moment ago. Try again in a minute.' } } });

    await renderCalendar();

    expect(client.post).toHaveBeenCalledTimes(1);
    expect(eventsRequests()).toBe(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

/** The dialog with feeds held the way the hook holds them. */
function Harness({ initial = [], connect, ...rest }) {
  const [feeds, setFeeds] = useState(initial);
  return (
    <GoogleCalendarDialog
      feeds={feeds}
      connect={async (body) => {
        const feed = await connect(body);
        setFeeds((list) => [...list, feed]);
        return feed;
      }}
      update={rest.update ?? vi.fn()}
      sync={rest.sync ?? vi.fn()}
      disconnect={async (id) => {
        await rest.disconnect?.(id);
        setFeeds((list) => list.filter((f) => f.id !== id));
      }}
      onClose={() => {}}
    />
  );
}

describe('connecting a Google Calendar', () => {
  it('walks through where the address is, then connects with the defaults', async () => {
    const user = userEvent.setup();
    let finish;
    const connect = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    render(<Harness connect={connect} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(/Secret address in iCal format/, { selector: 'strong' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Secret address in iCal format'), URL_);
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    expect(connect).toHaveBeenCalledWith({ url: URL_, name: 'Google Calendar', color: 'sky' });
    expect(screen.getByRole('button', { name: 'Connecting…' })).toBeDisabled();

    await act(async () => finish({ ...WORK, id: 3, name: 'Google Calendar', color: 'sky', eventCount: 12, lastSyncedAt: minutesAgo(0) }));

    expect(screen.getByText('Google Calendar', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('Synced just now · 12 events')).toBeInTheDocument();
    expect(screen.queryByLabelText('Secret address in iCal format')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add another calendar' })).toBeInTheDocument();
  });

  it('asks for the address before sending anything', async () => {
    const user = userEvent.setup();
    const connect = vi.fn();
    render(<Harness connect={connect} />);

    await user.click(screen.getByRole('button', { name: 'Connect' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Paste the secret address first.');
    expect(connect).not.toHaveBeenCalled();
  });

  it('shows the server’s reason when it refuses, and can try again', async () => {
    const user = userEvent.setup();
    const reason = 'That isn’t a Google Calendar secret address. In Google Calendar, open Settings, pick the calendar, and copy “Secret address in iCal format”.';
    const connect = vi.fn().mockRejectedValueOnce({ response: { status: 400, data: { error: reason } } });
    render(<Harness connect={connect} />);

    await user.type(screen.getByLabelText('Secret address in iCal format'), 'https://example.com/cal.ics');
    await user.type(screen.getByLabelText('Name'), 'Work');
    await user.click(screen.getByRole('radio', { name: 'violet' }));
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(reason);
    expect(connect).toHaveBeenCalledWith({ url: 'https://example.com/cal.ics', name: 'Work', color: 'violet' });
    expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled();
  });

  it('says so when the calendar is already connected', async () => {
    const user = userEvent.setup();
    const connect = vi.fn().mockRejectedValue({ response: { status: 409, data: { error: 'That calendar is already connected.' } } });
    render(<Harness connect={connect} />);

    await user.type(screen.getByLabelText('Secret address in iCal format'), URL_);
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That calendar is already connected.');
  });
});

describe('a connected calendar', () => {
  it('shows its state, or what went wrong', () => {
    const broken = { ...WORK, id: 2, name: 'Home', lastError: 'Google no longer recognises this address. Copy the secret address again.' };
    render(<Harness initial={[WORK, broken]} connect={vi.fn()} />);

    expect(screen.getByText('Synced 4 min ago · 128 events')).toBeInTheDocument();
    expect(screen.getByText(broken.lastError)).toBeInTheDocument();
    expect(screen.getAllByText('calendar.google.com/…sam', { exact: false })).toHaveLength(2);
    expect(screen.getByText(/Mordi checks for changes every 15 minutes/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Secret address in iCal format')).toBeNull();
  });

  it('confirms before disconnecting, and says nothing changes in Google', async () => {
    const user = userEvent.setup();
    const disconnect = vi.fn().mockResolvedValue();
    render(<Harness initial={[WORK]} connect={vi.fn()} disconnect={disconnect} />);

    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(screen.getByText('Disconnect Work? Its events leave Mordi’s calendar. Nothing changes in Google.')).toBeInTheDocument();
    expect(disconnect).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByText(/Disconnect Work\?/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    await user.click(within(screen.getByRole('group', { name: 'Disconnect Work' })).getByRole('button', { name: 'Disconnect' }));
    expect(disconnect).toHaveBeenCalledWith(1);
    expect(screen.queryByText('Work')).toBeNull();
    // With the last one gone, the dialog is the first-run form again rather
    // than a lone "Add another calendar".
    expect(screen.getByLabelText('Secret address in iCal format')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add another calendar' })).toBeNull();
  });

  it('renames, and syncs on request with the server’s answer shown', async () => {
    const user = userEvent.setup();
    const update = vi.fn().mockResolvedValue({});
    const sync = vi.fn().mockRejectedValue({ response: { status: 429, data: { error: 'Synced a moment ago. Try again in a minute.' } } });
    render(<Harness initial={[WORK]} connect={vi.fn()} update={update} sync={sync} />);

    await user.click(screen.getByRole('button', { name: 'Sync now' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Synced a moment ago. Try again in a minute.');

    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const field = screen.getByLabelText('Name');
    await user.clear(field);
    await user.type(field, 'Office');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(update).toHaveBeenCalledWith(1, { name: 'Office', color: 'violet' });
  });
});

describe('the feed helpers', () => {
  it('call a feed stale after fifteen minutes, or when it never synced', () => {
    const now = new Date('2026-10-18T12:00:00Z');
    expect(isStale({ lastSyncedAt: '2026-10-18T11:50:00Z' }, now)).toBe(false);
    expect(isStale({ lastSyncedAt: '2026-10-18T11:45:00Z' }, now)).toBe(true);
    expect(isStale({ lastSyncedAt: null }, now)).toBe(true);
    expect(syncedLabel({ lastSyncedAt: '2026-10-18T10:00:00Z', eventCount: 1 }, now)).toBe('Synced 2 hr ago · 1 event');
    expect(syncedLabel({ lastSyncedAt: null })).toBe('Not synced yet');
  });
});
