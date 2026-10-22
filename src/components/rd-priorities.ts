import type { Project } from '../types.js';
import { StoreElement, emit } from './base.js';
import { store } from '../store.js';
import { prefs } from '../lib/prefs.js';
import { cardArt } from '../lib/icons.js';
import { h, preserveFocus, setAttr, setText } from '../lib/dom.js';
import { topPriorities } from '../domain/projects.js';

interface Card { btn: HTMLButtonElement; art: HTMLSpanElement; name: HTMLElement; next: HTMLSpanElement; index: number }

/**
 * Top-priorities drawer pinned at the top of the assistant. Height is a fraction 0 (collapsed) … 1
 * (natural three-card height), set by the toggle, a drag handle, or the handle's arrow keys.
 */
export class RdPriorities extends StoreElement {
  #frac = prefs.get('drawer');
  #cards = new Map<string, Card>();
  #body!: HTMLElement;
  #list!: HTMLElement;

  protected setup(): void {
    this.#body = this.ref('body');
    this.#list = this.ref('cards');
    this.watch(['projects', 'openId', 'day'], (_c, s) => preserveFocus(() => this.#render(topPriorities(s.projects), s.openId)));
    this.ref('toggle').addEventListener('click', () => this.#set(this.#frac > 0 ? 0 : 1));
    this.#setupHandle();
  }

  /** Re-measure after the panel becomes visible or changes width. */
  sync(): void {
    this.#apply(false);
  }

  #render(top: Project[], openId: string | null): void {
    const section = this.ref('section');
    const handle = this.ref('handle');
    section.hidden = handle.hidden = top.length === 0;
    const ids = new Set(top.map((p) => p.id));
    for (const [id, c] of this.#cards) if (!ids.has(id)) { c.btn.remove(); this.#cards.delete(id); }
    top.forEach((p, i) => {
      let c = this.#cards.get(p.id);
      if (!c) {
        const art = h('span', { style: 'display:contents' });
        const name = h('b');
        const next = h('span');
        const btn = h('button', { class: 'card', type: 'button', 'data-fk': `card:${p.id}`, onclick: () => this.#open(p.id) }, art, name, next);
        c = { btn, art, name, next, index: -1 };
        this.#cards.set(p.id, c);
      }
      if (c.index !== i) { c.art.innerHTML = cardArt(i, 'pc'); c.index = i; }
      setText(c.name, p.name);
      setText(c.next, p.nextStep || 'No next step yet.');
      setAttr(c.btn, 'aria-current', String(p.id === openId));
      const at = this.#list.children[i];
      if (at !== c.btn) this.#list.insertBefore(c.btn, at ?? null);
    });
    this.#apply(false);
  }

  #open(id: string): void {
    store.set({ openId: id });
    emit(this, 'rd:reveal-project', { id });
  }

  #set(frac: number, save = true): void {
    this.#frac = Math.min(1, Math.max(0, frac));
    this.#apply(save);
  }

  #apply(save: boolean): void {
    const open = this.#frac > 0;
    const max = this.#list.scrollHeight;
    this.#body.style.height = `${Math.round(this.#frac * max)}px`;
    this.#body.inert = !open;
    const toggle = this.ref('toggle');
    setAttr(toggle, 'aria-expanded', String(open));
    setAttr(toggle, 'aria-label', `${open ? 'Collapse' : 'Expand'} top priorities`);
    setAttr(this.ref('handle'), 'aria-valuenow', String(Math.round(this.#frac * 100)));
    if (save) prefs.set('drawer', this.#frac);
  }

  #setupHandle(): void {
    const handle = this.ref('handle');
    const section = this.ref('section');
    handle.addEventListener('pointerdown', (e) => {
      const y0 = e.clientY, max = this.#list.scrollHeight || 1, h0 = this.#frac * max;
      handle.setPointerCapture(e.pointerId);
      section.classList.add('dragging');
      const move = (ev: PointerEvent): void => this.#set((h0 + ev.clientY - y0) / max, false);
      const up = (): void => {
        handle.removeEventListener('pointermove', move);
        section.classList.remove('dragging');
        // Snap: nearly closed collapses, nearly full opens fully.
        if (this.#frac * max < 28) this.#set(0); else if (this.#frac > 0.92) this.#set(1); else this.#apply(true);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up, { once: true });
      handle.addEventListener('pointercancel', up, { once: true });
    });
    handle.addEventListener('dblclick', () => this.#set(this.#frac > 0 ? 0 : 1));
    handle.addEventListener('keydown', (e) => {
      const step: Record<string, number> = { ArrowUp: -0.2, ArrowDown: 0.2 };
      const delta = step[e.key];
      if (delta !== undefined) { e.preventDefault(); this.#set(this.#frac + delta); }
      else if (e.key === 'Home') { e.preventDefault(); this.#set(0); }
      else if (e.key === 'End') { e.preventDefault(); this.#set(1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.#set(this.#frac > 0 ? 0 : 1); }
    });
  }
}

customElements.define('rd-priorities', RdPriorities);
