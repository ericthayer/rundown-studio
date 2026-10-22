import { StoreElement } from './base.js';
import { store } from '../store.js';
import { prefs } from '../lib/prefs.js';
import { UI } from '../lib/icons.js';
import { h, icon, placeUnder, setAttr, setText } from '../lib/dom.js';
import { dragToDismiss } from '../lib/gestures.js';
import { GROUPS, SORT_OPTIONS, activeCount, chipValue, defaultFilters, selected, testOption, visibleProjects, withOption } from '../domain/filters.js';
/**
 * Search + filter chips (popover per group) + sort, folding into a sheet dialog on narrow containers.
 * Everything is built once; data changes only update counts, so open popovers stay open.
 */
export class RdToolbar extends StoreElement {
    #options = [];
    #chips = [];
    #debounce = 0;
    setup() {
        this.#buildSearch();
        this.#buildChips();
        this.#buildSort();
        this.#buildSheet();
        this.watch(['filters'], (_c, s) => this.#sync(s.filters));
        this.watch(['projects', 'day'], (_c, s) => this.#counts(s.projects));
        this.watch(['projects', 'filter', 'query', 'filters', 'day'], (_c, s) => setText(this.ref('sheet-n'), String(visibleProjects(s).length)));
        this.listen(window, 'resize', () => this.querySelectorAll('.fpop:popover-open').forEach((p) => p.hidePopover()));
    }
    #buildSearch() {
        const q = this.ref('q');
        q.addEventListener('input', () => {
            clearTimeout(this.#debounce);
            this.#debounce = window.setTimeout(() => store.set({ query: q.value.trim().toLowerCase() }), 120);
        });
        // The composer's filter fallback writes `query`; mirror it into the box.
        this.watch(['query'], (_c, s) => { if (q.value.trim().toLowerCase() !== s.query)
            q.value = s.query; });
    }
    #fieldset(g, scope) {
        return h('fieldset', { class: 'fset' }, h('legend', {}, g.title), g.opts.map(([value, label]) => {
            const input = h('input', { type: g.multi ? 'checkbox' : 'radio', name: `${scope}-${g.key}`, value,
                onchange: (e) => this.#set(withOption(store.state.filters, g, value, e.target.checked)) });
            const count = h('span', { class: 'n num' });
            let opt = this.#options.find((o) => o.group.key === g.key && o.value === value);
            if (!opt) {
                opt = { group: g, value, inputs: [], counts: [] };
                this.#options.push(opt);
            }
            opt.inputs.push(input);
            opt.counts.push(count);
            return h('label', { class: 'fopt' }, input, g.key === 'status' ? h('span', { class: `dot ${value}`, 'aria-hidden': 'true' }) : null, label, count);
        }));
    }
    #buildChips() {
        const parts = GROUPS.map((g) => {
            const id = `fp-${g.key}`;
            const btn = h('button', { class: 'fchip', type: 'button', popovertarget: id, 'data-fk': `chip:${g.key}`, 'aria-expanded': 'false' });
            const pop = h('div', { class: 'fpop', id, popover: 'auto', role: 'dialog', 'aria-label': `${g.title} filter` }, this.#fieldset(g, 'pop'));
            pop.addEventListener('toggle', (e) => {
                const open = e.newState === 'open';
                btn.setAttribute('aria-expanded', String(open));
                if (open)
                    placeUnder(btn, pop);
            });
            this.#chips.push({ group: g, btn });
            return [btn, pop];
        });
        this.ref('chips').replaceChildren(...parts.flat());
        this.ref('clear').addEventListener('click', () => this.#clear());
    }
    #buildSort() {
        const sel = this.ref('sort');
        sel.replaceChildren(...SORT_OPTIONS.map(([v, l]) => h('option', { value: v }, l)));
        sel.addEventListener('change', () => this.#set({ ...store.state.filters, sort: sel.value }));
    }
    #buildSheet() {
        const sheet = this.ref('sheet');
        const sortSet = h('fieldset', { class: 'fset' }, h('legend', {}, 'Sort by'), SORT_OPTIONS.map(([value, label]) => h('label', { class: 'fopt' }, h('input', { type: 'radio', name: 'sheet-sort', value, 'data-sort': '', onchange: () => this.#set({ ...store.state.filters, sort: value }) }), label)));
        this.ref('groups').replaceChildren(sortSet, ...GROUPS.map((g) => this.#fieldset(g, 'sheet')));
        this.ref('fbtn').addEventListener('click', () => sheet.showModal());
        this.ref('sheet-x').addEventListener('click', () => sheet.close());
        this.ref('sheet-done').addEventListener('click', () => sheet.close());
        this.ref('sheet-clear').addEventListener('click', () => this.#clear());
        sheet.addEventListener('click', (e) => { if (e.target === sheet)
            sheet.close(); });
        dragToDismiss({ handle: sheet.querySelector('.fsh') ?? sheet, target: sheet, axis: () => (sheet.open ? 'down' : null), onDismiss: () => sheet.close() });
    }
    #set(f) {
        prefs.set('filters', f);
        store.set({ filters: f });
    }
    #clear() {
        this.#set({ ...defaultFilters(), sort: store.state.filters.sort });
    }
    #sync(f) {
        for (const { group, btn } of this.#chips) {
            const val = chipValue(group, f);
            setAttr(btn, 'data-active', Boolean(val));
            setAttr(btn, 'aria-label', val ? `${group.title}: ${val}` : `Filter by ${group.title.toLowerCase()}`);
            btn.replaceChildren(group.title, val ? h('span', { class: 'fv' }, val) : '', icon(UI.chevron));
        }
        for (const o of this.#options) {
            const sel = selected(o.group, f);
            const checked = sel.includes(o.value) || (!o.group.multi && !sel.length && o.value === 'any');
            o.inputs.forEach((i) => { i.checked = checked; });
        }
        this.querySelectorAll('input[data-sort]').forEach((i) => { i.checked = i.value === f.sort; });
        this.ref('sort').value = f.sort;
        const n = activeCount(f);
        this.ref('clear').hidden = !n;
        this.ref('sheet-clear').disabled = !n;
        const badge = this.ref('fbadge');
        badge.hidden = !n;
        setText(badge, String(n));
        setAttr(this.ref('fbtn'), 'aria-label', n ? `Filters, ${n} active` : 'Filters');
    }
    #counts(projects) {
        for (const o of this.#options) {
            const n = o.value === 'any' ? projects.length : projects.filter((p) => testOption(o.group, p, o.value)).length;
            o.counts.forEach((c) => setText(c, String(n)));
        }
    }
}
customElements.define('rd-toolbar', RdToolbar);
