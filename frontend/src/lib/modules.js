import { useSyncExternalStore } from 'react';

/**
 * What the app shows, grown with use.
 *
 * A new account starts focused: the goal rings, the week, and what was
 * logged, which is the whole loop of the product. Everything else is a
 * module the person adds when they want it, or that turns itself on once
 * there is something for it to show. Someone with weeks of history starts
 * with everything, exactly as before.
 *
 * Kept per browser, like the theme and the block order.
 */

export const MODULES = [
  { id: 'plan', label: 'Calendar', blurb: 'Plan the day in blocks, then mark each done or skipped.', page: '/calendar', block: true },
  { id: 'todo', label: 'To do', blurb: 'One-line to-dos, beside what you logged.', block: true },
  { id: 'timer', label: 'Timer', blurb: 'Time a session and save it as an entry.', block: true },
  { id: 'notes', label: 'Notes', blurb: 'Markdown notes, linked the way Obsidian links them.', page: '/notes', block: true },
  { id: 'activity', label: 'Activity', blurb: 'A year of logging, one square a day.', block: true },
  { id: 'clock', label: 'Clock & weather', blurb: 'The time and today’s weather on the week card.', block: true },
  { id: 'places', label: 'Places', blurb: 'A map of where you logged, with directions.', page: '/locations' },
  { id: 'together', label: 'Together', blurb: 'Goals shared with friends, and their threads.', page: '/together' },
  { id: 'history', label: 'History', blurb: 'Goals you archived, and what they came to.', page: '/history' },
];

export const MODULE_IDS = MODULES.map((m) => m.id);
const KEY = 'mordi-modules';
const EVENT = 'mordi:modules';

/** Days with something logged before a new browser starts with everything on. */
export const ESTABLISHED_DAYS = 14;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.mode !== 'focused' && parsed?.mode !== 'everything') return null;
    return { mode: parsed.mode, on: Array.isArray(parsed.on) ? parsed.on.filter((id) => MODULE_IDS.includes(id)) : [] };
  } catch {
    return null;
  }
}

// useSyncExternalStore needs the same object back until something changes.
let cache;
let cacheRaw;
function snapshot() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Blocked storage: behave as undecided.
  }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = read();
  }
  return cache;
}

function write(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked: the choice lasts until the page reloads.
    cacheRaw = undefined;
    cache = prefs;
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * The saved choice, or null while undecided. Undecided shows everything:
 * only the dashboard, with the person's history in hand, decides.
 */
export function useModules() {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

export function isOn(prefs, id) {
  return !prefs || prefs.mode === 'everything' || prefs.on.includes(id);
}

/** Focused for a new account; everything for one with weeks of logging. */
export function initialPrefs(behaviors) {
  const days = new Set(behaviors.map((b) => b.logDate));
  return days.size >= ESTABLISHED_DAYS
    ? { mode: 'everything', on: [...MODULE_IDS] }
    : { mode: 'focused', on: [] };
}

export function savePrefs(prefs) {
  write(prefs);
}

export function setMode(mode) {
  const current = snapshot() ?? { mode: 'everything', on: [...MODULE_IDS] };
  // Switching to focused keeps what was switched on by hand; everything is everything.
  write({ mode, on: mode === 'everything' ? [...MODULE_IDS] : current.mode === 'everything' ? [] : current.on });
}

export function setModule(id, on) {
  const current = snapshot() ?? { mode: 'focused', on: [] };
  const set = new Set(current.mode === 'everything' ? MODULE_IDS : current.on);
  if (on) set.add(id);
  else set.delete(id);
  // Turning one off from everything is a step into choosing: focused, with the rest kept.
  const all = MODULE_IDS.every((m) => set.has(m));
  write({ mode: all ? 'everything' : 'focused', on: [...set] });
}

/** Turns a module on because there is now something for it; never turns one off. */
export function enableModule(id) {
  const current = snapshot();
  if (!current || isOn(current, id)) return;
  setModule(id, true);
}
