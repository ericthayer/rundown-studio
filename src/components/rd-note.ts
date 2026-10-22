import { StoreElement } from './base.js';
import { prefs } from '../lib/prefs.js';
import { setText } from '../lib/dom.js';

/** Rundown note: info alert under the toolbar. Dismissal is remembered for that exact note text. */
export class RdNote extends StoreElement {
  protected setup(): void {
    const text = this.ref('text');
    let current = '';
    this.watch(['meta'], (_c, s) => {
      current = typeof s.meta.critique === 'string' ? s.meta.critique : '';
      this.hidden = !current || prefs.get('noteDismissed') === current;
      setText(text, current);
    });
    this.ref('dismiss').addEventListener('click', () => {
      prefs.set('noteDismissed', current);
      this.hidden = true;
    });
  }
}

customElements.define('rd-note', RdNote);
