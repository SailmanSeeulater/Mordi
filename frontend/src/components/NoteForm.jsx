import { Suspense, lazy, useRef, useState } from 'react';

// The Markdown renderer is the heaviest thing on the dashboard; it loads the
// first time a note is opened, not with the page.
const Markdown = lazy(() => import('./Markdown'));
import { findNote } from '../lib/markdown';

const MAX_BODY = 20_000;

const MODES = ['Write', 'Preview'];

/**
 * Wraps the selection in the textarea with Markdown marks, or inserts a
 * prefix at the start of the line, the way an editor's shortcut would.
 */
function applyMark(textarea, body, mark) {
  const { selectionStart: a, selectionEnd: b } = textarea;
  const selected = body.slice(a, b);
  if (mark.prefix) {
    const lineStart = body.lastIndexOf('\n', a - 1) + 1;
    return { body: body.slice(0, lineStart) + mark.prefix + body.slice(lineStart), cursor: b + mark.prefix.length };
  }
  const inner = selected || mark.placeholder;
  const next = body.slice(0, a) + mark.open + inner + mark.close + body.slice(b);
  return { body: next, cursor: a + mark.open.length + inner.length };
}

const svg = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

const MARKS = [
  { label: 'Bold', open: '**', close: '**', placeholder: 'bold',
    icon: <svg {...svg}><path d="M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z" /></svg> },
  { label: 'Italic', open: '*', close: '*', placeholder: 'italic',
    icon: <svg {...svg}><path d="M14 5h-4M14 19h-4M13 5l-2 14" /></svg> },
  { label: 'Heading', prefix: '## ',
    icon: <svg {...svg}><path d="M6 5v14M16 5v14M6 12h10" /></svg> },
  { label: 'Checklist item', prefix: '- [ ] ',
    icon: <svg {...svg}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></svg> },
  { label: 'Link to a note', open: '[[', close: ']]', placeholder: 'Note title',
    icon: <svg {...svg}><path d="M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1" /></svg> },
];

/**
 * Writes or edits one note, in Markdown, with a live preview a tap away:
 * Obsidian's split between writing the source and reading the result.
 * The cap on the number of notes is enforced by the API, not here.
 */
export default function NoteForm({ note, notes = [], initialTitle = '', onSave, onCancel }) {
  const editing = Boolean(note);
  const [title, setTitle] = useState(note?.title ?? initialTitle);
  const [body, setBody] = useState(note?.body ?? '');
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [mode, setMode] = useState('Write');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const area = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) {
      setMode('Write');
      setError('Write something first.');
      return;
    }
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

  const mark = (m) => {
    const el = area.current;
    if (!el) return;
    const next = applyMark(el, body, m);
    setBody(next.body.slice(0, MAX_BODY));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.cursor, next.cursor);
    });
  };

  return (
    <form className="app-form note-editor" onSubmit={submit}>
      <div className="app-field">
        <label htmlFor="note-title">Title</label>
        <input
          id="note-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Optional: left empty, the first line is the title"
          maxLength={120}
        />
      </div>

      {/* One framed editor: the mode switch and formatting sit inside the
          frame, above the text, and focus outlines the whole frame. Before,
          the textarea's own focus ring spilled over the toolbar above it. */}
      <div className={`note-editor__frame${mode === 'Preview' ? ' note-editor__frame--preview' : ''}`}>
        <div className="note-editor__bar">
          <div className="app-segments note-editor__modes" role="group" aria-label="Editor mode">
            <span
              className="app-segments__thumb"
              style={{ '--n': MODES.length, '--i': MODES.indexOf(mode) }}
              aria-hidden="true"
            />
            {MODES.map((m) => (
              <button key={m} type="button" className="app-segment" aria-pressed={m === mode} onClick={() => setMode(m)}>
                {m}
              </button>
            ))}
          </div>
          {mode === 'Write' && (
            <div className="note-editor__marks" role="toolbar" aria-label="Formatting">
              {MARKS.map((m) => (
                <button
                  key={m.label}
                  type="button"
                  className="note-editor__mark"
                  onClick={() => mark(m)}
                  aria-label={m.label}
                  title={m.label}
                >
                  {m.icon}
                </button>
              ))}
            </div>
          )}
        </div>

        {mode === 'Write' ? (
          <>
            <label className="app-sr" htmlFor="note-body">
              Note, in Markdown
            </label>
            <textarea
              id="note-body"
              ref={area}
              className="note-editor__source"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={'# Physio\nStop at **20 minutes**, not 40.\n\n- [ ] Book follow-up\n\nSee [[Running plan]] #health'}
              maxLength={MAX_BODY}
              rows={14}
              spellCheck
            />
          </>
        ) : (
          <div className="note-editor__preview" aria-label="Preview">
            {body.trim() ? (
              <Suspense fallback={<p className="app-empty">Loading the preview…</p>}>
                <Markdown source={body} resolve={(name) => findNote(notes, name)} />
              </Suspense>
            ) : (
              <p className="app-empty">Nothing to preview yet.</p>
            )}
          </div>
        )}
      </div>
      <p className="app-field__hint note-editor__hint">
        <span>
          Markdown. <code>[[Note title]]</code> links another note, <code>#tag</code> tags this one.
        </span>
        <span className="note-editor__count">{body.length.toLocaleString()} / {MAX_BODY.toLocaleString()}</span>
      </p>

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
