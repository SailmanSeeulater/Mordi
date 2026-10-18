import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import LogEntryForm from '../components/LogEntryForm';
import client from '../api/client';

vi.mock('../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const TODAY = new Date(2026, 8, 16, 9, 0);
const TODAY_ISO = '2026-09-16';
const GOALS = [
  { id: 1, title: 'Morning run', targetPerWeek: 3 },
  { id: 2, title: 'Read', targetPerWeek: 7 },
];
const DONE_RUN = [{ id: 10, goal: { id: 1 }, logDate: TODAY_ISO, completed: true, note: 'Morning run' }];

const REPEAT = /Already logged today/;
const NOT_DONE_HINT = 'Saved as a note for today. It doesn’t count toward the goal.';

function renderForm(props = {}) {
  const onSaved = vi.fn();
  render(<LogEntryForm goals={GOALS} onSaved={onSaved} onCancel={() => {}} {...props} />);
  return { onSaved };
}

async function save(note = 'Ran 3 miles') {
  fireEvent.change(screen.getByLabelText('What did you do?'), { target: { value: note } });
  fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));
  await act(async () => {});
}

describe('LogEntryForm', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: TODAY, toFake: ['Date'] });
    vi.clearAllMocks();
    client.post.mockResolvedValue({ data: { id: 99 } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks whether it was done with two named choices, Did it first', () => {
    renderForm();
    expect(screen.queryByRole('checkbox')).toBeNull();
    const group = screen.getByRole('group', { name: 'Today' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Did it' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Didn’t do it' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText(NOT_DONE_HINT)).toBeNull();
  });

  it('sends completed: true for Did it', async () => {
    const { onSaved } = renderForm();
    await save();
    expect(client.post).toHaveBeenCalledWith('/api/behaviors', expect.objectContaining({ completed: true, logDate: TODAY_ISO }));
    expect(onSaved).toHaveBeenCalled();
  });

  it('explains Didn’t do it, and sends completed: false', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Didn’t do it' }));
    expect(screen.getByRole('button', { name: 'Didn’t do it' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(NOT_DONE_HINT)).toBeInTheDocument();
    await save('Skipped, too tired');
    expect(client.post).toHaveBeenCalledWith('/api/behaviors', expect.objectContaining({ completed: false }));
  });

  it('says a goal already done today won’t count twice, and still saves', async () => {
    const { onSaved } = renderForm({ behaviors: DONE_RUN, initialGoalId: 1 });
    expect(screen.getByRole('status')).toHaveTextContent(REPEAT);
    expect(screen.getByRole('status')).toHaveTextContent('it won’t count twice');
    await save('Second loop');
    expect(client.post).toHaveBeenCalledWith('/api/behaviors', expect.objectContaining({ goalId: 1, completed: true }));
    expect(onSaved).toHaveBeenCalled();
  });

  it('says nothing for a goal not yet done today, or when it wasn’t done', () => {
    renderForm({ behaviors: DONE_RUN, initialGoalId: 2 });
    expect(screen.queryByText(REPEAT)).toBeNull();
  });

  it('drops the repeat note once Didn’t do it is picked', () => {
    renderForm({ behaviors: DONE_RUN, initialGoalId: 1 });
    expect(screen.getByText(REPEAT)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Didn’t do it' }));
    expect(screen.queryByText(REPEAT)).toBeNull();
  });
});
