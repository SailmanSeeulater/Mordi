import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps keyboard focus inside one element for as long as it is mounted:
 * Tab and Shift+Tab wrap at its edges, Escape calls `onEscape`, and when
 * it unmounts focus goes back to whatever had it before. The dialog and
 * the tour card share this; what each focuses first is its own business.
 *
 * `ref.current` is read on every key press rather than once, so an element
 * that re-mounts (the tour card does, step by step) stays trapped.
 */
export default function useFocusTrap(ref, onEscape) {
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;

    const onKeyDown = (e) => {
      const box = ref.current;
      if (!box) return;
      if (e.key === 'Escape') {
        onEscapeRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = [...box.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (!box.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === box)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [ref]);
}
