import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './tour.css';

const PAD = 8;
const CARD_ROOM = 230;

/**
 * A guided walk through the page: one step at a time, each a card beside the
 * thing it talks about, with everything else dimmed. A step names its target
 * by selector; steps whose target is not on the page are left out, so the
 * same list works whatever the person has switched on. The page is asked
 * a frame after mount, once the surfaces the tour points at are drawn.
 *
 * Escape or Skip ends it. Done after the last step. The page underneath keeps
 * its layout; only the spotlight moves.
 */
export default function Tour({ steps, onDone, onSkip }) {
  const [shown, setShown] = useState(null);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const cardRef = useRef(null);
  const step = shown?.[i];
  const last = shown ? i === shown.length - 1 : false;

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      const present = steps.filter((s) => !s.target || document.querySelector(s.target));
      if (present.length === 0) onDone();
      else setShown(present);
    });
    return () => cancelAnimationFrame(frame);
  }, [steps, onDone]);

  // The target is brought into view at once (a smooth scroll would still be
  // moving when the spotlight is measured), then measured on the next frame
  // and again whenever the page moves, so the spotlight follows it.
  useLayoutEffect(() => {
    if (!step?.target) return undefined;
    const el = document.querySelector(step.target);
    if (!el) return undefined;
    const measure = () => setRect(el.getBoundingClientRect());
    el.scrollIntoView?.({ block: 'center', behavior: 'auto' });
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step]);

  useEffect(() => {
    cardRef.current?.focus();
  }, [i, shown]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onSkip]);

  if (!step) return null;

  const hole = step.target && rect && {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  // The card sits under its target when there is room, above it otherwise,
  // and never past the right edge. Without a target it is centred.
  let cardStyle;
  if (hole) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(340, vw - 32);
    const left = Math.min(Math.max(16, hole.left), vw - width - 16);
    cardStyle =
      hole.top + hole.height + CARD_ROOM < vh
        ? { top: hole.top + hole.height + 12, left, width }
        : { bottom: vh - hole.top + 12, left, width };
  }

  const next = () => {
    if (last) onDone();
    else setI((n) => n + 1);
  };

  return (
    <div className="tour" role="presentation">
      {hole && <div className="tour__hole" style={hole} aria-hidden="true" />}
      <div
        ref={cardRef}
        className={'tour__card' + (step.target ? '' : ' tour__card--centred')}
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        key={i}
      >
        <p className="tour__count">
          {i + 1} of {shown.length}
        </p>
        <h2 className="tour__title" id="tour-title">
          {step.title}
        </h2>
        <p className="tour__body" id="tour-body">
          {step.body}
        </p>
        <div className="tour__actions">
          <button type="button" className="app-btn app-btn--quiet" onClick={onSkip}>
            Skip
          </button>
          <button type="button" className="app-btn" onClick={next}>
            {last ? step.doneLabel ?? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
