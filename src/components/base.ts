import type { AppState, StateKey } from '../types.js';
import { store } from '../store.js';

/**
 * Light-DOM custom element base. Markup ships in index.html (progressive enhancement);
 * components look up their parts via `data-ref` and update them in place.
 */
export abstract class StoreElement extends HTMLElement {
  #cleanups: (() => void)[] = [];
  #ready = false;

  connectedCallback(): void {
    if (this.#ready) return;
    this.#ready = true;
    this.setup();
  }

  disconnectedCallback(): void {
    this.#cleanups.forEach((fn) => fn());
    this.#cleanups = [];
    this.#ready = false;
  }

  /** Build once: cache refs, wire events, subscribe. */
  protected abstract setup(): void;

  protected watch(keys: readonly StateKey[] | null, fn: (changed: ReadonlySet<StateKey>, s: Readonly<AppState>) => void): void {
    this.#cleanups.push(store.subscribe(keys, fn));
  }

  protected listen<K extends keyof WindowEventMap>(target: Window | Document | Element, type: K | string, fn: (e: Event) => void): void {
    target.addEventListener(type, fn);
    this.#cleanups.push(() => target.removeEventListener(type, fn));
  }

  protected ref<T extends Element = HTMLElement>(name: string): T {
    const el = this.querySelector<T>(`[data-ref="${name}"]`);
    if (!el) throw new Error(`<${this.localName}> missing [data-ref="${name}"]`);
    return el;
  }
}

/** Events crossing component boundaries (bubbling, composed). */
export interface RundownEvents {
  'rd:reveal-project': CustomEvent<{ id: string }>;
  'rd:answer': CustomEvent<void>;
}

export function emit<K extends keyof RundownEvents>(from: Element, type: K, detail: RundownEvents[K]['detail']): void {
  from.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
}
