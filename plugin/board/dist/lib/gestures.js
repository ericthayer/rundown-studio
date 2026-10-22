/**
 * Touch gestures. Each one is a shortcut for a control that already exists (close button, Escape,
 * view tabs), so nothing depends on a path-based gesture (WCAG 2.2 SC 2.5.1, 2.5.7).
 */
const INTERACTIVE = 'button, a, input, select, textarea, [role="separator"]';
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Drag a sheet by its header to dismiss it; a short or slow drag springs back. */
export function dragToDismiss({ handle, target, axis, onDismiss }) {
    handle.addEventListener('pointerdown', (e) => {
        const dir = axis();
        if (!dir || e.pointerType === 'mouse' || !e.isPrimary || e.target.closest(INTERACTIVE))
            return;
        const start = dir === 'down' ? e.clientY : e.clientX;
        const size = dir === 'down' ? target.offsetHeight : target.offsetWidth;
        const t0 = performance.now();
        let dist = 0;
        handle.setPointerCapture(e.pointerId);
        target.style.transition = 'none';
        const move = (ev) => {
            dist = Math.max(0, (dir === 'down' ? ev.clientY : ev.clientX) - start);
            if (!reducedMotion())
                target.style.transform = dir === 'down' ? `translateY(${dist}px)` : `translateX(${dist}px)`;
        };
        const end = (ev) => {
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', end);
            handle.removeEventListener('pointercancel', end);
            const fast = dist / Math.max(1, performance.now() - t0) > 0.5;
            const commit = ev.type === 'pointerup' && dist > 24 && (dist > size * 0.25 || fast);
            // Clear the inline styles in the same frame so the sheet's own transition carries it home or away.
            target.style.transition = '';
            target.style.transform = '';
            if (commit)
                onDismiss();
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
    });
}
/** Horizontal touch swipe on a vertically scrolling surface. `dir` is 1 for a swipe left (next), -1 for right (previous). */
export function onSwipe(el, cb, { edge = 24, min = 64 } = {}) {
    el.style.touchAction = 'pan-y';
    el.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'touch' || !e.isPrimary || e.clientX < edge || e.clientX > innerWidth - edge)
            return;
        if (e.target.closest('input, select, textarea, dialog, [role="separator"]'))
            return;
        const x0 = e.clientX, y0 = e.clientY, t0 = performance.now();
        const up = (ev) => {
            el.removeEventListener('pointerup', up);
            el.removeEventListener('pointercancel', cancel);
            const dx = ev.clientX - x0, dy = ev.clientY - y0;
            if (Math.abs(dx) >= min && Math.abs(dx) > 2 * Math.abs(dy) && performance.now() - t0 < 700)
                cb(dx < 0 ? 1 : -1);
        };
        const cancel = () => {
            el.removeEventListener('pointerup', up);
            el.removeEventListener('pointercancel', cancel);
        };
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', cancel);
    });
}
