import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Select from '../components/Select';

const OPTIONS = [
  { value: '', label: 'Not linked to a goal' },
  { value: '1', label: 'Morning run' },
  { value: '2', label: 'Read before bed' },
];

function setup(value = '') {
  const onChange = vi.fn();
  render(
    <Select id="sel" value={value} options={OPTIONS} onChange={onChange} placeholder="Pick one" />,
  );
  return { onChange };
}

// The select-only combobox pattern: the trigger reports itself as a combobox.
const getTrigger = () => screen.getByRole('combobox');

describe('Select', () => {
  it('shows the selected option, and the placeholder when there is none', () => {
    render(<Select value="1" options={OPTIONS} onChange={() => {}} />);
    expect(getTrigger()).toHaveTextContent('Morning run');
  });

  it('falls back to the placeholder for a value that is not in the list', () => {
    render(<Select value="999" options={OPTIONS} onChange={() => {}} placeholder="Pick one" />);
    expect(getTrigger()).toHaveTextContent('Pick one');
  });

  it('opens on click and reports its state', async () => {
    const user = userEvent.setup();
    setup();
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');

    await user.click(getTrigger());

    expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('marks exactly one option as selected', async () => {
    const user = userEvent.setup();
    render(<Select value="2" options={OPTIONS} onChange={() => {}} />);
    await user.click(getTrigger());

    const selected = screen
      .getAllByRole('option')
      .filter((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('Read before bed');
  });

  it('commits the option clicked and closes', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(getTrigger());
    await user.click(screen.getByRole('option', { name: /Morning run/ }));

    expect(onChange).toHaveBeenCalledWith('1');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens with the down arrow and walks the list with the arrows', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    getTrigger().focus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('does not walk past either end of the list', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    getTrigger().focus();

    await user.keyboard('{ArrowDown}{ArrowUp}{ArrowUp}{ArrowUp}{Enter}');
    expect(onChange).toHaveBeenCalledWith('');

    await user.keyboard('{ArrowDown}{End}{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('2');
  });

  it('names the active option through aria-activedescendant', async () => {
    const user = userEvent.setup();
    setup();
    getTrigger().focus();
    await user.keyboard('{ArrowDown}{ArrowDown}');

    const active = getTrigger().getAttribute('aria-activedescendant');
    expect(active).toBe('sel-opt-1');
    expect(document.getElementById(active)).toHaveTextContent('Morning run');
  });

  it('starts from the selected option rather than the top of the list', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select id="sel" value="2" options={OPTIONS} onChange={onChange} />);
    getTrigger().focus();

    await user.keyboard('{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('closes on Escape without changing the value', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(getTrigger());
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes when a click lands outside it', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(getTrigger());
    await user.click(document.body);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
