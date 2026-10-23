import { store } from '../store.js';

/**
 * Opens a project's row from outside the list (a toast, the weekly plan): clears filters so the row
 * is shown, expands it, and moves focus to it, since the control that asked is usually gone or elsewhere.
 */
export function reveal(id: string): void {
  store.set({ openId: id, filter: 'all', query: '' });
  document.dispatchEvent(new CustomEvent('rd:reveal-project', { detail: { id } }));
  document.querySelector<HTMLElement>(`[data-fk="row:${CSS.escape(id)}"]`)?.focus();
}
