import { useEffect, useId, useRef } from 'react';
import useFocusTrap from '../hooks/useFocusTrap';
import './app.css';

export default function Modal({ title, onClose, children, size }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Tab stays inside, Escape closes, and focus goes back where it was.
  useFocusTrap(dialogRef, onClose);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const firstField = dialog.querySelector('input, select, textarea');
    (firstField ?? dialog).focus();

    return () => {
      document.body.style.overflow = previousOverflow;
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
