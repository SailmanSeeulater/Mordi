import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TodoList from '../components/TodoList';
import client from '../api/client';

vi.mock('../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const trip = {
  id: 7,
  text: 'Plan the trip',
  done: false,
  createdAt: '2026-11-19T09:00:00',
  steps: [
    { id: 'a', text: 'Book flights', done: true },
    { id: 'b', text: 'Find a hotel', done: false },
  ],
};
const shoes = { id: 8, text: 'Buy new running shoes', done: false, createdAt: '2026-11-19T10:00:00', steps: [] };

describe('TodoList steps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.get.mockResolvedValue({ data: [trip, shoes] });
    client.put.mockImplementation((url, body) => Promise.resolve({ data: body }));
  });

  it('shows a to-do with steps as a ring with its count, and its steps under it', async () => {
    render(<TodoList />);

    const row = await screen.findByRole('checkbox', { name: /Plan the trip/ });
    expect(row).toHaveAccessibleDescription('1 of 2 steps done');
    const steps = screen.getByRole('list', { name: 'Steps of Plan the trip' });
    expect(within(steps).getByRole('checkbox', { name: 'Book flights' })).toHaveAttribute('aria-checked', 'true');
    expect(within(steps).getByRole('checkbox', { name: 'Find a hotel' })).toHaveAttribute('aria-checked', 'false');
  });

  it('finishes the to-do when its last step is ticked, in one request', async () => {
    render(<TodoList />);

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Find a hotel' }));

    expect(client.put).toHaveBeenCalledTimes(1);
    const [url, body] = client.put.mock.calls[0];
    expect(url).toBe('/api/todos/7');
    expect(body.done).toBe(true);
    expect(body.completedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.steps.map((s) => s.done)).toEqual([true, true]);
    expect(screen.getByRole('checkbox', { name: /Plan the trip/ })).toHaveAttribute('aria-checked', 'true');
    // A finished to-do folds its steps away.
    expect(screen.queryByRole('list', { name: 'Steps of Plan the trip' })).not.toBeInTheDocument();
  });

  it('adds a step from the row, keeping the line open for the next', async () => {
    render(<TodoList />);

    await userEvent.click(await screen.findByRole('button', { name: 'Add a step to Buy new running shoes' }));
    const field = screen.getByLabelText('New step for Buy new running shoes');
    await userEvent.type(field, 'Measure my feet{Enter}');

    const [url, body] = client.put.mock.calls[0];
    expect(url).toBe('/api/todos/8');
    expect(body).toEqual({ steps: [{ id: expect.any(String), text: 'Measure my feet', done: false }] });
    expect(await screen.findByRole('checkbox', { name: 'Measure my feet' })).toBeInTheDocument();
    expect(field).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: /Buy new running shoes/ })).toHaveAccessibleDescription('0 of 1 steps done');
  });

  it('ticking the to-do ticks its steps, and a plain one sends no steps', async () => {
    render(<TodoList />);

    await userEvent.click(await screen.findByRole('checkbox', { name: /Plan the trip/ }));
    expect(client.put.mock.calls[0][1].steps.map((s) => s.done)).toEqual([true, true]);

    await userEvent.click(screen.getByRole('checkbox', { name: /Buy new running shoes/ }));
    expect(client.put.mock.calls[1][1]).not.toHaveProperty('steps');
  });

  it('removes a step', async () => {
    render(<TodoList />);

    await userEvent.click(await screen.findByRole('button', { name: 'Remove step: Book flights' }));

    expect(client.put).toHaveBeenCalledWith('/api/todos/7', { steps: [{ id: 'b', text: 'Find a hotel', done: false }] });
    expect(screen.queryByRole('checkbox', { name: 'Book flights' })).not.toBeInTheDocument();
  });
});
