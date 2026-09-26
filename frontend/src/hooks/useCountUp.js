import { useEffect, useState } from 'react';

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A number that counts up to its value on arrival, once, over `duration`
 * milliseconds with an exponential ease-out. A later change of the value
 * simply shows the new one: the arrival is the only moment. Under reduced
 * motion the value shows at once.
 */
export default function useCountUp(value, duration = 420) {
  const [shown, setShown] = useState(() => (reduced() ? value : 0));
  const [arrived, setArrived] = useState(reduced());

  useEffect(() => {
    if (arrived) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(value);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else setArrived(true);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, arrived]);

  return shown;
}
