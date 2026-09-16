import { useState } from 'react';

/** Writes or edits one note. The cap is enforced by the API, not here. */
export default function NoteForm({ note, onSave, onCancel }) {
  const editing = Boolean(note);
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({ title: title.trim(), body: body.trim(), pinned });
    } catch (err) {
      // The API writes the cap message for people to read, so show it rather
      // than replacing it with something vaguer.
      setError(
        err?.response?.data?.error ??
          "Couldn't save that note. Check your connection and try again.",
      );
      setSaving(false);
    }
  };

  return (
    <form className="app-form" onSubmit={submit}>
      <div className="app-field">
        <label htmlFor="note-body">Note</label>
        <textarea
          id="note-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Physio said to stop at 20 minutes, not 40."
          required
          maxLength={2000}
          rows={5}
        />
      </div>

      <div className="app-field">
        <label htmlFor="note-title">Title</label>
        <input
          id="note-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Optional"
          maxLength={120}
        />
        <p className="app-field__hint">
          Left empty, the note shows its first line instead.
        </p>
      </div>

      <label className="app-check">
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
        Keep this one at the top
      </label>

      {error && (
        <p className="app-form__error" role="alert">
          {error}
        </p>
      )}

      <div className="app-form__actions">
        <button type="button" className="app-btn app-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="app-btn" disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save note' : 'Add note'}
        </button>
      </div>
    </form>
  );
}
