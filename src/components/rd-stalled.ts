import type { AppState, Project } from '../types.js';
import { StoreElement } from './base.js';
import { store } from '../store.js';
import { h, icon, preserveFocus, setAttr, setText } from '../lib/dom.js';
import { UI } from '../lib/icons.js';
import { toast } from '../lib/toast.js';
import { failure, UNAVAILABLE } from '../lib/sample-errors.js';
import { sampleJson } from '../lib/sample-json.js';
import { writeNudge } from '../lib/nudge-store.js';
import { BATCH, nudgePrompt, parseSuggestions, stalledView } from '../domain/nudges.js';
import { setCard, suggestionCard } from './nudge-card.js';

/** Suggest-specific copy for a failed call; falls back to the shared `sample` copy. */
function suggestFailure(code: string): { text: string; retry: boolean } {
  if (UNAVAILABLE.has(code)) return { text: "Suggestions need Claude, which isn't available in this view.", retry: false };
  switch (code) {
    case 'unusable': return { text: "Claude's suggestions came back in a shape the board can't use. Try again.", retry: true };
    case 'stalled': return { text: 'Claude stopped responding, so suggesting timed out.', retry: true };
    case 'refused': return { text: "Claude couldn't suggest next steps for these projects.", retry: false };
    default: return { text: failure(code, false).text.replace('only Ask is affected', 'only suggestions are affected'), retry: failure(code, false).retry };
  }
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/**
 * Stalled tab: rows that went quiet, are blocked on you, or wait too long on others. One button asks
 * the board's own Claude (quick tier) for one next step per row; each comes back as a card with
 * Use this and Not now. Suggestions live in `nudges`; the page never writes a project row.
 */
export class RdStalled extends StoreElement {
  #body!: HTMLElement;
  #live!: HTMLElement;
  #busy = false;
  #error: { text: string; retry: boolean } | null = null;
  #missing = 0;

  protected setup(): void {
    this.#body = this.ref('body');
    this.#live = this.ref('live');
    this.watch(['rows', 'nudges', 'canAsk', 'status'], (_c, s) => preserveFocus(() => this.#render(s)));
    this.listen(document, 'rd:show-stalled', (e) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id;
      requestAnimationFrame(() => this.#focusCard(id));
    });
  }

  #say(text: string): void {
    setText(this.#live, '');
    requestAnimationFrame(() => setText(this.#live, text));
  }

  #render(s: Readonly<AppState>): void {
    const v = stalledView(s.rows, s.nudges);
    setText(this.ref('title'), v.cards.length ? plural(v.cards.length, 'suggestion') : 'Stalled');
    setAttr(this.ref('section'), 'aria-busy', this.#busy ? 'true' : null);
    const nodes: (HTMLElement | null)[] = [];
    if (this.#error) nodes.push(h('div', { class: 'werr', role: 'alert' }, h('p', {}, this.#error.text),
      this.#error.retry ? h('button', { class: 'lnk', type: 'button', 'data-fk': 'stall:retry', onclick: () => void this.#suggest() }, 'Try again') : null));
    if (this.#busy) nodes.push(h('div', { class: 'wskel' }, h('p', { class: 'wmuted' }, icon(UI.spark), 'Suggesting next steps…'),
      ...v.pending.slice(0, 3).map(() => h('div', { class: 'wskel-row', 'aria-hidden': 'true' }))));
    if (this.#missing && !this.#busy) nodes.push(h('p', { class: 'wmuted' }, `${plural(this.#missing, 'row')} had no usable suggestion.`));
    if (v.cards.length) {
      nodes.push(h('div', { class: 'nlist', role: 'list', 'aria-label': 'Suggestions' },
        ...v.cards.map(({ p, n }) => h('div', { role: 'listitem' }, suggestionCard(p, n, 'panel', () => this.#after(p))))));
    }
    if (v.pending.length && !this.#busy) nodes.push(this.#pending(v.pending, s.canAsk));
    if (v.set.length) {
      nodes.push(h('section', { class: 'nset', 'aria-labelledby': 'nset-h' }, h('h4', { id: 'nset-h', class: 'cards-lbl' }, 'Set on the board'),
        h('ul', { class: 'nlist' }, ...v.set.map(({ p, n }) => setCard(p, n)))));
    }
    if (!nodes.length) {
      nodes.push(s.nudges === null || s.status !== 'ready' ? h('p', { class: 'wmuted' }, 'Loading…')
        : h('div', { class: 'wempty' }, h('p', {}, 'Nothing has stalled.'),
          h('p', { class: 'wmuted' }, 'Projects that go stale, get blocked on you, or wait on someone for 14 days show up here.')));
    }
    this.#body.replaceChildren(...nodes.filter((n): n is HTMLElement => n !== null));
  }

  #pending(rows: readonly Project[], canAsk: boolean): HTMLElement {
    const names = rows.map((p) => p.name);
    const shown = names.slice(0, 4).join(', ') + (names.length > 4 ? `, and ${names.length - 4} more` : '');
    return h('div', { class: 'wempty npend' },
      h('p', {}, `${plural(rows.length, 'project')} ${rows.length === 1 ? 'has' : 'have'} stalled with no suggestion yet: ${shown}.`),
      canAsk ? h('div', { class: 'wempty-acts' }, h('button', { class: 'cta', type: 'button', 'data-fk': 'stall:suggest', onclick: () => void this.#suggest() }, icon(UI.spark), 'Suggest next steps'))
        : h('p', { class: 'wmuted' }, "Suggestions need Claude, which isn't available in this view."));
  }

  /** A decided card leaves the list: focus moves to the next card's main button, else to the tab heading. */
  #after(p: Project): void {
    requestAnimationFrame(() => {
      const next = this.querySelector<HTMLElement>('.nlist .ncard:not(.done) .cta') ?? this.querySelector<HTMLElement>('[data-fk="stall:suggest"]');
      (next ?? this.ref<HTMLElement>('title')).focus();
      this.#say(`${p.name} done.`);
    });
  }

  #focusCard(id: string | undefined): void {
    const card = id ? this.querySelector<HTMLElement>(`.ncard[data-nudge="${CSS.escape(id)}"]`) : null;
    if (!card) return;
    card.scrollIntoView({ block: 'nearest' });
    card.querySelector<HTMLElement>('.cta')?.focus();
  }

  async #suggest(): Promise<void> {
    if (this.#busy) return;
    const s = store.state;
    const batch = stalledView(s.rows, s.nudges).pending.slice(0, BATCH);
    if (!batch.length) return;
    this.#busy = true;
    this.#error = null;
    this.#missing = 0;
    this.#render(s);
    this.#say('Suggesting next steps.');
    const res = await sampleJson(nudgePrompt(batch, s.day), { tier: 'quick' });
    const parsed = res.ok ? parseSuggestions(res.value, batch, new Date().toISOString()) : { nudges: [], missing: batch.length };
    this.#busy = false;
    if (!parsed.nudges.length) {
      this.#error = suggestFailure(res.ok ? 'unusable' : res.code);
      this.#render(store.state);
      this.#say(this.#error.text);
      return;
    }
    this.#missing = parsed.missing;
    const failed = await this.#save(parsed.nudges);
    this.#render(store.state);
    this.#say(`${plural(parsed.nudges.length - failed, 'suggestion')} ready.`);
    this.querySelector<HTMLElement>('.nlist .ncard .cta')?.focus();
  }

  /** Writes each suggestion; refused ones get one sticky toast that retries just those. Returns how many failed. */
  async #save(list: Parameters<typeof writeNudge>[0][]): Promise<number> {
    const results = await Promise.allSettled(list.map((n) => writeNudge(n)));
    const failed = list.filter((_, i) => results[i]?.status === 'rejected');
    if (failed.length) {
      toast({ tone: 'error', key: 'nudges', text: `Couldn't save ${plural(failed.length, 'suggestion')} to the board.`,
        action: { label: 'Retry', run: async () => { await this.#save(failed); } } });
    }
    return failed.length;
  }
}

customElements.define('rd-stalled', RdStalled);
