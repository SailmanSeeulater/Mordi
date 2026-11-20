import { describe, it, expect } from 'vitest';
import { addStep, finishSteps, MAX_STEPS, toggleStep } from './todoSteps';

const trip = (ticks, done = false) => ({
  id: 1,
  text: 'Plan the trip',
  done,
  steps: ticks.map((t, i) => ({ id: `s${i}`, text: `Step ${i}`, done: t })),
});

describe('todoSteps', () => {
  it('finishes the to-do when its last step is ticked', () => {
    const { steps, done } = toggleStep(trip([true, true, false]), 's2');
    expect(steps.every((s) => s.done)).toBe(true);
    expect(done).toBe(true);
  });

  it('leaves it open while other steps are', () => {
    const { steps, done } = toggleStep(trip([false, false]), 's0');
    expect(steps.map((s) => s.done)).toEqual([true, false]);
    expect(done).toBe(false);
  });

  it('reopens a finished to-do when a step is unticked', () => {
    const { steps, done } = toggleStep(trip([true, true], true), 's1');
    expect(steps.map((s) => s.done)).toEqual([true, false]);
    expect(done).toBe(false);
  });

  it('changes nothing for a step it does not have', () => {
    const todo = trip([false]);
    expect(toggleStep(todo, 'nope')).toEqual({ steps: todo.steps, done: false });
  });

  it('ticks every step when the to-do is ticked, and leaves them when it is reopened', () => {
    expect(finishSteps(trip([false, true]), true).map((s) => s.done)).toEqual([true, true]);
    expect(finishSteps(trip([true, true], true), false).map((s) => s.done)).toEqual([true, true]);
  });

  it('adds a trimmed open step, refusing a blank one or one too many', () => {
    expect(addStep(trip([true]), '  Ask Sam  ', () => 'new')).toEqual([
      { id: 's0', text: 'Step 0', done: true },
      { id: 'new', text: 'Ask Sam', done: false },
    ]);
    expect(addStep(trip([]), '   ')).toBeNull();
    expect(addStep(trip(Array(MAX_STEPS).fill(false)), 'One more')).toBeNull();
  });

  it('reads a to-do from before steps as having none', () => {
    expect(addStep({ id: 2, text: 'Old', done: false }, 'First', () => 'a')).toEqual([
      { id: 'a', text: 'First', done: false },
    ]);
  });
});
