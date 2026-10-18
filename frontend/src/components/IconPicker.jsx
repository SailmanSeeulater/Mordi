import { useRef } from 'react';
import { ICONS, ICON_KEYS, ICON_LABELS } from '../lib/categories';
import './icon-picker.css';

/**
 * A grid of the drawn icons, as one radio group.
 *
 * Radio semantics rather than a row of buttons, because exactly one is chosen:
 * Tab lands on the chosen icon only, and the arrow keys move the choice (Home
 * and End to either end), wrapping round, as a native radio group does.
 *
 * `value` is a key, or null. With `defaultLabel`, the first option is null
 * ("Same as category"), drawn as `defaultIcon`, the icon null resolves to.
 */
export default function IconPicker({ value, onChange, labelledBy, defaultLabel, defaultIcon = 'thumbtack' }) {
  const options = [
    ...(defaultLabel ? [{ key: null, label: defaultLabel, icon: ICONS[defaultIcon] ?? ICONS.thumbtack }] : []),
    ...ICON_KEYS.map((key) => ({ key, label: ICON_LABELS[key], icon: ICONS[key] })),
  ];
  const chosen = Math.max(
    options.findIndex((o) => o.key === (value ?? null)),
    0,
  );
  const refs = useRef([]);

  const choose = (index) => {
    const next = (index + options.length) % options.length;
    onChange(options[next].key);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e, index) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step) {
      e.preventDefault();
      choose(index + step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      choose(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      choose(options.length - 1);
    } else if (e.key === ' ' || e.key === 'Enter') {
      // Space checks a radio; Enter is kept from submitting the goal form.
      e.preventDefault();
      onChange(options[index].key);
    }
  };

  return (
    <div className="icon-picker" role="radiogroup" aria-labelledby={labelledBy}>
      {options.map((option, i) => (
        <button
          key={option.key ?? 'default'}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={i === chosen}
          aria-label={option.key === null ? undefined : option.label}
          title={option.key === null ? undefined : option.label}
          tabIndex={i === chosen ? 0 : -1}
          className={'icon-picker__option' + (option.key === null ? ' icon-picker__option--default' : '')}
          onClick={() => onChange(option.key)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {option.icon}
          {/* The one option with words: an icon alone can't say "whatever
              the category uses". */}
          {option.key === null && <span>{option.label}</span>}
        </button>
      ))}
    </div>
  );
}
