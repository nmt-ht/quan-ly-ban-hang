export type StepState = 'done' | 'current' | 'todo';

export interface StatusStep {
  label: string;
  state: StepState;
  /** A few words after the label of the step the document is at, e.g. "một phần". */
  hint?: string;
}

/**
 * The steps of a lifecycle in order, from the index of the step the document is at.
 * `at < 0` = stopped (cancelled): nothing done, nothing current. `finished` = every step done.
 * `hint` rides on the current step.
 */
export function stepsAt(labels: string[], at: number, opts: { finished?: boolean; hint?: string } = {}): StatusStep[] {
  return labels.map((label, i) => {
    const state: StatusStep['state'] = at < 0 ? 'todo' : opts.finished || i < at ? 'done' : i === at ? 'current' : 'todo';
    return state === 'current' && opts.hint ? { label, state, hint: opts.hint } : { label, state };
  });
}
