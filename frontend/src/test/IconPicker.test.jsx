import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IconPicker from '../components/IconPicker';
import { ICON_KEYS } from '../lib/categories';

function Harness({ initial = null, onChange = () => {}, withDefault = true }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <span id="lbl">Icon</span>
      <button type="button">Before</button>
      <IconPicker
        value={value}
        onChange={(key) => {
          setValue(key);
          onChange(key);
        }}
        labelledBy="lbl"
        defaultLabel={withDefault ? 'Same as category' : undefined}
        defaultIcon="sleep"
      />
      <button type="button">After</button>
    </>
  );
}

const checked = () => screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true');

describe('IconPicker', () => {
  it('is one labelled radio group, every option named, exactly one checked', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Icon' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(ICON_KEYS.length + 1);
    expect(radios[0]).toHaveAccessibleName('Same as category');
    expect(screen.getByRole('radio', { name: 'Book' })).toBeInTheDocument();
    expect(checked()).toHaveLength(1);
    expect(checked()[0]).toHaveAccessibleName('Same as category');
  });

  it('is one tab stop, on the checked option', async () => {
    const user = userEvent.setup();
    render(<Harness initial="book" />);
    await user.click(screen.getByRole('button', { name: 'Before' }));

    await user.tab();
    expect(screen.getByRole('radio', { name: 'Book' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('moves the choice and the focus with the arrow keys, wrapping at the ends', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    radios[0].focus();

    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(ICON_KEYS[0]);
    expect(radios[1]).toHaveFocus();
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenLastCalledWith(ICON_KEYS[1]);

    await user.keyboard('{ArrowUp}{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(radios[0]).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith(ICON_KEYS[ICON_KEYS.length - 1]);
    expect(radios[radios.length - 1]).toHaveFocus();

    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith(null);
    await user.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith('check');
    expect(checked()).toHaveLength(1);
  });

  it('chooses on click, and has no default option when not asked for one', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} withDefault={false} initial="thumbtack" />);
    expect(screen.queryByRole('radio', { name: 'Same as category' })).toBeNull();

    await user.click(screen.getByRole('radio', { name: 'Leaf' }));
    expect(onChange).toHaveBeenLastCalledWith('leaf');
    expect(screen.getByRole('radio', { name: 'Leaf' })).toHaveAttribute('aria-checked', 'true');
  });
});
