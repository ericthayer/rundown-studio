import type { LoadStatus, Project, RailFilter } from '../types.js';
import { StoreElement } from './base.js';
import { store } from '../store.js';
import { h, icon, placeUnder, preserveFocus, setAttr, setText } from '../lib/dom.js';
import { UI } from '../lib/icons.js';
import { needsYou } from '../domain/projects.js';
import { decisionCount, waits } from '../domain/signals.js';
import { checkinCommand } from '../lib/config.js';

type StatKey = Extract<RailFilter, 'needs' | 'decisions' | 'waiting' | 'blocked' | 'stale' | 'parked'>;
const where = (test: (p: Project) => boolean) => (ps: readonly Project[]): number => ps.filter(test).length;
const STATS: readonly [StatKey, string, (ps: readonly Project[]) => number][] = [
  ['needs', 'Need you', where(needsYou)],
  ['blocked', 'Blocked', where((p) => p.state === 'blocked')],
  ['waiting', 'Waiting', where((p) => waits(p).length > 0)],
  ['decisions', 'Decisions', decisionCount],
  ['stale', 'Stale', where((p) => p.state === 'stale')],
  ['parked', 'Parked', where((p) => p.state === 'parked')],
];

const MESSAGE: Record<LoadStatus, string> = {
  loading: 'Loading your projects…',
  'signed-out': "Sign in to see your projects. Rows live in this page's database.",
  error: "Couldn't load projects. Reload to try again.",
  ready: 'No projects yet. Run {cmd} inside any Project to add the first one.',
};

interface Stat { key: StatKey; label: string; btn: HTMLButtonElement; num: HTMLElement; sep: HTMLElement | null; item: HTMLButtonElement; itemNum: HTMLElement }

/**
 * Stat strip: counts that double as filter shortcuts. Never wraps — stats that don't fit move,
 * last first, into a "+N" menu (priority+ pattern). Buttons are built once and updated in place.
 */
export class RdStatStrip extends StoreElement {
  #stats: Stat[] = [];
  #msg!: HTMLElement;
  #more!: HTMLButtonElement;
  #menu!: HTMLDivElement;
  #raf = 0;

  protected setup(): void {
    this.#msg = this.ref('msg');
    this.#menu = h('div', { class: 'fpop smenu', id: 'pstats-menu', popover: 'auto', role: 'group', 'aria-label': 'More project counts' });
    this.#more = h('button', { class: 'stat smore', type: 'button', popovertarget: 'pstats-menu', 'aria-haspopup': 'true', 'data-fk': 'stat:more', hidden: true });
    this.#menu.addEventListener('toggle', (e) => {
      const open = (e as ToggleEvent).newState === 'open';
      this.#more.setAttribute('aria-expanded', String(open));
      if (open) placeUnder(this.#more, this.#menu);
    });

    const nodes: Node[] = [];
    STATS.forEach(([key, label], i) => {
      const toggle = (): void => store.set({ filter: store.state.filter === key ? 'all' : key });
      const num = h('b', {}, '0');
      const dot = key === 'needs' ? null : h('span', { class: `dot ${key}`, 'aria-hidden': 'true' });
      const btn = h('button', { class: 'stat', type: 'button', 'data-fk': `stat:${key}`, 'aria-pressed': 'false', onclick: toggle }, dot, num, label);
      const sep = i ? h('span', { class: 'ssep', 'aria-hidden': 'true' }, '/') : null;
      const itemNum = h('span', { class: 'n num' }, '0');
      const item = h('button', { class: 'fopt', type: 'button', 'data-fk': `statmenu:${key}`, hidden: true, onclick: () => { this.#menu.hidePopover(); toggle(); } },
        dot?.cloneNode(true) ?? null, label, itemNum);
      if (sep) nodes.push(sep);
      nodes.push(btn);
      this.#menu.append(item);
      this.#stats.push({ key, label, btn, num, sep, item, itemNum });
    });
    this.append(...nodes, this.#more);
    document.body.append(this.#menu);

    this.watch(['projects', 'filter', 'status', 'day', 'config'], (_c, s) => preserveFocus(() => this.#render(s.projects, s.filter, s.status)));
    const ro = new ResizeObserver(() => { cancelAnimationFrame(this.#raf); this.#raf = requestAnimationFrame(() => this.#fit()); });
    ro.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#menu.remove();
  }

  #render(projects: readonly Project[], filter: RailFilter, status: LoadStatus): void {
    const empty = projects.length === 0;
    this.#msg.hidden = !empty;
    setText(this.#msg, MESSAGE[status].replace('{cmd}', checkinCommand()));
    for (const st of this.#stats) {
      const n = STATS.find(([k]) => k === st.key)?.[2];
      const count = n ? n(projects) : 0;
      const on = filter === st.key;
      st.btn.hidden = empty;
      if (st.sep) st.sep.hidden = empty;
      setText(st.num, String(count));
      setText(st.itemNum, String(count));
      setAttr(st.btn, 'aria-pressed', String(on));
      setAttr(st.item, 'aria-pressed', String(on));
      setAttr(st.btn, 'data-zero', !count);
      setAttr(st.btn, 'aria-label', `${count} ${st.label.toLowerCase()}${on ? ', filtered' : ''}`);
    }
    this.#fit();
  }

  /** Hide trailing stats until the strip fits; mirror hidden ones into the menu. */
  #fit(): void {
    if (!this.#stats.length || this.#msg.hidden === false) { this.#more.hidden = true; return; }
    for (const st of this.#stats) { st.btn.hidden = false; if (st.sep) st.sep.hidden = false; st.item.hidden = true; }
    this.#more.hidden = true;
    const fits = (): boolean => this.scrollWidth <= this.clientWidth + 1;
    let hidden = 0;
    for (let i = this.#stats.length - 1; i > 0 && !fits(); i--) {
      const st = this.#stats[i];
      if (!st) continue;
      st.btn.hidden = true;
      if (st.sep) st.sep.hidden = true;
      st.item.hidden = false;
      hidden++;
      this.#more.hidden = false;
      this.#more.replaceChildren(`+${hidden}`, icon(UI.chevron));
      this.#more.setAttribute('aria-label', `${hidden} more counts`);
    }
    if (!hidden && this.#menu.matches(':popover-open')) this.#menu.hidePopover();
  }
}

customElements.define('rd-stat-strip', RdStatStrip);
