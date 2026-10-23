import { StoreElement } from './base.js';
import { store } from '../store.js';
import { prefs } from '../lib/prefs.js';
import { ICON } from '../lib/icons.js';
import { h, icon, setAttr, setText } from '../lib/dom.js';
import { needsYou } from '../domain/projects.js';
import { initials } from '../lib/config.js';
import { decisionCount, waits } from '../domain/signals.js';
export const VIEWS = [['all', 'Home'], ['needs', 'Needs you'], ['decisions', 'Decisions'], ['waiting', 'Waiting on'], ['blocked', 'Blocked'], ['stale', 'Stale'], ['parked', 'Parked']];
const AREAS = [['work', 'Work'], ['client', 'Client'], ['personal', 'Personal']];
const BADGE = {
    needs: (ps) => ps.filter(needsYou).length,
    decisions: decisionCount,
    waiting: (ps) => ps.filter((p) => waits(p).length > 0).length,
    blocked: (ps) => ps.filter((p) => p.state === 'blocked').length,
};
/** Left rail: view + area filters, slim (icon-only) mode, account footer. */
export class RdSidebar extends StoreElement {
    #items = new Map();
    setup() {
        const build = ([key, label]) => {
            const badge = h('span', { class: 'badge num', hidden: true });
            const btn = h('button', { class: 'navb', type: 'button', 'data-fk': `nav:${key}`, 'data-tip': label, 'aria-pressed': 'false', onclick: () => store.set({ filter: key }) }, icon(ICON[key]), h('span', { class: 'lbl' }, label), badge);
            this.#items.set(key, { btn, badge, label });
            return btn;
        };
        this.ref('nav').replaceChildren(...VIEWS.map(build));
        this.ref('areas').replaceChildren(...AREAS.map(build));
        this.watch(['projects', 'filter', 'day'], (_c, s) => {
            for (const [key, { btn, badge, label }] of this.#items) {
                setAttr(btn, 'aria-pressed', String(s.filter === key));
                const test = BADGE[key];
                const n = test ? test(s.projects) : 0;
                badge.hidden = !n;
                setText(badge, String(n));
                setAttr(btn, 'data-tip', n ? `${label} (${n})` : label);
            }
            const current = this.#items.get(s.filter);
            if (current)
                requestAnimationFrame(() => revealTab(current.btn));
        });
        this.watch(['meta', 'config'], (_c, s) => setText(this.ref('run'), s.meta.nextRun ? `Next run ${s.meta.nextRun}` : s.config.schedule ?? 'No schedule yet'));
        this.watch(['config'], (_c, s) => {
            const owner = s.config.owner ?? 'Rundown';
            setText(this.ref('owner'), owner);
            setText(this.ref('initials'), initials(owner));
        });
        this.#setupAreas();
        this.#setupSlim();
    }
    #setupAreas() {
        const sec = this.ref('sec');
        const apply = (open) => {
            sec.setAttribute('aria-expanded', String(open));
            this.closest('.shell')?.classList.toggle('hide-areas', !open);
        };
        apply(prefs.get('areasOpen'));
        sec.addEventListener('click', () => {
            const open = sec.getAttribute('aria-expanded') !== 'true';
            prefs.set('areasOpen', open);
            apply(open);
        });
    }
    #setupSlim() {
        const btn = this.ref('slim');
        const shell = this.closest('.shell');
        const apply = (on) => {
            shell?.classList.toggle('slim', on);
            btn.setAttribute('aria-pressed', String(on));
            btn.setAttribute('aria-label', on ? 'Expand sidebar' : 'Collapse sidebar');
        };
        apply(prefs.get('slim'));
        btn.addEventListener('click', () => {
            const on = !shell?.classList.contains('slim');
            prefs.set('slim', on);
            apply(on);
        });
    }
}
/** Phones: the view tabs scroll sideways; keep the active one centered in view (no page scroll). */
function revealTab(btn) {
    const nav = btn.parentElement;
    if (!nav || nav.scrollWidth <= nav.clientWidth)
        return;
    const n = nav.getBoundingClientRect(), b = btn.getBoundingClientRect();
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    nav.scrollTo({ left: nav.scrollLeft + b.left - n.left - (n.width - b.width) / 2, behavior });
}
customElements.define('rd-sidebar', RdSidebar);
