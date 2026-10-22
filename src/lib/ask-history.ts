/** One Ask Rundown exchange. `a` is empty while the answer streams or after a failed ask. */
export interface AskTurn { q: string; a: string; at: string; /** Collapsed in the transcript. */ folded?: boolean }

/** Session-only: the transcript lives in this tab and is gone when the tab closes. */
const KEY = 'rundown.askLog';
export const MAX_TURNS = 20;
/** Earlier turns sent with a new question so follow-ups have context. */
export const CONTEXT_TURNS = 3;

function valid(t: unknown): t is AskTurn {
  const o = t as Partial<AskTurn> | null;
  return !!o && typeof o.q === 'string' && typeof o.a === 'string' && typeof o.at === 'string';
}

export function loadTurns(): AskTurn[] {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter(valid).slice(-MAX_TURNS) : [];
  } catch { return []; }
}

export function saveTurns(turns: readonly AskTurn[]): void {
  try {
    if (turns.length) sessionStorage.setItem(KEY, JSON.stringify(turns.slice(-MAX_TURNS)));
    else sessionStorage.removeItem(KEY);
  } catch { /* private mode / blocked storage: history just won't survive a reload */ }
}

/** Plain-text recap of the last answered turns, for the prompt. Empty when there are none. */
export function recap(turns: readonly AskTurn[]): string {
  const done = turns.filter((t) => t.a).slice(-CONTEXT_TURNS);
  return done.map((t) => `Q: ${t.q}\nA: ${t.a}`).join('\n\n');
}
