import { StoreElement } from './base.js';
import { store } from '../store.js';
import { h, icon, preserveFocus, setAttr, setText } from '../lib/dom.js';
import { UI } from '../lib/icons.js';
import { toast } from '../lib/toast.js';
import { reveal } from '../lib/reveal.js';
import { failure, UNAVAILABLE } from '../lib/sample-errors.js';
import { sampleJson } from '../lib/sample-json.js';
import { prunePlans, writePlan } from '../lib/plan-store.js';
import { basisOf, lastWeekKey, parsePlan, planPrompt, version, weekKey, weekLabel } from '../domain/week-plan.js';
import { PlanEditor } from './plan-editor.js';
/** Plan-specific copy for a failed draft; falls back to the shared `sample` copy. */
function draftFailure(code) {
    if (UNAVAILABLE.has(code))
        return { text: "Drafting needs Claude, which isn't available in this view. You can still plan it yourself.", retry: false };
    switch (code) {
        case 'unusable': return { text: "Claude's draft came back in a shape the board can't use. Try again.", retry: true };
        case 'stalled': return { text: 'Claude stopped responding, so the draft timed out.', retry: true };
        case 'refused': return { text: "Claude couldn't draft a plan from this board. Try again, or plan it yourself.", retry: true };
        case 'prompt_too_large': return { text: 'Too much project data to draft from at once. Plan it yourself, or park a few rows first.', retry: false };
        default: return { text: failure(code, false).text.replace('only Ask is affected', 'only drafting is affected'), retry: failure(code, false).retry };
    }
}
const weekday = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { weekday: 'short' }) : '');
/**
 * "This week" in the right panel: draft the week's top three with the board's own Claude, edit, pin.
 * Plans live in the `plans` collection; the plan never changes a project row.
 */
