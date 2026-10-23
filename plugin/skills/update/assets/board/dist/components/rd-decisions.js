import { StoreElement, emit } from './base.js';
import { store } from '../store.js';
import { h, preserveFocus, setAttr, setText } from '../lib/dom.js';
import { visibleProjects } from '../domain/filters.js';
import { NUDGE_DAYS, ageLabel, decisionRollup } from '../domain/signals.js';
const keyOf = (d) => `${d.project.id}\u0000${d.text}`;
/**
 * Decisions rollup: every open decision across the visible projects, oldest first. Shown in place of
 * the project list while the "decisions" view is active. Rows are keyed and patched in place.
 */
export class RdDecisions extends StoreElement {
    #rows = new Map();
    #ul;
    #empty;
    setup() {
        this.#ul = this.ref('list');
        this.#empty = h('li', { class: 'empty' });
        this.watch(['projects', 'filter', 'query', 'filters', 'status', 'day'], () => preserveFocus(() => this.#render()));
    }
    #render() {
        const s = store.state;
        this.hidden = s.filter !== 'decisions';
        if (this.hidden)
            return;
        const shown = decisionRollup(visibleProjects(s));
        if (!shown.length) {
            setText(this.#empty, s.query || s.filters.flags.length ? 'Nothing matches.' : 'No open decisions. Check-ins add them as questions.');
            this.#ul.replaceChildren(this.#empty);
            this.#rows.clear();
            return;
        }
        this.#empty.remove();
        const seen = new Set();
        shown.forEach((d, i) => {
            const key = keyOf(d);
            seen.add(key);
            const row = this.#rows.get(key) ?? this.#create(d, key);
            this.#patch(row, d);
            const at = this.#ul.children[i];
            if (at !== row.li)
                this.#ul.insertBefore(row.li, at ?? null);
        });
        for (const [key, row] of this.#rows) {
            if (!seen.has(key)) {
                row.li.remove();
                this.#rows.delete(key);
            }
        }
    }
    #create(d, key) {
        const text = h('b');
        const pv = h('span', { class: 'pv' });
        const time = h('time');
        const id = d.project.id;
        const btn = h('button', { class: 'pitem', type: 'button', 'data-fk': `dec:${key}`, onclick: () => this.#open(id) }, h('span', { class: 'dot decisions', 'aria-hidden': 'true' }), text, pv, h('span', { class: 'meta' }, h('span', { class: 'badges' }), time));
        const row = { li: h('li', { 'data-key': key }, btn), btn, text, pv, time };
        this.#rows.set(key, row);
        return row;
    }
    #patch(row, d) {
        const age = ageLabel(d.age);
        const when = d.age === null ? '' : d.age <= 0 ? 'raised today' : `${age} open`;
        setText(row.text, d.text);
        setText(row.pv, d.project.name);
        setText(row.time, when);
        setAttr(row.time, 'data-old', d.age !== null && d.age >= NUDGE_DAYS);
        setAttr(row.btn, 'aria-label', `${d.text} (${d.project.name}${when ? `, ${when}` : ''}). Open project.`);
    }
    /** Jump to the project: back to the full list with its row expanded and focused. */
    #open(id) {
        store.set({ filter: 'all', openId: id });
        requestAnimationFrame(() => {
            document.querySelector(`[data-fk="row:${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
            emit(this, 'rd:reveal-project', { id });
        });
    }
}
customElements.define('rd-decisions', RdDecisions);
