import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import History from '../pages/History';
import client from '../api/client';

vi.mock('../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

vi.mock('../components/AppShell', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

const archived = {
  id: 1,
  title: 'Learn the guitar',
  archivedAt: '2026-10-01T10:00:00Z',
  targetPerWeek: 3,
  entries: 12,
  completed: 9,
  firstLog: '2026-08-01',
  lastLog: '2026-09-30',
};

const done = { id: 11, text: 'Book the dentist', done: true, completedAt: '2026-11-03T14:05:00Z', completedOn: '2026-11-03' };
const removed = { id: 12, text: 'Fix the bike', done: false, removedAt: '2026-11-02T09:00:00Z' };

function answer({ todoPages = [{ items: [done, removed], hasMore: false }] } = {}) {
  client.get.mockImplementation((url, config) => {
    if (url === '/api/goals/archived') return Promise.resolve({ data: [archived] });
    if (url === '/api/todos/history') return Promise.resolve({ data: todoPages[config?.params?.page ?? 0] });
    return Promise.resolve({ data: [] });
  });
}

const renderAt = (path = '/history') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <History />
    </MemoryRouter>,
  );

describe('History', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens on archived goals, and switches to to-dos', async () => {
    answer();
    renderAt();

    expect(await screen.findByText('Learn the guitar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Goals' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'To-dos' }));

    expect(await screen.findByText('Book the dentist')).toBeInTheDocument();
    expect(screen.queryByText('Learn the guitar')).not.toBeInTheDocument();
  });

  it('shows done and removed to-dos, each saying which', async () => {
    answer();
    renderAt('/history?show=todos');

    const doneRow = (await screen.findByText('Book the dentist')).closest('li');
    expect(within(doneRow).getByText(/^Done/)).toBeInTheDocument();
    const removedRow = screen.getByText('Fix the bike').closest('li');
    expect(within(removedRow).getByText(/^Removed/)).toBeInTheDocument();
  });

  it('loads older to-dos a page at a time', async () => {
    const older = { id: 13, text: 'Return the library books', done: true, completedAt: '2026-10-20T08:00:00Z', completedOn: '2026-10-20' };
    answer({ todoPages: [{ items: [done], hasMore: true }, { items: [older], hasMore: false }] });
    renderAt('/history?show=todos');

    await userEvent.click(await screen.findByRole('button', { name: 'Show older' }));

    expect(await screen.findByText('Return the library books')).toBeInTheDocument();
    expect(client.get).toHaveBeenCalledWith('/api/todos/history', { params: { page: 1 } });
    expect(screen.queryByRole('button', { name: 'Show older' })).not.toBeInTheDocument();
  });

  it('deletes a to-do from History for good after asking', async () => {
    answer();
    client.delete.mockResolvedValue({});
    renderAt('/history?show=todos');

    await userEvent.click(await screen.findByRole('button', { name: 'Delete Fix the bike from History' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete to-do' }));

    expect(client.delete).toHaveBeenCalledWith('/api/todos/12/history');
    expect(screen.queryByText('Fix the bike')).not.toBeInTheDocument();
    expect(screen.getByText('Book the dentist')).toBeInTheDocument();
  });
});
