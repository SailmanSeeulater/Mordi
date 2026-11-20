/**
 * How a to-do and its steps move together, as on the Mac (MordiCore's
 * TodoSteps): the to-do ticks itself when its last step is ticked, opens
 * again when a step is unticked, and ticking the to-do ticks every step.
 * The server keeps whatever the app sends; these rules are the apps'.
 */

export const MAX_STEPS = 20;
export const MAX_STEP_TEXT = 200;

/** One step ticked or unticked, and whether the to-do is done after it. */
export function toggleStep(todo, stepId) {
  const steps = todo.steps ?? [];
  const at = steps.findIndex((s) => s.id === stepId);
  if (at === -1) return { steps, done: todo.done };
  const next = steps.map((s, i) => (i === at ? { ...s, done: !s.done } : s));
  const done = next[at].done ? todo.done || next.every((s) => s.done) : false;
  return { steps: next, done };
}

/** The steps after the to-do is ticked or reopened: ticking ticks them all. */
export function finishSteps(todo, done) {
  const steps = todo.steps ?? [];
  return done ? steps.map((s) => ({ ...s, done: true })) : steps;
}

/** A new open step at the end, or null when it's blank or the to-do is full. */
export function addStep(todo, text, makeId = newStepId) {
  const steps = todo.steps ?? [];
  const trimmed = text.trim();
  if (!trimmed || steps.length >= MAX_STEPS) return null;
  return [...steps, { id: makeId(), text: trimmed.slice(0, MAX_STEP_TEXT), done: false }];
}

export function newStepId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
