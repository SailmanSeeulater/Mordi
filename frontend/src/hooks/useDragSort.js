import { useCallback, useEffect, useRef, useState } from 'react';

/** Below this, a press is a press. Above it, the person meant to drag. */
const THRESHOLD = 10;

/**
 * Pointer-driven reordering for a list whose items carry `data-sort-id`.
 *
 * Nothing moves during the drag. An earlier version reordered live on every
 * pointer crossing, which thrashed: rearranging the list moves items out from
 * under the pointer, the pointer then lands on a different item, and that
 * reorders again. Raising the threshold only made it start later. So the drag
 * now reports which item it is over, the caller marks that slot, and the
 * order is committed once on release.
 *
 * It works the same for mouse, pen and touch because it only uses pointer
 * events.
 *
 * `onDrop(heldId, overId)` is called on release, and only when the two
 * differ. This is the pointer half only: a drag is unusable from a keyboard,
 * so every caller also wires arrow keys to its own nudge.
 */
export default function useDragSort(onDrop) {
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const origin = useRef({ x: 0, y: 0, armed: false });
  // Read by the release handler, which must not be re-created every time the
  // pointer crosses onto a new item. Written after render rather than during
  // it: a ref is not render state, and touching it mid-render is exactly the
  // thing that makes one behave unpredictably under concurrent rendering.
  const latest = useRef({ dragId: null, overId: null });
  useEffect(() => {
    latest.current = { dragId, overId };
  }, [dragId, overId]);

  const begin = useCallback(
    (id) => (event) => {
      if (event.button != null && event.button !== 0) return;
      origin.current = { x: event.clientX, y: event.clientY, armed: false };
      setDragId(String(id));
      setOverId(null);
    },
    [],
  );

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
      // The held element is still where it was, so ask the document what is
      // under the pointer and look upward for a sortable.
      const over = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest('[data-sort-id]');
      const id = over?.getAttribute('data-sort-id') ?? null;
      setOverId(id === dragId ? null : id);
    };

    const onEnd = () => {
      const held = latest.current;
      if (held.dragId && held.overId && held.dragId !== held.overId) {
        onDrop(held.dragId, held.overId);
      }
      setDragId(null);
      setOverId(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [dragId, onDrop]);

  /**
   * Spread onto the drag handle. The id also goes on the item itself.
   *
   * Deliberately no `style`: callers spread this alongside their own style
   * prop, and whichever came last would win. `touch-action` belongs in the
   * stylesheet with the rest of each handle's appearance anyway, and it
   * differs by axis.
   */
  const handleProps = useCallback((id) => ({ onPointerDown: begin(id) }), [begin]);

  return { dragId, overId, handleProps };
}
