import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';

/** Matches NoteService.MAX_NOTES, and is replaced by whatever the API says. */
const FALLBACK_LIMIT = 5;

/**
 * The caller's notes, plus the cap.
 *
 * The cap is read from the API rather than hardcoded here, so raising it is a
 * backend change alone. If that request fails the fallback keeps the UI
 * honest rather than letting someone write a sixth note and be refused on
 * save.
 */
export default function useNotes() {
  const [notes, setNotes] = useState([]);
  const [limit, setLimit] = useState(FALLBACK_LIMIT);
  const [loadState, setLoadState] = useState('loading');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      client.get('/api/notes'),
      client.get('/api/notes/limit').catch(() => null),
    ])
      .then(([notesRes, limitRes]) => {
        if (cancelled) return;
        if (!Array.isArray(notesRes.data)) {
          setLoadState('error');
          return;
        }
        setNotes(notesRes.data);
        const max = limitRes?.data?.maxNotes;
        if (typeof max === 'number' && max > 0) setLimit(max);
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const retry = useCallback(() => {
    setLoadState('loading');
    setReloadKey((k) => k + 1);
  }, []);

  const save = useCallback(
    async (note, body) => {
      if (note) await client.put(`/api/notes/${note.id}`, body);
      else await client.post('/api/notes', body);
      reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id) => {
      await client.delete(`/api/notes/${id}`);
      reload();
    },
    [reload],
  );

  const togglePin = useCallback(
    async (note) => {
      await client.put(`/api/notes/${note.id}`, { pinned: !note.pinned });
      reload();
    },
    [reload],
  );

  return { notes, limit, loadState, reload, retry, save, remove, togglePin };
}
