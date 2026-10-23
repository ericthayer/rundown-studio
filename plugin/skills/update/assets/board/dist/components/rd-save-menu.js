import { StoreElement } from './base.js';
import { store } from '../store.js';
import { toast } from '../lib/toast.js';
import { answerId, saveAnswer } from '../lib/note-locker.js';
import { UI } from '../lib/icons.js';
import { h, icon, placeAbove, placeUnder, setText } from '../lib/dom.js';
/** The project an answer is most likely about: the first one it names, else the question, else the open row. */
export function guessProject(question, answer, projects, openId) {
    for (const text of [answer, question]) {
        const lower = text.toLowerCase();
        let best = null;
        for (const p of projects) {
            const at = lower.indexOf(p.name.toLowerCase());
            if (at >= 0 && (!best || at < best.at))
                best = { id: p.id, at };
        }
        if (best)
            return best.id;
    }
    return openId ?? projects[0]?.id ?? null;
}
/** Saved state of an answer on the board, if any. */
export const savedAnswer = (text, notes) => notes?.find((n) => n.id === answerId(text));
/**
 * One shared "Save to" popover for Ask Rundown answers: Locker and/or a project card.
 * Each change writes to the board right away (like the filter popovers); unticking both removes the save.
 */
export class RdSaveMenu extends StoreElement {
    #pop;
    #locker;
    #card;
    #project;
    #status;
    #anchor = null;
    #q = '';
    #a = '';
    setup() {
        this.#locker = h('input', { type: 'checkbox', 'data-fk': 'save:locker', onchange: () => void this.#apply() });
        this.#card = h('input', { type: 'checkbox', 'data-fk': 'save:card', onchange: () => void this.#apply() });
        this.#project = h('select', { 'aria-label': 'Project card', 'data-fk': 'save:project', onchange: () => { this.#card.checked = true; void this.#apply(); } });
        this.#status = h('p', { class: 'asave-st', role: 'status' });
        this.#pop = h('div', { class: 'fpop asave-pop', id: 'asave-pop', popover: 'auto', role: 'dialog', 'aria-label': 'Save answer' }, h('fieldset', { class: 'fset' }, h('legend', {}, 'Save to'), h('label', { class: 'fopt' }, this.#locker, 'Locker'), h('label', { class: 'fopt' }, this.#card, 'Project card'), h('span', { class: 'fsort asave-sel' }, this.#project, icon(UI.chevron))), this.#status);
        this.#pop.addEventListener('toggle', (e) => {
            const open = e.newState === 'open';
            this.#anchor?.setAttribute('aria-expanded', String(open));
            if (open && this.#anchor)
                this.#place(this.#anchor);
            else if (!open)
                this.#anchor?.focus({ preventScroll: true });
        });
        this.listen(window, 'resize', () => { if (this.#pop.matches(':popover-open'))
            this.#pop.hidePopover(); });
        this.replaceChildren(this.#pop);
    }
    /** Opens the menu for one answer, under (or above) its Save button. */
    open(anchor, question, answer) {
        if (this.#pop.matches(':popover-open'))
            this.#pop.hidePopover();
        this.#anchor = anchor;
        this.#q = question;
        this.#a = answer;
        const s = store.state;
        const prev = savedAnswer(answer, s.notes);
        const pick = prev?.projectId ?? guessProject(question, answer, s.projects, s.openId);
        this.#project.replaceChildren(...s.projects.map((p) => h('option', { value: p.id, selected: p.id === pick }, p.name)));
        this.#project.disabled = !s.projects.length;
        this.#locker.checked = prev?.inLocker ?? false;
        this.#card.checked = Boolean(prev?.projectId);
        this.#card.disabled = !s.projects.length;
        setText(this.#status, prev ? this.#where(prev) : 'Saves to the board, on every device.');
        this.#pop.showPopover();
        this.#locker.focus();
    }
    /** Under the Save button (above it in the lower half), right edges aligned, kept inside the viewport. */
    #place(anchor) {
        (anchor.getBoundingClientRect().top < innerHeight / 2 ? placeUnder : placeAbove)(anchor, this.#pop);
        const r = anchor.getBoundingClientRect();
        this.#pop.style.left = `${Math.round(Math.max(8, Math.min(r.right - this.#pop.offsetWidth, innerWidth - this.#pop.offsetWidth - 8)))}px`;
    }
    async #apply() {
        const place = { inLocker: this.#locker.checked, projectId: this.#card.checked ? this.#project.value || null : null };
        try {
            await saveAnswer(this.#q, this.#a, place, savedAnswer(this.#a, store.state.notes));
            setText(this.#status, place.inLocker || place.projectId ? this.#where(place) : 'Not saved.');
        }
        catch {
            setText(this.#status, "Couldn't save to the board. Try again.");
            toast({ tone: 'error', key: 'save', text: "Couldn't save the answer to the board.", action: { label: 'Retry', run: () => this.#apply() } });
        }
    }
    #where(place) {
        const name = store.state.projects.find((p) => p.id === place.projectId)?.name;
        const parts = [place.inLocker ? 'the Locker' : '', name ?? ''].filter(Boolean);
        return parts.length ? `Saved to ${parts.join(' and ')}.` : 'Not saved.';
    }
}
customElements.define('rd-save-menu', RdSaveMenu);
