import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const IconCaret = () => (
  <svg
    className="app-select__caret"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M6 9.5l6 6 6-6" />
  </svg>
);

const IconTick = () => (
  <svg
    className="app-select__tick"
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M4.5 12.5l5 5 10-11" />
  </svg>
);

/**
 * A listbox that replaces the native <select> for short lists.
 *
 * Focus stays on the trigger the whole time and the active option is named
 * through aria-activedescendant, which is the pattern screen readers already
 * expect from a collapsed listbox — moving real focus into the popup would
 * mean rebuilding Tab handling for no benefit.
 *
 * The list is portalled out of the trigger's subtree. Inside a dialog it
 * would otherwise count towards that dialog's scrollable overflow: opening
 * the list made the dialog taller, a scrollbar appeared and the whole thing
 * resized under the pointer.
 *
 * It is portalled to the nearest [data-theme] ancestor, not to document.body.
 * The theme's custom properties are declared on that element, so a popup
 * outside it loses them: --glass-fill-strong stops resolving and the list
 * renders see-through, and the colours that do still resolve come from the
 * defaults on :root rather than from the theme the person picked. That
 * element is still outside the dialog, so the overflow problem stays fixed.
 *
 * `options` is `[{ value, label, icon? }]`. `value` is always a string.
 */
export default function Select({
  id,
  value,
  options,
  onChange,
  labelledBy,
  placeholder = 'Select…',
}) {
  const reactId = useId();
  const baseId = id ?? `sel-${reactId}`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const [box, setBox] = useState(null);
  const [host, setHost] = useState(null);

  const selectedIndex = Math.max(
    options.findIndex((o) => o.value === value),
    0,
  );
  const selected = options.find((o) => o.value === value);

  const close = useCallback(() => setOpen(false), []);

  const openList = () => {
    setActive(selectedIndex);
    setOpen(true);
  };

  // Clicking anywhere else, or scrolling the page away, closes the list.
  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e) => {
      // The list is portalled, so "inside" means either element.
      const inside =
        rootRef.current?.contains(e.target) || listRef.current?.contains(e.target);
      if (!inside) close();
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open, close]);

  /* Where the popup goes. Measured from the trigger, dropped upward when
     there is more room above than below, and never taller than the space it
     has. A layout effect, so it is positioned before the browser paints
     rather than appearing at the wrong place for a frame. */
  useLayoutEffect(() => {
    if (!open) return undefined;
    // The themed element the popup belongs to. Resolved here rather than at
    // module scope because it depends on where this Select was mounted.
    setHost(rootRef.current?.closest('[data-theme]') ?? document.body);

    const place = () => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gap = 6;
      const cap = 248;
      const below = window.innerHeight - rect.bottom - gap * 2;
      const above = rect.top - gap * 2;
      const dropUp = below < Math.min(cap, 160) && above > below;
      const height = Math.max(Math.min(cap, dropUp ? above : below), 96);
      setBox({
        left: rect.left,
        width: rect.width,
        top: dropUp ? rect.top - height - gap : rect.bottom + gap,
        height,
      });
    };
    place();
    // Capture, so scrolling inside a dialog counts too.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  // Keep the active option in view when arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    const option = listRef.current?.querySelector(
      `#${CSS.escape(`${baseId}-opt-${active}`)}`,
    );
    // Optional call: not every environment implements scrollIntoView, and
    // scrolling is a nicety here rather than the behaviour under test.
    option?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, baseId]);

  const commit = (index) => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(active);
        break;
      case 'Escape':
        e.preventDefault();
        // Stop here: an open list inside a dialog should close the list, not
        // the dialog.
        e.stopPropagation();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className="app-select" ref={rootRef}>
      {/* The select-only combobox pattern: a button that reports itself as a
          combobox, controls a listbox, and names the active option. */}
      <button
        type="button"
        id={baseId}
        className="app-select__trigger"
        role="combobox"
        aria-controls={`${baseId}-list`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelledBy ? `${labelledBy} ${baseId}` : undefined}
        aria-activedescendant={open ? `${baseId}-opt-${active}` : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
      >
        <span
          className={`app-select__value${selected ? '' : ' app-select__value--empty'}`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <IconCaret />
      </button>

      {open &&
        box &&
        host &&
        createPortal(
          <ul
            id={`${baseId}-list`}
            className="app-select__list"
            role="listbox"
            ref={listRef}
            aria-labelledby={labelledBy ?? baseId}
            style={{
              top: box.top,
              left: box.left,
              width: box.width,
              maxHeight: box.height,
            }}
          >
            {options.map((option, i) => (
              <li
                key={option.value}
                id={`${baseId}-opt-${i}`}
                role="option"
                aria-selected={option.value === value}
                className={
                  'app-select__option' + (i === active ? ' app-select__option--active' : '')
                }
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(i)}
              >
                {option.icon ?? null}
                <span>{option.label}</span>
                {option.value === value && <IconTick />}
              </li>
            ))}
          </ul>,
          host,
        )}
    </div>
  );
}
