import { StoreElement, emit } from './base.js';
import { store } from '../store.js';
import { ICON, KIND, UI } from '../lib/icons.js';
import { h, icon, preserveFocus, setAttr, setText } from '../lib/dom.js';
import { visibleProjects, activeCount, defaultFilters } from '../domain/filters.js';
import { AREA_LABEL, isArea, strings, whenLabel } from '../domain/projects.js';
import { ageLabel, decisions, sourceError, waitLabel, waitingOnOthers, waits } from '../domain/signals.js';
import { saveAnswer } from '../lib/note-locker.js';
import { checkinCommand } from '../lib/config.js';
import { StatePanel, panelCopy } from '../lib/state-panel.js';
import { reconnect } from '../runtime.js';
import { stalledView } from '../domain/nudges.js';
import { setBadge, suggestionCard } from './nudge-card.js';
import { shortDay } from '../lib/nudge-actions.js';
/** Keyed project list. Rows are created once per id and patched in place, so focus survives updates. */
export class RdProjectList extends StoreElement {
    #rows = new Map();
    #ul;
    #empty;
    #panel = new StatePanel('estate-h');
    setup() {
        this.#ul = this.ref('list');
        this.#empty = h('li', { class: 'empty' }, this.#panel.el);
        this.watch(['projects', 'filter', 'query', 'filters', 'openId', 'status', 'link', 'day', 'notes', 'config', 'nudges'], () => preserveFocus(() => this.#render()));
        this.listen(document, 'rd:reveal-project', (e) => this.reveal(e.detail.id));
    }
    /** Scroll a row into view (used by the priorities drawer and the icon rail). */
    reveal(id) {
        this.#rows.get(id)?.li.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    #render() {
        const s = store.state;
        // The decisions view renders as a rollup in <rd-decisions> instead.
        this.hidden = s.filter === 'decisions';
        if (this.hidden)
            return;
        const shown = visibleProjects(s);
        const seen = new Set();
        const open = new Map(stalledView(s.rows, s.nudges).cards.map((c) => [c.p.id, c.n]));
        if (!shown.length) {
            const spec = this.#spec();
            if (spec)
                this.#panel.set(spec);
            else
                this.#panel.stop();
            this.#ul.replaceChildren(...(spec ? [this.#empty] : []));
            this.#rows.clear();
            return;
        }
        this.#empty.remove();
        this.#panel.stop();
        shown.forEach((p, i) => {
            seen.add(p.id);
            const row = this.#rows.get(p.id) ?? this.#create(p);
            this.#patch(row, p, s.openId === p.id, open.get(p.id));
            const at = this.#ul.children[i];
            if (at !== row.li)
                this.#ul.insertBefore(row.li, at ?? null);
        });
        for (const [id, row] of this.#rows) {
            if (!seen.has(id)) {
                row.li.remove();
                this.#rows.delete(id);
            }
        }
    }
    /** Which panel stands in for the rows; null while the first load is in flight. */
    #spec() {
        const s = store.state;
        const offline = s.link === 'offline' || navigator.onLine === false;
        let kind = s.status === 'signed-out' ? 'signed-out' : s.status === 'error' ? (offline ? 'offline' : 'error') : null;
        // A retry in flight keeps the failure panel up, with its button busy, instead of blanking the list.
        const failed = this.#panel.kind === 'error' || this.#panel.kind === 'offline';
        if (s.status === 'loading')
            kind = failed ? this.#panel.kind : null;
        if (s.status === 'ready')
            kind = s.projects.length ? 'nomatch' : 'empty';
        this.#panel.busy(s.status === 'loading');
        if (!kind)
            return null;
        const cmd = checkinCommand();
        const copy = panelCopy(kind, cmd, s.query);
        const filtered = Boolean(activeCount(s.filters) || s.query || s.filter !== 'all');
        const retry = { label: 'Try again', run: () => reconnect() };
        const action = kind === 'empty' ? { label: `Run ${cmd}`, id: 'empty-cta', run: () => document.getElementById('copy-cmd-2')?.click() }
            : kind === 'nomatch' ? (filtered ? { label: 'Clear filters', run: () => store.set({ filters: { ...defaultFilters(), sort: s.filters.sort }, query: '', filter: 'all' }) } : undefined)
                : kind === 'error' || kind === 'offline' ? retry : undefined;
        return { kind, ...copy, action };
    }
    #create(p) {
        const dot = h('span', { class: 'dot' });
        const name = h('b');
        const pv = h('span', { class: 'pv' });
        const badges = h('span', { class: 'badges' });
        const time = h('time');
        // Pointer shortcut to the Stalled card; keyboard users get the same suggestion in the expanded row.
        const chip = h('span', { class: 'sugm', hidden: true, onclick: (e) => { e.stopPropagation(); emit(this, 'rd:show-stalled', { id: p.id }); } });
        const btn = h('button', { class: 'pitem', type: 'button', 'data-fk': `row:${p.id}`, 'aria-expanded': 'false',
            onclick: () => store.set({ openId: store.state.openId === p.id ? null : p.id }) }, dot, name, pv, h('span', { class: 'meta' }, badges, chip, time));
        const li = h('li', { 'data-key': p.id }, btn);
        const row = { li, btn, dot, name, pv, badges, chip, chipSig: '', time, badgeSig: '', detail: null, detailSig: '' };
        this.#rows.set(p.id, row);
        return row;
    }
    #patch(row, p, open, nudge) {
        const state = p.state ?? 'active';
        const waiting = waitingOnOthers(p);
        setAttr(row.dot, 'class', `dot ${waiting ? 'waiting' : state}`);
        setAttr(row.dot, 'title', waiting ? `waiting on ${waits(p).map((w) => w.who).join(', ')}` : state);
        setText(row.name, p.name);
        setText(row.pv, p.leftOff || 'No check-in yet.');
        setText(row.time, whenLabel(p));
        setAttr(row.btn, 'aria-expanded', String(open));
        const src = sourceError(p);
        const badgeSig = `${p.area ?? ''}|${p.kind ?? ''}|${src?.source ?? ''}`;
        if (badgeSig !== row.badgeSig) {
            row.badgeSig = badgeSig;
            const area = isArea(p.area) ? p.area : null;
            const kind = p.kind && p.kind in KIND ? p.kind : null;
            row.badges.replaceChildren(h('span', { class: area ? `b-${area}` : 'b-kind', title: area ? AREA_LABEL[area] : 'Other' }, (area ? AREA_LABEL[area] : 'O').charAt(0)));
            if (kind)
                row.badges.append(h('span', { class: 'b-kind', title: kind.charAt(0).toUpperCase() + kind.slice(1), html: `<svg viewBox="0 0 24 24" aria-hidden="true">${KIND[kind]}</svg>` }));
            if (src) {
                const why = `Couldn't reach ${src.source} at the last check-in`;
                row.badges.append(h('span', { class: 'b-src', role: 'img', 'aria-label': why, title: why, html: `<svg viewBox="0 0 24 24" aria-hidden="true">${UI.unplug}</svg>` }));
            }
        }
        const chipSig = nudge ? 'sug' : p.boardSet ? `set|${p.boardSet.at}` : '';
        if (chipSig !== row.chipSig) {
            row.chipSig = chipSig;
            row.chip.hidden = !chipSig;
            row.chip.className = nudge ? 'sugm' : 'setb';
            row.chip.replaceChildren(...(nudge ? [icon(UI.spark), 'Suggestion'] : p.boardSet ? [`Set on the board · ${shortDay(p.boardSet.at)}`] : []));
        }
        if (!open) {
            row.detail?.remove();
            row.detail = null;
            row.detailSig = '';
            return;
        }
        const saved = (store.state.notes ?? []).filter((n) => n.kind === 'answer' && n.projectId === p.id);
        const sig = JSON.stringify([p.nextStep, p.leftOff, p.openDecisions, p.waitingOn, p.blockers, p.decided, p.sourceError, p.area, whenLabel(p), saved, nudge, p.boardSet]);
        if (row.detail && sig === row.detailSig)
            return;
        const card = this.#card(p, saved, nudge, () => row.btn.focus());
        const detail = h('div', { class: 'pitem', style: 'padding-top:0' }, h('span'), card);
        if (row.detail)
            row.detail.replaceWith(detail);
        else
            row.li.append(detail);
        row.detail = detail;
        row.detailSig = sig;
    }
    /** Next-step card (Primer-style): icon tile, heading, description, detail groups, meta footer. */
    #card(p, saved, nudge, refocus) {
        const aged = (label, age) => [label, age === null ? null : h('span', { class: 'ns-age' }, ` · ${ageLabel(age)}`)];
        const src = sourceError(p);
        const groups = [
            ["Couldn't reach", src ? [aged(src.detail ? `${src.source}: ${src.detail}` : src.source, src.age)] : []],
            ['Open decisions', decisions(p).map((d) => aged(d.text, d.age))],
            ['Waiting on', waits(p).map((w) => aged(waitLabel(w), w.age))],
            ['Blocked by', strings(p.blockers)],
            ['Decided', strings(p.decided)],
        ]
            .filter(([, items]) => items.length)
            .map(([t, items]) => h('section', {}, h('h4', {}, t), h('ul', {}, items.map((x) => h('li', {}, x)))));
        const when = whenLabel(p);
        const area = isArea(p.area) ? p.area : null;
        return h('article', { class: 'nscard', 'aria-label': `Next step for ${p.name}` }, h('span', { class: 'ns-icon', html: `<svg viewBox="0 0 24 24" aria-hidden="true">${UI.rocket}</svg>` }), h('h3', { class: 'ns-h' }, p.nextStep || 'Run a check-in to set a next step.'), p.boardSet ? setBadge(p.boardSet.at) : null, p.leftOff ? h('p', { class: 'ns-d' }, p.leftOff) : null, nudge ? suggestionCard(p, nudge, 'row', refocus) : null, groups.length ? h('div', { class: 'ns-groups' }, groups) : null, saved.length ? this.#saved(p, saved) : null, h('footer', { class: 'ns-meta' }, h('span', {}, icon(UI.calendar), when === 'parked' ? 'Parked' : when.charAt(0).toUpperCase() + when.slice(1)), area ? h('span', {}, icon(ICON[area]), AREA_LABEL[area]) : null));
    }
    /** Ask Rundown answers saved to this card; removing one keeps it in the Locker if it's there too. */
    #saved(p, saved) {
        return h('section', { class: 'ns-saved', 'aria-labelledby': `nss-${p.id}` }, h('h4', { id: `nss-${p.id}` }, 'Saved answers'), h('ul', {}, saved.map((n) => h('li', {}, n.question ? h('p', { class: 'ns-saved-q' }, n.question) : null, h('p', { class: 'ns-saved-a' }, n.text), h('button', { class: 'fclear', type: 'button', 'data-fk': `saved:rm:${n.id}`, 'aria-label': `Remove saved answer${n.question ? ` to ${n.question}` : ''}`,
            onclick: () => void saveAnswer(n.question ?? '', n.text, { inLocker: n.inLocker, projectId: null }, n) }, 'Remove')))));
    }
}
customElements.define('rd-project-list', RdProjectList);
