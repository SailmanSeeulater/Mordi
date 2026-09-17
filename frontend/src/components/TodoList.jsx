import { useState } from 'react';
import useTodos from '../hooks/useTodos';
import './todo.css';

const icon = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

const IconTick = () => (
  <svg {...icon} width="12" height="12" strokeWidth="3">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const IconRemove = () => (
  <svg {...icon}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/**
 * One-line to-dos. Type and press Enter to add; tick to finish; the x removes
 * one. No description field, on purpose: a to-do here is a reminder, not a
 * task with a body.
 */
export default function TodoList() {
  const { todos, loadState, error, retry, add, toggle, remove, clearDone } = useTodos();
  const [draft, setDraft] = useState('');

  const open = todos.filter((t) => !t.done).length;
  const done = todos.length - open;

  const submit = async (e) => {
    e.preventDefault();
    const text = draft;
    // Clear straight away, so a second item can be typed while the first saves.
    setDraft('');
    const ok = await add(text);
    if (!ok) setDraft(text);
  };

  return (
    <section className="todo" aria-labelledby="dash-todo-title">
      <div className="app-panel__head">
        <h2 className="app-panel__title" id="dash-todo-title">
          To do
        </h2>
        <div className="app-panel__spacer" />
        {loadState === 'ready' && (
          <span className="app-panel__meta">{open === 0 ? 'All clear' : `${open} open`}</span>
        )}
      </div>

      <form className="todo__add" onSubmit={submit}>
        <label className="app-sr" htmlFor="todo-new">
          New to-do
        </label>
        <input
          id="todo-new"
          className="todo__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a to-do"
          maxLength={200}
          autoComplete="off"
          enterKeyHint="done"
          disabled={loadState !== 'ready'}
        />
        <button
          type="submit"
          className="app-btn app-btn--quiet app-btn--sm"
          disabled={loadState !== 'ready' || !draft.trim()}
        >
          Add
        </button>
      </form>

      {error && (
        <p className="app-form__error todo__error" role="alert">
          {error}
        </p>
      )}

      {loadState === 'loading' && <p className="app-empty">Loading your to-dos…</p>}

      {loadState === 'error' && (
        <div className="app-empty">
          <p>Couldn&rsquo;t load your to-dos.</p>
          <button type="button" className="app-btn app-btn--quiet app-btn--sm" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && todos.length === 0 && (
        <p className="app-empty todo__empty">Nothing on the list.</p>
      )}

      {loadState === 'ready' && todos.length > 0 && (
        <ul className="todo__list">
          {todos.map((todo) => (
            <li key={todo.id} className={`todo__item${todo.done ? ' todo__item--done' : ''}`}>
              <button
                type="button"
                className="todo__check"
                role="checkbox"
                aria-checked={todo.done}
                onClick={() => toggle(todo)}
              >
                <span className="todo__box" aria-hidden="true">
                  {todo.done && <IconTick />}
                </span>
                <span className="todo__text">{todo.text}</span>
              </button>
              <button
                type="button"
                className="todo__remove"
                onClick={() => remove(todo)}
                aria-label={`Delete: ${todo.text}`}
                title="Delete"
              >
                <IconRemove />
              </button>
            </li>
          ))}
        </ul>
      )}

      {loadState === 'ready' && done > 0 && (
        <div className="todo__foot">
          <button type="button" className="app-linkbtn" onClick={clearDone}>
            Clear {done} done
          </button>
        </div>
      )}
    </section>
  );
}
