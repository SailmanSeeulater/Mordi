import { Suspense, lazy, useCallback, useState } from 'react';
import useNotes from '../hooks/useNotes';
import { Link } from 'react-router-dom';
import Modal from './Modal';
import NoteForm from './NoteForm';

// The Markdown renderer is the heaviest thing on the dashboard; it loads the
// first time a note is opened, not with the page.
const Markdown = lazy(() => import('./Markdown'));
import { backlinks, findNote, noteExcerpt, noteHeading, tagsOf } from '../lib/markdown';
import './notes.css';

const icon = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

const IconPin = ({ filled }) => (
  <svg {...icon} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 17v4" />
    <path d="M8 3h8l-1.2 6.2 2.7 3.1a1 1 0 01-.76 1.7H7.26a1 1 0 01-.76-1.7l2.7-3.1L8 3z" />
  </svg>
);

const IconTrash = () => (
  <svg {...icon}>
    <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
  </svg>
);

const editedFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Obsidian's reading view for one note: the Markdown set as a page to read,
 * a quiet line of facts above it, and the notes that link here below.
 * [[Links]] open the note they name; one to a note that does not exist yet
 * offers to write it. The dialog's own Close is the only close.
 */
export function NoteReader({ note, notes, onOpen, onCreate, onEdit }) {
  const tags = tagsOf(note);
  const linkedFrom = backlinks(notes, note);
  const edited = note.updatedAt ?? note.createdAt;
  return (
    <article className="note-reader">
      <p className="note-reader__meta">
        {edited && <span>Edited {editedFormat.format(new Date(edited))}</span>}
        {note.pinned && <span>Pinned</span>}
        {tags.map((t) => (
          <span key={t} className="md-tag">
            #{t}
          </span>
        ))}
      </p>

      <div className="note-reader__page">
        <Suspense fallback={<p className="app-empty">Opening the note…</p>}>
          <Markdown
            source={note.body}
            resolve={(name) => findNote(notes, name)}
            onOpenNote={(name) => {
              const target = findNote(notes, name);
              if (target) onOpen(target);
              else onCreate(name);
            }}
          />
        </Suspense>
      </div>

      <footer className="note-reader__foot">
        {linkedFrom.length > 0 ? (
          <div className="note-reader__backlinks">
            <span>Linked from</span>
            {linkedFrom.map((n) => (
              <button key={n.id} type="button" className="note-reader__backlink" onClick={() => onOpen(n)}>
                {noteHeading(n)}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <button type="button" className="app-btn" onClick={onEdit}>
          Edit note
        </button>
      </footer>
    </article>
  );
}

export default function NotesPanel() {
  const { notes, limit, loadState, retry, save, remove, togglePin } = useNotes();
  const [editing, setEditing] = useState(null); // null | 'new' | note
  const [reading, setReading] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => {
    setEditing(null);
    setNewTitle('');
  }, []);

  // A [[link]] to a note that does not exist yet: write it, as Obsidian does,
  // unless the cap is already reached.
  const createFromLink = (name) => {
    setReading(null);
    if (notes.length >= limit) return;
    setNewTitle(name);
    setEditing('new');
  };
  const full = notes.length >= limit;
  // The dashboard shows a handful: pinned first, then the latest. The rest
  // live on the Notes page, with search and tags.
  const SHOWN = 5;
  const shown = [...notes]
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
    .slice(0, SHOWN);

  const handleSave = async (body) => {
    await save(editing === 'new' ? null : editing, body);
    setEditing(null);
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await remove(confirming.id);
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="app-panel__head">
        <h2 className="app-panel__title" id="dash-notes-title">
          Notes
        </h2>
        <div className="app-panel__spacer" />
        <span className="app-panel__meta">
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </span>
        <button
          type="button"
          className="app-btn app-btn--quiet app-btn--sm"
          onClick={() => setEditing('new')}
          disabled={full || loadState !== 'ready'}
          title={full ? `You can keep up to ${limit} notes` : undefined}
        >
          Add
        </button>
      </div>

      {loadState === 'loading' && <p className="app-empty">Loading your notes…</p>}

      {loadState === 'error' && (
        <div className="app-empty">
          <p>Couldn&rsquo;t load your notes.</p>
          <button type="button" className="app-btn app-btn--quiet app-btn--sm" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && notes.length === 0 && (
        <p className="app-empty">
          Nothing written down. Notes are for the things that do not belong to one goal — what
          the physio said, the route that works, the number to call.
        </p>
      )}

      {loadState === 'ready' && notes.length > 0 && (
        <ul className="app-list notes">
          {shown.map((note) => {
            const rest = noteExcerpt(note);
            return (
              <li className={`note${note.pinned ? ' note--pinned' : ''}`} key={note.id}>
                <button
                  type="button"
                  className="note__open"
                  onClick={() => setReading(note)}
                  aria-label={`Open note: ${noteHeading(note)}`}
                >
                  <span className="note__heading">{noteHeading(note)}</span>
                  {rest && <span className="note__body">{rest}</span>}
                </button>
                <div className="note__tools">
                  <button
                    type="button"
                    className="app-iconbtn app-iconbtn--sm"
                    onClick={() => togglePin(note)}
                    aria-pressed={note.pinned}
                    aria-label={note.pinned ? 'Unpin this note' : 'Keep this note at the top'}
                    title={note.pinned ? 'Unpin' : 'Pin to top'}
                  >
                    <IconPin filled={note.pinned} />
                  </button>
                  <button
                    type="button"
                    className="app-iconbtn app-iconbtn--sm"
                    onClick={() => setConfirming(note)}
                    aria-label={`Delete note: ${noteHeading(note)}`}
                    title="Delete"
                  >
                    <IconTrash />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {loadState === 'ready' && notes.length > 0 && (
        <p className="notes__all">
          <Link to="/notes">
            {notes.length > SHOWN ? `All ${notes.length} notes` : 'Open notes'}
            {' →'}
          </Link>
        </p>
      )}

      {full && loadState === 'ready' && (
        <p className="notes__cap">That is all {limit}. Delete one to write another.</p>
      )}

      {editing && (
        <Modal title={editing === 'new' ? 'New note' : 'Edit note'} onClose={close} size="wide">
          <NoteForm
            note={editing === 'new' ? null : editing}
            notes={notes}
            initialTitle={newTitle}
            onSave={handleSave}
            onCancel={close}
          />
        </Modal>
      )}

      {reading && (
        <Modal title={noteHeading(reading)} onClose={() => setReading(null)} size="wide">
          <NoteReader
            // Re-read from the live list, so an edit shows when coming back.
            note={notes.find((n) => n.id === reading.id) ?? reading}
            notes={notes}
            onOpen={setReading}
            onCreate={createFromLink}
            onEdit={() => {
              setEditing(notes.find((n) => n.id === reading.id) ?? reading);
              setReading(null);
            }}
          />
        </Modal>
      )}

      {confirming && (
        <Modal title="Delete this note?" onClose={() => setConfirming(null)}>
          <p className="notes__confirm">
            {noteHeading(confirming)}
            <span>This cannot be undone.</span>
          </p>
          <div className="app-form">
            <div className="app-form__actions">
              <button
                type="button"
                className="app-btn app-btn--ghost"
                onClick={() => setConfirming(null)}
              >
                Keep it
              </button>
              <button
                type="button"
                className="app-btn app-btn--danger"
                onClick={handleDelete}
                disabled={busy}
              >
                {busy ? 'Deleting…' : 'Delete note'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
