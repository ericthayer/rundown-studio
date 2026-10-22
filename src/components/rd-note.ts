import { StoreElement } from './base.js';
import { isDismissed, lockNote } from '../lib/note-locker.js';
import { setText } from '../lib/dom.js';

/** Rundown note: info alert under the toolbar. Dismissing keeps that exact text in the note locker on the board (settings). */
export class RdNote extends StoreElement {
  protected setup(): void {
    const text = this.ref('text');
    let current = '';
    this.watch(['meta', 'notes'], (_c, s) => {
      current = typeof s.meta.critique === 'string' ? s.meta.critique : '';
      // Wait for the locker so a dismissed note doesn't flash on load.
      this.hidden = !current || s.notes === null || isDismissed(current, s.notes);
      setText(text, current);
    });
    this.ref('dismiss').addEventListener('click', () => {
      this.hidden = true;
      void lockNote(current);
    });
  }
}

customElements.define('rd-note', RdNote);
