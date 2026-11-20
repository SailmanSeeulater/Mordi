import { useRef, useState } from 'react';
import useTodos from '../hooks/useTodos';
import { MAX_STEPS } from '../lib/todoSteps';
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

const IconPlus = () => (
  <svg {...icon}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * The to-do's tick when it has steps: a ring like the goals', filling as the
 * steps are ticked, then a filled circle with a tick when the to-do is done.
 */
function StepRing({ fraction, done }) {
  const r = 7.25;
  const length = 2 * Math.PI * r;
  return (
    <span className={`todo__ring${done ? ' todo__ring--done' : ''}`} aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18" focusable="false">
        <circle className="todo__ring-track" cx="9" cy="9" r={r} />
        <circle
          className="todo__ring-fill"
          cx="9"
          cy="9"
          r={r}
          strokeDasharray={length}
          strokeDashoffset={length * (1 - (done ? 1 : fraction))}
          transform="rotate(-90 9 9)"
        />
      </svg>
      {done && <IconTick />}
    </span>
  );
}

/**
 * One-line to-dos. Type and press Enter to add; tick to finish; the x removes
 * one. No description field, on purpose: a to-do here is a reminder, not a
 * task with a body. A to-do can have a few steps under it, though: its tick
 * becomes a ring that fills as they're done, and the last one finishes it.
 */
export default function TodoList() {
  const { todos, loadState, error, retry, add, toggle, remove, clearDone, toggleStep, addStep, removeStep } =
    useTodos();
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
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={toggle}
              onRemove={remove}
              onToggleStep={toggleStep}
              onAddStep={addStep}
              onRemoveStep={removeStep}
            />
          ))}
        </ul>
      )}

      {loadState === 'ready' && done > 0 && (
        <div className="todo__foot">
          <button
            type="button"
            className="app-linkbtn"
            onClick={clearDone}
            title="Takes them off this list. They stay in Lately and your weekly report."
          >
            Clear {done} done
          </button>
        </div>
      )}
    </section>
  );
}

/** One to-do, its steps under it while it's open, and a line for adding a step. */
function TodoItem({ todo, onToggle, onRemove, onToggleStep, onAddStep, onRemoveStep }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const input = useRef(null);
  const steps = todo.steps ?? [];
  const stepsDone = steps.filter((s) => s.done).length;
  const saved = !String(todo.id).startsWith('temp-');
  const canAddStep = saved && !todo.done && steps.length < MAX_STEPS;
  const showSteps = !todo.done && (steps.length > 0 || adding);

  const openStep = () => {
    setAdding(true);
    // After the field is drawn.
    requestAnimationFrame(() => input.current?.focus());
  };
  const closeStep = () => {
    setAdding(false);
    setDraft('');
  };

  // Saves it and leaves the line open for the next; Enter on an empty line closes it.
  const submitStep = async (e) => {
    e.preventDefault();
    const text = draft;
    if (!text.trim()) {
      closeStep();
      return;
    }
    setDraft('');
    const ok = await onAddStep(todo, text);
    if (!ok) setDraft(text);
    else if (steps.length + 1 >= MAX_STEPS) closeStep();
  };

  return (
    <li className={`todo__item${todo.done ? ' todo__item--done' : ''}`}>
      <div className="todo__row">
        <button
          type="button"
          className="todo__check"
          role="checkbox"
          aria-checked={todo.done}
          aria-describedby={steps.length ? `todo-steps-${todo.id}` : undefined}
          onClick={() => onToggle(todo)}
        >
          {steps.length ? (
            <StepRing fraction={stepsDone / steps.length} done={todo.done} />
          ) : (
            <span className="todo__box" aria-hidden="true">
              {todo.done && <IconTick />}
            </span>
          )}
          <span className="todo__text">{todo.text}</span>
          {steps.length > 0 && (
            <span className="todo__count" id={`todo-steps-${todo.id}`}>
              <span aria-hidden="true">
                {stepsDone}/{steps.length}
              </span>
              <span className="app-sr">
                {stepsDone} of {steps.length} steps done
              </span>
            </span>
          )}
        </button>
        {canAddStep && (
          <button
            type="button"
            className="todo__quiet"
            onClick={openStep}
            aria-label={`Add a step to ${todo.text}`}
            title="Add a step"
          >
            <IconPlus />
          </button>
        )}
        <button
          type="button"
          className="todo__quiet todo__remove"
          onClick={() => onRemove(todo)}
          aria-label={`Delete: ${todo.text}`}
          title="Delete"
        >
          <IconRemove />
        </button>
      </div>

      {showSteps && (
        <ul className="todo__steps" aria-label={`Steps of ${todo.text}`}>
          {steps.map((step) => (
            <li key={step.id} className={`todo__step${step.done ? ' todo__step--done' : ''}`}>
              <button
                type="button"
                className="todo__check todo__check--step"
                role="checkbox"
                aria-checked={step.done}
                onClick={() => onToggleStep(todo, step.id)}
              >
                <span className="todo__box todo__box--step" aria-hidden="true">
                  {step.done && <IconTick />}
                </span>
                <span className="todo__text">{step.text}</span>
              </button>
              <button
                type="button"
                className="todo__quiet todo__remove"
                onClick={() => onRemoveStep(todo, step.id)}
                aria-label={`Remove step: ${step.text}`}
                title="Remove step"
              >
                <IconRemove />
              </button>
            </li>
          ))}
          {adding && (
            <li className="todo__step">
              <form className="todo__step-add" onSubmit={submitStep}>
                <span className="todo__step-plus" aria-hidden="true">
                  <IconPlus />
                </span>
                <label className="app-sr" htmlFor={`todo-step-new-${todo.id}`}>
                  New step for {todo.text}
                </label>
                <input
                  id={`todo-step-new-${todo.id}`}
                  ref={input}
                  className="todo__step-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') closeStep();
                  }}
                  onBlur={() => {
                    if (!draft.trim()) closeStep();
                  }}
                  placeholder="Add a step"
                  maxLength={200}
                  autoComplete="off"
                  enterKeyHint="done"
                />
              </form>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}
