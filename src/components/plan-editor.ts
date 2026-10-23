import type { PlanItem, Project } from '../types.js';
import { h, icon, setText } from '../lib/dom.js';
import { UI } from '../lib/icons.js';
import { MAX_ITEMS, WHY_MAX } from '../domain/week-plan.js';

/** What the editor is changing: a fresh Claude draft, the pinned plan, or a plan started by hand. */
export type EditKind = 'draft' | 'edit' | 'scratch';

export interface EditorHandlers {
  onPin(items: PlanItem[]): void;
  onCancel(): void;
  onRedraft(): void;
}

interface Row { projectId: string; why: string }

/**
 * Plan editor: one fieldset per item (project, reason, move up/down, remove), Add item while under
 * three, and a footer to pin, redraft or put it away. Reordering uses buttons, never drag (WCAG 2.5.7).
 * Rebuilt on structural changes; focus is placed explicitly after each one.
 */
export class PlanEditor {
  readonly el: HTMLFormElement;
  readonly #list: HTMLElement;
  readonly #foot: HTMLElement;
  readonly #msg: HTMLElement;
  #rows: Row[] = [];
  #kind: EditKind = 'draft';
  #projects: readonly Project[] = [];
  #canDraft = false;
  readonly #on: EditorHandlers;

  constructor(on: EditorHandlers) {
    this.#on = on;
    this.#list = h('div', { class: 'wed-list' });
    this.#msg = h('p', { class: 'wed-msg', 'aria-live': 'polite' });
    this.#foot = h('div', { class: 'wed-foot' });
    this.el = h('form', { class: 'wed', 'aria-label': 'Edit this week’s plan', novalidate: true }, this.#list, this.#msg, this.#foot);
    this.el.addEventListener('submit', (e) => { e.preventDefault(); this.#submit(); });
    this.el.addEventListener('input', () => this.#read());
  }

  open(kind: EditKind, items: readonly PlanItem[], projects: readonly Project[], canDraft: boolean): void {
    this.#kind = kind;
    this.#projects = projects.filter((p) => p.state !== 'parked');
    this.#canDraft = canDraft;
    this.#rows = items.map((i) => ({ projectId: i.projectId, why: i.why }));
    if (!this.#rows.length) this.#rows.push({ projectId: '', why: '' });
    setText(this.#msg, '');
    this.#render();
  }

  focusFirst(): void {
    this.el.querySelector<HTMLElement>('select')?.focus();
  }

  #read(): void {
    this.#list.querySelectorAll<HTMLFieldSetElement>('fieldset').forEach((fs, i) => {
      const row = this.#rows[i];
      if (!row) return;
      row.projectId = fs.querySelector('select')?.value ?? '';
      row.why = fs.querySelector('input')?.value ?? '';
    });
  }

  #render(): void {
    const n = this.#rows.length;
    this.#list.replaceChildren(...this.#rows.map((r, i) => this.#row(r, i, n)));
    if (n < MAX_ITEMS) {
      this.#list.append(h('button', { class: 'wed-add', type: 'button', 'data-fk': 'plan:add', onclick: () => this.#add() }, icon(UI.plus), 'Add a project'));
    }
    const draft = this.#kind === 'draft';
    const note = draft ? 'Drafted by Claude from your board. Edit anything, then pin it.' : this.#kind === 'edit' ? 'Editing your pinned plan.' : 'Pick up to three projects for this week.';
    const redraft = this.#canDraft ? h('button', { class: 'ghost', type: 'button', 'data-fk': 'plan:redraft', onclick: () => this.#on.onRedraft() }, draft ? 'Redraft' : 'Draft with Claude') : '';
    this.#foot.replaceChildren(
      h('span', { class: 'wed-note' }, draft ? icon(UI.spark) : null, note),
      h('button', { class: 'lnk', type: 'button', 'data-fk': 'plan:cancel', onclick: () => this.#on.onCancel() }, draft ? 'Discard' : 'Cancel'),
      redraft,
      h('button', { class: 'cta', type: 'submit', 'data-fk': 'plan:pin' }, this.#kind === 'edit' ? 'Save plan' : 'Pin plan'),
    );
  }

  #row(r: Row, i: number, n: number): HTMLFieldSetElement {
    const num = i + 1;
    const sel = h('select', { id: `wed-p${i}`, 'data-fk': `plan:p${i}` },
      h('option', { value: '' }, 'Choose a project'),
      ...this.#projects.map((p) => h('option', { value: p.id, selected: p.id === r.projectId }, p.name)));
    const why = h('input', { id: `wed-w${i}`, type: 'text', maxlength: WHY_MAX, value: r.why, placeholder: 'Why this week', 'data-fk': `plan:w${i}` });
    const btn = (what: 'up' | 'down' | 'remove', label: string, disabled: boolean, run: () => void): HTMLButtonElement =>
      h('button', { class: 'wed-ibtn', type: 'button', 'aria-label': `${label} item ${num}`, 'data-fk': `plan:${what}${i}`, disabled, onclick: run },
        icon(what === 'remove' ? UI.close : UI[what]));
    return h('fieldset', { class: 'wed-row' },
      h('legend', { class: 'sr' }, `Item ${num}`),
      h('span', { class: 'wnum', 'aria-hidden': 'true' }, String(num)),
      h('label', { class: 'sr', for: `wed-p${i}` }, `Project for item ${num}`), sel,
      h('label', { class: 'sr', for: `wed-w${i}` }, `Why item ${num} this week`), why,
      h('span', { class: 'wed-ord' },
        btn('up', 'Move up', i === 0, () => this.#move(i, -1)),
        btn('down', 'Move down', i === n - 1, () => this.#move(i, 1)),
        btn('remove', 'Remove', false, () => this.#remove(i))));
  }

  #focus(fk: string): void {
    this.el.querySelector<HTMLElement>(`[data-fk="${fk}"]:not(:disabled)`)?.focus();
  }

  #move(i: number, by: -1 | 1): void {
    this.#read();
    const j = i + by;
    const [a, b] = [this.#rows[i], this.#rows[j]];
    if (!a || !b) return;
    this.#rows[i] = b;
    this.#rows[j] = a;
    this.#render();
    // Focus follows the moved item; at an end, the other arrow of the same item.
    this.#focus(`plan:${by < 0 ? 'up' : 'down'}${j}`);
    if (document.activeElement === document.body || !this.el.contains(document.activeElement)) this.#focus(`plan:${by < 0 ? 'down' : 'up'}${j}`);
    setText(this.#msg, `Moved to position ${j + 1}.`);
  }

  #remove(i: number): void {
    this.#read();
    this.#rows.splice(i, 1);
    this.#render();
    const next = Math.min(i, this.#rows.length - 1);
    if (next >= 0) this.#focus(`plan:p${next}`);
    else this.#focus('plan:add');
    setText(this.#msg, `Item ${i + 1} removed.`);
  }

  #add(): void {
    this.#read();
    this.#rows.push({ projectId: '', why: '' });
    this.#render();
    this.#focus(`plan:p${this.#rows.length - 1}`);
  }

  #submit(): void {
    this.#read();
    const byId = new Map(this.#projects.map((p) => [p.id, p]));
    const seen = new Set<string>();
    const items: PlanItem[] = [];
    for (const r of this.#rows) {
      const p = byId.get(r.projectId);
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      items.push({ projectId: p.id, name: p.name, why: r.why.replace(/\s+/g, ' ').trim().slice(0, WHY_MAX) });
    }
    if (!items.length) {
      setText(this.#msg, 'Pick at least one project to pin.');
      this.focusFirst();
      return;
    }
    this.#on.onPin(items);
  }
}
