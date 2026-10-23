import { StoreElement } from './base.js';
import { prefs } from '../lib/prefs.js';
import { setAttr, setText } from '../lib/dom.js';
import { stalledView } from '../domain/nudges.js';
/**
 * This week | Stalled, under Top priorities. ARIA tabs with automatic activation: arrows, Home and End
 * move between tabs, and only the selected tab is in the tab order. The choice is remembered per browser.
 */
export class RdPanelTabs extends StoreElement {
    #tabs = [];
    setup() {
        this.#tabs = [...this.querySelectorAll('[role="tab"]')];
        this.#tabs.forEach((t) => t.addEventListener('click', () => this.select(t.dataset.tab)));
        this.ref('list').addEventListener('keydown', (e) => this.#key(e));
        // Without a row to jump to, focus lands on the Stalled tab itself.
        this.listen(document, 'rd:show-stalled', (e) => this.select('stalled', !e.detail?.id));
        this.select(prefs.get('panelTab') === 'stalled' ? 'stalled' : 'week', false);
        this.watch(['rows', 'nudges'], (_c, s) => {
            const n = stalledView(s.rows, s.nudges).count;
            const badge = this.ref('count');
            badge.hidden = !n;
            setText(badge, String(n));
            setAttr(this.ref('tab-stalled'), 'aria-label', n ? `Stalled, ${n} need a next step` : 'Stalled');
        });
    }
    select(tab, focus = true) {
        prefs.set('panelTab', tab);
        for (const t of this.#tabs) {
            const on = t.dataset.tab === tab;
            setAttr(t, 'aria-selected', String(on));
            t.tabIndex = on ? 0 : -1;
            const panel = document.getElementById(t.getAttribute('aria-controls') ?? '');
            if (panel)
                panel.hidden = !on;
            if (on && focus)
                t.focus();
        }
    }
    #key(e) {
        const i = this.#tabs.findIndex((t) => t === document.activeElement);
        if (i < 0)
            return;
        const n = this.#tabs.length;
        const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
        if (to === undefined)
            return;
        e.preventDefault();
        this.select(this.#tabs[to]?.dataset.tab);
    }
}
customElements.define('rd-panel-tabs', RdPanelTabs);
