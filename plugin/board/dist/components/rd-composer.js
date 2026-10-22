import { StoreElement, emit } from './base.js';
import { store } from '../store.js';
import { getSampler, revokeSampler } from '../runtime.js';
import { h, icon, setAttr, setText } from '../lib/dom.js';
import { UI } from '../lib/icons.js';
import { loadTurns, saveTurns, recap, MAX_TURNS } from '../lib/ask-history.js';
import { savedAnswer } from './rd-save-menu.js';
import './rd-save-menu.js';
/** No streamed text for this long counts as a stalled connection. */
export const STALL_MS = 45000;
/** Codes that mean asking can't work in this view: fall back to filtering, never re-ask. */
const UNAVAILABLE = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);
/** Viewer copy per failure, and whether a manual Try again makes sense. Unknown codes read as upstream_error. */
function failure(code, partial) {
    switch (code) {
        case 'rate_limited': return { text: 'Too many questions in a row. Try again in a minute.', retry: true };
        case 'session_expired': return { text: 'Your claude.ai sign-in expired. Sign in again, then try again.', retry: true };
        case 'refused': return { text: "Claude couldn't answer that one. Try asking it a different way.", retry: false };
        case 'empty_completion': return { text: 'Claude came back empty. Try a simpler question.', retry: false };
        case 'prompt_too_large': return { text: 'Too much project data to send at once. Filter the list down, then ask again.', retry: false };
        case 'stalled': return { text: 'Claude stopped responding, so this answer timed out.', retry: true };
        case 'offline': return { text: "You're offline. Ask again when you're back online.", retry: true };
        default: return { text: partial ? 'Claude became unavailable, so this answer stopped early.' : "Claude isn't available right now. Your projects are fine; only Ask is affected.", retry: true };
    }
}
/** Fields sent to the model: status data only. */
const FIELDS = ['id', 'name', 'area', 'state', 'priority', 'lastActivity', 'due', 'leftOff', 'decided', 'openDecisions', 'waitingOn', 'blockers', 'nextStep'];
/**
 * Ask box + transcript. With the `sample` capability it asks Claude about the projects; without it,
 * the same box filters the list (writes `query`). The transcript is kept for this tab only.
 */
