/**
 * Saved display order for a list of things.
 *
 * Order is stored as a list of ids, not as an index on each item, so it
 * survives items being added, removed or renamed. A saved order is always
 * reconciled against what actually exists: ids that no longer exist are
 * dropped, and items the saved order has never seen are appended in their
 * natural order rather than being hidden or thrown to the front.
 *
 * It lives in localStorage, which means per-device. That is a deliberate
 * trade: the alternative is a sort_order column, a migration and an endpoint
 * for something that is a viewing preference rather than data.
 */

export function readOrder(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const saved = JSON.parse(raw);
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function writeOrder(key, ids) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Private windows and blocked site data both throw. Losing the order only
    // costs the default arrangement next time.
  }
}

/**
 * The effective order: everything in `saved` that still exists, followed by
 * anything new, in the order the source list gave it.
 */
export function orderedIds(items, saved, idOf = (item) => String(item.id)) {
  const present = new Set(items.map(idOf));
  const kept = saved.filter((id) => present.has(id));
  const known = new Set(kept);
  const added = items.map(idOf).filter((id) => !known.has(id));
  return [...kept, ...added];
}

/** `items`, rearranged to match `ids`. */
export function sortByIds(items, ids, idOf = (item) => String(item.id)) {
  const rank = new Map(ids.map((id, i) => [id, i]));
  return [...items].sort(
    (a, b) => (rank.get(idOf(a)) ?? 0) - (rank.get(idOf(b)) ?? 0),
  );
}

/**
 * `ids` with `fromId` moved to where `toId` currently sits. Returns the same
 * array reference when nothing would change, so callers can skip a write.
 */
export function moveBefore(ids, fromId, toId) {
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from === -1 || to === -1 || from === to) return ids;
  const next = [...ids];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/** `ids` with `id` moved `delta` places, clamped to the ends. */
export function nudgeBy(ids, id, delta) {
  const from = ids.indexOf(id);
  if (from === -1) return ids;
  const to = Math.min(Math.max(from + delta, 0), ids.length - 1);
  if (to === from) return ids;
  const next = [...ids];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}
