import { useCallback, useEffect, useRef, useState } from 'react';

/** Below this, a press is a press. Above it, the person meant to drag. */
const THRESHOLD = 6;

/**
 * Pointer-driven reordering for a list whose items carry `data-sort-id`.
 *
 * It works the same for mouse, pen and touch because it only uses pointer
 * events. The held item is not moved under the cursor; instead the list
 * rearranges live beneath it, which is both simpler and what the deck already
 * animates for free, since its passes are positioned by transform.
 *
 * `onOver(heldId, overId)` is called each time the pointer crosses onto a
 * different item. Nothing is committed on release: every step has already
 * been applied, so releasing is just letting go.
 *
 * This is the pointer half only. A drag is unusable from a keyboard, so every
 * caller also wires arrow keys to its own nudge — see useSortOrder.
 */
export default function useDragSort(onOver) {
  const [dragId, setDragId] = useState(null);
  const origin = useRef({ x: 0, y: 0, armed: false });

  const begin = useCallback((id) => (event) => {
    // Left button or a touch only, and never on a nested control.
    if (event.button != null && event.button !== 0) return;
    origin.current = { x: event.clientX, y: event.clientY, armed: false };
    setDragId(String(id));
  }, []);

  useEffect(() => {
    if (dragId == null) return undefined;

    const onMove = (event) => {
      const { x, y, armed } = origin.current;
      if (!armed) {
        const far =
          Math.abs(event.clientX - x) > THRESHOLD ||
          Math.abs(event.clientY - y) > THRESHOLD;
        if (!far) return;
        origin.current.armed = true;
      }
      // The held element is still under the pointer, so ask the document what
      // is there and look upward for a sortable.
      const over = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest('[data-sort-id]');
      const overId = over?.getAttribute('data-sort-id');
      if (overId && overId !== dragId) onOver(dragId, overId);
    };

    const onEnd = () => setDragId(null);

    // Passive: false, because a touch drag has to be able to stop the page
    // from scrolling underneath it.
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [dragId, onOver]);

  /**
   * Spread onto the drag handle. The id also goes on the item itself.
   *
   * Deliberately no `style`: callers spread this alongside their own style
   * prop, and whichever came last would win. `touch-action` belongs in the
   * stylesheet with the rest of each handle's appearance anyway, and it
   * differs by axis — a ring reorders horizontally and must leave vertical
   * pans to the page, a grip owns the gesture outright.
   */
  const handleProps = useCallback(
    (id) => ({ onPointerDown: begin(id) }),
    [begin],
  );

  return { dragId, handleProps };
}