export class RdComposer extends StoreElement {
    #aborter = null;
    #input;
    #scroll;
    #log;
    #head;
    #turns = loadTurns();
    #menu;
    /** Save button per answer element, relabelled as the board's saved answers change. */
    #saves = new Map();
    setup() {
        this.#input = this.ref('input');
        this.#scroll = this.ref('scroll');
        this.#log = this.ref('log');
        this.#head = this.ref('head');
        this.ref('clear').addEventListener('click', () => this.clear());
        this.#menu = document.createElement('rd-save-menu');
        this.append(this.#menu);
        this.#log.replaceChildren(...this.#turns.map((t) => { const [el] = this.#turnEl(t, t.a); this.#addSave(el, t.q, t.a); return el; }));
        this.#sync();
        this.watch(['notes'], () => this.#labelSaves());
        const form = this.ref('form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const q = this.#input.value.trim();
            if (q)
                void this.ask(q);
        });
        this.#input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                form.requestSubmit();
            }
        });
        if (!CSS.supports('field-sizing', 'content')) {
            this.#input.addEventListener('input', () => { this.#input.style.height = 'auto'; this.#input.style.height = `${this.#input.scrollHeight}px`; });
        }
        this.querySelectorAll('.chip[data-q]').forEach((b) => b.addEventListener('click', () => void this.ask(b.dataset.q ?? '')));
        this.watch(['canAsk'], (_c, s) => { this.#input.placeholder = s.canAsk ? 'Ask about your projects…' : 'Filter projects…'; });
    }
    focusInput() {
        this.#input.focus();
    }
    /** Drops this tab's transcript and stops any answer in flight. */
    clear() {
        this.#aborter?.abort();
        this.#turns = [];
        saveTurns(this.#turns);
        this.#log.replaceChildren();
        this.#sync();
        this.focusInput();
    }
    /** One exchange as a disclosure: the question is the summary, so a long answer folds away. Folding is kept per tab. */
    #turnEl(turn, text) {
        const out = h('div', { class: 'atext' }, text);
        const el = h('details', { class: 'answer', open: !turn.folded }, h('summary', { class: 'q' }, h('span', {}, turn.q), icon(UI.chevron)), out);
        el.addEventListener('toggle', () => { turn.folded = !el.open; saveTurns(this.#turns); });
        return [el, out];
    }
    #sync() {
        this.#head.hidden = !this.#turns.length;
        while (this.#log.childElementCount > MAX_TURNS)
            this.#log.firstElementChild?.remove();
        for (const el of this.#saves.keys())
            if (!el.isConnected)
                this.#saves.delete(el);
    }
    /** Save button under a finished answer; opens the shared Save to menu. */
    #addSave(el, q, a) {
        const btn = h('button', { class: 'asave', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'asave-pop', onclick: () => this.#menu.open(btn, q, a) });
        el.append(h('div', { class: 'afoot' }, btn));
        this.#saves.set(el, { btn, a });
        this.#labelSaves();
    }
    #labelSaves() {
        const notes = store.state.notes;
        this.#saves.forEach(({ btn, a }, el) => {
            const saved = Boolean(savedAnswer(a, notes));
            setText(btn, saved ? 'Saved' : 'Save');
            btn.classList.toggle('on', saved);
            setAttr(btn, 'aria-label', `${saved ? 'Saved. Change where' : 'Save'} this answer: ${el.querySelector('.q')?.textContent ?? ''}`);
        });
    }
    async ask(question) {
        if (!question)
            return;
        this.#input.value = question;
        const sample = getSampler();
        if (!sample) {
            store.set({ query: question.toLowerCase() });
            return;
        }
        this.#input.value = '';
        this.#aborter?.abort();
        const aborter = new AbortController();
        this.#aborter = aborter;
        const turn = { q: question, a: '', at: new Date().toISOString() };
        const context = recap(this.#turns);
        this.#turns = [...this.#turns, turn].slice(-MAX_TURNS);
        const [el, out] = this.#turnEl(turn, 'Thinking…');
        this.#log.append(el);
        this.#sync();
        requestAnimationFrame(() => { this.#scroll.scrollTop = this.#scroll.scrollHeight; });
        const keep = (text) => { turn.a = text; saveTurns(this.#turns); };
        const drop = () => { this.#turns = this.#turns.filter((t) => t !== turn); saveTurns(this.#turns); };
        if (navigator.onLine === false) {
            drop();
            this.#fail(el, out, question, 'offline', '');
            return;
        }
        const data = store.state.projects.map((p) => Object.fromEntries(FIELDS.map((k) => [k, p[k]])));
        const prompt = `Today is ${store.state.day}. Below is a JSON list of one person's projects and their latest check-in status. Answer their question in plain text, under 120 words, no markdown headings. Use project names exactly. If the data can't answer it, say what's missing.\n\nProjects:\n${JSON.stringify(data)}\n\n${context ? `Earlier in this conversation:\n${context}\n\n` : ''}Question: ${question}`;
        // A stream that goes quiet for STALL_MS is aborted and reported as a timeout, not a supersede.
        let stalled = false;
        let stall = 0;
        const arm = () => { clearTimeout(stall); stall = window.setTimeout(() => { stalled = true; aborter.abort(); }, STALL_MS); };
        arm();
        try {
            const res = await sample(prompt, { signal: aborter.signal, modelTier: 'quick', onText: ({ text }) => { arm(); out.textContent = text; } });
            out.textContent = res.text;
            keep(res.text);
            this.#addSave(el, question, res.text);
            emit(this, 'rd:answer', undefined);
        }
        catch (e) {
            const err = e;
            const partial = typeof err.text === 'string' && err.text ? err.text : out.textContent !== 'Thinking…' ? out.textContent ?? '' : '';
            if (!stalled && (err.name === 'AbortError' || err.code === 'cancelled')) {
                // Superseded by a newer question: keep what streamed, or drop an answer that never started.
                if (partial) {
                    keep(partial);
                    this.#addSave(el, question, partial);
                }
                else {
                    el.remove();
                    drop();
                    this.#sync();
                }
                return;
            }
            drop();
            if (err.code && UNAVAILABLE.has(err.code)) {
                out.textContent = "Asking Claude isn't available here. The box now filters the list instead.";
                revokeSampler();
                return;
            }
            this.#fail(el, out, question, stalled ? 'stalled' : err.code, err.code === 'refused' ? '' : partial);
        }
        finally {
            clearTimeout(stall);
        }
    }
    /** Failed answer: keeps any partial text, says what happened, and offers Try again when it can help. */
    #fail(el, out, question, code, partial) {
        const { text, retry } = failure(code, Boolean(partial));
        el.classList.add('afail');
        out.replaceChildren(...(partial ? [partial, h('br'), h('br')] : []), h('span', { class: 'aerr' }, text));
        if (!retry)
            return;
        el.append(h('div', { class: 'afoot' }, h('button', { class: 'asave aretry', type: 'button', 'data-fk': 'ask:retry',
            onclick: () => { el.remove(); this.#sync(); this.focusInput(); void this.ask(question); } }, 'Try again')));
    }
}
customElements.define('rd-composer', RdComposer);
