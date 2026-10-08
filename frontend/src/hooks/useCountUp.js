import { useEffect, useRef, useState } from 'react';

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A number that counts to its value over `duration` milliseconds with an
 * exponential ease-out, every time the value changes: on arrival, when the
 * week loads, and again after a log, so a tap on a goal ring is visibly
 * registered on the card. A change of more than one counts the whole way.
 *
 * The first value is not a change — there is nothing to count from — so a page
 * load with nothing happening on it is still. A run always settles on the real
 * value, and an interrupted run carries on from whatever is on screen rather
 * than jumping back. Under reduced motion the value shows at once.
 *
 * Returns `[shown, counting]`: `counting` is true while a run is in flight,
 * for the pop in CSS.
 */
export default function useCountUp(value, duration = 420) {
  const [shown, setShown] = useState(value);
  const [counting, setCounting] = useState(false);
  // What is on screen right now, read by the next run as its starting point.
  const shownRef = useRef(value);
  const started = useRef(false);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      return undefined;
    }
    const from = shownRef.current;
    if (from === value || reduced()) {
      shownRef.current = value;
      setShown(value);
      setCounting(false);
      return undefined;
    }
    setCounting(true);
    let frame;
    const start = performance.now();
    const tick = (now) => {
      // A frame's timestamp can precede `start`; clamped, so the count never
      // dips below where it began.
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      const next = t < 1 ? Math.round(from + (value - from) * eased) : value;
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
      else setCounting(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return [shown, counting];
}
