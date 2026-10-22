import { defaultFilters } from './domain/filters.js';
import { prefs } from './lib/prefs.js';
import { dayKey } from './lib/dates.js';
/**
 * Single source of truth. Explicit data flow: components call `set()`, the store notifies
 * subscribers whose keys changed. No proxies, no implicit reactivity.
 */
class Store {
    #state;
    #subs = new Set();
    constructor(initial) {
        this.#state = initial;
    }
    get state() {
        return this.#state;
    }
    set(patch) {
        const changed = new Set();
        for (const key of Object.keys(patch)) {
            if (!Object.is(this.#state[key], patch[key]))
                changed.add(key);
        }
        if (!changed.size)
            return;
        this.#state = { ...this.#state, ...patch };
        for (const sub of this.#subs) {
            if (!sub.keys || [...changed].some((k) => sub.keys?.has(k)))
                sub.fn(changed, this.#state);
        }
    }
    /** Subscribe to some keys (or all, with `null`). Calls `fn` once immediately. Returns an unsubscribe. */
    subscribe(keys, fn) {
        const sub = { keys: keys ? new Set(keys) : null, fn };
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
