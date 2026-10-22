type AttrValue = string | number | boolean | null | undefined;
type Handler = (e: Event) => void;
export type Attrs = Record<string, AttrValue | Handler>;
export type Kid = Node | string | number | null | undefined | false | readonly Kid[];

/**
 * Element factory. Text children are always text nodes. The `html` attribute is reserved for
 * trusted, static icon markup from `icons.ts` — never pass data through it.
 */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, kids);
  return el;
}

function append(el: Element, kids: readonly Kid[]): void {
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Wraps trusted icon markup in an inline `<span style="display:contents">`. */
export function icon(markup: string, viewBox = '0 0 24 24'): HTMLSpanElement {
  return h('span', { html: `<svg viewBox="${viewBox}" aria-hidden="true">${markup}</svg>`, style: 'display:contents' });
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
}

/** Sets text only when it changed (avoids needless layout + keeps selection). */
export function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

export function setAttr(el: Element, name: string, value: AttrValue): void {
  if (value === null || value === undefined || value === false) el.removeAttribute(name);
  else {
    const v = value === true ? '' : String(value);
    if (el.getAttribute(name) !== v) el.setAttribute(name, v);
  }
}

/**
 * Safety net for DOM updates: if the focused element (tagged with `data-fk`) is removed or moved,
 * restore focus to its replacement so keyboard users never fall back to <body>.
 */
export function preserveFocus<T>(fn: () => T): T {
  const active = document.activeElement as HTMLElement | null;
  const key = active?.dataset?.fk;
  const result = fn();
  if (key && (!active?.isConnected || document.activeElement === document.body)) {
    document.querySelector<HTMLElement>(`[data-fk="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  }
  return result;
}

const copyTimers = new WeakMap<Element, number>();

/** Copies the check-in command and flashes a confirmation; repeated clicks restart one timer. */
export async function copyCommand(labelEl: Element, idle: string, command = '/project-checkin'): Promise<void> {
  try {
    await navigator.clipboard.writeText(command);
    labelEl.textContent = 'Copied';
  } catch {
    labelEl.textContent = `Type ${command}`;
  }
  clearTimeout(copyTimers.get(labelEl));
  copyTimers.set(labelEl, window.setTimeout(() => { labelEl.textContent = idle; }, 1800));
}

/** Positions a fixed popover under its anchor, kept inside the viewport. */
export function placeUnder(anchor: Element, pop: HTMLElement): void {
  const r = anchor.getBoundingClientRect();
  pop.style.top = `${Math.round(r.bottom + 6)}px`;
  pop.style.left = `${Math.round(Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8)))}px`;
}

/** Positions a fixed popover above its anchor (for controls pinned to the bottom), kept inside the viewport. */
export function placeAbove(anchor: Element, pop: HTMLElement): void {
  const r = anchor.getBoundingClientRect();
  pop.style.top = `${Math.round(Math.max(8, r.top - pop.offsetHeight - 6))}px`;
  pop.style.left = `${Math.round(Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8)))}px`;
}
