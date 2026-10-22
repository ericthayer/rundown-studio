import type { RailFilter } from '../types.js';
import { store } from '../store.js';
import { VIEWS } from '../components/rd-sidebar.js';
import { onSwipe } from './gestures.js';

/**
 * Swipe the project list sideways to step through the views (Home, Needs you, Decisions …),
 * in tab order. The view tabs above the list do the same by tap or keyboard.
 */
export function initViewSwipe(surface: HTMLElement): void {
  const order: readonly RailFilter[] = VIEWS.map(([key]) => key);
  onSwipe(surface, (dir) => {
    const at = order.indexOf(store.state.filter);
    const next = order[at === -1 ? 0 : Math.min(order.length - 1, Math.max(0, at + dir))];
    if (!next || next === store.state.filter) return;
    surface.dataset.swipe = dir === 1 ? 'next' : 'prev';
    store.set({ filter: next });
    surface.addEventListener('animationend', () => { delete surface.dataset.swipe; }, { once: true });
    window.setTimeout(() => { delete surface.dataset.swipe; }, 400);
  });
}
