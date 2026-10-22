import { StoreElement, emit } from './base.js';
import { store } from '../store.js';
import { prefs } from '../lib/prefs.js';
import { cardArt } from '../lib/icons.js';
import { byId, h, preserveFocus, setAttr } from '../lib/dom.js';
import { dragToDismiss } from '../lib/gestures.js';
import { topPriorities } from '../domain/projects.js';
const NARROW = '(max-width: 1060px)';
const PHONE = matchMedia('(max-width: 720px)');
const W_MIN = 300;
/**
 * Assistant layout controller.
 * Wide: inline column, resizable, collapsible to an icon rail (unread badge on its chat button).
 * Narrow: modal overlay drawer (side sheet; bottom sheet on phones) opened from the header toggle.
 */
export class RdAssistant extends StoreElement {
    #mq = matchMedia(NARROW);
    #open = prefs.get('agentOpen');
    #returnTo = null;
    #pending = '';
    #panel;
    #shell;
    get #composer() { return this.querySelector('rd-composer'); }
    get #priorities() { return this.querySelector('rd-priorities'); }
    setup() {
        this.#panel = this.ref('panel');
        this.#shell = this.closest('.shell') ?? document.body;
        this.#setupResize();
        this.#setupRail();
        const toggle = byId('agent-toggle');
        toggle.addEventListener('click', () => this.set(!this.#isOpen()));
        this.ref('close-x').addEventListener('click', () => this.set(false));
        this.ref('collapse').addEventListener('click', () => this.set(false));
        this.ref('scrim').addEventListener('click', () => this.set(false));
        // Touch: drag the sheet header down (phone) or right (side drawer) to close; the close button and Esc do the same.
        dragToDismiss({
            handle: this.#panel.querySelector('.agent-head') ?? this.#panel,
            target: this.#panel,
            axis: () => (this.#mq.matches && this.#panel.classList.contains('open') ? (PHONE.matches ? 'down' : 'right') : null),
            onDismiss: () => this.set(false),
        });
        this.listen(document, 'keydown', (e) => {
            const k = e;
            if (k.key === 'Escape' && this.#mq.matches && this.#panel.classList.contains('open') && !document.querySelector(':popover-open'))
                this.set(false);
        });
        this.listen(document, 'rd:reveal-project', () => { if (this.#mq.matches)
            this.set(false); });
        this.listen(this, 'rd:answer', () => this.#flag('answer'));
        const onMq = () => this.set(this.#mq.matches ? false : prefs.get('agentOpen'), { focus: false });
        this.#mq.addEventListener('change', onMq);
        this.watch(['meta'], (_c, s) => {
            const note = typeof s.meta.critique === 'string' ? s.meta.critique : '';
            if (note && note !== prefs.get('noteSeen')) {
                this.#pending = note;
                this.#flag('note');
            }
        });
        // First paint: restore the remembered layout without animating the column.
        this.#shell.style.transition = 'none';
        this.set(this.#mq.matches ? false : this.#open, { focus: false });
        requestAnimationFrame(() => requestAnimationFrame(() => { this.#shell.style.transition = ''; }));
    }
    #isOpen() {
        return this.#mq.matches ? this.#panel.classList.contains('open') : this.#open;
    }
    set(open, { focus = true } = {}) {
        const toggle = byId('agent-toggle');
        const bg = [this.#shell.querySelector('.rail'), this.#shell.querySelector('.center')];
        setAttr(toggle, 'aria-expanded', String(open));
        setAttr(toggle, 'aria-label', open ? 'Close assistant' : 'Open assistant');
        if (!this.#mq.matches) {
            this.#open = open;
            prefs.set('agentOpen', open);
            this.#shell.classList.toggle('agent-rail', !open);
            this.#panel.classList.toggle('is-rail', !open);
            this.#panel.classList.remove('open');
            this.ref('scrim').classList.remove('on');
            this.#modal(false, bg);
            this.#panel.inert = false;
            if (open) {
                this.#seen();
                requestAnimationFrame(() => this.#priorities.sync());
            }
            if (focus)
                requestAnimationFrame(() => this.ref(open ? 'collapse' : 'rail-open').focus());
            return;
        }
        this.#shell.classList.remove('agent-rail');
        this.#panel.classList.remove('is-rail');
        this.#panel.classList.toggle('open', open);
        this.ref('scrim').classList.toggle('on', open);
        this.#panel.inert = !open;
        this.#modal(open, bg);
        if (open) {
            this.#returnTo = document.activeElement;
            this.#priorities.sync();
            if (focus)
                requestAnimationFrame(() => this.ref('title').focus());
        }
        else if (focus && this.#returnTo) {
            this.#returnTo.focus();
            this.#returnTo = null;
        }
    }
    #modal(on, bg) {
        if (on) {
            this.#panel.setAttribute('role', 'dialog');
            this.#panel.setAttribute('aria-modal', 'true');
        }
        else {
            this.#panel.removeAttribute('role');
            this.#panel.removeAttribute('aria-modal');
        }
        bg.forEach((n) => { if (n)
            n.inert = on; });
        document.documentElement.style.overflow = on ? 'hidden' : '';
    }
    /** Icon rail: expand, top priorities, quick asks, chat. */
    #setupRail() {
        this.ref('rail-open').addEventListener('click', () => this.set(true));
        this.ref('rail-chat').addEventListener('click', () => { this.set(true, { focus: false }); requestAnimationFrame(() => this.#composer.focusInput()); });
        this.querySelectorAll('.rbtn[data-rq]').forEach((b) => b.addEventListener('click', () => {
            this.set(true, { focus: false });
            void this.#composer.ask(b.dataset.rq ?? '');
            requestAnimationFrame(() => this.#composer.focusInput());
        }));
        const group = this.ref('rail-pri');
        const buttons = new Map();
        this.watch(['projects', 'openId'], (_c, s) => preserveFocus(() => {
            const top = topPriorities(s.projects);
            const ids = new Set(top.map((p) => p.id));
            for (const [id, b] of buttons)
                if (!ids.has(id)) {
                    b.remove();
                    buttons.delete(id);
                }
            top.forEach((p, i) => {
                let b = buttons.get(p.id);
                if (!b) {
                    const id = p.id;
                    b = h('button', { class: 'rbtn art', type: 'button', 'data-fk': `rail:${id}`, onclick: () => { store.set({ openId: id }); emit(this, 'rd:reveal-project', { id }); } });
                    buttons.set(id, b);
                }
                if (b.dataset.idx !== String(i)) {
                    b.innerHTML = cardArt(i, 'rc');
                    b.dataset.idx = String(i);
                }
                setAttr(b, 'aria-label', `Open ${p.name}`);
                setAttr(b, 'data-tip', p.name);
                setAttr(b, 'aria-current', String(p.id === s.openId));
                const at = group.children[i];
                if (at !== b)
                    group.insertBefore(b, at ?? null);
            });
        }));
    }
    /** Unread dot on the rail's chat button; only meaningful while collapsed. */
    #flag(kind) {
        const railed = this.#shell.classList.contains('agent-rail');
        if (!railed) {
            if (kind === 'note')
                this.#seen();
            return;
        }
        const chat = this.ref('rail-chat');
        chat.toggleAttribute('data-unread', true);
        chat.setAttribute('aria-label', `Ask about your projects, new ${kind === 'note' ? 'rundown note' : 'answer'}`);
        chat.dataset.tip = kind === 'note' ? 'New rundown note' : 'New answer';
    }
    #seen() {
        if (this.#pending)
            prefs.set('noteSeen', this.#pending);
        const chat = this.ref('rail-chat');
        chat.removeAttribute('data-unread');
        chat.setAttribute('aria-label', 'Ask about your projects');
        chat.dataset.tip = 'Ask Rundown';
    }
    /** Drag the panel's left edge (or arrow keys on it); double-click resets. Width persists per browser. */
    #setupResize() {
        const grip = this.ref('resize');
        const wMax = () => Math.max(W_MIN, Math.min(600, Math.round(this.#shell.clientWidth * 0.45)));
        const width = () => this.#panel.getBoundingClientRect().width;
        const setW = (w, save = true) => {
            if (w === null)
                this.#shell.style.removeProperty('--agent-w');
            else
                this.#shell.style.setProperty('--agent-w', `${Math.round(Math.min(wMax(), Math.max(W_MIN, w)))}px`);
            if (save)
                prefs.set('agentW', w === null ? null : width());
            grip.setAttribute('aria-valuemax', String(wMax()));
            grip.setAttribute('aria-valuenow', String(Math.round(width())));
        };
        const saved = prefs.get('agentW');
        if (saved)
            setW(saved, false);
        grip.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            const x0 = e.clientX, w0 = width();
            grip.setPointerCapture(e.pointerId);
            this.#shell.classList.add('resizing');
            const move = (ev) => setW(w0 + (x0 - ev.clientX), false);
            const up = () => { grip.removeEventListener('pointermove', move); this.#shell.classList.remove('resizing'); setW(width()); this.#priorities.sync(); };
            grip.addEventListener('pointermove', move);
            grip.addEventListener('pointerup', up, { once: true });
            grip.addEventListener('pointercancel', up, { once: true });
        });
        grip.addEventListener('dblclick', () => { setW(null); prefs.set('agentW', null); });
        grip.addEventListener('keydown', (e) => {
            const step = e.shiftKey ? 64 : 16;
            const map = { ArrowLeft: () => width() + step, ArrowRight: () => width() - step, Home: wMax, End: () => W_MIN };
            const next = map[e.key];
            if (next) {
                e.preventDefault();
                setW(next());
            }
        });
        this.listen(window, 'resize', () => { const v = parseFloat(this.#shell.style.getPropertyValue('--agent-w')); if (v)
            setW(v, false); });
    }
}
customElements.define('rd-assistant', RdAssistant);
