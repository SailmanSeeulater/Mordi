/**
 * Where a person is in the first-run tour, kept per account in this browser.
 *
 *   'new'   never started: the welcome and the first goal are next
 *   'goal'  saw the welcome; the week card and the rest come once a goal exists
 *   'done'  finished or skipped
 */

const key = (email) => `mordi-tour:${(email || '').trim().toLowerCase()}`;

export function tourStage(email) {
  try {
    const v = localStorage.getItem(key(email));
    return v === 'goal' || v === 'done' ? v : 'new';
  } catch {
    return 'done';
  }
}

export function setTourStage(email, stage) {
  try {
    localStorage.setItem(key(email), stage);
  } catch {
    // Blocked storage: the tour would come back next visit, which is bearable.
  }
}
