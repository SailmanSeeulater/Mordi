import { useCallback, useMemo, useState } from 'react';
import { moveBefore, nudgeBy, orderedIds, readOrder, sortByIds, writeOrder } from '../lib/order';

/**
 * A saved display order for `items`, reconciled against what exists.
 *
 * Returns the effective id list, the items in that order, an `indexOf` for
 * driving the CSS `order` property, and two ways to change it: `moveOver` for
 * a drag, `nudge` for a keyboard press.
 *
 * Callers are expected to keep their DOM in the source order and position
 * with `order` rather than re-sorting their children. Reordering the DOM
 * restarts CSS animations on the moved nodes, which during a drag means a
 * flicker on every step.
 */
export default function useSortOrder(storageKey, items) {
  const [saved, setSaved] = useState(() => readOrder(storageKey));

  const ids = useMemo(() => orderedIds(items, saved), [items, saved]);
  const ordered = useMemo(() => sortByIds(items, ids), [items, ids]);

  const indexOf = useCallback((id) => ids.indexOf(String(id)), [ids]);

  const commit = useCallback(
    (next) => {
      if (next === ids) return;
      setSaved(next);
      writeOrder(storageKey, next);
    },
    [ids, storageKey],
  );

  /** During a drag: put the held item where the one under the pointer is. */
  const moveOver = useCallback(
    (fromId, toId) => commit(moveBefore(ids, String(fromId), String(toId))),
    [ids, commit],
  );

  /** From the keyboard: one place in either direction. */
  const nudge = useCallback(
    (id, delta) => commit(nudgeBy(ids, String(id), delta)),
    [ids, commit],
  );

  const reset = useCallback(() => {
    setSaved([]);
    writeOrder(storageKey, []);
  }, [storageKey]);

  return { ids, ordered, indexOf, moveOver, nudge, reset };
}
