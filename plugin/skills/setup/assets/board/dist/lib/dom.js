/**
 * Element factory. Text children are always text nodes. The `html` attribute is reserved for
 * trusted, static icon markup from `icons.ts` — never pass data through it.
 */
export function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false)
            continue;
        if (typeof v === 'function')
            el.addEventListener(k.slice(2), v);
        else if (k === 'class')
            el.className = String(v);
        else if (k === 'html')
            el.innerHTML = String(v);
        else
            el.setAttribute(k, v === true ? '' : String(v));
    }
    append(el, kids);
    return el;
}
function append(el, kids) {
    for (const c of kids) {
        if (c === null || c === undefined || c === false)
            continue;
        if (Array.isArray(c))
            append(el, c);
        else
            el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
}
/** Wraps trusted icon markup in an inline `<span style="display:contents">`. */
export function icon(markup, viewBox = '0 0 24 24') {
    return h('span', { html: `<svg viewBox="${viewBox}" aria-hidden="true">${markup}</svg>`, style: 'display:contents' });
}
export function byId(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`#${id} missing`);
    return el;
}
/** Sets text only when it changed (avoids needless layout + keeps selection). */
export function setText(el, text) {
    if (el.textContent !== text)
        el.textContent = text;
}
export function setAttr(el, name, value) {
    if (value === null || value === undefined || value === false)
        el.removeAttribute(name);
    else {
        const v = value === true ? '' : String(value);
        if (el.getAttribute(name) !== v)
            el.setAttribute(name, v);
    }
}
/**
 * Safety net for DOM updates: if the focused element (tagged with `data-fk`) is removed or moved,
 * restore focus to its replacement so keyboard users never fall back to <body>.
 */
export function preserveFocus(fn) {
    const active = document.activeElement;
    const key = active?.dataset?.fk;
    const result = fn();
    if (key && (!active?.isConnected || document.activeElement === document.body)) {
        document.querySelector(`[data-fk="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
    }
    return result;
}
const flashTimers = new WeakMap();
/** Shows a short confirmation on a button label, then restores it; repeated calls restart one timer. */
export function flashLabel(labelEl, text, idle) {
    labelEl.textContent = text;
    clearTimeout(flashTimers.get(labelEl));
    flashTimers.set(labelEl, window.setTimeout(() => { labelEl.textContent = idle; }, 1800));
}
/** Copies the check-in command and flashes a confirmation. */
export async function copyCommand(labelEl, idle, command = '/project-checkin') {
    try {
        await navigator.clipboard.writeText(command);
        flashLabel(labelEl, 'Copied', idle);
    }
    catch {
        flashLabel(labelEl, `Type ${command}`, idle);
    }
}
/** Positions a fixed popover under its anchor, kept inside the viewport. */
export function placeUnder(anchor, pop) {
    const r = anchor.getBoundingClientRect();
    pop.style.top = `${Math.round(r.bottom + 6)}px`;
    pop.style.left = `${Math.round(Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8)))}px`;
}
/** Positions a fixed popover above its anchor (for controls pinned to the bottom), kept inside the viewport. */
export function placeAbove(anchor, pop) {
    const r = anchor.getBoundingClientRect();
    pop.style.top = `${Math.round(Math.max(8, r.top - pop.offsetHeight - 6))}px`;
    pop.style.left = `${Math.round(Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8)))}px`;
}
