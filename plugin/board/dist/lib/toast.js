/**
 * Toasts: short, bottom-center notices for things that happened to the board. Successes dismiss
 * themselves (paused while hovered or focused, WCAG 2.2.1); failures stay until dismissed and carry
 * Retry. The stack is a persistent polite live region; a failure toast is role="alert" (assertive).
 * The stack is a manual popover, so it sits in the top layer above the page and the assistant sheet.
 */
import { h } from './dom.js';
/** How long a success stays up, not counting time hovered or focused. */
export const TOAST_MS = 5000;
const MAX = 3;
let stack = null;
const live = new Map();
function host() {
    if (stack?.isConnected)
        return stack;
    stack = h('section', { class: 'toasts', 'aria-live': 'polite', 'aria-label': 'Notifications', popover: 'manual' });
    document.body.append(stack);
    // Open from the start (empty it takes no space), so the live region exists before the first toast.
    stack.showPopover();
    return stack;
}
/** Shows a toast; a toast with the same `key` replaces the one already up. Returns a dismiss function. */
export function toast(o) {
    const root = host();
    if (o.key)
        live.get(o.key)?.();
    const sticky = o.tone === 'error';
    let left = TOAST_MS;
    let started = 0;
    let timer = 0;
    const pause = () => { clearTimeout(timer); if (started)
        left -= Date.now() - started; started = 0; };
    const resume = () => { if (sticky || started)
        return; started = Date.now(); timer = window.setTimeout(dismiss, Math.max(800, left)); };
    const act = o.action;
    const actBtn = act ? h('button', { class: 'toast-act', type: 'button', 'data-fk': `toast:${o.key ?? 'act'}`, onclick: () => { dismiss(); void act.run(); } }, act.label) : null;
    const el = h('div', { class: `toast t-${o.tone}`, role: sticky ? 'alert' : null, 'data-key': o.key ?? null }, h('span', { class: 'toast-dot', 'aria-hidden': 'true' }), h('p', { class: 'toast-msg' }, o.text), actBtn, h('button', { class: 'toast-x', type: 'button', 'aria-label': 'Dismiss notification', onclick: () => dismiss() }, h('span', { html: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 3 6 6M9 3 3 9"/></svg>', style: 'display:contents' })));
    function dismiss() {
        clearTimeout(timer);
        if (o.key && live.get(o.key) === dismiss)
            live.delete(o.key);
        if (!el.isConnected)
            return;
        el.remove();
    }
    el.addEventListener('pointerenter', pause);
    el.addEventListener('pointerleave', () => { if (!el.contains(document.activeElement))
        resume(); });
    el.addEventListener('focusin', pause);
    el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget))
        resume(); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape')
        dismiss(); });
    root.append(el);
    while (root.childElementCount > MAX)
        root.firstElementChild?.remove();
    if (!root.matches(':popover-open'))
        root.showPopover();
    if (o.key)
        live.set(o.key, dismiss);
    resume();
    return dismiss;
}
/** Removes every toast (tests, and when the page tears down). */
export function clearToasts() {
    for (const d of [...live.values()])
        d();
    stack?.replaceChildren();
}
