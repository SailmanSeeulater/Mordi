/**
 * Small, pure helpers around single entries: whether a goal is already done
 * for a day, what an entry is called in a toast, and what to send to put a
 * removed entry back.
 */

/**
 * Whether `goalId` already has a completed entry on `iso`. A goal counts one
 * day per day however many entries it gets, so this is the question to ask
 * before logging it done again.
 */
export function doneOnDay(behaviors, goalId, iso) {
  if (goalId === '' || goalId == null) return false;
  const id = String(goalId);
  return behaviors.some((b) => b.completed && b.logDate === iso && b.goal && String(b.goal.id) === id);
}

/** What an entry is called in a toast: its goal, or its own words. */
export function entryName(entry) {
  return entry.goal?.title || entry.note || 'that entry';
}

/**
 * The body that re-creates a removed entry with the fields it had: the Undo
 * after Remove. The server gives it a new id; everything the person wrote,
 * and the moment it was logged, comes back as it was.
 */
export function restoreRequest(entry) {
  return {
    goalId: entry.goal?.id ?? null,
    note: entry.note ?? '',
    completed: Boolean(entry.completed),
    mood: entry.mood ?? null,
    logDate: entry.logDate,
    latitude: entry.latitude ?? null,
    longitude: entry.longitude ?? null,
    placeName: entry.placeName ?? null,
    durationSeconds: entry.durationSeconds ?? null,
    loggedAt: entry.loggedAt ?? null,
  };
}
