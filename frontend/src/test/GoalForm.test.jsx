import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GoalForm from '../components/GoalForm';
import client from '../api/client';
import { resetCategoriesCache } from '../hooks/useCategories';

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const MINE = [{ id: 3, key: 'custom:3', name: 'Music', icon: 'music' }];

beforeEach(() => {
  vi.clearAllMocks();
  resetCategoriesCache();
  client.get.mockImplementation((url) =>
    url === '/api/categories' ? Promise.resolve({ data: MINE }) : Promise.resolve({ data: [] }),
  );
  client.post.mockImplementation((url, body) =>
    url === '/api/categories'
      ? Promise.resolve({ data: { id: 9, key: 'custom:9', name: body.name, icon: body.icon } })
      : Promise.resolve({ data: { id: 1, ...body } }),
  );
});

const categorySelect = () => screen.getByRole('combobox', { name: /category/i });

async function openCategories(user) {
  await user.click(categorySelect());
  return screen.getByRole('listbox');
}

describe('GoalForm categories and icons', () => {
  it('lists the built-ins, the person’s own, no category and a way to make one', async () => {
    const user = userEvent.setup();
    render(<GoalForm onSaved={() => {}} onCancel={() => {}} />);
    await waitFor(() => expect(client.get).toHaveBeenCalledWith('/api/categories'));

    const list = await openCategories(user);
    const names = within(list).getAllByRole('option').map((o) => o.textContent);
    expect(names).toEqual(['No category', 'Fitness', 'Sleep', 'Productivity', 'Health', 'Music', 'New category…']);
  });

  it('makes a category inline, selects it, and saves the goal with it and a chosen icon', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<GoalForm onSaved={onSaved} onCancel={() => {}} />);
    await user.type(screen.getByLabelText('Goal'), 'Read a chapter');

    const list = await openCategories(user);
    await user.click(within(list).getByRole('option', { name: 'New category…' }));

    const editor = screen.getByRole('group', { name: 'New category' });
    expect(within(editor).getByLabelText('Category name')).toHaveFocus();
    await user.type(within(editor).getByLabelText('Category name'), '  Reading ');
    await user.click(within(editor).getByRole('radio', { name: 'Book' }));
    await user.click(within(editor).getByRole('button', { name: 'Add category' }));

    expect(client.post).toHaveBeenCalledWith('/api/categories', { name: 'Reading', icon: 'book' });
    await waitFor(() => expect(categorySelect()).toHaveTextContent('Reading'));
    expect(screen.queryByRole('group', { name: 'New category' })).toBeNull();

    // The icon field starts on the category's icon, then takes its own.
    const toggle = screen.getByRole('button', { name: /choose an icon/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    const icons = screen.getByRole('radiogroup', { name: 'Icon' });
    expect(within(icons).getByRole('radio', { name: 'Same as category' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(icons).getByRole('radio', { name: 'Pen' }));

    await user.click(screen.getByRole('button', { name: 'Add goal' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(client.post).toHaveBeenLastCalledWith(
      '/api/goals',
      expect.objectContaining({ title: 'Read a chapter', category: 'custom:9', icon: 'pen' }),
    );
  });

  it('Enter in the new category’s name makes the category, not the goal', async () => {
    const user = userEvent.setup();
    render(<GoalForm onSaved={() => {}} onCancel={() => {}} />);
    const list = await openCategories(user);
    await user.click(within(list).getByRole('option', { name: 'New category…' }));

    await user.type(screen.getByLabelText('Category name'), 'Garden{Enter}');

    await waitFor(() => expect(client.post).toHaveBeenCalledTimes(1));
    expect(client.post).toHaveBeenCalledWith('/api/categories', { name: 'Garden', icon: 'thumbtack' });
  });

  it('shows the server’s reason when a category is refused, and keeps the editor open', async () => {
    const user = userEvent.setup();
    client.post.mockRejectedValueOnce({
      response: { status: 409, data: { error: 'You already have a category called “Music”.' } },
    });
    render(<GoalForm onSaved={() => {}} onCancel={() => {}} />);
    const list = await openCategories(user);
    await user.click(within(list).getByRole('option', { name: 'New category…' }));
    await user.type(screen.getByLabelText('Category name'), 'music');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You already have a category called “Music”.');
    expect(screen.getByRole('group', { name: 'New category' })).toBeInTheDocument();
  });

  it('sends an empty icon to go back to the category’s, and keeps an edited goal’s choice', async () => {
    const user = userEvent.setup();
    const goal = { id: 4, title: 'Practise', category: 'custom:3', icon: 'sparkle', targetPerWeek: 3 };
    render(<GoalForm goal={goal} onSaved={() => {}} onCancel={() => {}} />);
    await waitFor(() => expect(categorySelect()).toHaveTextContent('Music'));

    await user.click(screen.getByRole('button', { name: /choose an icon/i }));
    expect(screen.getByRole('radio', { name: 'Sparkle' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'Same as category' }));
    await user.click(screen.getByRole('button', { name: 'Save goal' }));

    await waitFor(() =>
      expect(client.put).toHaveBeenCalledWith('/api/goals/4', expect.objectContaining({ category: 'custom:3', icon: '' })),
    );
  });
});
