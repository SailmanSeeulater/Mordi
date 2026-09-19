import { useEffect, useRef, useState } from 'react';
import './undo-toast.css';

const SHOWN_MS = 6000;

/**
 * "Logged Morning run · Undo", for six seconds.
 *
 * One-tap logging is only safe with a way back: a tap on the wrong ring
 * should cost a tap to undo, not a trip into the feed. The message is a live
 * region, so a screen reader hears what was logged. Hovering or focusing the
 * toast holds it open, so reaching for Undo never races the timer.
 */
export default function UndoToast({ toast, onUndo, onDone }) {
  const [held, setHeld] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (!toast || held) return undefined;
    timer.current = setTimeout(onDone, SHOWN_MS);
    return () => clearTimeout(timer.current);
  }, [toast, held, onDone]);

  if (!toast) return null;

  const undo = async () => {
    setBusy(true);
    try {
      await onUndo(toast);
    } finally {
      setBusy(false);
      onDone();
    }
  };

  return (
    <div
      className="undo-toast"
      role="status"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <span className="undo-toast__text">{toast.message}</span>
      {toast.undoable !== false && (
        <button type="button" className="undo-toast__undo" onClick={undo} disabled={busy}>
          {busy ? 'Undoing…' : 'Undo'}
        </button>
      )}
      <button type="button" className="undo-toast__close" onClick={onDone} aria-label="Dismiss">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
