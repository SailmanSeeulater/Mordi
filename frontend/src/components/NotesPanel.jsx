import { useCallback, useState } from 'react';
import useNotes from '../hooks/useNotes';
import Modal from './Modal';
import NoteForm from './NoteForm';
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

/** A note with no title is shown by its first line. */
function noteHeading(note) {
  if (note.title) return note.title;
  const [first] = note.body.split('\n');
  return first.length > 60 ? `${first.slice(0, 60)}…` : first;
}

/** The body, minus whatever the heading already showed. */
function noteRest(note) {
  if (note.title) return note.body;
  return note.body.split('\n').slice(1).join('\n').trim();
}

export default function NotesPanel() {
  const { notes, limit, loadState, retry, save, remove, togglePin } = useNotes();
  const [editing, setEditing] = useState(null); // null | 'new' | note
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => setEditing(null), []);
  const full = notes.length >= limit;

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
          {notes.length} / {limit}
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
          {notes.map((note) => {
            const rest = noteRest(note);
            return (
              <li className={`note${note.pinned ? ' note--pinned' : ''}`} key={note.id}>
                <button
                  type="button"
                  className="note__open"
                  onClick={() => setEditing(note)}
                  aria-label={`Edit note: ${noteHeading(note)}`}
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

      {full && loadState === 'ready' && (
        <p className="notes__cap">That is all {limit}. Delete one to write another.</p>
      )}

      {editing && (
        <Modal title={editing === 'new' ? 'New note' : 'Edit note'} onClose={close}>
          <NoteForm
            note={editing === 'new' ? null : editing}
            onSave={handleSave}
            onCancel={close}
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
