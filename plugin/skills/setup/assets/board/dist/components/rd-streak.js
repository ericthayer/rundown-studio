import { StoreElement } from './base.js';
import { setAttr, setText } from '../lib/dom.js';
import { streakInfo } from '../domain/projects.js';
/** Streak badge: consecutive days with Claude activity; flame color warms by tier (0–5). */
export class RdStreak extends StoreElement {
    setup() {
        const num = this.ref('n');
        this.watch(['meta', 'projects', 'day'], (_c, s) => {
            const { n, source, tier } = streakInfo(s.meta, s.projects);
            setAttr(this, 'data-tier', String(tier));
            setText(num, String(n));
            setAttr(this, 'aria-label', n ? `${n}-day streak of consecutive Claude sessions` : 'No streak yet');
            setAttr(this, 'title', n ? `${n} consecutive day${n === 1 ? '' : 's'} with activity (from ${source}).` : 'Run a session today to start a streak.');
        });
    }
}
customElements.define('rd-streak', RdStreak);
