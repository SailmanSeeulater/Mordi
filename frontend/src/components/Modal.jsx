import { useEffect, useId, useRef } from 'react';
import './app.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ title, onClose, children, size }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const firstField = dialog.querySelector('input, select, textarea');
    (firstField ?? dialog).focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = [...dialog.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (!dialog.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === dialog)) {
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
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="app-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
    >
      <div
        ref={dialogRef}
        className={`app-dialog${size === 'wide' ? ' app-dialog--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="app-panel__head">
          <h2 id={titleId} className="app-panel__title">
            {title}
          </h2>
          <div className="app-panel__spacer" />
          <button type="button" className="app-linkbtn" onClick={() => onCloseRef.current()}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
