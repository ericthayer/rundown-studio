/** Illustrated panel for the list area: empty board, no matches, can't connect, offline, signed out. */
import { h, setAttr, setText } from './dom.js';
import { paintArt, stopArt } from './art.js';
import type { SceneName } from './scenes.js';

export type PanelKind = 'empty' | 'nomatch' | 'error' | 'offline' | 'signed-out';

export interface PanelAction { label: string; run: () => void | Promise<void>; id?: string }
export interface PanelSpec { kind: PanelKind; title: string; body: string; action?: PanelAction | undefined }

const SCENE: Record<PanelKind, SceneName> = { empty: 'empty', nomatch: 'search', error: 'unplugged', offline: 'unplugged', 'signed-out': 'empty' };

/** Copy for each kind. `cmd` is the board's check-in command; `query` the search text. */
export function panelCopy(kind: PanelKind, cmd: string, query = ''): { title: string; body: string } {
  switch (kind) {
    case 'empty': return { title: 'No projects yet', body: `Run ${cmd} inside any Claude Project. Its first check-in lands here as a row.` };
    case 'nomatch': return { title: 'Nothing matches', body: query ? `No project matches “${query}”. Try another word or clear the filters.` : 'No project fits these filters.' };
    case 'error': return { title: "Can't reach your board", body: "Your rows are safe. The board's database didn't answer, so this is a connection problem, not lost data." };
    case 'offline': return { title: "You're offline", body: 'Your projects load as soon as you’re back online.' };
    case 'signed-out': return { title: 'Sign in to see your projects', body: "Rows live in this page's database, so the board needs you signed in to claude.ai." };
  }
}

/** Built once, patched in place so focus on the action button survives store updates. */
export class StatePanel {
  readonly el: HTMLElement;
  readonly #art: HTMLElement;
  readonly #title: HTMLElement;
  readonly #body: HTMLElement;
  readonly #btn: HTMLButtonElement;
  #action: PanelAction | undefined;
  #busy = false;

  constructor(headingId: string) {
    this.#art = h('div', { class: 'art', 'aria-hidden': 'true' });
    this.#title = h('h2', { class: 'estate-h', id: headingId });
    this.#body = h('p', { class: 'estate-d' });
    this.#btn = h('button', { class: 'cta estate-cta', type: 'button', 'data-fk': 'estate:cta', onclick: () => void this.#run() });
    this.el = h('section', { class: 'estate', 'aria-labelledby': headingId }, this.#art, this.#title, this.#body, this.#btn);
  }

  get kind(): PanelKind | null {
    return (this.el.dataset.kind as PanelKind | undefined) ?? null;
  }

  set(spec: PanelSpec): void {
    this.el.dataset.kind = spec.kind;
    paintArt(this.#art, SCENE[spec.kind]);
    setText(this.#title, spec.title);
    setText(this.#body, spec.body);
    this.#action = spec.action;
    this.#btn.hidden = !spec.action;
    setAttr(this.#btn, 'id', spec.action?.id);
    if (spec.action && !this.#busy) setText(this.#btn, spec.action.label);
  }

  /** Marks the action as running (e.g. a retry in flight) without changing the panel. */
  busy(on: boolean): void {
    this.#busy = on;
    setAttr(this.#btn, 'aria-disabled', on);
    if (on) setText(this.#btn, 'Trying again…');
    else if (this.#action) setText(this.#btn, this.#action.label);
  }

  stop(): void {
    stopArt(this.#art);
    delete this.el.dataset.kind;
  }

  async #run(): Promise<void> {
    if (this.#busy || !this.#action) return;
    await this.#action.run();
  }
}
