import { StoreElement } from './base.js';
import { prefs } from '../lib/prefs.js';
import { lockNote } from '../lib/note-locker.js';
import { setText } from '../lib/dom.js';

/** Rundown note: info alert under the toolbar. Dismissing hides that exact text and keeps it in the note locker (settings). */
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
      lockNote(current);
      this.hidden = true;
    });
    this.listen(document, 'rd:note-restore', (e) => {
      if ((e as CustomEvent<{ text: string }>).detail.text === current) this.hidden = false;
    });
  }
}

customElements.define('rd-note', RdNote);