export class RdWeekPlan extends StoreElement {
    #body;
    #live;
    #editor;
    #drafting = false;
    #error = null;
    #errEl = null;
    #editing = null;
    #aborter = null;
    setup() {
        this.#body = this.ref('body');
        this.#live = this.ref('live');
        this.#editor = new PlanEditor({
            onPin: (items) => void this.#pin(items),
            onCancel: () => void this.#cancel(),
            onRedraft: () => void this.#draft(),
        });
        this.ref('edit').addEventListener('click', () => this.#edit());
        this.watch(['plans', 'projects', 'canAsk', 'day'], (_c, s) => preserveFocus(() => this.#render(s)));
    }
    #current(s = store.state) {
        const week = weekKey(s.day);
        return s.plans?.find((p) => p.week === week) ?? null;
    }
    #setError(e) {
        this.#error = e;
        this.#errEl = null;
    }
    #say(text) {
        setText(this.#live, '');
        requestAnimationFrame(() => setText(this.#live, text));
    }
    #render(s) {
        setText(this.ref('range'), weekLabel(s.day));
        const cur = this.#current(s);
        // A draft saved on the board (another tab, or before a reload) reopens in the editor.
        if (!this.#editing && !this.#drafting && cur?.draft?.items.length)
            this.#editing = { kind: 'draft', ...cur.draft };
        const pinned = cur?.pinned?.items.length ? cur.pinned : null;
        this.ref('edit').hidden = Boolean(this.#editing || this.#drafting || !pinned);
        setAttr(this.ref('section'), 'aria-busy', this.#drafting ? 'true' : null);
        const err = this.#error ? (this.#errEl ??= this.#errorBox(this.#error)) : null;
        if (this.#drafting)
            return this.#show('drafting', this.#skeleton());
        if (this.#editing) {
            if (this.#body.dataset.mode !== 'editor') {
                this.#editor.open(this.#editing.kind, this.#editing.items, s.projects, s.canAsk);
                this.#body.dataset.mode = 'editor';
            }
            // Keep the form node in place while editing, so a board update never steals focus from a field.
            const kids = [err, this.#editor.el].filter((n) => n !== null);
            if (kids.length !== this.#body.children.length || kids.some((k, i) => this.#body.children[i] !== k))
                this.#body.replaceChildren(...kids);
            return;
        }
        if (s.plans === null)
            return this.#show('loading', h('p', { class: 'wmuted' }, 'Loading your plan…'));
        if (pinned)
            return this.#show('view', err, this.#view(pinned, s), this.#lastWeek(s));
        this.#show('empty', err, this.#empty(s.canAsk), this.#lastWeek(s));
    }
    #show(mode, ...nodes) {
        this.#body.dataset.mode = mode;
        this.#body.replaceChildren(...nodes.filter((n) => n !== null));
    }
    #skeleton() {
        return h('div', { class: 'wskel' }, h('p', { class: 'wmuted' }, icon(UI.spark), 'Drafting your week…'), ...[0, 1, 2].map(() => h('div', { class: 'wskel-row', 'aria-hidden': 'true' })));
    }
    #errorBox(e) {
        return h('div', { class: 'werr', role: 'alert' }, h('p', {}, e.text), e.retry ? h('button', { class: 'lnk', type: 'button', 'data-fk': 'plan:retry', onclick: () => void this.#draft() }, 'Try again') : null);
    }
    #empty(canAsk) {
        return h('div', { class: 'wempty' }, h('p', {}, 'No plan for this week yet.'), h('div', { class: 'wempty-acts' }, canAsk ? h('button', { class: 'cta', type: 'button', 'data-fk': 'plan:draft', onclick: () => void this.#draft() }, icon(UI.spark), 'Draft this week') : null, h('button', { class: canAsk ? 'lnk' : 'ghost', type: 'button', 'data-fk': 'plan:scratch', onclick: () => this.#open('scratch', [], '', null) }, canAsk ? 'or plan it yourself' : 'Plan it yourself')));
    }
    #view(v, s) {
        const byId = new Map(s.projects.map((p) => [p.id, p]));
        const list = h('ol', { class: 'wlist', 'aria-label': 'This week’s plan' }, ...v.items.map((it, i) => {
            const p = byId.get(it.projectId);
            const gone = !p || p.state === 'parked';
            return h('li', { class: 'witem', 'data-gone': gone || null }, h('span', { class: 'wnum', 'aria-hidden': 'true' }, String(i + 1)), gone ? h('b', {}, it.name) : h('button', { class: 'wname', type: 'button', 'data-fk': `week:${it.projectId}`, onclick: () => reveal(it.projectId) }, p.name), it.why ? h('span', { class: 'why' }, it.why) : null, h('span', { class: 'nx' }, gone ? 'No longer active' : p.nextStep ? h('span', {}, h('b', {}, 'Next: '), p.nextStep) : 'No next step yet.'));
        }));
        const by = v.generatedAt ? `Drafted by Claude ${weekday(v.generatedAt)}, pinned by you.` : 'Planned by you.';
        const moved = s.canAsk && v.basis && v.basis !== basisOf(s.projects);
        return h('div', { class: 'wview' }, list, h('p', { class: 'wfoot' }, v.generatedAt ? icon(UI.spark) : null, by), moved ? h('p', { class: 'wmoved' }, 'Your board has changed since this was drafted. ', h('button', { class: 'lnk', type: 'button', 'data-fk': 'plan:redraft-view', onclick: () => void this.#draft() }, 'Redraft')) : null);
    }
    #lastWeek(s) {
        const prev = s.plans?.find((p) => p.week === lastWeekKey(s.day))?.pinned;
        if (!prev?.items.length)
            return null;
        return h('details', { class: 'wlast' }, h('summary', {}, 'Last week'), h('ol', {}, ...prev.items.map((it) => h('li', {}, it.name))));
    }
    #open(kind, items, basis, generatedAt) {
        this.#setError(null);
        this.#editing = { kind, items, basis, generatedAt };
        delete this.#body.dataset.mode;
        this.#render(store.state);
        this.#editor.focusFirst();
    }
    #edit() {
        const p = this.#current()?.pinned;
        if (p)
            this.#open('edit', p.items, p.basis, p.generatedAt);
    }
    async #draft() {
        if (this.#drafting)
            return;
        this.#aborter?.abort();
        const aborter = new AbortController();
        this.#aborter = aborter;
        const s = store.state;
        this.#drafting = true;
        this.#setError(null);
        this.#render(s);
        this.#say('Drafting your week.');
        const res = await sampleJson(planPrompt(s.projects, s.day), { tier: 'default', signal: aborter.signal });
        this.#drafting = false;
        if (!res.ok && res.code === 'cancelled')
            return this.#render(store.state);
        const items = res.ok ? parsePlan(res.value, store.state.projects) : [];
        if (!items.length) {
            const err = draftFailure(res.ok ? 'unusable' : res.code);
            this.#setError(err);
            delete this.#body.dataset.mode;
            this.#render(store.state);
            return this.#say(err.text);
        }
        const draft = version(items, basisOf(store.state.projects), new Date().toISOString());
        this.#open('draft', draft.items, draft.basis, draft.generatedAt);
        this.#say('Draft ready. Edit it, then pin it.');
        const cur = this.#current();
        void this.#write({ week: weekKey(store.state.day), draft, pinned: cur?.pinned ?? null }).catch(() => undefined);
    }
    /** Writes the plan, mirrors it into the store at once (the snapshot follows), and rejects on refusal. */
    async #write(plan) {
        await writePlan(plan);
        const plans = store.state.plans ?? [];
        store.set({ plans: [plan, ...plans.filter((p) => p.week !== plan.week)].sort((a, b) => (a.week < b.week ? 1 : -1)) });
    }
    async #pin(items) {
        const s = store.state;
        const e = this.#editing;
        const week = weekKey(s.day);
        const pinned = version(items, e?.basis || basisOf(s.projects), e?.generatedAt ?? null, new Date().toISOString());
        try {
            await this.#write({ week, draft: null, pinned });
        }
        catch {
            toast({ tone: 'error', key: 'plan', text: "Couldn't pin the plan to the board.", action: { label: 'Retry', run: () => this.#pin(items) } });
            return;
        }
        this.#editing = null;
        delete this.#body.dataset.mode;
        this.#render(store.state);
        toast({ tone: 'ok', key: 'plan', text: `Plan pinned for ${weekLabel(s.day)}.` });
        this.ref('section').querySelector('.wname')?.focus();
        void prunePlans(store.state.plans ?? [], week);
    }
    async #cancel() {
        const e = this.#editing;
        const cur = this.#current();
        if (e?.kind === 'draft' && cur?.draft) {
            try {
                await this.#write({ week: cur.week, draft: null, pinned: cur.pinned });
            }
            catch {
                toast({ tone: 'error', key: 'plan', text: "Couldn't discard the draft on the board.", action: { label: 'Retry', run: () => this.#cancel() } });
                return;
            }
        }
        this.#editing = null;
        delete this.#body.dataset.mode;
        this.#render(store.state);
        this.querySelector('[data-fk="plan:draft"], [data-fk="plan:scratch"], .wname')?.focus();
    }
}
customElements.define('rd-week-plan', RdWeekPlan);
