import { store } from '../store.js';
/**
 * Light-DOM custom element base. Markup ships in index.html (progressive enhancement);
 * components look up their parts via `data-ref` and update them in place.
 */
export class StoreElement extends HTMLElement {
    #cleanups = [];
    #ready = false;
    connectedCallback() {
        if (this.#ready)
            return;
        this.#ready = true;
        this.setup();
    }
    disconnectedCallback() {
        this.#cleanups.forEach((fn) => fn());
        this.#cleanups = [];
        this.#ready = false;
    }
    watch(keys, fn) {
        this.#cleanups.push(store.subscribe(keys, fn));
    }
    listen(target, type, fn) {
        target.addEventListener(type, fn);
        this.#cleanups.push(() => target.removeEventListener(type, fn));
    }
    ref(name) {
        const el = this.querySelector(`[data-ref="${name}"]`);
        if (!el)
            throw new Error(`<${this.localName}> missing [data-ref="${name}"]`);
        return el;
    }
}
export function emit(from, type, detail) {
    from.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
}
