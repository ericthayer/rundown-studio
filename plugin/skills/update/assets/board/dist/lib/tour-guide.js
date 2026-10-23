import { h, setText } from './dom.js';
/** Space kept free above the bottom edge for the toast stack (toast.css). */
const TOAST_BAND = 88;
const GAP = 12;
const EDGE = 8;
function loadStyles() {
    if (document.querySelector('link[data-tour]'))
        return Promise.resolve();
    return new Promise((done) => {
        const link = h('link', { rel: 'stylesheet', href: 'styles/tour.css', 'data-tour': '' });
        link.addEventListener('load', () => done());
        link.addEventListener('error', () => done());
        document.head.append(link);
    });
}
function visible(el) {
    if (!(el instanceof HTMLElement) || !el.isConnected)
        return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.checkVisibility({ checkVisibilityCSS: true });
}
/** The step's live target, or null for a centered step. Undefined = target missing, skip the step. */
function resolve(step) {
    if (!step.target)
        return null;
    const { selector, fallback } = step.target;
    const el = [selector, fallback].map((s) => (s ? document.querySelector(s) : null)).find(visible);
    return el ?? undefined;
}
class DialogGuide {
    #dlg;
    #spot = h('div', { class: 'tour-spot', 'aria-hidden': 'true' });
    #card;
    #n = h('p', { class: 'tour-n', id: 'tour-n' });
    #title = h('h2', { class: 'tour-h', id: 'tour-h', tabindex: '-1' });
    #body = h('div', { class: 'tour-d', id: 'tour-d' });
    #back = h('button', { class: 'tour-btn', type: 'button' }, 'Back');
    #next = h('button', { class: 'cta tour-next', type: 'button' }, 'Next');
    #steps = [];
    #i = 0;
    #done = null;
    #frame = 0;
    constructor() {
        const skip = h('button', { class: 'tour-skip', type: 'button' }, 'Skip tour');
        this.#card = h('section', { class: 'tour-card' }, this.#n, this.#title, this.#body, h('footer', { class: 'tour-f' }, skip, this.#back, this.#next));
        this.#dlg = h('dialog', { class: 'tour', 'aria-labelledby': 'tour-h', 'aria-describedby': 'tour-n tour-d' }, this.#spot, this.#card);
        skip.addEventListener('click', () => this.#end('dismissed'));
        this.#back.addEventListener('click', () => this.#go(this.#i - 1));
        this.#next.addEventListener('click', () => (this.#i >= this.#steps.length - 1 ? this.#end('completed') : this.#go(this.#i + 1)));
        // Esc: dismiss on our terms so the outcome is recorded; a forced close still counts as dismissed.
        this.#dlg.addEventListener('cancel', (e) => { e.preventDefault(); this.#end('dismissed'); });
        this.#dlg.addEventListener('close', () => this.#end('dismissed'));
        window.addEventListener('resize', () => this.#schedule());
    }
    async run(flow, opts) {
        this.stop();
        await loadStyles();
        // Steps whose targets are missing or hidden at this size are skipped up front, so "Step n of m" is honest.
        this.#steps = flow.steps.flatMap((step) => {
            const target = resolve(step);
            return target === undefined && step.missingTarget === 'skip' ? [] : [{ step, target: target ?? null }];
        });
        this.#next.dataset.done = opts.doneLabel;
        if (!this.#steps.length)
            return 'dismissed';
        if (!this.#dlg.isConnected)
            document.body.append(this.#dlg);
        const ended = new Promise((r) => { this.#done = r; });
        this.#dlg.showModal();
        this.#go(0);
        return ended;
    }
    stop() {
        this.#end('dismissed');
    }
    #go(i) {
        const shown = this.#steps[i];
        if (!shown)
            return;
        this.#i = i;
        const last = i === this.#steps.length - 1;
        setText(this.#n, `Step ${i + 1} of ${this.#steps.length}`);
        setText(this.#title, shown.step.title);
        this.#body.replaceChildren(...shown.step.blocks.map((b) => h('p', {}, b.text)));
        this.#back.hidden = i === 0;
        setText(this.#next, last ? (this.#next.dataset.done ?? 'Done') : 'Next');
        // A target can re-render between steps; look it up again.
        if (shown.target && !shown.target.isConnected)
            shown.target = resolve(shown.step) ?? null;
        shown.target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        this.#place();
        this.#title.focus();
    }
    #schedule() {
        if (!this.#dlg.open)
            return;
        cancelAnimationFrame(this.#frame);
        this.#frame = requestAnimationFrame(() => this.#place());
    }
    /** Spotlight on the target; card below it, else above, else beside it, never in the toast band. */
    #place() {
        const target = this.#steps[this.#i]?.target ?? null;
        const r = target?.isConnected ? target.getBoundingClientRect() : null;
        this.#dlg.classList.toggle('centered', !r);
        if (r)
            Object.assign(this.#spot.style, { top: `${r.top - 6}px`, left: `${r.left - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` });
        const w = this.#card.offsetWidth;
        const ht = this.#card.offsetHeight;
        const floor = innerHeight - TOAST_BAND;
        const clampX = (x) => Math.max(EDGE * 2, Math.min(x, innerWidth - w - EDGE * 2));
        let top;
        let left;
        if (!r) {
            top = Math.max(EDGE, (innerHeight - ht) / 2 - 40);
            left = (innerWidth - w) / 2;
        }
        else if (r.bottom + GAP + ht <= floor) {
            top = r.bottom + GAP;
            left = clampX(r.left + r.width / 2 - w / 2);
        }
        else if (Math.min(r.top - GAP, floor) - ht >= EDGE) {
            // Targets flush with the bottom edge (sidebar footer) sit inside the band; stay above it.
            top = Math.min(r.top - GAP, floor) - ht;
            left = clampX(r.left + r.width / 2 - w / 2);
        }
        else {
            top = Math.max(EDGE, Math.min(r.top, floor - ht));
            left = r.right + GAP + w <= innerWidth - EDGE ? r.right + GAP : clampX(r.left - GAP - w);
        }
        this.#card.style.top = `${Math.round(top)}px`;
        this.#card.style.left = `${Math.round(left)}px`;
    }
    #end(end) {
        const done = this.#done;
        if (!done)
            return;
        this.#done = null;
        if (this.#dlg.open)
            this.#dlg.close();
        done(end);
    }
}
export function createGuide() {
    return new DialogGuide();
}
