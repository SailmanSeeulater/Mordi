import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';

/** Fired after any change to the person's categories is saved. */
export const CATEGORIES_CHANGED = 'mordi:categories-changed';

/** Matches CategoryService.MAX_CATEGORIES. */
export const MAX_CATEGORIES = 20;

/* The last list loaded, kept for the session so opening the goal form again
   shows the person's categories at once instead of a moment without them.
   It is refreshed from the API every time a hook mounts, and belongs to one
   account: signing in as someone else in the same tab never shows the last
   person's list, even for a moment. */
let cache = null; // { owner, list }

function signedInAs() {
  try {
    return JSON.parse(localStorage.getItem('user') ?? 'null')?.email ?? null;
  } catch {
    return null;
  }
}

function cachedList() {
  return cache && cache.owner === signedInAs() ? cache.list : null;
}

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

function store(list) {
  cache = { owner: signedInAs(), list: [...list].sort(byName) };
  window.dispatchEvent(new Event(CATEGORIES_CHANGED));
  return cache.list;
}

/** For tests: forget what the last one loaded. */
export function resetCategoriesCache() {
  cache = null;
}

/** The server's message for a refused change, written to be shown as-is. */
export function categoryError(err, fallback) {
  const status = err?.response?.status;
  const message = err?.response?.data?.error;
  if ((status === 400 || status === 409) && typeof message === 'string' && message !== 'That conflicts with existing data') {
    return message;
  }
  if (status === 409) return 'You already have a category with that name.';
  return fallback;
}

/**
 * The person's own categories (the four built-in ones are not in it), with
 * create, update and delete. Every mounted copy stays in step: a category made
 * in the goal form shows on the Goals page without a reload.
 */
export default function useCategories() {
  const [categories, setCategories] = useState(() => cachedList() ?? []);
  const [loadState, setLoadState] = useState(() => (cachedList() ? 'ready' : 'loading'));
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    client
      .get('/api/categories')
      .then((res) => {
        if (cancelled) return;
        if (!Array.isArray(res.data)) {
          setLoadState((s) => (s === 'ready' ? s : 'error'));
          return;
        }
        store(res.data);
        setLoadState('ready');
      })
      .catch(() => {
        // A list already on screen stays usable; only a first load fails.
        if (!cancelled) setLoadState((s) => (s === 'ready' ? s : 'error'));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    const sync = () => {
      const list = cachedList();
      if (list) setCategories(list);
    };
    window.addEventListener(CATEGORIES_CHANGED, sync);
    return () => window.removeEventListener(CATEGORIES_CHANGED, sync);
  }, []);

  const retry = useCallback(() => {
    setLoadState('loading');
    setReloadKey((k) => k + 1);
  }, []);

  /** Resolves to the new category, so a caller can select it. Throws if refused. */
  const create = useCallback(async (body) => {
    const res = await client.post('/api/categories', body);
    const made = res?.data;
    if (made?.id != null) store([...(cachedList() ?? []), made]);
    return made ?? null;
  }, []);

  const update = useCallback(async (id, body) => {
    const res = await client.put(`/api/categories/${id}`, body);
    const saved = res?.data;
    if (saved?.id != null) store((cachedList() ?? []).map((c) => (c.id === id ? saved : c)));
    return saved ?? null;
  }, []);

  /** The server also takes it off every goal that had it. */
  const remove = useCallback(async (id) => {
    await client.delete(`/api/categories/${id}`);
    store((cachedList() ?? []).filter((c) => c.id !== id));
  }, []);

  return { categories, loadState, retry, create, update, remove };
}
