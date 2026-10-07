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

/** A finished to-do in the shape the feed reads: its day, its moment, its words. */
export function todoFeedItem(todo) {
  return {
    kind: 'todo',
    id: `todo-${todo.id}`,
    logDate: todo.completedOn,
    loggedAt: todo.completedAt ?? null,
    note: todo.text,
  };
}

const moment = (item) => {
  const t = Date.parse(item.loggedAt ?? item.createdAt ?? '');
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Entries and finished to-dos as one feed, newest first: by day, then by the
 * moment within the day. Anything without a moment sorts last in its day,
 * keeping the order it arrived in.
 */
export function mergeFeed(entries, todos, count) {
  const items = [
    ...entries.map((e) => (e.kind ? e : { ...e, kind: 'entry' })),
    ...todos.filter((t) => t?.done !== false && t?.completedOn).map(todoFeedItem),
  ];
  return items
    .map((item, index) => ({ item, index, day: item.logDate?.slice(0, 10) ?? '', at: moment(item) }))
    .sort((a, b) => b.day.localeCompare(a.day) || b.at - a.at || a.index - b.index)
    .slice(0, count)
    .map(({ item }) => item);
}
