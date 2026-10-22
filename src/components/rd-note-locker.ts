import type { LockedNote } from '../types.js';
import { StoreElement } from './base.js';
import { store } from '../store.js';
import { LOCKER_DAYS, saveAnswer, unlockNote } from '../lib/note-locker.js';
import { dayKey } from '../lib/dates.js';
import { h, setText } from '../lib/dom.js';

function when(iso: string): string {
  const d = new Date(iso);
  return dayKey(d) === dayKey() ? 'today' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Locker, synced on the board, inside the settings popover: rundown notes dismissed in the last 14 days
 * and Ask Rundown answers saved here. The note still on the board can be shown again; older ones were
 * replaced by a newer run and are read-only. Saved answers stay until removed.
 */
export class RdNoteLocker extends StoreElement {
  protected setup(): void {
    const list = h('ul', { class: 'nlock-list', 'aria-labelledby': 'nlock-h' });
    const empty = h('p', { class: 'nlock-empty' });
    this.replaceChildren(h('h3', { class: 'nlock-h', id: 'nlock-h' }, 'Locker'), list, empty);
    this.watch(['meta', 'notes', 'day'], (_c, s) => {
      const current = typeof s.meta.critique === 'string' ? s.meta.critique : '';
      const notes: readonly LockedNote[] = (s.notes ?? []).filter((n) => n.inLocker);
      list.replaceChildren(...notes.map((n) => h('li', {},
        n.question ? h('p', { class: 'nlock-q' }, n.question) : null,
        h('p', { class: 'nlock-text' }, n.text),
        h('div', { class: 'nlock-meta' },
          h('time', { datetime: n.savedAt }, `${n.kind === 'answer' ? 'Saved' : 'Dismissed'} ${when(n.savedAt)}`),
          n.kind === 'answer'
            ? h('button', { type: 'button', class: 'nlock-btn', 'data-fk': `nlock:rm:${n.id}`, 'aria-label': 'Remove this answer from the Locker', onclick: () => void saveAnswer(n.question ?? '', n.text, { inLocker: false, projectId: n.projectId }, n) }, 'Remove')
            : n.text === current
              ? h('button', { type: 'button', class: 'nlock-btn', 'data-fk': 'nlock:show', onclick: () => this.#restore(n.text) }, 'Show again')
              : h('span', {}, 'Replaced by a newer note')))));
      list.hidden = !notes.length;
      setText(empty, notes.length ? `Notes stay ${LOCKER_DAYS} days, saved answers until you remove them, on every device.` : `Notes you dismiss stay here for ${LOCKER_DAYS} days. Answers you save stay until you remove them.`);
    });
  }

  #restore(text: string): void {
    this.closest<HTMLElement>('[popover]')?.hidePopover();
    // Optimistic: the banner comes back now; the db snapshot confirms it.
    store.set({ notes: (store.state.notes ?? []).filter((n) => n.kind !== 'note' || n.text !== text) });
    void unlockNote(text);
  }
}

customElements.define('rd-note-locker', RdNoteLocker);
