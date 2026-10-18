import { useSyncExternalStore } from 'react';

/**
 * A small display preference kept per browser, like the theme and the
 * modules: one of a fixed list of strings, saved to localStorage, with every
 * component that reads it updated when it changes, in this tab or another.
 *
 * Storage can be blocked (private windows, strict settings). Reads then fall
 * back to the default, and a choice made lasts until the page reloads.
 */
export function storedChoice({ key, values, fallback }) {
  const event = `mordi:${key}`;
  // Only used when storage is blocked, so a choice still lasts the session.
  let memory = null;

  const get = () => {
    let raw;
    try {
      raw = localStorage.getItem(key);
    } catch {
      raw = memory;
    }
    return values.includes(raw) ? raw : fallback;
  };

  const set = (value) => {
    if (!values.includes(value)) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      memory = value;
    }
    window.dispatchEvent(new Event(event));
  };

  const subscribe = (onChange) => {
    window.addEventListener(event, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(event, onChange);
      window.removeEventListener('storage', onChange);
    };
  };

  // A string, so the snapshot is stable between changes without a cache.
  const useChoice = () => useSyncExternalStore(subscribe, get, () => fallback);

  return { get, set, useChoice };
}
