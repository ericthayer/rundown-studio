import type { LockedNote } from '../types.js';
import { StoreElement } from './base.js';
import { store } from '../store.js';
import { LOCKER_DAYS, unlockNote } from '../lib/note-locker.js';
import { dayKey } from '../lib/dates.js';
import { h, setText } from '../lib/dom.js';

function when(iso: string): string {
  const d = new Date(iso);
  return dayKey(d) === dayKey() ? 'today' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Note locker: rundown notes dismissed in the last 14 days, synced on the board, inside the settings popover.
 * The note still on the board can be shown again; older ones were replaced by a newer run and are read-only.
 */
export class RdNoteLocker extends StoreElement {
  protected setup(): void {
    const list = h('ul', { class: 'nlock-list', 'aria-labelledby': 'nlock-h' });
    const empty = h('p', { class: 'nlock-empty' });
    this.replaceChildren(h('h3', { class: 'nlock-h', id: 'nlock-h' }, 'Dismissed notes'), list, empty);
    this.watch(['meta', 'notes', 'day'], (_c, s) => {
      const current = typeof s.meta.critique === 'string' ? s.meta.critique : '';
      const notes: readonly LockedNote[] = s.notes ?? [];
      list.replaceChildren(...notes.map((n) => h('li', {},
        h('p', { class: 'nlock-text' }, n.text),
        h('div', { class: 'nlock-meta' },
          h('time', { datetime: n.savedAt }, `Dismissed ${when(n.savedAt)}`),
          n.text === current
            ? h('button', { type: 'button', class: 'nlock-btn', 'data-fk': 'nlock:show', onclick: () => this.#restore(n.text) }, 'Show again')
            : h('span', {}, 'Replaced by a newer note')))));
      list.hidden = !notes.length;
      setText(empty, notes.length ? `Kept for ${LOCKER_DAYS} days, on every device.` : `Notes you dismiss stay here for ${LOCKER_DAYS} days.`);
    });
  }

  #restore(text: string): void {
    this.closest<HTMLElement>('[popover]')?.hidePopover();
    // Optimistic: the banner comes back now; the db snapshot confirms it.
    store.set({ notes: (store.state.notes ?? []).filter((n) => n.text !== text) });
    void unlockNote(text);
  }
}

customElements.define('rd-note-locker', RdNoteLocker);
