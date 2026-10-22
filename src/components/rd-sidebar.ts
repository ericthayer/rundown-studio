import type { Project, RailFilter } from '../types.js';
import { StoreElement } from './base.js';
import { store } from '../store.js';
import { prefs } from '../lib/prefs.js';
import { ICON } from '../lib/icons.js';
import { copyCommand, h, icon, setAttr, setText } from '../lib/dom.js';
import { needsYou } from '../domain/projects.js';

type NavKey = Extract<RailFilter, keyof typeof ICON>;
const VIEWS: readonly [NavKey, string][] = [['all', 'Home'], ['needs', 'Needs you'], ['blocked', 'Blocked'], ['stale', 'Stale'], ['parked', 'Parked']];
const AREAS: readonly [NavKey, string][] = [['work', 'Work'], ['client', 'Client'], ['personal', 'Personal']];

const BADGE: Partial<Record<NavKey, (p: Project) => boolean>> = {
  needs: needsYou,
  blocked: (p) => p.state === 'blocked',
};

interface NavRefs { btn: HTMLButtonElement; badge: HTMLSpanElement; label: string }

/** Left rail: view + area filters, slim (icon-only) mode, account footer. */
export class RdSidebar extends StoreElement {
  #items = new Map<NavKey, NavRefs>();

  protected setup(): void {
    const build = ([key, label]: readonly [NavKey, string]): HTMLButtonElement => {
      const badge = h('span', { class: 'badge num', hidden: true });
      const btn = h('button', { class: 'navb', type: 'button', 'data-fk': `nav:${key}`, 'data-tip': label, 'aria-pressed': 'false', onclick: () => store.set({ filter: key }) },
        icon(ICON[key]), h('span', { class: 'lbl' }, label), badge);
      this.#items.set(key, { btn, badge, label });
      return btn;
    };
    this.ref('nav').replaceChildren(...VIEWS.map(build));
    this.ref('areas').replaceChildren(...AREAS.map(build));

    this.watch(['projects', 'filter', 'day'], (_c, s) => {
      for (const [key, { btn, badge, label }] of this.#items) {
        setAttr(btn, 'aria-pressed', String(s.filter === key));
        const test = BADGE[key];
        const n = test ? s.projects.filter(test).length : 0;
        badge.hidden = !n;
        setText(badge, String(n));
        setAttr(btn, 'data-tip', n ? `${label} (${n})` : label);
      }
    });
    this.watch(['meta'], (_c, s) => setText(this.ref('run'), s.meta.nextRun ? `Next run ${s.meta.nextRun}` : 'Mon & Fri, 3:16am'));

    this.#setupAreas();
    this.#setupSlim();
    const copy = this.ref<HTMLButtonElement>('copy');
    copy.addEventListener('click', () => void copyCommand(this.ref('copy-label'), 'Copy command'));
  }

  #setupAreas(): void {
    const sec = this.ref<HTMLButtonElement>('sec');
    const apply = (open: boolean): void => {
      sec.setAttribute('aria-expanded', String(open));
      this.closest('.shell')?.classList.toggle('hide-areas', !open);
    };
    apply(prefs.get('areasOpen'));
    sec.addEventListener('click', () => {
      const open = sec.getAttribute('aria-expanded') !== 'true';
      prefs.set('areasOpen', open);
      apply(open);
    });
  }

  #setupSlim(): void {
    const btn = this.ref<HTMLButtonElement>('slim');
    const shell = this.closest('.shell');
    const apply = (on: boolean): void => {
      shell?.classList.toggle('slim', on);
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', on ? 'Expand sidebar' : 'Collapse sidebar');
    };
    apply(prefs.get('slim'));
    btn.addEventListener('click', () => {
      const on = !shell?.classList.contains('slim');
      prefs.set('slim', on);
      apply(on);
    });
  }
}

customElements.define('rd-sidebar', RdSidebar);
