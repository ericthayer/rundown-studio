/**
 * Touch gestures. Each one is a shortcut for a control that already exists (close button, Escape,
 * view tabs), so nothing depends on a path-based gesture (WCAG 2.2 SC 2.5.1, 2.5.7).
 */

export type DismissAxis = 'down' | 'right';

export interface DragDismissOptions {
  /** The part the finger grabs (a sheet header). */
  handle: HTMLElement;
  /** The part that follows the finger (the sheet). */
  target: HTMLElement;
  /** Direction that dismisses, or null when the gesture doesn't apply (e.g. wide layout). */
  axis: () => DismissAxis | null;
  onDismiss: () => void;
}

const INTERACTIVE = 'button, a, input, select, textarea, [role="separator"]';
const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Drag a sheet by its header to dismiss it; a short or slow drag springs back. */
export function dragToDismiss({ handle, target, axis, onDismiss }: DragDismissOptions): void {
  handle.addEventListener('pointerdown', (e) => {
    const dir = axis();
    if (!dir || e.pointerType === 'mouse' || !e.isPrimary || (e.target as Element).closest(INTERACTIVE)) return;
    const start = dir === 'down' ? e.clientY : e.clientX;
    const size = dir === 'down' ? target.offsetHeight : target.offsetWidth;
    const t0 = performance.now();
    let dist = 0;
    handle.setPointerCapture(e.pointerId);
    target.style.transition = 'none';
    const move = (ev: PointerEvent): void => {
      dist = Math.max(0, (dir === 'down' ? ev.clientY : ev.clientX) - start);
      if (!reducedMotion()) target.style.transform = dir === 'down' ? `translateY(${dist}px)` : `translateX(${dist}px)`;
    };
    const end = (ev: PointerEvent): void => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      const fast = dist / Math.max(1, performance.now() - t0) > 0.5;
      const commit = ev.type === 'pointerup' && dist > 24 && (dist > size * 0.25 || fast);
      // Clear the inline styles in the same frame so the sheet's own transition carries it home or away.
      target.style.transition = '';
      target.style.transform = '';
      if (commit) onDismiss();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  });
}

export interface SwipeOptions {
  /** Ignore swipes that start this close to the screen edge (the browser's own back/forward). */
  edge?: number;
  /** Minimum horizontal travel in px. */
  min?: number;
}

/** Horizontal touch swipe on a vertically scrolling surface. `dir` is 1 for a swipe left (next), -1 for right (previous). */
export function onSwipe(el: HTMLElement, cb: (dir: 1 | -1) => void, { edge = 24, min = 64 }: SwipeOptions = {}): void {
  el.style.touchAction = 'pan-y';
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || !e.isPrimary || e.clientX < edge || e.clientX > innerWidth - edge) return;
    if ((e.target as Element).closest('input, select, textarea, dialog, [role="separator"]')) return;
    const x0 = e.clientX, y0 = e.clientY, t0 = performance.now();
    const up = (ev: PointerEvent): void => {
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (Math.abs(dx) >= min && Math.abs(dx) > 2 * Math.abs(dy) && performance.now() - t0 < 700) cb(dx < 0 ? 1 : -1);
    };
    const cancel = (): void => {
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
  });
}
