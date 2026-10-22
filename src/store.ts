import type { AppState, StateKey } from './types.js';
import { defaultFilters } from './domain/filters.js';
import { prefs } from './lib/prefs.js';
import { dayKey } from './lib/dates.js';

type Listener = (changed: ReadonlySet<StateKey>, state: Readonly<AppState>) => void;

interface Subscription { keys: ReadonlySet<StateKey> | null; fn: Listener }

/**
 * Single source of truth. Explicit data flow: components call `set()`, the store notifies
 * subscribers whose keys changed. No proxies, no implicit reactivity.
 */
class Store {
  #state: AppState;
  readonly #subs = new Set<Subscription>();

  constructor(initial: AppState) {
    this.#state = initial;
  }

  get state(): Readonly<AppState> {
    return this.#state;
  }

  set(patch: Partial<AppState>): void {
    const changed = new Set<StateKey>();
    for (const key of Object.keys(patch) as StateKey[]) {
      if (!Object.is(this.#state[key], patch[key])) changed.add(key);
    }
    if (!changed.size) return;
    this.#state = { ...this.#state, ...patch };
    for (const sub of this.#subs) {
      if (!sub.keys || [...changed].some((k) => sub.keys?.has(k))) sub.fn(changed, this.#state);
    }
  }

  /** Subscribe to some keys (or all, with `null`). Calls `fn` once immediately. Returns an unsubscribe. */
  subscribe(keys: readonly StateKey[] | null, fn: Listener): () => void {
    const sub: Subscription = { keys: keys ? new Set(keys) : null, fn };
    this.#subs.add(sub);
    fn(new Set(keys ?? []), this.#state);
    return () => this.#subs.delete(sub);
  }
}

export const store = new Store({
  projects: [],
  meta: {},
  config: {},
  status: 'loading',
  filter: 'all',
  query: '',
  openId: null,
  filters: { ...defaultFilters(), ...(prefs.get('filters') ?? {}) },
  canAsk: false,
  day: dayKey(),
  notes: null,
});
