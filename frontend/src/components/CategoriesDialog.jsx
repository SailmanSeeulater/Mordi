import { useState } from 'react';
import Modal from './Modal';
import CategoryEditor from './CategoryEditor';
import useCategories, { MAX_CATEGORIES, categoryError } from '../hooks/useCategories';
import { ICONS } from '../lib/categories';
import './icon-picker.css';

/**
 * The person's own categories: rename, re-icon, delete, or add one.
 *
 * `goals` are the current goals, for saying how many a deletion touches.
 * `onChanged` runs after a change the goals list should reload for.
 */
export default function CategoriesDialog({ goals = [], onClose, onChanged }) {
  const { categories, loadState, retry, create, update, remove } = useCategories();
  const [editing, setEditing] = useState(null); // a category id, or 'new'
  const [confirming, setConfirming] = useState(null); // a category id
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const using = (category) => goals.filter((g) => g.category === category.key).length;

  const save = async (category, body) => {
    if (category) await update(category.id, body);
    else await create(body);
    setEditing(null);
    onChanged?.();
  };

  const confirmDelete = async (category) => {
    setBusy(true);
    setError('');
    try {
      await remove(category.id);
      setConfirming(null);
      onChanged?.();
    } catch (err) {
      setError(categoryError(err, `Couldn’t delete “${category.name}”. Check your connection and try again.`));
    }
    setBusy(false);
  };

  return (
    <Modal title="Categories" onClose={onClose}>
      <p className="app-field__hint">
        Fitness, sleep, productivity and health are always there. These are your own.
      </p>

      {loadState === 'loading' && categories.length === 0 && (
        <p className="app-empty" role="status">
          Loading your categories…
        </p>
      )}
      {loadState === 'error' && (
        <div className="app-empty" role="alert">
          <span>Couldn’t load your categories. </span>
          <button type="button" className="app-btn app-btn--quiet app-btn--sm" onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {loadState === 'ready' && categories.length === 0 && editing !== 'new' && (
        <p className="app-empty">None of your own yet.</p>
      )}

      {categories.length > 0 && (
        <ul className="cat-list">
          {categories.map((category) => {
            const count = using(category);
            return (
              <li key={category.id}>
                {editing === category.id ? (
                  <CategoryEditor
                    initial={category}
                    saveLabel="Save category"
                    onSave={(body) => save(category, body)}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <div className="cat-list__row">
                    <span className="cat-list__mark" aria-hidden="true">
                      {ICONS[category.icon] ?? ICONS.thumbtack}
                    </span>
                    <span className="cat-list__name">{category.name}</span>
                    <span className="cat-list__actions">
                      <button
                        type="button"
                        className="app-btn app-btn--quiet app-btn--sm"
                        aria-label={`Edit ${category.name}`}
                        onClick={() => {
                          setConfirming(null);
                          setEditing(category.id);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="app-btn app-btn--ghost app-btn--sm"
                        aria-label={`Delete ${category.name}`}
                        onClick={() => {
                          setEditing(null);
                          setError('');
                          setConfirming(category.id);
                        }}
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                )}
                {confirming === category.id && (
                  <div className="cat-editor" role="group" aria-label={`Delete ${category.name}`}>
                    <p className="cat-list__confirm">
                      Delete &ldquo;{category.name}&rdquo;?{' '}
                      {count === 0
                        ? 'None of your current goals use it.'
                        : `${count} of your current goals ${count === 1 ? 'uses' : 'use'} it. ${
                            count === 1 ? 'It' : 'They'
                          }’ll have no category, and keep any icon you chose.`}
                    </p>
                    {error && (
                      <p className="app-form__error" role="alert">
                        {error}
                      </p>
                    )}
                    <div className="cat-editor__actions">
                      <button
                        type="button"
                        className="app-btn app-btn--ghost app-btn--sm"
                        onClick={() => setConfirming(null)}
                      >
                        Keep it
                      </button>
                      <button
                        type="button"
                        className="app-btn app-btn--sm"
                        onClick={() => confirmDelete(category)}
                        disabled={busy}
                      >
                        {busy ? 'Deleting…' : 'Delete category'}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editing === 'new' ? (
        <CategoryEditor onSave={(body) => save(null, body)} onCancel={() => setEditing(null)} />
      ) : (
        loadState === 'ready' && (
          <div className="app-form__actions">
            {categories.length < MAX_CATEGORIES ? (
              <button
                type="button"
                className="app-btn app-btn--sm"
                onClick={() => {
                  setConfirming(null);
                  setEditing('new');
                }}
              >
                New category
              </button>
            ) : (
              <p className="app-field__hint">
                That’s {MAX_CATEGORIES}, the most you can have. Delete one to add another.
              </p>
            )}
          </div>
        )
      )}
    </Modal>
  );
}
