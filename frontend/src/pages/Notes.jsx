import { useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import Modal from '../components/Modal';
import NoteForm from '../components/NoteForm';
import { NoteReader } from '../components/NotesPanel';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useNotes from '../hooks/useNotes';
import { noteExcerpt, noteHeading, tagsOf } from '../lib/markdown';
import '../components/notes.css';
import './notes-page.css';

const edited = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

/**
 * All the notes, as Obsidian lays out a vault: a list to search and filter
 * by tag on the left, the note itself on the right. On a phone the list and
 * the note take turns.
 *
 * Search matches titles and bodies; a tag narrows to notes carrying it. The
 * reader's [[links]] move between notes in place, and a link to a note that
 * does not exist yet starts it.
 */
export default function Notes() {
  useDocumentTitle('Notes');
  const { notes, limit, loadState, retry, save, remove, togglePin } = useNotes();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('read'); // read | edit | new
  const [newTitle, setNewTitle] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);
  // On a phone, whether the note pane is showing instead of the list.
  const [paneOpen, setPaneOpen] = useState(false);

  const sorted = useMemo(
    () =>
      [...notes].sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')),
      ),
    [notes],
  );

  const tags = useMemo(() => {
    const counts = new Map();
    for (const n of notes) {
      for (const t of tagsOf(n)) {
        const key = t.toLowerCase();
        counts.set(key, { name: t, count: (counts.get(key)?.count ?? 0) + 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [notes]);

  const q = query.trim().toLowerCase();
  const filtered = sorted.filter(
    (n) =>
      (!tag || tagsOf(n).some((t) => t.toLowerCase() === tag)) &&
      (!q || `${noteHeading(n)}\n${n.body}`.toLowerCase().includes(q)),
  );

  const selected = notes.find((n) => n.id === selectedId) ?? filtered[0] ?? null;
  const full = notes.length >= limit;

  const open = (note) => {
    setSelectedId(note.id);
    setMode('read');
    setPaneOpen(true);
  };

  const startNew = (title = '') => {
    if (full) return;
    setNewTitle(title);
    setMode('new');
    setPaneOpen(true);
  };

  const handleSave = async (body) => {
    const saved = await save(mode === 'new' ? null : selected, body);
    if (saved?.id) setSelectedId(saved.id);
    setMode('read');
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await remove(confirming.id);
      if (selectedId === confirming.id) setSelectedId(null);
      setConfirming(null);
      setPaneOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      title="Notes"
      action={
        <button type="button" className="app-btn" onClick={() => startNew()} disabled={full || loadState !== 'ready'}>
          New note
        </button>
      }
    >
      {loadState === 'loading' && <p className="app-status" role="status">Loading your notes&hellip;</p>}
      {loadState === 'error' && (
        <div className="app-status" role="alert">
          <span>Couldn&rsquo;t load your notes.</span>
          <button type="button" className="app-btn app-btn--quiet" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && (
        <div className={`vault${paneOpen ? ' vault--pane' : ''}`}>
          <aside className="app-panel vault__side" aria-label="Your notes">
            <div className="vault__search">
              <label className="app-sr" htmlFor="notes-search">
                Search notes
              </label>
              <input
                id="notes-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}
                autoComplete="off"
              />
            </div>

            {tags.length > 0 && (
              <div className="vault__tags" role="group" aria-label="Filter by tag">
                <button type="button" className="md-tag vault__tag" aria-pressed={!tag} onClick={() => setTag(null)}>
                  All
                </button>
                {tags.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    className="md-tag vault__tag"
                    aria-pressed={tag === t.name.toLowerCase()}
                    onClick={() => setTag(tag === t.name.toLowerCase() ? null : t.name.toLowerCase())}
                  >
                    #{t.name} <span>{t.count}</span>
                  </button>
                ))}
              </div>
            )}

            {filtered.length === 0 ? (
              <p className="app-empty">
                {notes.length === 0 ? 'No notes yet. Start one with New note.' : 'No note matches that.'}
              </p>
            ) : (
              <ul className="vault__list">
                {filtered.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className="vault__item"
                      aria-current={selected?.id === n.id ? 'true' : undefined}
                      onClick={() => open(n)}
                    >
                      <span className="vault__item-top">
                        <span className="vault__item-title">{noteHeading(n)}</span>
                        {n.pinned && (
                          <span className="vault__pin" title="Pinned">
                            <span className="app-sr">Pinned</span>
                          </span>
                        )}
                      </span>
                      <span className="vault__item-body">{noteExcerpt(n)}</span>
                      {n.updatedAt && <span className="vault__item-date">{edited.format(new Date(n.updatedAt))}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {full && <p className="notes__cap">That is all {limit}. Delete one to write another.</p>}
          </aside>

          <section className="app-panel vault__pane" aria-label="Note">
            <div className="vault__pane-bar">
              <button type="button" className="app-btn app-btn--ghost app-btn--sm vault__back" onClick={() => setPaneOpen(false)}>
                All notes
              </button>
              <div className="app-panel__spacer" />
              {selected && mode === 'read' && (
                <>
                  <button
                    type="button"
                    className="app-btn app-btn--quiet app-btn--sm"
                    onClick={() => togglePin(selected)}
                    aria-pressed={selected.pinned}
                  >
                    {selected.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={() => setConfirming(selected)}>
                    Delete
                  </button>
                </>
              )}
            </div>

            {mode === 'new' && (
              <>
                <h2 className="vault__title">New note</h2>
                <NoteForm notes={notes} initialTitle={newTitle} onSave={handleSave} onCancel={() => setMode('read')} />
              </>
            )}
            {mode === 'edit' && selected && (
              <>
                <h2 className="vault__title">{noteHeading(selected)}</h2>
                <NoteForm note={selected} notes={notes} onSave={handleSave} onCancel={() => setMode('read')} />
              </>
            )}
            {mode === 'read' && selected && (
              <>
                <h2 className="vault__title">{noteHeading(selected)}</h2>
                <NoteReader
                  note={selected}
                  notes={notes}
                  onOpen={open}
                  onCreate={(name) => startNew(name)}
                  onEdit={() => setMode('edit')}
                />
              </>
            )}
            {mode === 'read' && !selected && <p className="app-empty">Pick a note, or start a new one.</p>}
          </section>
        </div>
      )}

      {confirming && (
        <Modal title="Delete this note?" onClose={() => setConfirming(null)}>
          <p className="notes__confirm">
            {noteHeading(confirming)}
            <span>This cannot be undone.</span>
          </p>
          <div className="app-form">
            <div className="app-form__actions">
              <button type="button" className="app-btn app-btn--ghost" onClick={() => setConfirming(null)}>
                Keep it
              </button>
              <button type="button" className="app-btn app-btn--danger" onClick={handleDelete} disabled={busy}>
                {busy ? 'Deleting…' : 'Delete note'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
