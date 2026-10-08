import { useCallback, useEffect, useState } from 'react';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * True once the element has been on screen. It never turns back off, so a
 * demo plays once on arrival rather than every time it scrolls past. Under
 * reduced motion it starts true, and the demos show their final frame.
 */
export function useInView(ref, threshold = 0.35) {
  const [inView, setInView] = useState(prefersReducedMotion);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      const t = setTimeout(() => setInView(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, inView, threshold]);

  return inView;
}

/**
 * A demo's playhead: phase 0 until `active`, then each phase is held for its
 * duration in `holds` before moving on, stopping on the last (holds.length).
 * `holds` must be a stable array (a module constant). Under reduced motion
 * the playhead starts on the last phase. `replay` rewinds to 0.
 */
export function usePlayhead(active, holds) {
  const last = holds.length;
  const [phase, setPhase] = useState(() => (prefersReducedMotion() ? last : 0));

  useEffect(() => {
    if (!active || phase >= last) return undefined;
    const t = setTimeout(() => setPhase((p) => p + 1), holds[phase]);
    return () => clearTimeout(t);
  }, [active, phase, last, holds]);

  const replay = useCallback(() => setPhase(0), []);
  return [phase, replay, phase >= last];
}
