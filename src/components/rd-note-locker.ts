import { StoreElement, emit } from './base.js';
import { LOCKER_DAYS, lockedNotes, unlockNote } from '../lib/note-locker.js';
import { dayKey } from '../lib/dates.js';
import { h, setText } from '../lib/dom.js';

function when(iso: string): string {
  const d = new Date(iso);
  return dayKey(d) === dayKey() ? 'today' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Note locker: rundown notes the viewer dismissed in the last 14 days, inside the settings popover.
 * The note still on the board can be shown again; older ones were replaced by a newer run and are read-only.
 */
export class RdNoteLocker extends StoreElement {
  #current = '';
  #list!: HTMLUListElement;
  #empty!: HTMLParagraphElement;

  protected setup(): void {
    this.#list = h('ul', { class: 'nlock-list', 'aria-labelledby': 'nlock-h' });
    this.#empty = h('p', { class: 'nlock-empty' });
    this.replaceChildren(h('h3', { class: 'nlock-h', id: 'nlock-h' }, 'Dismissed notes'), this.#list, this.#empty);
    this.watch(['meta'], (_c, s) => {
      this.#current = typeof s.meta.critique === 'string' ? s.meta.critique : '';
      this.refresh();
    });
  }

  /** Re-reads the locker (it lives in per-viewer storage, so render on open rather than on change). */
  refresh(): void {
    if (!this.#list) return;
    const notes = lockedNotes();
    this.#list.replaceChildren(...notes.map((n) => h('li', {},
      h('p', { class: 'nlock-text' }, n.text),
      h('div', { class: 'nlock-meta' },
        h('time', { datetime: n.at }, `Dismissed ${when(n.at)}`),
        n.text === this.#current
          ? h('button', { type: 'button', class: 'nlock-btn', 'data-fk': 'nlock:show', onclick: () => this.#restore(n.text) }, 'Show again')
          : h('span', {}, 'Replaced by a newer note')))));
    this.#list.hidden = !notes.length;
    setText(this.#empty, notes.length ? `Kept for ${LOCKER_DAYS} days.` : `Notes you dismiss stay here for ${LOCKER_DAYS} days.`);
  }

  #restore(text: string): void {
    unlockNote(text);
    emit(this, 'rd:note-restore', { text });
    this.refresh();
    this.closest<HTMLElement>('[popover]')?.hidePopover();
  }
}

customElements.define('rd-note-locker', RdNoteLocker);
