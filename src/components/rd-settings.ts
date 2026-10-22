import type { ThemeMode } from '../types.js';
import { StoreElement } from './base.js';
import { prefs } from '../lib/prefs.js';
import { applyTheme } from '../lib/theme.js';
import { THEME, UI } from '../lib/icons.js';
import { feedbackHref, issuesHref } from '../lib/config.js';
import { startTour } from '../lib/onboarding.js';
import { h, icon, placeAbove, placeUnder, setAttr } from '../lib/dom.js';
import './rd-note-locker.js';

const MODES: readonly [ThemeMode, string][] = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];

/** Account settings popover next to the viewer's name: color mode, the note locker, and Help (tour replay, feedback, issues). */
export class RdSettings extends StoreElement {
  protected setup(): void {
    const btn = this.ref<HTMLButtonElement>('btn');
    const pop = this.ref('pop');
    const current = prefs.get('theme');
    const locker = document.createElement('rd-note-locker');
    locker.className = 'nlock';
    pop.replaceChildren(h('fieldset', { class: 'fset' }, h('legend', {}, 'Color mode'),
      MODES.map(([value, label]) => h('label', { class: 'fopt' },
        h('input', { type: 'radio', name: 'theme', value, checked: value === current, 'data-fk': `theme:${value}`, onchange: () => this.#set(value) }),
        icon(THEME[value]), label))), locker, this.#help(btn, pop));
    pop.addEventListener('toggle', (e) => {
      const open = (e as ToggleEvent).newState === 'open';
      btn.setAttribute('aria-expanded', String(open));
      // Footer gear (desktop) opens upward; the top-bar gear (phones) opens downward.
      if (open) (btn.getBoundingClientRect().top < innerHeight / 2 ? placeUnder : placeAbove)(btn, pop);
    });
    this.listen(window, 'resize', () => { if (pop.matches(':popover-open')) pop.hidePopover(); });
  }

  /** Tour replay and feedback links. Link targets come from `meta/config` when set, so they're refreshed on config changes. */
  #help(btn: HTMLButtonElement, pop: HTMLElement): HTMLElement {
    const tour = h('button', { class: 'fopt', type: 'button', 'data-fk': 'help:tour', onclick: () => { pop.hidePopover(); void startTour(btn); } }, icon(UI.tour), 'Take the tour');
    const mail = h('a', { class: 'fopt', 'data-fk': 'help:feedback' }, icon(UI.mail), 'Send feedback');
    const issue = h('a', { class: 'fopt', target: '_blank', rel: 'noopener noreferrer', 'data-fk': 'help:issue' }, icon(UI.bug), 'Report an issue', h('span', { class: 'sr' }, ' (opens in a new tab)'));
    this.watch(['config'], () => { setAttr(mail, 'href', feedbackHref()); setAttr(issue, 'href', issuesHref()); });
    return h('fieldset', { class: 'fset fhelp' }, h('legend', {}, 'Help'), tour, mail, issue);
  }

  #set(mode: ThemeMode): void {
    prefs.set('theme', mode);
    applyTheme(mode);
  }
}

customElements.define('rd-settings', RdSettings);
