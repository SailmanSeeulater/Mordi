/**
 * What is still left this week, in the words the push reminder uses. A port
 * of the backend's ReminderComposer so the week card can say the same thing
 * the moment the dashboard opens, from the week it has already loaded.
 *
 * Only facts against targets the person set, most pressing first: the
 * largest share of a target still to do, then by title. Nothing when every
 * target is met, because a reminder that there is nothing to do is noise.
 */

export const MAX_LISTED = 3;

/** Days from today to Sunday, today included: 7 on Monday, 1 on Sunday. */
export function daysLeft(todayIndex) {
  return 7 - Math.min(6, Math.max(0, todayIndex));
}

/**
 * `rows` are the week summary's rows ({ goal, done, target }); `todayIndex`
 * is 0 for Monday. Returns { title, body, items, more } or null.
 */
export function composeReminder(rows, todayIndex) {
  const behind = rows
    .map((r) => ({ title: r.goal.title, left: Math.max(0, r.target - r.done), target: r.target }))
    .filter((r) => r.target > 0 && r.left > 0)
    .sort((a, b) => b.left / b.target - a.left / a.target || a.title.localeCompare(b.title));
  if (behind.length === 0) return null;

  const left = daysLeft(todayIndex);
  const items = behind.slice(0, MAX_LISTED);
  const more = behind.length - items.length;
  let body = items.map((l) => `${l.title}: ${l.left} of ${l.target} left`).join(' · ');
  if (more > 0) body += ` · and ${more} more`;

  return {
    title: left === 1 ? 'Last day of the week' : `${left} days left this week`,
    body,
    items,
    more,
  };
}
