import { useEffect, useId, useRef, useState } from 'react';
import IconPicker from './IconPicker';
import { categoryError } from '../hooks/useCategories';

const MAX_NAME = 40;

/**
 * A category's name and icon, made or edited in place.
 *
 * Not a <form>: it sits inside the goal form, and forms do not nest. Enter in
 * the name saves the category rather than the goal around it.
 */
export default function CategoryEditor({ initial, onSave, onCancel, saveLabel = 'Add category' }) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? 'thumbtack');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the category a name.');
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ name: trimmed, icon });
    } catch (err) {
      setError(categoryError(err, 'Couldn’t save that category. Check your connection and try again.'));
      setSaving(false);
    }
  };

  return (
    <div className="cat-editor" role="group" aria-labelledby={`${id}-legend`}>
      <span className="app-sr" id={`${id}-legend`}>
        {initial ? 'Edit category' : 'New category'}
      </span>
      <div className="app-field">
        <label htmlFor={`${id}-name`}>Category name</label>
        <input
          id={`${id}-name`}
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            }
            if (e.key === 'Escape' && onCancel) {
              // Close this, not the dialog it sits in.
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }
          }}
          placeholder="Reading"
          maxLength={MAX_NAME}
          autoComplete="off"
        />
      </div>
      <div className="app-field">
        <span className="app-field__label" id={`${id}-icon`}>
          Icon
        </span>
        <IconPicker value={icon} onChange={setIcon} labelledBy={`${id}-icon`} />
      </div>
      {error && (
        <p className="app-form__error" role="alert">
          {error}
        </p>
      )}
      <div className="cat-editor__actions">
        {onCancel && (
          <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="button" className="app-btn app-btn--sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : saveLabel}
        </button>
      </div>
    </div>
  );
}
