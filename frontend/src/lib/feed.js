/**
 * Consecutive entries on the same calendar day, as one group each.
 *
 * Expects entries already ordered newest first, which is how the feed shows
 * them, and keeps that order both between and within groups. Grouping is by
 * adjacency rather than a lookup, so an out-of-order list is still split
 * wherever the day actually changes instead of being silently re-sorted.
 */
export function groupByDay(entries) {
  const groups = [];
  for (const entry of entries) {
    const iso = entry?.logDate?.slice(0, 10);
    if (!iso) continue;
    const last = groups[groups.length - 1];
    if (last && last.iso === iso) {
      last.entries.push(entry);
    } else {
      groups.push({ iso, entries: [entry] });
    }
  }
  return groups;
}
