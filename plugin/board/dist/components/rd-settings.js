import { StoreElement } from './base.js';
import { prefs } from '../lib/prefs.js';
import { applyTheme } from '../lib/theme.js';
import { THEME } from '../lib/icons.js';
import { h, icon, placeAbove, placeUnder } from '../lib/dom.js';
import './rd-note-locker.js';
const MODES = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];
/** Account settings popover next to the viewer's name. Holds per-viewer preferences (color mode) and the note locker. */
export class RdSettings extends StoreElement {
    setup() {
        const btn = this.ref('btn');
        const pop = this.ref('pop');
        const current = prefs.get('theme');
        const locker = document.createElement('rd-note-locker');
        locker.className = 'nlock';
        pop.replaceChildren(h('fieldset', { class: 'fset' }, h('legend', {}, 'Color mode'), MODES.map(([value, label]) => h('label', { class: 'fopt' }, h('input', { type: 'radio', name: 'theme', value, checked: value === current, 'data-fk': `theme:${value}`, onchange: () => this.#set(value) }), icon(THEME[value]), label))), locker);
        pop.addEventListener('toggle', (e) => {
            const open = e.newState === 'open';
            btn.setAttribute('aria-expanded', String(open));
            // Footer gear (desktop) opens upward; the top-bar gear (phones) opens downward.
            if (open)
                (btn.getBoundingClientRect().top < innerHeight / 2 ? placeUnder : placeAbove)(btn, pop);
        });
        this.listen(window, 'resize', () => { if (pop.matches(':popover-open'))
            pop.hidePopover(); });
    }
    #set(mode) {
        prefs.set('theme', mode);
        applyTheme(mode);
    }
}
customElements.define('rd-settings', RdSettings);
